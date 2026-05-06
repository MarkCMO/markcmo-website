// netlify/functions/film-rolodex-expand.js
//
// One-shot rolodex EXPAND endpoint. Each call processes ONE batch and
// returns immediately, so the browser can call it 5-10 times in a row
// to grow the rolodex by thousands of rows without ever hitting the
// 26-second function timeout.
//
// POST { source, page }   -> { ok, added, summary }
//
// Sources:
//   tmdb-movie    - paginates /movie/popular, /movie/top_rated,
//                   /movie/upcoming, /movie/now_playing - one page per call
//                   (each page is ~20 movies = ~80 cast + ~240 crew slots).
//   tmdb-tv       - same but for TV (showrunners, writers room, cast).
//                   Massive new pool - showrunners are direct hires.
//   tmdb-discover - /discover/movie with rotating sort_by + year filters
//                   to surface indie + festival titles the popularity feeds
//                   skip. Page param drives pagination.
//   wiki-list     - scrapes a curated set of Wikipedia "List of ..." pages
//                   for production-co + financier names. page param picks
//                   which list to scrape this call.
//
// Auth: same admin session cookie as film-rolodex.

const { getStore } = require('@netlify/blobs');
const { COMPANIES: SEED_COMPANIES, PEOPLE: SEED_PEOPLE } = require('./_film-rolodex-seed');

const STORE_NAME = 'film-rolodex';
const COOKIE_NAME = 'mcadmin_session';
const TMDB = 'https://api.themoviedb.org/3';

const ALLOWED_ORIGINS = ['https://markcmo.com', 'https://academy.markcmo.com', 'http://localhost:8888'];

function corsHeaders(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

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
  if (!key) throw new Error('TMDB_API_KEY not set');
  const url = new URL(TMDB + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const headers = { Accept: 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key;
  else url.searchParams.set('api_key', key);
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url.toString(), { headers, signal: ctrl.signal });
    if (!r.ok) throw new Error(`TMDB ${path} -> ${r.status}`);
    return r.json();
  } finally { clearTimeout(tid); }
}

// ── verifyAdmin (same HMAC cookie pattern) ──
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

// ── source: TMDB movie page ──
async function fromTmdbMovie(page) {
  const lists = ['/movie/popular', '/movie/top_rated', '/movie/upcoming', '/movie/now_playing'];
  // Round-robin which list this page hits, so sequential calls walk all 4.
  const list = lists[(page - 1) % lists.length];
  const tmdbPage = Math.floor((page - 1) / lists.length) + 1;
  const data = await tmdbGet(list, { region: 'US', page: tmdbPage });
  const movieIds = (data?.results || []).map(m => m.id);
  return harvestMovies(movieIds, `${list} pg${tmdbPage}`);
}

// ── source: TMDB TV page ──
async function fromTmdbTv(page) {
  const lists = ['/tv/popular', '/tv/top_rated', '/tv/on_the_air', '/tv/airing_today'];
  const list = lists[(page - 1) % lists.length];
  const tmdbPage = Math.floor((page - 1) / lists.length) + 1;
  const data = await tmdbGet(list, { page: tmdbPage });
  const tvIds = (data?.results || []).map(t => t.id);
  return harvestTv(tvIds, `${list} pg${tmdbPage}`);
}

// ── source: TMDB discover (indie / festival reach) ──
async function fromTmdbDiscover(page) {
  // Rotate sort_by + year filters to surface different titles each call.
  const sorts = ['vote_count.desc', 'revenue.desc', 'primary_release_date.desc', 'vote_average.desc'];
  const sort = sorts[(page - 1) % sorts.length];
  const tmdbPage = Math.floor((page - 1) / sorts.length) + 1;
  const data = await tmdbGet('/discover/movie', {
    sort_by: sort,
    'vote_count.gte': 50,
    page: tmdbPage,
    include_adult: 'false',
  });
  const movieIds = (data?.results || []).map(m => m.id);
  return harvestMovies(movieIds, `discover ${sort} pg${tmdbPage}`);
}

async function harvestMovies(ids, sourceTag) {
  const companies = [];
  const people = [];
  for (const mid of ids) {
    try {
      const detail = await tmdbGet(`/movie/${mid}`, { append_to_response: 'credits' });
      if (!detail) continue;
      const movieTitle = detail.title || `tmdb:${mid}`;
      const primaryCompany = (detail.production_companies || [])[0]?.name || '';

      for (const pc of (detail.production_companies || [])) {
        if (!pc.name) continue;
        companies.push({
          id: makeId('c', pc.name),
          name: pc.name,
          type: 'prodco',
          tags: ['tmdb-expand', 'auto'],
          notes: `Producer of "${movieTitle}". TMDB id ${pc.id}.`,
          _tmdbId: pc.id,
          _addedAt: new Date().toISOString(),
          _source: sourceTag,
        });
      }
      const cast = (detail.credits?.cast || []).slice(0, 10);
      const crewKeep = ['Director', 'Producer', 'Executive Producer', 'Co-Producer', 'Line Producer', 'Screenplay', 'Writer', 'Director of Photography', 'Casting', 'Editor', 'Production Designer', 'Composer'];
      const crew = (detail.credits?.crew || []).filter(c => crewKeep.includes(c.job)).slice(0, 20);
      for (const c of cast) {
        if (!c.name) continue;
        people.push({
          id: makeId('p', c.name, primaryCompany),
          name: c.name,
          title: c.character ? `Cast - ${c.character}` : 'Cast',
          company: primaryCompany || '',
          dept: 'talent',
          notes: `Credited in "${movieTitle}" (TMDB ${mid}).`,
          tags: ['tmdb-expand', 'cast'],
          _source: sourceTag,
        });
      }
      for (const c of crew) {
        if (!c.name) continue;
        people.push({
          id: makeId('p', c.name, primaryCompany),
          name: c.name,
          title: c.job,
          company: primaryCompany || '',
          dept: c.job === 'Casting' ? 'casting' : 'production',
          notes: `${c.job} on "${movieTitle}".`,
          tags: ['tmdb-expand', 'crew'],
          _source: sourceTag,
        });
      }
    } catch { /* skip individual movie */ }
  }
  return { companies, people };
}

async function harvestTv(ids, sourceTag) {
  const companies = [];
  const people = [];
  for (const tid of ids) {
    try {
      const detail = await tmdbGet(`/tv/${tid}`, { append_to_response: 'credits,aggregate_credits' });
      if (!detail) continue;
      const showTitle = detail.name || `tmdb-tv:${tid}`;
      const primaryCompany = (detail.production_companies || [])[0]?.name || '';

      for (const pc of (detail.production_companies || [])) {
        if (!pc.name) continue;
        companies.push({
          id: makeId('c', pc.name),
          name: pc.name,
          type: 'prodco',
          tags: ['tmdb-expand', 'tv', 'auto'],
          notes: `TV producer on "${showTitle}". TMDB id ${pc.id}.`,
          _tmdbId: pc.id,
          _addedAt: new Date().toISOString(),
          _source: sourceTag,
        });
      }

      // Showrunners / created_by - GOLD contacts
      for (const cb of (detail.created_by || [])) {
        if (!cb.name) continue;
        people.push({
          id: makeId('p', cb.name, primaryCompany),
          name: cb.name,
          title: 'Showrunner / Creator',
          company: primaryCompany || '',
          dept: 'production',
          notes: `Created "${showTitle}" (TMDB tv/${tid}).`,
          tags: ['tmdb-expand', 'tv', 'showrunner'],
          _source: sourceTag,
        });
      }

      // Aggregate credits (writers room, recurring directors) when available.
      const ag = detail.aggregate_credits || {};
      const cast = (ag.cast || detail.credits?.cast || []).slice(0, 10);
      const crewSrc = ag.crew || detail.credits?.crew || [];
      const crewKeep = ['Director', 'Executive Producer', 'Co-Executive Producer', 'Producer', 'Writer', 'Casting', 'Director of Photography'];
      const crew = crewSrc.filter(c => crewKeep.some(k => (c.job || (c.jobs && c.jobs[0]?.job) || '').includes(k))).slice(0, 20);

      for (const c of cast) {
        if (!c.name) continue;
        const role = c.character || (c.roles && c.roles[0]?.character) || 'Cast';
        people.push({
          id: makeId('p', c.name, primaryCompany),
          name: c.name,
          title: `TV cast - ${role}`,
          company: primaryCompany || '',
          dept: 'talent',
          notes: `Series regular on "${showTitle}" (TMDB tv/${tid}).`,
          tags: ['tmdb-expand', 'tv', 'cast'],
          _source: sourceTag,
        });
      }
      for (const c of crew) {
        if (!c.name) continue;
        const job = c.job || (c.jobs && c.jobs[0]?.job) || 'Crew';
        people.push({
          id: makeId('p', c.name, primaryCompany),
          name: c.name,
          title: `TV ${job}`,
          company: primaryCompany || '',
          dept: 'production',
          notes: `${job} on "${showTitle}".`,
          tags: ['tmdb-expand', 'tv', 'crew'],
          _source: sourceTag,
        });
      }
    } catch { /* skip */ }
  }
  return { companies, people };
}

// ── source: Wikipedia "List of ..." pages ──
const WIKI_LISTS = [
  // pageTitle, type, dept, tags
  { title: 'List_of_film_production_companies',                type: 'prodco',     tags: ['wiki', 'prodco'] },
  { title: 'List_of_independent_film_production_companies',    type: 'prodco',     tags: ['wiki', 'indie'] },
  { title: 'List_of_American_film_studios',                    type: 'studio-major', tags: ['wiki', 'studio'] },
  { title: 'List_of_film_production_companies_of_the_United_States', type: 'prodco', tags: ['wiki', 'us'] },
  { title: 'List_of_largest_film_production_companies',        type: 'studio-major', tags: ['wiki', 'major'] },
  { title: 'List_of_film_distributors',                        type: 'distributor', tags: ['wiki', 'distributor'] },
  { title: 'List_of_film_distributors_in_the_United_States',   type: 'distributor', tags: ['wiki', 'us-distributor'] },
  { title: 'List_of_talent_agencies',                          type: 'agency',     tags: ['wiki', 'talent-agency'] },
  { title: 'List_of_film_finance_companies',                   type: 'financier',  tags: ['wiki', 'financier'] },
  // High-value additions:
  { title: 'List_of_American_television_networks',             type: 'streamer',   tags: ['wiki', 'tv-network'] },
  { title: 'List_of_streaming_media_services',                 type: 'streamer',   tags: ['wiki', 'streamer'] },
  { title: 'List_of_film_festivals',                           type: 'other',      tags: ['wiki', 'festival'] },
  { title: 'List_of_post-production_companies',                type: 'vendor',     tags: ['wiki', 'post'] },
  { title: 'List_of_visual_effects_companies',                 type: 'vendor',     tags: ['wiki', 'vfx'] },
  { title: 'List_of_animation_studios',                        type: 'prodco',     tags: ['wiki', 'animation'] },
  { title: 'List_of_film_score_composers',                     type: 'other',      tags: ['wiki', 'composer'] },
  { title: 'List_of_casting_directors',                        type: 'other',      tags: ['wiki', 'casting'] },
  { title: 'List_of_cinematographers',                         type: 'other',      tags: ['wiki', 'dp'] },
];

async function fromWikiList(page) {
  const idx = (page - 1) % WIKI_LISTS.length;
  const def = WIKI_LISTS[idx];
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 8000);
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(def.title)}`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'WETYR-FilmIntel/1.0 (+mailto:info@wetyr.com)', Accept: 'text/html' },
      signal: ctrl.signal,
    });
    if (!r.ok) return { companies: [], people: [], wikiTitle: def.title, error: `wiki ${r.status}` };
    const html = await r.text();

    // Pull every wikilink target inside table rows + lists - those are the
    // company entries on these pages. Filter out non-company pages (categories,
    // disambiguation, year articles) by simple heuristics.
    const linkRe = /<a[^>]+href="\.\/([^"#?]+)"[^>]*>([^<]+)<\/a>/g;
    const seen = new Set();
    const companies = [];
    let m;
    while ((m = linkRe.exec(html)) !== null) {
      const href = decodeURIComponent(m[1]).replace(/_/g, ' ');
      const text = m[2].trim();
      if (!text || text.length < 2 || text.length > 80) continue;
      if (/^(File|Category|Wikipedia|Help|Talk|Special|Template|Portal|edit|Cite)/i.test(href)) continue;
      if (/^\d{4}$/.test(text) || /^\d{1,2}$/.test(text)) continue;
      if (/(disambiguation|list of)/i.test(text)) continue;
      const key = slug(text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      companies.push({
        id: makeId('c', text),
        name: text,
        type: def.type,
        tags: def.tags.concat(['auto']),
        notes: `Wikipedia: ${def.title.replace(/_/g, ' ')}`,
        website: `https://en.wikipedia.org/wiki/${encodeURIComponent(href.replace(/ /g, '_'))}`,
        _addedAt: new Date().toISOString(),
        _source: `wiki:${def.title}`,
      });
    }
    return { companies, people: [], wikiTitle: def.title };
  } catch (e) {
    return { companies: [], people: [], wikiTitle: def.title, error: e.message };
  } finally { clearTimeout(tid); }
}

// ── source: TMDB /person/popular - 10k+ named individuals ──
// Each page returns 20 people with TMDB id, known_for_department, and a
// known_for[] array (their top 3 credits we can use for current-company
// detection). 500 pages = 10,000 popular people. We capture _tmdbPersonId
// so the find-newest-email action can skip the search step.
async function fromTmdbPersonPopular(page) {
  const data = await tmdbGet('/person/popular', { page });
  const people = [];
  const companies = [];
  for (const pp of (data?.results || [])) {
    if (!pp.name) continue;
    const dept = (pp.known_for_department || '').toLowerCase();
    const deptMap = {
      'production': 'production', 'directing': 'production', 'writing': 'production',
      'acting': 'talent', 'crew': 'production', 'camera': 'production',
      'sound': 'production', 'editing': 'production', 'art': 'production',
      'visual effects': 'production', 'costume & make-up': 'production',
    };
    const knownFor = (pp.known_for || []).slice(0, 2).map(k => k.title || k.name).filter(Boolean);
    people.push({
      id: makeId('p', pp.name, knownFor[0] || 'tmdb'),
      name: pp.name,
      title: pp.known_for_department || 'Talent',
      company: '', // unknown until find-newest is run
      dept: deptMap[dept] || 'talent',
      notes: knownFor.length ? `Known for: ${knownFor.join(', ')}` : `TMDB popular person (popularity ${pp.popularity?.toFixed(1)}).`,
      tags: ['tmdb-popular', 'auto', dept || 'talent'],
      _tmdbPersonId: pp.id,
      _tmdbPopularity: pp.popularity,
      _source: `tmdb-person-popular pg${page}`,
    });
  }
  return { companies, people };
}

// ── source: NYC Film Permits (NYC OpenData) ──
// Daily-updated dataset of every film/TV permit issued in NYC. The
// EventAgency field is the prodco. Each permit also names a category
// (Television, Feature, Documentary, etc). Massive prodco discovery and
// always current.
// Endpoint: https://data.cityofnewyork.us/resource/tg4x-b46p.json
// Pagination via $offset / $limit.
async function fromNycFilmPermits(page) {
  const PAGE = 200;
  const offset = (page - 1) * PAGE;
  const url = `https://data.cityofnewyork.us/resource/tg4x-b46p.json?$limit=${PAGE}&$offset=${offset}&$order=enteredon%20DESC`;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'WETYR-FilmIntel/1.0 (+mailto:info@wetyr.com)', Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!r.ok) return { companies: [], people: [], error: `nyc ${r.status}` };
    const rows = await r.json();
    const companies = [];
    const people = [];
    const seenCo = new Set();
    for (const row of (rows || [])) {
      const coName = (row.eventagency || '').trim();
      if (!coName) continue;
      const key = slug(coName);
      if (seenCo.has(key)) continue;
      seenCo.add(key);
      const cat = row.category || row.subcategoryname || 'Production';
      companies.push({
        id: makeId('c', coName),
        name: coName,
        type: /television|tv/i.test(cat) ? 'prodco' : 'prodco',
        tags: ['nyc-permit', 'auto', cat.toLowerCase().replace(/\s+/g, '-')],
        notes: `NYC Film Permit (${cat}) - last permit ${row.enteredon ? row.enteredon.slice(0, 10) : 'unknown'}. Borough: ${row.borough || 'unknown'}.`,
        country: 'USA',
        hq: row.borough ? `${row.borough}, NY` : 'New York, NY',
        _nycPermitId: row.eventid,
        _addedAt: new Date().toISOString(),
        _source: `nyc-film-permits pg${page}`,
      });
    }
    return { companies, people };
  } catch (e) { return { companies: [], people: [], error: e.message }; }
  finally { clearTimeout(tid); }
}

// ── source: LA County Film Permits (FilmLA via socrata not available;
// use the City of LA OpenData "FilmLA Permits" feed). Fallback to LA
// City film office RSS if dataset URL changes.
// Endpoint: https://data.lacity.org/resource/yv23-pmwf.json
async function fromLaFilmPermits(page) {
  const PAGE = 200;
  const offset = (page - 1) * PAGE;
  const url = `https://data.lacity.org/resource/yv23-pmwf.json?$limit=${PAGE}&$offset=${offset}`;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'WETYR-FilmIntel/1.0 (+mailto:info@wetyr.com)', Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!r.ok) return { companies: [], people: [], error: `la ${r.status}` };
    const rows = await r.json();
    const companies = [];
    const seenCo = new Set();
    for (const row of (rows || [])) {
      // FilmLA dataset field names vary; try both.
      const coName = (row.production_company || row.applicant || row.permittee || row.company || '').trim();
      if (!coName) continue;
      const key = slug(coName);
      if (seenCo.has(key)) continue;
      seenCo.add(key);
      const cat = row.production_type || row.type || row.category || 'Production';
      companies.push({
        id: makeId('c', coName),
        name: coName,
        type: 'prodco',
        tags: ['la-permit', 'auto', String(cat).toLowerCase().replace(/\s+/g, '-')],
        notes: `LA City Film Permit (${cat}).`,
        country: 'USA',
        hq: 'Los Angeles, CA',
        _addedAt: new Date().toISOString(),
        _source: `la-film-permits pg${page}`,
      });
    }
    return { companies, people: [] };
  } catch (e) { return { companies: [], people: [], error: e.message }; }
  finally { clearTimeout(tid); }
}

// Snapshot the current store state to a `_snapshot_<ISO>` blob BEFORE any
// bulk write. Keeps the most recent N snapshots so we can roll back if a
// bulk operation goes sideways. Bounded to 10 to avoid unbounded growth.
const MAX_SNAPSHOTS = 10;
async function snapshotBeforeWrite(store, label) {
  try {
    const c = await store.get('companies', { type: 'json' });
    const p = await store.get('people', { type: 'json' });
    if (!c && !p) return null; // nothing to snapshot
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const key = `_snapshot_${ts}`;
    await store.setJSON(key, {
      at: new Date().toISOString(),
      label,
      companiesCount: (c || []).length,
      peopleCount: (p || []).length,
      companies: c || [],
      people: p || [],
    });
    // Prune oldest snapshots
    const all = await store.list({ prefix: '_snapshot_' });
    const keys = (all.blobs || []).map(b => b.key).sort();
    while (keys.length > MAX_SNAPSHOTS) {
      const oldest = keys.shift();
      try { await store.delete(oldest); } catch { /* ignore */ }
    }
    return key;
  } catch { return null; }
}

// ── persist new rows (idempotent merge) ──
async function persist(newCompanies, newPeople, sourceLabel) {
  const store = openStore();
  // SAFETY: snapshot BEFORE we read → mutate → write back. If anything goes
  // wrong (or a bug overwrites with seed), the snapshot can be restored.
  const snapKey = await snapshotBeforeWrite(store, sourceLabel || 'expand');

  // SAFETY: if the existing blob comes back null but _meta says we're already
  // bootstrapped, that means the read transient-failed. DO NOT fall back to
  // seed (that would nuke the live data). Throw instead so the caller surfaces
  // the error and the user can retry.
  const meta = await store.get('_meta', { type: 'json' });
  let existingC = await store.get('companies', { type: 'json' });
  let existingP = await store.get('people', { type: 'json' });
  if (meta && (existingC === null || existingP === null)) {
    throw new Error('Blob read returned null but store is bootstrapped - aborting to protect data. Snapshot key: ' + snapKey);
  }
  if (!existingC) existingC = SEED_COMPANIES.slice();
  if (!existingP) existingP = SEED_PEOPLE.slice();
  const cByKey = new Map(existingC.map(c => [slug(c.name), c]));
  const pByKey = new Map(existingP.map(p => [`${slug(p.name)}|${slug(p.company || '')}`, p]));

  let cAdded = 0, cUpdated = 0;
  for (const nc of newCompanies) {
    const key = slug(nc.name);
    if (!key) continue;
    const existing = cByKey.get(key);
    if (existing) {
      let changed = false;
      ['hq', 'website', 'country', 'parent', 'type'].forEach(f => {
        if (!existing[f] && nc[f]) { existing[f] = nc[f]; changed = true; }
      });
      // Append new tags
      if (Array.isArray(nc.tags)) {
        const tagSet = new Set([...(existing.tags || []), ...nc.tags]);
        if (tagSet.size !== (existing.tags || []).length) { existing.tags = [...tagSet]; changed = true; }
      }
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
    if (!np.name) continue;
    const existing = pByKey.get(key);
    if (existing) {
      let changed = false;
      ['title', 'email', 'phone', 'imdb', 'company_id', 'dept'].forEach(f => {
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
  return { cAdded, cUpdated, pAdded, pUpdated, totalCompanies: existingC.length, totalPeople: existingP.length };
}

exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'POST only' }) };

  const auth = await verifyAdmin(event);
  if (!auth) return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: 'auth required' }) };

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* ignore */ }
  const source = String(body.source || 'tmdb-movie');
  const page = Math.max(1, parseInt(body.page, 10) || 1);
  const t0 = Date.now();

  try {
    let result;
    if (source === 'tmdb-movie')              result = await fromTmdbMovie(page);
    else if (source === 'tmdb-tv')            result = await fromTmdbTv(page);
    else if (source === 'tmdb-discover')      result = await fromTmdbDiscover(page);
    else if (source === 'wiki-list')          result = await fromWikiList(page);
    else if (source === 'tmdb-person-popular') result = await fromTmdbPersonPopular(page);
    else if (source === 'nyc-film-permits')   result = await fromNycFilmPermits(page);
    else if (source === 'la-film-permits')    result = await fromLaFilmPermits(page);
    else return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'unknown source: ' + source }) };

    const sync = await persist(result.companies || [], result.people || [], `${source} pg${page}`);
    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true,
      runMs: Date.now() - t0,
      source,
      page,
      harvested: { companies: (result.companies || []).length, people: (result.people || []).length },
      sync,
      meta: result.wikiTitle ? { wikiTitle: result.wikiTitle, error: result.error } : undefined,
    }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
