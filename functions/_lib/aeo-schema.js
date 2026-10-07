// functions/_lib/aeo-schema.js
//
// Serve-time AEO normalization for KV-served HTML pages.
//
// Why serve-time: page HTML lives in Workers KV (BLOBS_MARKCMO_PAGES_HTML) and
// has been edited in KV directly for months, so the repo copies of the ~28k
// .html files are stale. Fixing the markup at the one code path every page
// flows through (functions/[[path]].js) fixes every page type with one change
// and never ships stale HTML.
//
// What it does (each step is independent and fails closed to "no change"):
//
// 1. FAQPage schema is DERIVED FROM THE VISIBLE FAQ.
//    Many pages ship a FAQPage block whose questions appear nowhere on the page
//    (the homepage carried 20 such Q&As; city pages 4-6 with only 1-2 visible).
//    Those hidden answers make claims nobody approved for display, so the fix
//    direction is: the visible FAQ is the source of truth, the schema mirrors it
//    1:1 (same questions, same answers, same order). Hidden Q&As are dropped,
//    never rendered. If a page has no visible FAQ, its FAQPage entity is removed.
//
//    Eligibility gate: before rewriting, every schema question that IS rendered
//    as an element on the page must have been captured by the extractor. If a
//    rendered question was missed (an FAQ markup family this extractor does not
//    know), the page is left untouched rather than losing valid Q&As.
//
// 2. Speakable. Pages without a speakable spec get WebPage.speakable pointing at
//    the H1 and the answer-first paragraph (the first substantive <p> after the
//    H1, tagged with the data-speakable attribute the site already uses).
//
// 3. Title / meta description length. Titles over 65 chars are shortened at a
//    natural separator (never by inventing copy); descriptions over 165 chars
//    drop a middle sentence (truncated generator sentences first) or cut at a
//    clause boundary. Short titles/descriptions are left alone: lengthening them
//    needs real copy. The homepage is excluded (locked, see CLAUDE.md).
//
// Kill switch: env AEO_SCHEMA = "off" disables everything.

const Q_CLASSES = new Set(['sp-faq-q', 'faq-q', 'faq-question']);
const A_CLASSES = new Set(['sp-faq-a', 'faq-a', 'faq-answer']);
const ITEM_CLASSES = new Set(['faq-item']);
const QWORD = /^(what|how|why|when|where|who|which|can|do|does|did|is|are|should|will|would|could|has|have)\b/i;

const NAMED = {
  amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', rsquo: "'", lsquo: "'",
  ldquo: '"', rdquo: '"', hellip: '...', middot: '·', bull: '•', trade: '™',
  reg: '®', copy: '©', ndash: '-', mdash: '-', rarr: '→', larr: '←',
  times: '×', deg: '°', frac12: '1/2', frac14: '1/4', frac34: '3/4', eacute: 'é',
};

// En dash (U+2013) and em dash (U+2014), built from char codes so this file
// itself contains neither character (house rule).
const DASH_RE = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']', 'g');

export function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z][a-z0-9]*);/gi, (m, n) => (n.toLowerCase() in NAMED ? NAMED[n.toLowerCase()] : m))
    // House rule: no en/em dashes in anything we emit.
    .replace(DASH_RE, '-');
}

export function textOf(html) {
  return decodeEntities(String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

export function norm(s) {
  return decodeEntities(String(s)).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const wordCount = s => (String(s).match(/\S+/g) || []).length;

function classTokens(attrs) {
  const m = attrs.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  return m ? (m[1] != null ? m[1] : m[2]).split(/\s+/).filter(Boolean) : [];
}

// Index just past the element that opens at `start` (balanced on same tag name).
const TAG_RE = new Map();
function elementEnd(html, start, tag) {
  let re = TAG_RE.get(tag);
  if (!re) { re = new RegExp('<(/?)' + tag + '\\b[^>]*>', 'gi'); TAG_RE.set(tag, re); }
  re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    if (m[1]) { depth--; if (depth === 0) return re.lastIndex; }
    else if (!/\/>$/.test(m[0])) depth++;
    else if (depth === 0) return re.lastIndex;
  }
  return -1;
}

function innerOf(html, start, end) {
  const open = html.indexOf('>', start);
  const close = html.lastIndexOf('<', end - 1);
  return open === -1 || close <= open ? '' : html.slice(open + 1, close);
}

// Accordion toggles sit inside the question element: <span>+</span>, chevrons.
function cleanQuestion(qHtml) {
  const noToggle = String(qHtml).replace(/<(span|i|svg)\b[^>]*>\s*(?:[+−×▾▸›»⌄˅vV-]|&plus;|&minus;|&times;|&#43;)?\s*<\/\1>/gi, ' ');
  return textOf(noToggle).replace(/\s*[+−×▾▸›»]\s*$/, '').trim();
}

const looksLikeQuestion = q => /\?\s*$/.test(q) || QWORD.test(q);

// Blank out script/style/comment bodies (same length, so indexes still line up
// with the original string).
function maskNonContent(html) {
  return html.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->|<noscript\b[\s\S]*?<\/noscript>|<template\b[\s\S]*?<\/template>/gi,
    m => ' '.repeat(m.length));
}

// Extract the FAQ a reader actually sees. Families handled:
//   A. .sp-faq-q / .faq-q / .faq-question  + next .sp-faq-a / .faq-a / .faq-answer
//      (or, when no answer class exists, the next sibling <p> / <div>)
//   B. <details><summary>Q</summary> answer </details>
//   C. .faq-item > h2-h5 question + the rest of the item as answer
export function extractVisibleFaq(html, maskedBody) {
  const body = maskedBody || maskNonContent(html);
  const items = [];
  const openRe = /<([a-z][a-z0-9]*)\b([^>]*)>/gi;
  const opens = [];
  let m;
  while ((m = openRe.exec(body))) opens.push({ tag: m[1].toLowerCase(), attrs: m[2], start: m.index, endOpen: openRe.lastIndex, cls: classTokens(m[2]) });
  // index of the first opening tag at or after pos (opens is sorted by start)
  const firstAt = pos => { let lo = 0, hi = opens.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (opens[mid].start < pos) lo = mid + 1; else hi = mid; } return lo; };

  const qOpens = opens.filter(o => o.cls.some(c => Q_CLASSES.has(c)));
  // Family A
  for (let i = 0; i < qOpens.length; i++) {
    const q = qOpens[i];
    const qEnd = elementEnd(body, q.start, q.tag);
    if (qEnd < 0) continue;
    const limit = i + 1 < qOpens.length ? qOpens[i + 1].start : body.length;
    let ans = null;
    for (let k = firstAt(qEnd); k < opens.length && opens[k].start < limit; k++) {
      if (opens[k].cls.some(c => A_CLASSES.has(c))) { ans = opens[k]; break; }
    }
    if (!ans) {
      // div.faq-q + p : the immediately following element
      const next = opens[firstAt(qEnd)];
      if (next && /^\s*$/.test(body.slice(qEnd, next.start)) && (next.tag === 'p' || next.tag === 'div') && next.start < limit) ans = next;
    }
    if (!ans) { items.push({ pos: q.start, q: cleanQuestion(innerOf(body, q.start, qEnd)), a: '' }); continue; }
    const aEnd = elementEnd(body, ans.start, ans.tag);
    if (aEnd < 0) continue;
    items.push({ pos: q.start, q: cleanQuestion(innerOf(body, q.start, qEnd)), a: textOf(innerOf(body, ans.start, aEnd)) });
  }

  // Family B
  for (const d of opens.filter(o => o.tag === 'details')) {
    const dEnd = elementEnd(body, d.start, 'details');
    if (dEnd < 0) continue;
    const inner = innerOf(body, d.start, dEnd);
    const sm = inner.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i);
    if (!sm) continue;
    const q = cleanQuestion(sm[1]);
    if (!looksLikeQuestion(q)) continue;
    // nested <details> inside a details answer are rare; take the text after </summary>
    const a = textOf(inner.slice(sm.index + sm[0].length));
    items.push({ pos: d.start, q, a });
  }

  // Family C
  for (const it of opens.filter(o => o.cls.some(c => ITEM_CLASSES.has(c)))) {
    const iEnd = elementEnd(body, it.start, it.tag);
    if (iEnd < 0) continue;
    const inner = innerOf(body, it.start, iEnd);
    if (/<details\b/i.test(inner) || [...Q_CLASSES].some(c => inner.includes(c))) continue;
    const hm = inner.match(/<(h[2-5])\b[^>]*>([\s\S]*?)<\/\1>/i);
    if (!hm) continue;
    const q = cleanQuestion(hm[2]);
    if (!looksLikeQuestion(q)) continue;
    items.push({ pos: it.start, q, a: textOf(inner.slice(hm.index + hm[0].length)) });
  }

  // Family D: inline Q&A inside a section whose heading says it is an FAQ
  // ("Shopify expert FAQ", "Frequently Asked Questions", "Contract questions,
  // answered"): <h3>Q?</h3><p>A</p> or <p><strong>Q?</strong></p><p>A</p>.
  // The answer is the run of <p>/<ul>/<ol> right after the question.
  const taken = new Set(items.map(it => it.pos));
  const inTaken = pos => taken.has(pos);
  const headRe = /<(h[2-4])\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const FAQ_HEAD = /\bfaqs?\b|frequently asked|questions?,? answered|questions this section answers|common questions/i;
  let hm2;
  while ((hm2 = headRe.exec(body))) {
    if (!FAQ_HEAD.test(textOf(hm2[2]))) continue;
    const level = +hm2[1][1];
    const regionStart = headRe.lastIndex;
    const stopRe = new RegExp('<h[1-' + level + ']\\b|<footer\\b', 'i');
    const stop = body.slice(regionStart).search(stopRe);
    const regionEnd = stop < 0 ? body.length : regionStart + stop;
    for (let k = firstAt(regionStart); k < opens.length && opens[k].start < regionEnd; k++) {
      const o = opens[k];
      if (inTaken(o.start)) continue;
      if (!/^(h[3-6]|p)$/.test(o.tag)) continue;
      const qEnd = elementEnd(body, o.start, o.tag);
      if (qEnd < 0 || qEnd > regionEnd) continue;
      const qInner = innerOf(body, o.start, qEnd);
      const q = cleanQuestion(qInner);
      if (!/\?\s*$/.test(q) || q.length > 200) continue;
      if (o.tag === 'p' && !/^\s*<(strong|b)\b[^>]*>[\s\S]*<\/\1>\s*$/i.test(qInner) && !/font-weight\s*:\s*(6|7|8|9)00|font-weight\s*:\s*bold/i.test(o.attrs)) continue;
      // answer run
      let at = qEnd, ans = '';
      for (;;) {
        const next = opens[firstAt(at)];
        if (!next || next.start >= regionEnd || !/^\s*$/.test(body.slice(at, next.start))) break;
        if (!/^(p|ul|ol)$/.test(next.tag)) break;
        const e = elementEnd(body, next.start, next.tag);
        if (e < 0 || e > regionEnd) break;
        const t = textOf(innerOf(body, next.start, e));
        if (next.tag === 'p' && /\?\s*$/.test(t) && t.length <= 200) break; // next question
        ans += (ans ? ' ' : '') + t;
        at = e;
      }
      if (wordCount(ans) >= 3) items.push({ pos: o.start, q, a: ans });
    }
  }

  items.sort((x, y) => x.pos - y.pos);
  const seen = new Set();
  return items.filter(it => {
    const k = norm(it.q);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Normalized text of every short element on the page, built once per page.
// A question "is rendered as an element" when some element's full text is it.
function elementTexts(maskedBody) {
  const out = new Set();
  const re = /<(h[1-6]|summary|button|dt|strong|b|span|div|p|li|a|label)\b[^>]*>([^]{8,400}?)<\/\1>/gi;
  let m;
  while ((m = re.exec(maskedBody))) {
    const t = norm(textOf(m[2]));
    if (t.length >= 8) out.add(t);
  }
  return out;
}
function renderedAsElement(texts, qNorm) {
  if (qNorm.length < 8) return false;
  if (texts.has(qNorm)) return true;
  for (const t of texts) if (t.length - qNorm.length <= 3 && t.length > qNorm.length && t.startsWith(qNorm)) return true;
  return false;
}

// Answer counts as visible when at least half of its 6-word shingles appear in
// the page text (tolerates small wording/punctuation drift, not a different answer).
function answerIsVisible(visibleText, ans) {
  const words = norm(ans && ans.text || '').split(' ').filter(Boolean);
  if (words.length < 6) return words.length > 0 && visibleText.includes(' ' + words.join(' ') + ' ');
  let hit = 0, total = 0;
  for (let i = 0; i + 6 <= words.length; i += 3) {
    total++;
    if (visibleText.includes(' ' + words.slice(i, i + 6).join(' ') + ' ')) hit++;
  }
  return hit * 2 >= total;
}

const LD_RE =/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const isType = (node, t) => node && typeof node === 'object' && [].concat(node['@type'] || []).includes(t);
const ldStringify = obj => JSON.stringify(obj).replace(/</g, '\\u003c');

function faqNodesIn(json) {
  if (Array.isArray(json)) return json.filter(n => isType(n, 'FAQPage'));
  if (isType(json, 'FAQPage')) return [json];
  if (json && Array.isArray(json['@graph'])) return json['@graph'].filter(n => isType(n, 'FAQPage'));
  return [];
}

// Returns { html, faq: 'derived'|'removed'|'skip-gate'|'none'|'unchanged', n }
export function reconcileFaqSchema(html) {
  const blocks = [];
  let m;
  LD_RE.lastIndex = 0;
  while ((m = LD_RE.exec(html))) {
    let json = null;
    try { json = JSON.parse(m[1].trim()); } catch (_) { /* invalid blocks are left exactly as they are */ }
    blocks.push({ start: m.index, end: LD_RE.lastIndex, raw: m[0], json });
  }
  const withFaq = blocks.filter(b => b.json && faqNodesIn(b.json).length);
  if (!withFaq.length) return { html, faq: 'none', n: 0 };

  const masked = maskNonContent(html);
  const visible = extractVisibleFaq(html, masked).filter(it => it.q);
  const visibleKeys = new Set(visible.map(it => norm(it.q)));

  // Gate 1: extracted questions must all have a real answer.
  if (visible.some(it => wordCount(it.a) < 3)) return { html, faq: 'skip-gate', n: 0 };
  // Gate 2: a schema Q&A whose question is rendered as an element AND whose
  // answer text is on the page is a real, visible Q&A in a markup family this
  // extractor does not know (e.g. <h3>Q</h3><p>A</p>). Never drop those: leave
  // the page untouched.
  // Gate 3: a schema question rendered as an element when the extractor found
  // no FAQ at all means we cannot derive a replacement. Leave the page alone.
  let visibleText = null, texts = null;
  for (const b of withFaq) for (const f of faqNodesIn(b.json)) for (const q of [].concat(f.mainEntity || [])) {
    const k = norm(q && q.name || '');
    if (!k || visibleKeys.has(k)) continue;
    if (!texts) texts = elementTexts(masked);
    if (!renderedAsElement(texts, k)) continue;
    if (visibleText === null) visibleText = ' ' + norm(textOf(masked)) + ' ';
    const a = q.acceptedAnswer || q.suggestedAnswer;
    if (answerIsVisible(visibleText, [].concat(a || [])[0])) return { html, faq: 'skip-gate', n: 0 };
    if (!visible.length) return { html, faq: 'skip-gate', n: 0 };
  }

  const mainEntity = visible.map(it => ({
    '@type': 'Question',
    name: it.q,
    acceptedAnswer: { '@type': 'Answer', text: it.a },
  }));

  // Already exact? (same questions + answers, single FAQPage) -> leave bytes alone.
  const allFaq = withFaq.flatMap(b => faqNodesIn(b.json));
  if (allFaq.length === 1 && mainEntity.length) {
    const cur = [].concat(allFaq[0].mainEntity || []);
    const same = cur.length === mainEntity.length && cur.every((q, i) =>
      norm(q && q.name || '') === norm(mainEntity[i].name) &&
      norm(q && q.acceptedAnswer && q.acceptedAnswer.text || '') === norm(mainEntity[i].acceptedAnswer.text));
    if (same) return { html, faq: 'unchanged', n: mainEntity.length };
  }

  let kept = false;
  const edits = [];
  for (const b of withFaq) {
    const j = b.json;
    const keepOrDrop = node => {
      if (!kept && mainEntity.length) { node.mainEntity = mainEntity; kept = true; return true; }
      return false;
    };
    let out;
    if (Array.isArray(j)) {
      const arr = j.filter(n => !isType(n, 'FAQPage') || keepOrDrop(n));
      out = arr.length ? arr : null;
    } else if (isType(j, 'FAQPage')) {
      out = keepOrDrop(j) ? j : null;
    } else {
      j['@graph'] = j['@graph'].filter(n => !isType(n, 'FAQPage') || keepOrDrop(n));
      out = j['@graph'].length ? j : null;
    }
    const openTag = b.raw.slice(0, b.raw.indexOf('>') + 1);
    edits.push({ start: b.start, end: b.end, text: out ? openTag + ldStringify(out) + '</script>' : '' });
  }
  let res = html;
  for (const e of edits.sort((a, b) => b.start - a.start)) res = res.slice(0, e.start) + e.text + res.slice(e.end);
  return { html: res, faq: mainEntity.length ? 'derived' : 'removed', n: mainEntity.length };
}

// ── Speakable ────────────────────────────────────────────────────────────────
export function addSpeakable(html, pageUrl) {
  if (/"speakable"/i.test(html)) return { html, speakable: 'present' };
  const h1End = html.search(/<\/h1>/i);
  if (h1End < 0) return { html, speakable: 'no-h1' };
  const masked = maskNonContent(html);
  const pRe = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  pRe.lastIndex = h1End;
  let m, target = null;
  while ((m = pRe.exec(masked)) && m.index - h1End < 8000) {
    const t = textOf(m[2]);
    if (wordCount(t) >= 20 && !/^(by mark|last updated)/i.test(t)) { target = m; break; }
  }
  if (!target) return { html, speakable: 'no-answer-p' };
  let res = html;
  if (!/\bdata-speakable\b/i.test(target[1])) {
    const at = target.index + 2; // just after "<p", before its attributes
    res = res.slice(0, at) + ' data-speakable' + res.slice(at);
  }
  const spec = { '@type': 'SpeakableSpecification', cssSelector: ['h1', '[data-speakable]'] };

  // Prefer adding to the page's existing WebPage node over a second WebPage.
  LD_RE.lastIndex = 0;
  let b;
  while ((b = LD_RE.exec(res))) {
    let j;
    try { j = JSON.parse(b[1].trim()); } catch (_) { continue; }
    const nodes = Array.isArray(j) ? j : (j && Array.isArray(j['@graph']) ? j['@graph'] : [j]);
    const wp = nodes.find(n => isType(n, 'WebPage'));
    if (wp) {
      wp.speakable = spec;
      const openTag = b[0].slice(0, b[0].indexOf('>') + 1);
      res = res.slice(0, b.index) + openTag + ldStringify(j) + '</script>' + res.slice(LD_RE.lastIndex);
      return { html: res, speakable: 'added' };
    }
  }
  const node = { '@context': 'https://schema.org', '@type': 'WebPage', '@id': pageUrl + '#webpage', url: pageUrl, speakable: spec };
  const tag = '<script type="application/ld+json">' + ldStringify(node) + '</script>\n';
  const headClose = res.search(/<\/head>/i);
  if (headClose < 0) return { html, speakable: 'no-head' };
  res = res.slice(0, headClose) + tag + res.slice(headClose);
  return { html: res, speakable: 'added' };
}

// ── Title / meta description length ─────────────────────────────────────────
const escText = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const escAttr = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const trimTail = s => s.replace(/[\s|:,;&]+$/g, '').trim();

export function shortenTitle(title) {
  const t = title.replace(/\s+/g, ' ').trim();
  if (t.length <= 65) return null;
  const segs = t.split(/\s+\|\s+/);
  const brand = segs.length > 1 && /markcmo/i.test(segs[segs.length - 1]) ? segs[segs.length - 1] : null;
  const core = segs[0];
  const middle = segs.slice(1, brand ? -1 : undefined);
  const cands = [];
  for (const mid of middle) {
    cands.push(core + ' | ' + mid + (brand ? ' | ' + brand : ''), core + ' | ' + mid);
    const area = mid.match(/\bfor (?:the )?(.+?)(?: (?:Businesses|Companies|Brands))?$/i);
    if (area) cands.push(core + ' | Serving ' + area[1], core + ' | ' + area[1] + (brand ? ' | ' + brand : ''));
  }
  if (brand) cands.push(core + ' | ' + brand);
  // Natural-separator prefixes of the whole title (": ", ", ", " & ", " and ").
  const sepRe = /(\s+\|\s+|:\s+|,\s+|\s+&\s+|\s+and\s+)/g;
  let sm;
  while ((sm = sepRe.exec(t))) cands.push(t.slice(0, sm.index));
  cands.push(core);
  const clean = [...new Set(cands.map(trimTail))].filter(c => c.length >= 30 && c.length <= 65);
  if (!clean.length) return null;
  const ideal = clean.filter(c => c.length >= 50 && c.length <= 60);
  if (ideal.length) return ideal.sort((a, b) => b.length - a.length)[0];
  return clean.sort((a, b) => Math.abs(a.length - 55) - Math.abs(b.length - 55))[0];
}

export function shortenDescription(desc) {
  const d = desc.replace(/\s+/g, ' ').trim();
  if (d.length <= 165) return null;
  const sents = d.split(/(?<=[.!?])\s+(?=[A-Z0-9$])/);
  // Generator-truncated sentences ("...aerospace m.", "...silicon vall.") are
  // never kept: they read as broken copy in the snippet. The city templates cut
  // the local descriptor (the sentence right before "Free 30-min strategy call.")
  // at ~80 chars mid-word, so that slot is always treated as truncated; anywhere
  // else only a dangling 1-2 letter fragment counts.
  const SHORT_WORDS = new Set(['to', 'in', 'on', 'it', 'us', 'up', 'me', 'go', 'do', 'be', 'is', 'at', 'by', 'of', 'or', 'an', 'as', 'so', 'we', 'no', 'a', 'i']);
  const truncated = (s, i) => {
    if (i != null && /^Free 30-min strategy call\.$/i.test(sents[i + 1] || '') && s.length >= 76 && s.length <= 86) return true;
    const last = (s.match(/\s([A-Za-z]{1,2})\.$/) || [])[1];
    return s.length >= 50 && !!last && !SHORT_WORDS.has(last.toLowerCase());
  };
  const truncIdx = new Set(sents.map((s, i) => (truncated(s, i) ? i : -1)).filter(i => i >= 0));
  const hasTrunc = truncIdx.size > 0;
  if (sents.length >= 2 && sents.length <= 8 && !truncIdx.has(0)) {
    // Every order-preserving subset that keeps the first sentence; longest one
    // that fits wins. Dropping a truncated sentence may land a little under 120.
    let best = null;
    const rest = sents.length - 1;
    for (let mask = 0; mask < (1 << rest); mask++) {
      const idx = [0];
      for (let i = 0; i < rest; i++) if (mask & (1 << i)) idx.push(i + 1);
      if (idx.some(i => truncIdx.has(i))) continue;
      const out = idx.map(i => sents[i]).join(' ');
      const min = hasTrunc ? 105 : 120;
      if (out.length >= min && out.length <= 165 && (!best || out.length > best.length)) best = out;
    }
    if (best) return best;
  }
  // Clause cut: longest prefix ending at ", " or "; " that lands in 120-160.
  // A list cut short gets its last comma turned into "and" so it still reads.
  let best = null;
  const re = /[,;]\s+(?:and\s+|or\s+)?/g;
  let m;
  while ((m = re.exec(d))) {
    let cut = d.slice(0, m.index).replace(/[\s,;:]+$/, '');
    const lastSentence = cut.slice(cut.lastIndexOf('. ') + 1);
    if (/,\s/.test(lastSentence) && !/\band\b|\bor\b/.test(lastSentence.slice(lastSentence.lastIndexOf(', ')))) {
      const i = cut.lastIndexOf(', ');
      cut = cut.slice(0, i) + ' and ' + cut.slice(i + 2);
    }
    cut += '.';
    if (cut.length >= 120 && cut.length <= 160) best = cut;
  }
  return best;
}

export function normalizeMeta(html) {
  let res = html, title = 'ok', desc = 'ok';
  const tm = res.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (tm) {
    const cur = decodeEntities(tm[1]).replace(/\s+/g, ' ').trim();
    const next = shortenTitle(cur);
    if (next) {
      const open = tm[0].slice(0, tm[0].indexOf('>') + 1);
      res = res.replace(tm[0], () => open + escText(next) + '</title>');
      title = 'shortened';
    } else if (cur.length > 65) title = 'long-unfixable';
  }
  const dm = res.match(/<meta\b[^>]*\bname\s*=\s*["']description["'][^>]*>/i);
  if (dm) {
    const cm = dm[0].match(/\bcontent\s*=\s*"([^"]*)"/i);
    if (cm) {
      const cur = decodeEntities(cm[1]).replace(/\s+/g, ' ').trim();
      const next = shortenDescription(cur);
      if (next) {
        res = res.replace(dm[0], () => dm[0].replace(cm[0], () => 'content="' + escAttr(next) + '"'));
        desc = 'shortened';
      } else if (cur.length > 165) desc = 'long-unfixable';
    }
  }
  return { html: res, title, desc };
}

// ── Entry point used by functions/[[path]].js ───────────────────────────────
export function applyAeo(html, pagePath, env) {
  if (env && String(env.AEO_SCHEMA || '').toLowerCase() === 'off') return { html, report: 'off' };
  if (/<meta\b[^>]*name\s*=\s*["']robots["'][^>]*noindex/i.test(html)) return { html, report: 'noindex' };
  const pageUrl = 'https://markcmo.com/' + (pagePath === 'index' ? '' : pagePath);
  let out = html;
  const report = [];
  try {
    const f = reconcileFaqSchema(out);
    out = f.html; report.push('faq=' + f.faq + (f.n ? ':' + f.n : ''));
  } catch (e) { report.push('faq=error'); }
  try {
    const s = addSpeakable(out, pageUrl);
    out = s.html; report.push('spk=' + s.speakable);
  } catch (e) { report.push('spk=error'); }
  if (pagePath !== 'index') {
    try {
      const mt = normalizeMeta(out);
      out = mt.html; report.push('title=' + mt.title, 'desc=' + mt.desc);
    } catch (e) { report.push('meta=error'); }
  }
  return { html: out, report: report.join(';') };
}
