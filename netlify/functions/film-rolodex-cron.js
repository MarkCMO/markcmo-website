// netlify/functions/film-rolodex-cron.js
// Scheduled rolodex sync - runs in the cloud on the schedule defined in
// netlify.toml. Pulls fresh production-company + crew contact signal from:
//   1. TMDB now_playing + popular movies -> credits -> companies + people
//   2. SEC EDGAR DEF 14A filings -> named executive officers (studios)
//   3. Curated baseline (the seed file) -> ensures floor coverage
//
// Idempotent: dedupes by name (companies) or name+company (people).
// Writes to the same Netlify Blobs `film-rolodex` store the rest of the
// system reads from.
//
// Trigger modes:
//   - Cron: Netlify invokes this on schedule, no auth needed.
//   - Manual: POST with the admin session cookie -> { ok, summary }.

const { getStore } = require('@netlify/blobs');
const { COMPANIES: SEED_COMPANIES, PEOPLE: SEED_PEOPLE } = require('./_film-rolodex-seed');

const STORE_NAME = 'film-rolodex';
const COOKIE_NAME = 'mcadmin_session';
const TMDB = 'https://api.themoviedb.org/3';

// ── helpers ────────────────────────────────────────────────────────
function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}
function makeId(prefix, name, extra) {
  return `${prefix}-${slug(name) || 'x'}${extra ? '-' + slug(extra) : ''}-${Math.random().toString(36).slice(2, 6)}`;
}

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

async function tmdbGet(path, params = {}) {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  const url = new URL(TMDB + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const headers = { Accept: 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key;
  else url.searchParams.set('api_key', key);
  const r = await fetch(url.toString(), { headers });
  if (!r.ok) throw new Error(`TMDB ${path} -> ${r.status}`);
  return r.json();
}

// ── source: TMDB ───────────────────────────────────────────────────
async function fromTmdb() {
  const summary = { source: 'tmdb', companiesFetched: 0, creditsFetched: 0, peopleHarvested: 0, errors: [] };
  if (!process.env.TMDB_API_KEY) {
    summary.errors.push('TMDB_API_KEY not set');
    return { companies: [], people: [], summary };
  }

  const seenCompanies = new Map(); // name -> row
  const seenPeople = new Map();    // name|company -> row

  try {
    // Pull a wide net of movies: now_playing + popular + upcoming + top_rated
    const lists = await Promise.all([
      tmdbGet('/movie/now_playing', { region: 'US', page: 1 }),
      tmdbGet('/movie/popular',     { region: 'US', page: 1 }),
      tmdbGet('/movie/upcoming',    { region: 'US', page: 1 }),
      tmdbGet('/trending/movie/week'),
    ]);
    const movieIds = new Set();
    lists.forEach(l => (l?.results || []).forEach(m => movieIds.add(m.id)));
    const ids = Array.from(movieIds).slice(0, 30);  // cap per run

    for (const mid of ids) {
      try {
        const detail = await tmdbGet(`/movie/${mid}`, { append_to_response: 'credits' });
        if (!detail) continue;
        summary.creditsFetched++;
        const movieTitle = detail.title || `tmdb:${mid}`;

        // -- companies on this title
        for (const pc of (detail.production_companies || [])) {
          if (!pc.name) continue;
          const key = slug(pc.name);
          if (seenCompanies.has(key)) continue;
          // Hydrate full company record (HQ, homepage, parent)
          let full = {};
          try { full = await tmdbGet(`/company/${pc.id}`) || {}; } catch { /* ignore */ }
          seenCompanies.set(key, {
            id: makeId('c', pc.name),
            name: pc.name,
            type: 'prodco',
            hq: full.headquarters || '',
            country: full.origin_country || '',
            website: full.homepage || '',
            parent: (full.parent_company || {}).name || '',
            tags: ['tmdb-cron', 'auto'],
            notes: `Producer of "${movieTitle}". TMDB id ${pc.id}.`,
            _addedAt: new Date().toISOString(),
            _source: 'tmdb-cron',
          });
          summary.companiesFetched++;
        }

        // -- people on this title (top-billed cast + key crew)
        const cast = (detail.credits?.cast || []).slice(0, 6);
        const crewKeep = ['Director', 'Producer', 'Executive Producer', 'Screenplay', 'Writer', 'Director of Photography', 'Casting'];
        const crew = (detail.credits?.crew || []).filter(c => crewKeep.includes(c.job)).slice(0, 12);
        const primaryCompany = (detail.production_companies || [])[0]?.name || '';

        for (const c of cast) {
          if (!c.name) continue;
          const key = `${slug(c.name)}|${slug(primaryCompany)}`;
          if (seenPeople.has(key)) continue;
          seenPeople.set(key, {
            id: makeId('p', c.name, primaryCompany),
            name: c.name,
            title: c.character ? `Cast - ${c.character}` : 'Cast',
            company: primaryCompany || '',
            dept: 'talent',
            imdb: '',
            notes: `Credited in "${movieTitle}" (TMDB ${mid}).`,
            tags: ['tmdb-cron', 'cast'],
            _source: 'tmdb-cron',
          });
          summary.peopleHarvested++;
        }
        for (const c of crew) {
          if (!c.name) continue;
          const key = `${slug(c.name)}|${slug(primaryCompany)}`;
          if (seenPeople.has(key)) continue;
          seenPeople.set(key, {
            id: makeId('p', c.name, primaryCompany),
            name: c.name,
            title: c.job,
            company: primaryCompany || '',
            dept: c.department === 'Writing' ? 'production' : 'production',
            notes: `${c.job} on "${movieTitle}".`,
            tags: ['tmdb-cron', 'crew'],
            _source: 'tmdb-cron',
          });
          summary.peopleHarvested++;
        }
      } catch (e) {
        summary.errors.push(`movie ${mid}: ${e.message}`);
      }
    }
  } catch (e) {
    summary.errors.push('tmdb top-level: ' + e.message);
  }

  return {
    companies: Array.from(seenCompanies.values()),
    people: Array.from(seenPeople.values()),
    summary,
  };
}

// ── source: SEC EDGAR (studio executives) ──────────────────────────
async function fromSec() {
  const summary = { source: 'sec', filingsChecked: 0, peopleHarvested: 0, errors: [] };
  const STUDIOS = [
    { cik: '0001065280', name: 'Netflix',                  cid: 'c-netflix' },
    { cik: '0001744489', name: 'The Walt Disney Co.',      cid: 'c-disney' },
    { cik: '0000813828', name: 'Paramount Global',         cid: 'c-paramount' },
    { cik: '0000929351', name: 'Lions Gate Entertainment', cid: 'c-lionsgate' },
    { cik: '0001437107', name: 'Warner Bros. Discovery',   cid: 'c-warner-bros' },
    { cik: '0001166691', name: 'Comcast (NBCU/Universal)', cid: 'c-universal' },
  ];

  const NAME_TITLE = /([A-Z][a-zA-Z.\-']+(?:\s+[A-Z][a-zA-Z.\-']+){1,3})\s*[,\u2013\-]\s*(Chief [A-Z][a-zA-Z ]+|President|Chairman|Director|EVP|SVP|General Counsel|CFO|CEO|COO|CTO|Executive Vice President|Senior Vice President)/g;
  const ua = { 'User-Agent': 'WETYR Film Intel info@wetyr.com', Accept: 'application/json' };

  const seen = new Map();
  for (const s of STUDIOS) {
    try {
      const subUrl = `https://data.sec.gov/submissions/CIK${s.cik.padStart(10, '0')}.json`;
      const r1 = await fetch(subUrl, { headers: ua });
      if (!r1.ok) { summary.errors.push(`${s.name} subs ${r1.status}`); continue; }
      const sub = await r1.json();
      const recent = sub.filings?.recent || {};
      const idx = (recent.form || []).indexOf('DEF 14A');
      if (idx < 0) continue;
      const acc = recent.accessionNumber[idx];
      const primary = recent.primaryDocument[idx];
      const accClean = acc.replace(/-/g, '');
      const cikInt = String(parseInt(s.cik, 10));
      const filingUrl = `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accClean}/${primary}`;

      const r2 = await fetch(filingUrl, { headers: { 'User-Agent': 'WETYR Film Intel info@wetyr.com' } });
      if (!r2.ok) { summary.errors.push(`${s.name} filing ${r2.status}`); continue; }
      const html = await r2.text();
      summary.filingsChecked++;
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      let m;
      while ((m = NAME_TITLE.exec(text)) !== null) {
        const nm = m[1].trim();
        const ttl = m[2].trim();
        if (nm.split(' ').length < 2) continue;
        if (/^(United|Common|Stock|Securities|Class)/.test(nm)) continue;
        const key = `${slug(nm)}|${s.cid}`;
        if (seen.has(key)) continue;
        seen.set(key, {
          id: makeId('p', nm, s.name),
          name: nm,
          title: ttl,
          company: s.name,
          company_id: s.cid,
          dept: 'executive',
          notes: `Named in SEC DEF 14A proxy (${acc}).`,
          tags: ['sec-edgar', 'executive', 'auto'],
          _source: 'sec-cron',
        });
        summary.peopleHarvested++;
      }
    } catch (e) {
      summary.errors.push(`${s.name}: ${e.message}`);
    }
  }
  return { companies: [], people: Array.from(seen.values()), summary };
}

// ── merge new rows into the Blobs store (idempotent) ────────────────
async function syncToStore({ companies: newCompanies, people: newPeople }) {
  const store = openStore();
  const existingC = (await store.get('companies', { type: 'json' })) || SEED_COMPANIES.slice();
  const existingP = (await store.get('people', { type: 'json' }))    || SEED_PEOPLE.slice();

  const cByKey = new Map(existingC.map(c => [slug(c.name), c]));
  const pByKey = new Map(existingP.map(p => [`${slug(p.name)}|${slug(p.company || '')}`, p]));

  let cAdded = 0, cUpdated = 0;
  for (const nc of newCompanies) {
    const key = slug(nc.name);
    const existing = cByKey.get(key);
    if (existing) {
      let changed = false;
      ['hq', 'website', 'country', 'parent'].forEach(f => {
        if (!existing[f] && nc[f]) { existing[f] = nc[f]; changed = true; }
      });
      if (changed) { existing._updatedAt = new Date().toISOString(); cUpdated++; }
    } else {
      existingC.push(nc);
      cByKey.set(key, nc);
      cAdded++;
    }
  }

  let pAdded = 0, pUpdated = 0;
  for (const np of newPeople) {
    const key = `${slug(np.name)}|${slug(np.company || '')}`;
    const existing = pByKey.get(key);
    if (existing) {
      let changed = false;
      ['title', 'email', 'phone', 'imdb', 'company_id'].forEach(f => {
        if (!existing[f] && np[f]) { existing[f] = np[f]; changed = true; }
      });
      if (changed) { existing._updatedAt = new Date().toISOString(); pUpdated++; }
    } else {
      existingP.push(np);
      pByKey.set(key, np);
      pAdded++;
    }
  }

  await store.setJSON('companies', existingC);
  await store.setJSON('people', existingP);
  await store.setJSON('_lastSync', { at: new Date().toISOString(), cAdded, cUpdated, pAdded, pUpdated });

  return { cAdded, cUpdated, pAdded, pUpdated, totalCompanies: existingC.length, totalPeople: existingP.length };
}

// ── handler (cron + manual trigger) ────────────────────────────────
async function runSync() {
  const t0 = Date.now();
  const tmdb = await fromTmdb();
  const sec = await fromSec();
  const sync = await syncToStore({
    companies: [...tmdb.companies, ...sec.companies],
    people: [...tmdb.people, ...sec.people],
  });
  return {
    ok: true,
    runMs: Date.now() - t0,
    sources: [tmdb.summary, sec.summary],
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

// Schedule is configured in netlify.toml.
// Manual trigger: POST with the admin session cookie returns the run summary.
exports.handler = async (event) => {
  // Admin manual trigger
  if (event.httpMethod === 'POST') {
    const auth = await verifyAdmin(event);
    if (!auth) return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'auth required' }) };
    try {
      const result = await runSync();
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) };
    } catch (e) {
      console.error('[film-rolodex-cron] manual FAIL', e);
      return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: e.message }) };
    }
  }

  // Scheduled invocation (Netlify GETs the function on schedule)
  try {
    const result = await runSync();
    console.log('[film-rolodex-cron] OK', JSON.stringify(result));
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (e) {
    console.error('[film-rolodex-cron] FAIL', e);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
