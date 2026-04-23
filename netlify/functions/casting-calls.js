// WETYR Film Intel - live casting-call aggregator.
// Pulls public RSS feeds from Project Casting, NYCastings, Backstage News, Casting Frontier.
// Auto-extracts location/role/rate/union from the title + summary (same regex logic as the Apify actor).
// 15-min in-memory cache. Netlify free tier: 125k invocations/month.

// Mix of dedicated casting feeds + open social/news feeds that surface real listings.
// Project Casting + Backstage are Cloudflare-protected (403 server-side) but kept in the rotation
// because cold proxies sometimes get through. Google News + Reddit do the heavy lifting.
const SOURCES = [
  { slug: 'projectcasting',  name: 'Project Casting', url: 'https://www.projectcasting.com/casting-calls-acting-auditions/feed', cat: 'scripted',  weight: 1 },
  { slug: 'nycastings',      name: 'NYCastings',      url: 'https://www.nycastings.com/feed/',                                    cat: 'scripted',  weight: 1 },
  { slug: 'backstage',       name: 'Backstage',       url: 'https://www.backstage.com/rss/',                                      cat: 'scripted',  weight: 1 },
  { slug: 'castingfrontier', name: 'Casting Frontier',url: 'https://www.castingfrontier.com/feed/',                               cat: 'commercial',weight: 1 },
  // Google News RSS - searches news indexes for fresh casting-call coverage.
  // Keep queries simple (no parens/operators) - Netlify outbound + Google News rate-limit better.
  { slug: 'gnews_film',     name: 'Google News (Film Casting)',     url: 'https://news.google.com/rss/search?q=%22casting+call%22+film&hl=en-US&gl=US&ceid=US:en',  cat: 'scripted',   weight: 2 },
  { slug: 'gnews_tv',       name: 'Google News (TV Casting)',       url: 'https://news.google.com/rss/search?q=%22casting+call%22+series&hl=en-US&gl=US&ceid=US:en',  cat: 'scripted',   weight: 2 },
  { slug: 'gnews_commercial', name: 'Google News (Commercial Casting)', url: 'https://news.google.com/rss/search?q=%22casting+call%22+commercial&hl=en-US&gl=US&ceid=US:en', cat: 'commercial', weight: 2 },
  { slug: 'gnews_brand',     name: 'Google News (Brand Spots)',       url: 'https://news.google.com/rss/search?q=%22casting+call%22+brand&hl=en-US&gl=US&ceid=US:en', cat: 'commercial', weight: 2 },
  { slug: 'gnews_extras',    name: 'Google News (Extras / Background)', url: 'https://news.google.com/rss/search?q=%22extras+wanted%22+film&hl=en-US&gl=US&ceid=US:en', cat: 'scripted',  weight: 2 },
  // Reddit - users post real casting calls daily, JSON feed works without auth
  // Reddit - only the dedicated casting/audition subs (general r/acting is too noisy with discussion posts).
  { slug: 'reddit_casting',   name: 'r/castingcalls',     url: 'https://www.reddit.com/r/castingcalls/new/.rss?limit=25',     cat: 'scripted',   weight: 2 },
  { slug: 'reddit_auditions', name: 'r/auditions',        url: 'https://www.reddit.com/r/auditions/new/.rss?limit=25',        cat: 'scripted',   weight: 2 },
  // Search-based Reddit feeds - filter applied by query, then we apply title-keyword filter for safety.
  { slug: 'reddit_commercial', name: 'r/acting (commercial search)', url: 'https://www.reddit.com/r/acting/search.rss?q=commercial+casting+OR+commercial+audition+OR+spot&restrict_sr=1&sort=new&t=month', cat: 'commercial', weight: 1 },
  { slug: 'reddit_voiceover', name: 'r/VoiceActing (paid)', url: 'https://www.reddit.com/r/VoiceActing/search.rss?q=PAID+OR+casting+call&restrict_sr=1&sort=new&t=month', cat: 'commercial', weight: 1 },
];

let cache = { at: 0, data: null };
const TTL_MS = 15 * 60 * 1000;

// Use a real browser UA - some casting feeds 403 on bot-style UAs.
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'application/rss+xml, application/xml, text/xml; q=0.9, */*; q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const UNION_RE  = /\b(sag[\s-]?aftra|sag|union|aea|aftra)\b/i;
const UNPAID_RE = /\b(unpaid|deferred|student\s+film|non-?paid|volunteer|spec)\b/i;
const PAY_RE    = /(\$[\d,]+(?:[.-]\d+)?(?:\s*(?:per\s+day|\/day|\/hr|\/hour|flat|buyout|session))?)/i;
const LOC_RE    = /\b(Los Angeles|New York|NYC|LA|Atlanta|Chicago|Miami|London|Toronto|Vancouver|Austin|Nashville|Las Vegas|Orlando|Seattle|Boston|Philadelphia|Dallas|Houston|Phoenix|Remote|New Orleans|Mexico City|UK|Canada)\b/i;
const ROLE_RE   = /\b(lead|supporting|principal|background|extra|voiceover|\bvo\b|commercial|feature|series|short|pilot|music video|industrial|host|narrator|day[\s-]?player|recurring|guest star|co-star|stand-in|photo double|stunt)\b/i;
const COMMERCIAL_RE = /\b(commercial|spot|campaign|brand|product|national spot|buyout|VO|voiceover|radio)\b/i;

// Basic decode - used for titles, links, dates. Preserves URLs.
function decodeEntities(s) {
  if (!s) return '';
  let out = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  for (let i = 0; i < 2; i++) {
    out = out
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ').replace(/&hellip;/g, '...').replace(/&mdash;/g, '-').replace(/&ndash;/g, '-')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
  }
  return out.trim();
}
// Aggressive cleaner for summary text - strips HTML and URLs.
function cleanSummary(s) {
  if (!s) return '';
  let out = decodeEntities(s);
  out = out.replace(/<[^>]+>/g, ' ');
  out = out.replace(/https?:\/\/\S+/g, '');
  out = out.replace(/submitted by\s*\/u\/\S+/gi, '').replace(/\[link\]\s*\[comments\]/gi, '');
  return out.replace(/\s+/g, ' ').trim();
}

function pick(block, tag) {
  const re = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i');
  const m = block.match(re);
  return m ? decodeEntities(m[1]) : '';
}

function pickLinkAttr(block) {
  // Atom-style <link href="..."/> (Reddit, Google News)
  const m = block.match(/<link[^>]+href=["']([^"']+)["']/i);
  return m ? m[1] : '';
}

function stripTags(s) { return (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

function parseRss(xml) {
  const items = [];
  const itemRe = /<item[\s>][\s\S]*?<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) && items.length < 30) {
    const block = m[0];
    items.push({
      title:   stripTags(pick(block, 'title')),
      link:    pick(block, 'link').trim() || pickLinkAttr(block),
      summary: pick(block, 'description') || pick(block, 'content:encoded') || '',
      date:    pick(block, 'pubDate') || pick(block, 'dc:date') || '',
    });
  }
  if (items.length === 0) {
    const entryRe = /<entry[\s>][\s\S]*?<\/entry>/gi;
    while ((m = entryRe.exec(xml)) && items.length < 30) {
      const block = m[0];
      items.push({
        title:   stripTags(pick(block, 'title')),
        link:    pickLinkAttr(block) || pick(block, 'id').trim(),
        summary: pick(block, 'summary') || pick(block, 'content') || '',
        date:    pick(block, 'updated') || pick(block, 'published') || '',
      });
    }
  }
  return items;
}

function extractLocation(text) {
  const m = text.match(LOC_RE);
  return m ? m[0] : null;
}
function extractRole(text) {
  const m = text.match(ROLE_RE);
  return m ? m[0].toLowerCase() : null;
}
function extractRate(text) {
  const m = text.match(PAY_RE);
  return m ? m[1] : null;
}
function titleCase(s) { return s ? s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1)) : s; }

function classify(title, summary, sourceCat) {
  const blob = (title + ' ' + summary).toLowerCase();
  // Strong scripted signal in content overrides source category
  if (/\b(feature film|tv series|netflix|hbo|amazon mgm|a24|miniseries|short film|pilot|drama series|limited series|psychological thriller|animated|music video)\b/i.test(blob)) return 'scripted';
  // Strong commercial signal anywhere
  if (/\b(commercial|spot|campaign|brand|buyout|national spot|infomercial|product|advertisement|advertising|industrial|voiceover|\bvo\b|jingle)\b/i.test(blob)) return 'commercial';
  // Otherwise trust source category (Google News commercial queries → commercial, etc.)
  return sourceCat || 'scripted';
}

async function fetchFeed(src) {
  src._debug = { status: null, items: 0, error: null, bytes: 0 };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(src.url, { headers: HEADERS, signal: ctrl.signal, redirect: 'follow' });
    clearTimeout(t);
    src._debug.status = r.status;
    if (!r.ok) { src._debug.error = 'HTTP ' + r.status; return []; }
    const xml = await r.text();
    src._debug.bytes = xml.length;
    const rawItems = parseRss(xml);
    src._debug.items = rawItems.length;
    const items = rawItems.map(it => {
      let title = (it.title || '').trim();
      // Google News titles look like "Real headline - Outlet Name". Split off the outlet for source attribution.
      let outletSuffix = '';
      const dashSplit = title.match(/^(.+?)\s+-\s+([^-]{2,40})$/);
      if (dashSplit && /Google News/i.test(src.name)) {
        title = dashSplit[1].trim();
        outletSuffix = dashSplit[2].trim();
      }
      const summary = cleanSummary(it.summary || '').slice(0, 400);
      const blob = title + ' ' + summary;
      const location = extractLocation(blob);
      const role = extractRole(blob);
      const rate = extractRate(blob);
      const union = UNION_RE.test(blob);
      const unpaid = UNPAID_RE.test(blob);
      const category = classify(title, summary, src.cat);
      const tags = [];
      if (union) tags.push('SAG-AFTRA');
      if (role) tags.push(titleCase(role));
      if (location) tags.push(location);
      if (category === 'commercial') tags.push('Commercial');
      if (!union && !unpaid) tags.push('Paid');
      if (unpaid) tags.push('Unpaid');
      return {
        source: outletSuffix || src.name,
        sourceSlug: src.slug,
        title,
        link: it.link,
        summary,
        date: it.date,
        location,
        role,
        rate,
        union,
        unpaid,
        category,
        tags: tags.slice(0, 4),
      };
    });
    src._debug.parsed = items.length;
    // capture first 3 raw titles for debug visibility
    src._debug.sampleTitles = items.slice(0, 3).map(i => i.title);
    src._debug.rejectReasons = [];
    const filtered = items.filter(x => {
      const t0 = x.title || '';
      const reasonHit = (r) => { if (src._debug.rejectReasons.length < 3) src._debug.rejectReasons.push(r + ': ' + t0.slice(0, 60)); };
      const _orig_return_false = false;
      if (!x.title || !x.link) { reasonHit('missing-title-or-link'); return false; }
      if (x.unpaid) { reasonHit('unpaid'); return false; }
      const t = x.title.toLowerCase();
      // Hard reject: blog-post / advice / how-to titles that some feeds mix in.
      if (/\b(how to|talks|interview|career advice|tips for|tip for|guide to|guide for|why you|the best|q&a|podcast|episode|review of|opinion|essential advice|the art of|discover your|making a better|secrets|lessons|insights|breakdown of|behind the scenes|profile:|spotlight:)\b/i.test(t)) { reasonHit('blog-regex'); return false; }
      // High-signal sources (Reddit casting subs, Google News casting query) - trust them.
      if (src.weight >= 2) return true;
      // Low-signal sources - require explicit casting keyword in the title.
      if (!/(audition|casting call|now casting|now hiring|open call|extras needed|talent needed|seeking |\brole\b|\broles\b|wanted|apply by|submission|paid|sag-?aftra|union|principal|lead|supporting|stand-?in|background)/i.test(t)) { reasonHit('no-casting-kw'); return false; }
      return true;
    });
    src._debug.filtered = filtered.length;
    return filtered;
  } catch (e) {
    src._debug.error = (e && e.message) || String(e);
    return [];
  }
}

exports.handler = async (event) => {
  const debug = event && event.queryStringParameters && event.queryStringParameters.debug === '1';
  const now = Date.now();
  if (!debug && cache.data && (now - cache.at) < TTL_MS) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600', 'Access-Control-Allow-Origin': '*', 'X-Cache': 'HIT' },
      body: JSON.stringify(cache.data),
    };
  }

  const results = await Promise.all(SOURCES.map(fetchFeed));
  const all = results.flat();

  // Sort newest first, dedupe by normalized title
  all.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const seen = new Set();
  const deduped = all.filter(x => {
    const k = (x.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Diversify top results: take from each source slug round-robin so one chatty source
  // (like Reddit casting subs) doesn't crowd out Google News and vice versa.
  function diversify(items, limit) {
    const buckets = {};
    items.forEach(it => { (buckets[it.sourceSlug] = buckets[it.sourceSlug] || []).push(it); });
    const out = [];
    let added = true;
    while (added && out.length < limit) {
      added = false;
      for (const k of Object.keys(buckets)) {
        if (buckets[k].length && out.length < limit) {
          out.push(buckets[k].shift());
          added = true;
        }
      }
    }
    return out;
  }
  const scripted = diversify(deduped.filter(x => x.category === 'scripted'), 10);
  const commercial = diversify(deduped.filter(x => x.category === 'commercial'), 10);

  const payload = {
    fetchedAt: new Date().toISOString(),
    totals: {
      scripted: deduped.filter(x => x.category === 'scripted').length,
      commercial: deduped.filter(x => x.category === 'commercial').length,
      all: deduped.length,
    },
    scripted,
    commercial,
    sourcesOk: results.filter(r => r.length > 0).length,
    sourceCount: SOURCES.length,
    debug: debug ? SOURCES.map(s => ({ slug: s.slug, name: s.name, ...s._debug })) : undefined,
  };

  if (deduped.length > 0) cache = { at: now, data: payload };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600', 'Access-Control-Allow-Origin': '*', 'X-Cache': 'MISS' },
    body: JSON.stringify(payload),
  };
};
