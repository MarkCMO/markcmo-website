// netlify/functions/film-rolodex-deep-cron.js
// Deep-website rolodex sync. Runs daily on the schedule defined in
// netlify.toml. For each company in the seed (with a website), crawls the
// company's homepage + a curated set of "About / Team / Leadership /
// Contact / Press / News / Slate" paths and regex-extracts:
//   - phone numbers (NANP + intl)
//   - email addresses (mailto + plain text + obfuscated)
//   - personnel names with titles  (from "Name, Title" inline patterns)
//   - production credits (titles in italics/quotes)
// Writes harvested rows back to the same Netlify Blobs `film-rolodex` store
// that the rolodex UI reads from. Idempotent: dedupes by slug.
//
// Trigger modes:
//   - Scheduled (GET): Netlify invokes this on its cron schedule.
//   - Manual (POST with admin cookie): trigger immediately, returns summary.

const { getStore } = require('@netlify/blobs');
const { COMPANIES: SEED_COMPANIES, PEOPLE: SEED_PEOPLE } = require('./_film-rolodex-seed');

const STORE_NAME = 'film-rolodex';
const COOKIE_NAME = 'mcadmin_session';
const PER_COMPANY_DELAY_MS = 250;
const MAX_PAGES_PER_COMPANY = 3;
const MAX_BYTES_PER_PAGE = 200_000;
const MAX_COMPANIES_PER_RUN = 8;      // cap to stay under function timeout
const FETCH_TIMEOUT_MS = 3_000;
const WALL_CLOCK_BUDGET_MS = 18_000;  // bail out well before the 26s function timeout

const DEFAULT_PATHS = ['/', '/about', '/about-us', '/team', '/leadership', '/contact', '/press', '/news', '/films'];

// ── helpers ────────────────────────────────────────────────────────
function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}
function makeId(prefix, name, extra) {
  return `${prefix}-${slug(name) || 'x'}${extra ? '-' + slug(extra) : ''}-${Math.random().toString(36).slice(2, 6)}`;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function openStore() {
  try {
    return getStore({ name: STORE_NAME, consistency: 'strong' });
  } catch (e) {
    const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID || '609d74ca-5f2a-4caa-aa7c-3f6922a7bcb4';
    const token = process.env.NETLIFY_TOKEN || process.env.NETLIFY_API_TOKEN;
    if (!token) throw new Error('Blobs not configured. Set NETLIFY_TOKEN env var.');
    return getStore({ name: STORE_NAME, siteID, token, consistency: 'strong' });
  }
}

async function timedFetch(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// ── extraction regexes ─────────────────────────────────────────────
const EMAIL_RE = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;
const OBFUS_RE = /\b([A-Za-z0-9._%+\-]+)\s*(?:\[at\]|\(at\)|\{at\}|@\s*)\s*([A-Za-z0-9.\-]+)\s*(?:\[dot\]|\(dot\)|\.)\s*([A-Za-z]{2,})\b/gi;
const PHONE_RE = /(?:(?:\+?1[\s.\-]?)?(?:\(?\d{3}\)?[\s.\-]?)\d{3}[\s.\-]?\d{4})|(?:\+\d{1,3}[\s.\-]?\d{2,4}[\s.\-]?\d{3,4}[\s.\-]?\d{3,4})/g;
const NAME_TITLE_RE = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z'.\-]+){1,3})\s*[,\-\u2013\u2014]\s*(Co-?Founder|Founder|President|Partner|EVP|SVP|VP|CEO|CFO|COO|CTO|CMO|Chairman|Chair|Director|Head of [A-Z][A-Za-z ]+|Executive Producer|Producer|Manager|Agent|Publicist|Casting Director|Cinematographer|Editor|Production Designer|Music Supervisor|Of Counsel|Counsel|Attorney|Chief [A-Z][a-zA-Z ]+|Senior Vice President|Executive Vice President|General Counsel|Development Executive|Creative Executive)\b/g;
const TITLE_QUOTE_RE = /(?:"|\u201c|<i>)([A-Z][^"\u201d<]{2,80})(?:"|\u201d|<\/i>)/g;

const EMAIL_BLOCK = /^(noreply|no-reply|donotreply|example@|you@|name@email)/i;
const PHONE_BLOCK_RE = /^(?:\+?1[\s.\-]?)?(?:000|111|555|123)[\s.\-]?/;

function decodeEmails(text) {
  const out = new Set();
  for (const m of text.matchAll(EMAIL_RE)) out.add(m[0].toLowerCase().replace(/\.$/, ''));
  for (const m of text.matchAll(OBFUS_RE)) out.add(`${m[1]}@${m[2]}.${m[3]}`.toLowerCase());
  return [...out].filter(e =>
    !EMAIL_BLOCK.test(e) &&
    !e.endsWith('.png') && !e.endsWith('.jpg') && !e.endsWith('.webp') && !e.endsWith('.svg') &&
    !e.includes('wixstatic') && !e.includes('googleusercontent') && !e.includes('cloudfront') &&
    !e.includes('sentry.io')
  );
}
function normalizePhone(raw) {
  const d = raw.replace(/\D/g, '');
  if (d.length === 10) return `+1-${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1') return `+1-${d.slice(1, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
  return raw.trim();
}
function extractPhones(text) {
  const out = new Set();
  for (const m of text.matchAll(PHONE_RE)) {
    if (PHONE_BLOCK_RE.test(m[0])) continue;
    const d = m[0].replace(/\D/g, '');
    if (d.length < 10 || d.length > 15) continue;
    out.add(normalizePhone(m[0]));
  }
  return [...out];
}
function extractPeople(text, fromUrl) {
  const seen = new Map();
  for (const m of text.matchAll(NAME_TITLE_RE)) {
    const name = m[1].trim();
    const title = m[2].trim();
    if (name.split(/\s+/).length < 2) continue;
    if (/^(United|Common|Stock|Class|Inc|Corp|LLC|Press|Photo)/.test(name)) continue;
    const key = `${slug(name)}|${slug(title)}`;
    if (!seen.has(key)) seen.set(key, { name, title, fromUrl });
  }
  return [...seen.values()];
}
function extractTitles(text) {
  const out = new Set();
  for (const m of text.matchAll(TITLE_QUOTE_RE)) {
    const t = m[1].trim().replace(/\s+/g, ' ');
    if (t.length >= 3 && t.length <= 80 && !/[<>]/.test(t)) out.add(t);
  }
  return [...out];
}

// ── per-company crawl ──────────────────────────────────────────────
async function crawlCompany(company) {
  const result = { company, emails: new Set(), phones: new Set(), people: [], productions: new Set(), pages: 0, errors: [] };
  const website = company.website;
  if (!website) return result;

  const base = website.replace(/\/+$/, '');
  let paths = company.scrape_paths || DEFAULT_PATHS;
  if (typeof paths === 'string') paths = paths.split(';').map(s => s.trim()).filter(Boolean);
  paths = paths.slice(0, MAX_PAGES_PER_COMPANY);

  const seenPpl = new Map();
  for (const path of paths) {
    const url = path.startsWith('http') ? path : base + (path.startsWith('/') ? path : '/' + path);
    try {
      const r = await timedFetch(url, {
        headers: {
          'User-Agent': 'WETYR-FilmIntel/1.0 (+mailto:info@wetyr.com)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.8',
        },
        redirect: 'follow',
      });
      if (!r.ok) { result.errors.push(`${url}: ${r.status}`); continue; }
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('html') && !ct.includes('text')) continue;
      let text = await r.text();
      if (text.length > MAX_BYTES_PER_PAGE) text = text.slice(0, MAX_BYTES_PER_PAGE);
      result.pages++;

      decodeEmails(text).forEach(e => result.emails.add(e));
      extractPhones(text).forEach(p => result.phones.add(p));
      extractPeople(text, url).forEach(p => {
        const k = `${slug(p.name)}|${slug(p.title)}`;
        if (!seenPpl.has(k)) seenPpl.set(k, p);
      });
      extractTitles(text).forEach(t => result.productions.add(t));
    } catch (e) {
      result.errors.push(`${url}: ${e.message}`);
    }
    await sleep(PER_COMPANY_DELAY_MS);
  }
  result.people = [...seenPpl.values()];
  return result;
}

// ── snapshot helper (rollback safety net) ──────────────────────────
const MAX_SNAPSHOTS = 10;
async function snapshotBeforeWrite(store, label) {
  try {
    const c = await store.get('companies', { type: 'json' });
    const p = await store.get('people',    { type: 'json' });
    if (!c && !p) return null;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const key = `_snapshot_${ts}`;
    await store.setJSON(key, {
      at: new Date().toISOString(),
      label: label || 'deep-cron',
      companiesCount: (c || []).length,
      peopleCount:    (p || []).length,
      companies: c || [],
      people:    p || [],
    });
    // prune
    try {
      const list = await store.list({ prefix: '_snapshot_' });
      const blobs = (list && list.blobs) || [];
      const sorted = blobs.map(b => b.key).sort();
      while (sorted.length > MAX_SNAPSHOTS) {
        const oldest = sorted.shift();
        await store.delete(oldest);
      }
    } catch {}
    return key;
  } catch { return null; }
}

// ── merge into Blobs store ─────────────────────────────────────────
async function syncToStore(crawls) {
  const store = openStore();
  const snapKey = await snapshotBeforeWrite(store, 'deep-cron');
  const meta = await store.get('_meta', { type: 'json' });
  let existingC = await store.get('companies', { type: 'json' });
  let existingP = await store.get('people',    { type: 'json' });
  if (meta && (existingC === null || existingP === null)) {
    throw new Error('Blob read returned null but store is bootstrapped - aborting deep-cron sync to protect data. Snapshot key: ' + snapKey);
  }
  if (!existingC) existingC = SEED_COMPANIES.slice();
  if (!existingP) existingP = SEED_PEOPLE.slice();

  const cByKey = new Map(existingC.map(c => [slug(c.name), c]));
  const pByKey = new Map(existingP.map(p => [`${slug(p.name)}|${slug(p.company || '')}`, p]));

  let cUpdated = 0, pAdded = 0, pUpdated = 0, productionsAdded = 0;
  for (const r of crawls) {
    const cKey = slug(r.company.name);
    const co = cByKey.get(cKey) || r.company;
    if (!cByKey.has(cKey)) { existingC.push(co); cByKey.set(cKey, co); }

    const newEmails = [...r.emails];
    const newPhones = [...r.phones];
    let coChanged = false;
    if (newEmails.length && !co.email)   { co.email = newEmails[0]; coChanged = true; }
    if (newPhones.length && !co.phone)   { co.phone = newPhones[0]; coChanged = true; }
    if (newEmails.length > 1 && !co.email_secondary) { co.email_secondary = newEmails[1]; coChanged = true; }
    if (newPhones.length > 1 && !co.phone_secondary) { co.phone_secondary = newPhones[1]; coChanged = true; }
    if (r.productions.size) {
      const existing = new Set(co.productions || []);
      r.productions.forEach(t => existing.add(t));
      if (existing.size !== (co.productions || []).length) {
        co.productions = [...existing].slice(0, 25);
        productionsAdded += co.productions.length - (co.productions ? co.productions.length : 0);
        coChanged = true;
      }
    }
    if (coChanged) {
      co._updatedAt = new Date().toISOString();
      co._source = 'deep-cron';
      cUpdated++;
    }

    for (const p of r.people) {
      const pkey = `${slug(p.name)}|${slug(co.name)}`;
      const existing = pByKey.get(pkey);
      if (existing) {
        let changed = false;
        if (!existing.title && p.title)  { existing.title = p.title; changed = true; }
        if (!existing.notes) { existing.notes = `Extracted via deep-scrape of ${p.fromUrl}`; changed = true; }
        if (changed) { existing._updatedAt = new Date().toISOString(); pUpdated++; }
      } else {
        const row = {
          id: makeId('p', p.name, co.name),
          name: p.name,
          title: p.title,
          company: co.name,
          company_id: co.id,
          dept: 'production',
          notes: `Extracted via deep-scrape of ${p.fromUrl}`,
          tags: ['deep-scrape', 'auto'],
          _source: 'deep-cron',
          _addedAt: new Date().toISOString(),
        };
        existingP.push(row);
        pByKey.set(pkey, row);
        pAdded++;
      }
    }
  }

  await store.setJSON('companies', existingC);
  await store.setJSON('people', existingP);
  await store.setJSON('_lastDeepSync', { at: new Date().toISOString(), cUpdated, pAdded, pUpdated, productionsAdded });

  return { cUpdated, pAdded, pUpdated, productionsAdded, totalCompanies: existingC.length, totalPeople: existingP.length };
}

// ── pick which companies to crawl this run ─────────────────────────
async function pickCompaniesForRun(store) {
  // Round-robin: track an index in Blobs and crawl the next N companies that
  // (a) have a website and (b) haven't been crawled recently.
  const all = (await store.get('companies', { type: 'json' })) || SEED_COMPANIES.slice();
  const eligible = all.filter(c => c.website && !c._noScrape);
  const cursor = (await store.get('_deepCursor', { type: 'json' })) || { idx: 0 };
  const slice = [];
  for (let i = 0; i < MAX_COMPANIES_PER_RUN && i < eligible.length; i++) {
    slice.push(eligible[(cursor.idx + i) % eligible.length]);
  }
  const nextIdx = (cursor.idx + MAX_COMPANIES_PER_RUN) % Math.max(eligible.length, 1);
  await store.setJSON('_deepCursor', { idx: nextIdx, lastAt: new Date().toISOString() });
  return slice;
}

// ── main run ───────────────────────────────────────────────────────
async function runDeepSync() {
  const t0 = Date.now();
  const store = openStore();
  const targets = await pickCompaniesForRun(store);
  const crawls = [];
  let actuallyCrawled = 0;
  let timedOut = false;
  for (const co of targets) {
    if (Date.now() - t0 > WALL_CLOCK_BUDGET_MS) {
      timedOut = true;
      break;
    }
    try {
      crawls.push(await crawlCompany(co));
    } catch (e) {
      crawls.push({ company: co, emails: new Set(), phones: new Set(), people: [], productions: new Set(), pages: 0, errors: [e.message] });
    }
    actuallyCrawled++;
  }
  // Rewind the cursor if we didn't get through the full batch, so the next run
  // picks up where we actually stopped (not where the optimistic batch ended).
  if (timedOut && actuallyCrawled < targets.length) {
    const all = (await store.get('companies', { type: 'json' })) || [];
    const eligibleLen = all.filter(c => c.website && !c._noScrape).length;
    const cursor = (await store.get('_deepCursor', { type: 'json' })) || { idx: 0 };
    const adjusted = (cursor.idx - (targets.length - actuallyCrawled) + eligibleLen) % Math.max(eligibleLen, 1);
    await store.setJSON('_deepCursor', { idx: adjusted, lastAt: new Date().toISOString(), partialBail: true });
  }
  const sync = await syncToStore(crawls);
  return {
    ok: true,
    runMs: Date.now() - t0,
    crawled: actuallyCrawled,
    plannedBatch: targets.length,
    bailedOnBudget: timedOut,
    pages: crawls.reduce((a, r) => a + r.pages, 0),
    sync,
    finishedAt: new Date().toISOString(),
  };
}

async function verifyAdmin(event) {
  const cookies = (event.headers.cookie || event.headers.Cookie || '').split(';').reduce((a, p) => {
    const [k, ...v] = p.trim().split('='); if (k) a[k] = decodeURIComponent(v.join('=')); return a;
  }, {});
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.TOKEN_SECRET || 'fallback';
  try {
    const [b64, sigB64] = token.split('.');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sig = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const ok = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(b64));
    if (!ok) return null;
    const payload = JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'POST') {
    const auth = await verifyAdmin(event);
    if (!auth) return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'auth required' }) };
    try {
      const result = await runDeepSync();
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) };
    } catch (e) {
      console.error('[film-rolodex-deep-cron] manual FAIL', e);
      return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: e.message }) };
    }
  }
  try {
    const result = await runDeepSync();
    console.log('[film-rolodex-deep-cron] OK', JSON.stringify(result));
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (e) {
    console.error('[film-rolodex-deep-cron] FAIL', e);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
