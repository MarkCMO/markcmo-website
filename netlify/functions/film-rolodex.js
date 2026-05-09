// netlify/functions/film-rolodex.js
// Internal-only Hollywood/Film industry contacts rolodex.
// Storage: Netlify Blobs (free, on-site).
// Auth: requires the same admin session cookie as admin-auth.js.
//
// GET  ?action=list&q=&type=&tag=  -> { ok, companies, people, total }
// POST { action: 'addCompany', company: {...} }   -> { ok, id }
// POST { action: 'addPerson',  person: {...} }    -> { ok, id }
// POST { action: 'updateCompany', id, patch }     -> { ok }
// POST { action: 'updatePerson',  id, patch }     -> { ok }
// POST { action: 'deleteCompany', id }            -> { ok }
// POST { action: 'deletePerson',  id }            -> { ok }
// POST { action: 'enrich', personId }             -> { ok, verified, person, found }
//   Free strategies: deep-crawl company /team /contact pages, Wikipedia REST,
//   observed-pattern email candidates. Optional 4th strategy uses Hunter.io
//   if HUNTER_API_KEY env var is set (auto-saves only if score>=80 + verified).
// POST { action: 'enrich-company', companyId }     -> { ok, verified, company, found }
//   Strategies: Hunter.io domain-search (returns up to 10 emails per domain
//   with name/title/dept/score) + site-crawl /team /about /contact /press
//   for additional emails + phones. Persists to company.emails[] array.
//
// Bootstraps on first call by merging _film-rolodex-seed.js into Blobs.

const { getStore } = require('./_blobs_shim');
const { COMPANIES: SEED_COMPANIES, PEOPLE: SEED_PEOPLE } = require('./_film-rolodex-seed');

const COOKIE_NAME = 'mcadmin_session';
const STORE_NAME = 'film-rolodex';

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

function parseCookies(h) {
  const out = {};
  (h || '').split(';').forEach(p => {
    const [k, ...v] = p.trim().split('=');
    if (k) out[k.trim()] = decodeURIComponent(v.join('='));
  });
  return out;
}

async function verifyToken(token, secret) {
  try {
    const [dataB64, sigB64] = token.split('.');
    if (!dataB64 || !sigB64) return null;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sig = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const ok = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(dataB64));
    if (!ok) return null;
    const payload = JSON.parse(atob(dataB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}

async function requireAuth(event) {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.TOKEN_SECRET || 'fallback';
  const cookies = parseCookies(event.headers.cookie || event.headers.Cookie || '');
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return await verifyToken(token, secret);
}

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function makeId(prefix, name) {
  const base = slug(name) || Math.random().toString(36).slice(2, 10);
  return `${prefix}-${base}-${Math.random().toString(36).slice(2, 6)}`;
}

function openStore() {
  // Prefer auto-injected Netlify context. Fall back to manual creds if the
  // environment didn't inject NETLIFY_BLOBS_CONTEXT (happens on some sites).
  try {
    return getStore({ name: STORE_NAME, consistency: 'strong' });
  } catch (e) {
    const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID || '609d74ca-5f2a-4caa-aa7c-3f6922a7bcb4';
    const token = process.env.NETLIFY_TOKEN || process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
    if (!token) throw new Error('Netlify Blobs not configured. Set NETLIFY_TOKEN env var (PAT) on the markcmo site, or wait for blob context injection.');
    return getStore({ name: STORE_NAME, siteID, token, consistency: 'strong' });
  }
}

async function loadStore() {
  const store = openStore();
  // SAFETY: if the read returns null but _meta says we're already
  // bootstrapped, that's a transient blob fetch failure - DO NOT fall back to
  // seed (would nuke live data). Throw so the caller can retry.
  const meta = await store.get('_meta', { type: 'json' });
  let companies = await store.get('companies', { type: 'json' });
  let people = await store.get('people', { type: 'json' });
  if (meta && (companies === null || people === null)) {
    throw new Error('Blob read returned null on a bootstrapped store - aborting to protect data. Try again.');
  }
  let bootstrapped = false;
  if (!companies) { companies = SEED_COMPANIES.slice(); bootstrapped = true; }
  if (!people)    { people    = SEED_PEOPLE.slice();    bootstrapped = true; }
  if (bootstrapped) {
    await store.set('companies', JSON.stringify(companies));
    await store.set('people', JSON.stringify(people));
    await store.set('_meta', JSON.stringify( { bootstrappedAt: new Date().toISOString(), version: 1 }));
  }
  return { store, companies, people };
}

// Snapshot current state to `_snapshot_<ISO>` before any bulk write so it can
// be restored. Bounded to MAX_SNAPSHOTS to avoid unbounded blob growth.
const MAX_SNAPSHOTS = 10;
async function snapshotBeforeWrite(store, label) {
  try {
    const c = await store.get('companies', { type: 'json' });
    const p = await store.get('people', { type: 'json' });
    if (!c && !p) return null;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const key = `_snapshot_${ts}`;
    await store.set(key, JSON.stringify({
      at: new Date().toISOString(),
      label: label || 'auto',
      companiesCount: (c || []).length,
      peopleCount: (p || []).length,
      companies: c || [],
      people: p || [],
    }));
    const list = await store.list({ prefix: '_snapshot_' });
    const keys = (list.blobs || []).map(b => b.key).sort();
    while (keys.length > MAX_SNAPSHOTS) {
      const oldest = keys.shift();
      try { await store.delete(oldest); } catch { /* ignore */ }
    }
    return key;
  } catch { return null; }
}

function matchesQuery(row, q) {
  if (!q) return true;
  const hay = JSON.stringify(row).toLowerCase();
  return q.toLowerCase().split(/\s+/).every(t => hay.includes(t));
}

// ── FRESHNESS INTELLIGENCE ────────────────────────────────────────
// Talent agencies: emails at these domains are valid CONTACT routes for
// agency-represented talent but get downranked vs. direct production-co
// emails when scoring "current" addresses for a producer/exec who has
// since moved in-house.
const TALENT_AGENCY_DOMAINS_LC = new Set([
  'caa.com', 'wmeagency.com', 'unitedtalent.com', 'gersh.com',
  'paradigmagency.com', 'a3artistsagency.com', 'apa-agency.com',
  'bbla.com', 'icmpartners.com', 'verveldd.com', 'innovativeartists.com',
]);

function emailDomain(addr) {
  return String(addr || '').toLowerCase().split('@')[1] || '';
}

function companyDomain(company) {
  if (!company || !company.website) return '';
  try {
    const u = new URL(company.website.startsWith('http') ? company.website : 'https://' + company.website);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch { return ''; }
}

// Compute per-email freshness score (0-200, higher = more likely current).
// Inputs: the email row, the person's CURRENT title + the resolved current
// company (object). Captures every signal we have to detect stale addresses.
function computeFreshness(em, person, currentCompany) {
  if (!em) return { score: 0, reasons: [] };
  const reasons = [];
  let score = 100;

  // 1. Recency decay (Hunter last_seen_on if we have it, else our addedAt)
  const lastSeen = em.lastSeenOn || em.addedAt || em.harvestedAt;
  if (lastSeen) {
    const days = Math.max(0, (Date.now() - new Date(lastSeen).getTime()) / 86400000);
    if (days > 1095)      { score *= 0.20; reasons.push(`>${Math.round(days/365)}y old`); }
    else if (days > 730)  { score *= 0.40; reasons.push(`${Math.round(days/365)}y old`); }
    else if (days > 365)  { score *= 0.65; reasons.push(`>1y old`); }
    else if (days > 180)  { score *= 0.85; reasons.push(`>6mo old`); }
    else                  { reasons.push(`fresh (${Math.round(days)}d)`); }
  } else {
    score *= 0.7;
    reasons.push('no date');
  }

  // 2. SMTP verification status
  const v = (em.verification || em.verifyStatus || '').toLowerCase();
  if (v === 'valid' || v === 'deliverable')          { score *= 1.20; reasons.push('verified'); }
  else if (v === 'invalid' || v === 'undeliverable') { score *= 0.05; reasons.push('SMTP fail'); }
  else if (v === 'disposable')                       { score *= 0.10; reasons.push('disposable'); }
  else if (v === 'accept_all' || v === 'unknown')    { score *= 0.85; }

  // 3. Hunter confidence at time of finding
  if (typeof em.score === 'number')               score *= (0.5 + Math.min(em.score, 100) / 200);
  else if (typeof em.confidence === 'number')     score *= (0.5 + Math.min(em.confidence, 100) / 200);

  // 4. Domain match with person's CURRENT company (the killer signal)
  const eDomain = emailDomain(em.address);
  const cDomain = companyDomain(currentCompany);
  if (cDomain && eDomain) {
    if (eDomain === cDomain)                       { score *= 1.60; reasons.push('matches current co'); }
    else if (TALENT_AGENCY_DOMAINS_LC.has(eDomain)){ score *= 0.85; reasons.push('agency rep'); }
    else if (em.source && em.source.includes(cDomain)) { score *= 1.45; reasons.push('crawled current co'); }
    else                                           { score *= 0.35; reasons.push('wrong domain'); }
  }

  // 5. Hunter `position` matches person's current title?
  if (em.title && person && person.title) {
    const a = em.title.toLowerCase();
    const b = person.title.toLowerCase();
    const aFirst = a.split(/\s+/)[0];
    const bFirst = b.split(/\s+/)[0];
    if (a === b || a.includes(b) || b.includes(a))  { score *= 1.10; reasons.push('title match'); }
    else if (aFirst === bFirst)                     { /* same family */ }
    else                                            { score *= 0.65; reasons.push('title mismatch'); }
  }

  // 6. Explicit archive flag wins
  if (em._archivedAt) {
    score *= 0.10;
    reasons.push('archived: ' + (em._archivedReason || 'manual'));
  }

  return { score: Math.round(score), reasons };
}

// TMDB v3+v4 fetch helper. v4 read tokens (start with `eyJ`) need a Bearer
// header; v3 keys go in the query string. Lifted out so both single + bulk
// freshen actions share it.
function makeTmdbFetch(TMDB) {
  return async (path, params = {}) => {
    const url = new URL('https://api.themoviedb.org/3' + path);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const headers = { Accept: 'application/json' };
    if (TMDB.startsWith('eyJ')) headers.Authorization = 'Bearer ' + TMDB;
    else url.searchParams.set('api_key', TMDB);
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 5000);
    try {
      const r = await fetch(url.toString(), { headers, signal: ctrl.signal });
      if (!r.ok) throw new Error(`TMDB ${path} -> ${r.status}`);
      return r.json();
    } finally { clearTimeout(tid); }
  };
}

// ── CORE: find one person's newest email ────────────────────────────
// Used by both the single find-newest-email action and the bulk freshen-batch
// sweep. Mutates the passed `companies` array (may push a new one) and returns
// the updated person + diagnostics. Caller is responsible for persisting.
async function findNewestForPerson(person, companies, opts = {}) {
  const trace = [];
  const TMDB = process.env.TMDB_API_KEY;
  const HUNTER = process.env.HUNTER_API_KEY;
  if (!TMDB)   trace.push('NO TMDB_API_KEY');
  if (!HUNTER) trace.push('NO HUNTER_API_KEY');
  const tmdbFetch = TMDB ? makeTmdbFetch(TMDB) : null;
  const skipVerify = !!opts.skipVerify; // batch mode skips per-email verify to save credits

  let currentCompany = null;
  let currentTitle = null;
  let latestProject = null;
  let companiesChanged = false;

  // Step 1: TMDB person -> latest producing/directing credit -> production_companies
  if (tmdbFetch) {
    try {
      let pid = person._tmdbPersonId;
      if (!pid) {
        try {
          const sJ = await tmdbFetch('/search/person', { query: person.name });
          const candidates = (sJ.results || []).slice(0, 3);
          trace.push(`TMDB person/search "${person.name}": ${candidates.length} candidate(s)`);
          const prod = candidates.find(c => /Production|Directing|Writing/i.test(c.known_for_department || ''));
          pid = (prod || candidates[0])?.id;
          if (pid) trace.push(`Picked TMDB person id ${pid}${prod ? ' (production dept)' : ''}`);
          else     trace.push('No TMDB person match');
        } catch (e) { trace.push('TMDB search failed: ' + e.message); }
      } else {
        trace.push(`Using stored _tmdbPersonId=${pid}`);
      }
      if (pid) {
        try {
          const cJ = await tmdbFetch(`/person/${pid}/combined_credits`);
          const wanted = ['Producer', 'Executive Producer', 'Director', 'Showrunner', 'Co-Producer', 'Line Producer', 'Writer', 'Creator'];
          const allCrew = (cJ.crew || []).filter(c => wanted.some(w => (c.job || '').includes(w)));
          allCrew.sort((a, b) => String(b.release_date || b.first_air_date || '').localeCompare(String(a.release_date || a.first_air_date || '')));
          const top = allCrew.slice(0, 5);
          trace.push(`combined_credits: ${(cJ.crew || []).length} crew rows, ${allCrew.length} producing/directing.`);
          if (top.length) trace.push(`Top: ${top.slice(0,3).map(t => (t.title || t.name) + ' (' + (t.release_date || t.first_air_date || '?').slice(0,4) + ')').join(' | ')}`);

          for (const credit of top) {
            const mediaType = credit.media_type === 'tv' ? 'tv' : 'movie';
            try {
              const dJ = await tmdbFetch(`/${mediaType}/${credit.id}`);
              const pcs = (dJ.production_companies || []).filter(p => !!p.name);
              if (!pcs.length) continue;
              const STUDIO_MAJORS_RX = /^(Warner Bros|Universal|Paramount|Sony Pictures|Walt Disney|20th Century|MGM|Lions Gate|Lionsgate|Netflix|Amazon|Apple Studios|HBO|FX|AMC|Showtime|Hulu|Peacock|Max|Columbia Pictures)/i;
              const boutique = pcs.find(pc => !STUDIO_MAJORS_RX.test(pc.name)) || pcs[0];
              currentCompany = { name: boutique.name, source: 'tmdb-credit', tmdbId: boutique.id };
              currentTitle = credit.job || person.title;
              latestProject = credit.title || credit.name;
              trace.push(`Current company: "${boutique.name}" (from "${latestProject}")`);
              break;
            } catch { /* try next */ }
          }
        } catch (e) { trace.push('combined_credits failed: ' + e.message); }
      }
    } catch (e) { trace.push('TMDB lookup failed: ' + e.message); }
  }

  // Step 2: resolve company in our rolodex (or add it)
  let resolvedCo = null;
  let resolvedDomain = '';
  if (currentCompany) {
    resolvedCo = companies.find(c =>
      c.name.toLowerCase() === currentCompany.name.toLowerCase()
      || (c._tmdbId && c._tmdbId === currentCompany.tmdbId)
    );
    if (resolvedCo) {
      resolvedDomain = companyDomain(resolvedCo);
      trace.push(`Matched in rolodex: ${resolvedCo.name}${resolvedDomain ? ' @ ' + resolvedDomain : ' (no website)'}`);
    } else {
      trace.push(`Adding new company: "${currentCompany.name}"`);
    }
    if (!resolvedDomain && currentCompany.tmdbId && tmdbFetch) {
      try {
        const j = await tmdbFetch(`/company/${currentCompany.tmdbId}`);
        if (j.homepage) {
          try {
            const u = new URL(j.homepage.startsWith('http') ? j.homepage : 'https://' + j.homepage);
            resolvedDomain = u.hostname.replace(/^www\./, '').toLowerCase();
            trace.push(`TMDB homepage: ${j.homepage}`);
          } catch {}
        }
      } catch (e) { trace.push('TMDB company lookup failed: ' + e.message); }
    }
  }

  // Step 3: Hunter email-finder against the new domain
  let foundEmail = null;
  let verify = null;
  if (resolvedDomain && HUNTER) {
    const [first, ...rest] = (person.name || '').trim().split(/\s+/);
    const last = rest.pop() || '';
    if (first && last) {
      try {
        const url = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(resolvedDomain)}&first_name=${encodeURIComponent(first)}&last_name=${encodeURIComponent(last)}&api_key=${HUNTER}`;
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 5000);
        const r = await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        if (r.ok) {
          const j = await r.json();
          const d = j?.data;
          if (d?.email) {
            const sources = (d.sources || []);
            let mostRecentSeen = null;
            sources.forEach(s => { if (s.last_seen_on && (!mostRecentSeen || s.last_seen_on > mostRecentSeen)) mostRecentSeen = s.last_seen_on; });
            foundEmail = {
              address: d.email.toLowerCase(),
              source: resolvedDomain,
              score: Number(d.score || 0),
              title: d.position || currentTitle,
              seniority: d.seniority || null,
              department: d.department || null,
              verification: d.verification?.result || null,
              verificationDate: d.verification?.date || null,
              lastSeenOn: mostRecentSeen,
              harvestedAt: new Date().toISOString(),
              addedAt: new Date().toISOString().slice(0, 10),
              _foundVia: opts.foundVia || 'find-newest-email',
            };
            trace.push(`Hunter HIT @ ${resolvedDomain}: ${d.email} (${d.score}%)`);
          } else {
            trace.push(`Hunter MISS @ ${resolvedDomain} for "${first} ${last}"`);
          }
        }
      } catch (e) { trace.push('Hunter find failed: ' + e.message); }

      if (foundEmail && !skipVerify) {
        try {
          const vUrl = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(foundEmail.address)}&api_key=${HUNTER}`;
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 4000);
          const vR = await fetch(vUrl, { signal: ctrl.signal });
          clearTimeout(tid);
          if (vR.ok) {
            const vJ = await vR.json();
            const vd = vJ?.data;
            if (vd) {
              verify = { status: vd.status, score: vd.score, smtp_check: vd.smtp_check };
              foundEmail.verification = vd.status;
              foundEmail.verificationDate = new Date().toISOString().slice(0, 10);
              trace.push(`SMTP verify: ${vd.status}`);
            }
          }
        } catch {}
      }
    }
  }

  // Step 4: build the updated person + (maybe) push new company
  const today = new Date().toISOString().slice(0, 10);
  let updatedPerson = { ...person };
  let companyIdForPerson = person.company_id;
  let companyNameForPerson = person.company;

  if (currentCompany && !resolvedCo) {
    const newCo = {
      id: makeId('c', currentCompany.name),
      name: currentCompany.name,
      type: 'prodco',
      tags: ['auto', 'find-newest-email'],
      notes: `Discovered via TMDB credit on "${latestProject}".`,
      _tmdbId: currentCompany.tmdbId,
      website: resolvedDomain ? 'https://' + resolvedDomain : '',
      _addedAt: new Date().toISOString(),
      _source: 'find-newest-email',
    };
    companies.push(newCo);
    resolvedCo = newCo;
    companyIdForPerson = newCo.id;
    companyNameForPerson = newCo.name;
    companiesChanged = true;
  } else if (resolvedCo) {
    companyIdForPerson = resolvedCo.id;
    companyNameForPerson = resolvedCo.name;
  }

  if (foundEmail) {
    const existingEmails = Array.isArray(person.emails) ? person.emails.slice() : (person.email ? [{ address: person.email, source: 'manual' }] : []);
    const oldCompanyName = person.company;
    const oldCompanyDomain = (() => {
      const oc = companies.find(c => c.name === oldCompanyName);
      return companyDomain(oc);
    })();
    const moved = oldCompanyName && companyNameForPerson && oldCompanyName !== companyNameForPerson;
    let mergedEmails = existingEmails.map(raw => {
      const em = (typeof raw === 'string') ? { address: raw, source: 'manual' } : { ...raw };
      if (moved && !em._archivedAt) {
        const eDom = emailDomain(em.address);
        const fromOld = (oldCompanyDomain && eDom === oldCompanyDomain)
                     || TALENT_AGENCY_DOMAINS_LC.has(eDom)
                     || (em.source && oldCompanyDomain && em.source.includes(oldCompanyDomain));
        if (fromOld) {
          em._archivedAt = new Date().toISOString();
          em._archivedReason = `person moved from ${oldCompanyName} to ${companyNameForPerson}`;
        }
      }
      return em;
    });
    const existingAddrs = new Set(mergedEmails.map(e => (typeof e === 'string' ? e : e.address).toLowerCase()));
    if (!existingAddrs.has(foundEmail.address)) mergedEmails.push(foundEmail);

    const noteAdd = ` [find-newest ${today} - "${latestProject}" -> ${currentCompany?.name} -> ${resolvedDomain || 'no domain'}${verify ? ' [SMTP ' + verify.status + ']' : ''}]`;
    updatedPerson = {
      ...person,
      email: foundEmail.address,
      emails: mergedEmails,
      company: companyNameForPerson,
      company_id: companyIdForPerson,
      title: currentTitle || person.title,
      notes: (person.notes || '') + noteAdd,
      _enrichedAt: new Date().toISOString(),
      _enrichSource: opts.foundVia || 'find-newest-email',
      _lastFindNewest: { at: new Date().toISOString(), foundAt: resolvedDomain, project: latestProject },
    };
  } else if (currentCompany && companyIdForPerson !== person.company_id) {
    updatedPerson = {
      ...person,
      company: companyNameForPerson,
      company_id: companyIdForPerson,
      title: currentTitle || person.title,
      notes: (person.notes || '') + ` [find-newest ${today} - detected move to ${companyNameForPerson} via "${latestProject}", no email yet]`,
      _enrichedAt: new Date().toISOString(),
      _lastFindNewest: { at: new Date().toISOString(), foundAt: null, project: latestProject },
    };
  } else {
    // Nothing actionable - just stamp the attempt timestamp so we don't re-try too soon
    updatedPerson = { ...person, _lastFindNewest: { at: new Date().toISOString(), attempted: true, found: false } };
  }

  return { updatedPerson, companiesChanged, found: !!foundEmail, currentCompany, currentTitle, latestProject, resolvedDomain, newEmail: foundEmail, verify, trace };
}

// Decorate every email on a person with _freshness + _isPrimary, sorted
// freshest-first. Run at GET time so the UI gets the intelligence without
// us mutating stored data.
function decoratePersonEmails(person, companiesById) {
  if (!person || !Array.isArray(person.emails)) return person;
  const currentCompany = person.company_id ? companiesById[person.company_id] : null;
  const decorated = person.emails.map(raw => {
    const em = (typeof raw === 'string') ? { address: raw, source: 'manual' } : { ...raw };
    const f = computeFreshness(em, person, currentCompany);
    em._freshness = f.score;
    em._freshnessReasons = f.reasons;
    return em;
  });
  decorated.sort((a, b) => (b._freshness || 0) - (a._freshness || 0));
  if (decorated.length) decorated[0]._isPrimary = true;
  return { ...person, emails: decorated, _primaryEmail: decorated[0]?.address || person.email || '' };
}

exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const auth = await requireAuth(event);
  if (!auth) return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: 'auth required' }) };

  try {
    const { store, companies, people } = await loadStore();

    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};
      const q = (params.q || '').trim();
      const type = (params.type || '').trim();
      const tag = (params.tag || '').trim();
      const dept = (params.dept || '').trim();
      // SERVER-SIDE PAGINATION. AWS Lambda caps response at 6MB. With 16k+
      // contacts the unpaginated payload was ~10MB, causing "Error: unknown"
      // on the client. Default to 2000 rows per call (well under the cap),
      // client can call again with offset to fetch more.
      const limit  = Math.min(5000, Math.max(1, parseInt(params.limit, 10)  || 2000));
      const offset = Math.max(0, parseInt(params.offset, 10) || 0);

      let cs = companies;
      if (type) cs = cs.filter(c => (c.type || '') === type);
      if (tag) cs = cs.filter(c => (c.tags || []).includes(tag));
      if (q) cs = cs.filter(c => matchesQuery(c, q));

      let ps = people;
      if (dept) ps = ps.filter(p => (p.dept || '') === dept);
      if (q) ps = ps.filter(p => matchesQuery(p, q));

      // attach company name to people for UI + freshness-decorate emails so
      // the UI can highlight the most-likely-current address and demote the
      // stale ones (old agency emails after a contact moves in-house, etc).
      const cmap = Object.fromEntries(companies.map(c => [c.id, c]));
      const pAug = ps.map(p => {
        const aug = { ...p, _companyName: cmap[p.company_id]?.name || null, _companyType: cmap[p.company_id]?.type || null };
        return decoratePersonEmails(aug, cmap);
      });

      const types = Array.from(new Set(companies.map(c => c.type).filter(Boolean))).sort();
      const tags = Array.from(new Set(companies.flatMap(c => c.tags || []))).sort();
      const depts = Array.from(new Set(people.map(p => p.dept).filter(Boolean))).sort();

      // Apply pagination to the actual rows shipped over the wire.
      const csPage = cs.slice(offset, offset + limit);
      const psPage = pAug.slice(offset, offset + limit);

      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          ok: true,
          companies: csPage,
          people: psPage,
          paging: {
            limit, offset,
            companiesReturned: csPage.length,
            peopleReturned: psPage.length,
            companiesHasMore: cs.length > offset + csPage.length,
            peopleHasMore: pAug.length > offset + psPage.length,
          },
          total: { companies: companies.length, people: people.length, filteredCompanies: cs.length, filteredPeople: pAug.length },
          facets: { types, tags, depts },
        }),
      };
    }

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'method not allowed' }) };
    }

    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'bad json' }) }; }
    const action = body.action;

    if (action === 'addCompany') {
      const c = body.company || {};
      if (!c.name) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'name required' }) };
      const id = c.id || makeId('c', c.name);
      const row = { ...c, id, _addedAt: new Date().toISOString(), _addedBy: auth.sub || 'admin' };
      const next = companies.filter(x => x.id !== id).concat(row);
      await store.set('companies', JSON.stringify(next));
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, id }) };
    }

    if (action === 'addPerson') {
      const p = body.person || {};
      if (!p.name) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'name required' }) };
      const id = p.id || makeId('p', p.name);
      const row = { ...p, id, _addedAt: new Date().toISOString(), _addedBy: auth.sub || 'admin' };
      const next = people.filter(x => x.id !== id).concat(row);
      await store.set('people', JSON.stringify(next));
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, id }) };
    }

    if (action === 'updateCompany' || action === 'updatePerson') {
      const key = action === 'updateCompany' ? 'companies' : 'people';
      const list = action === 'updateCompany' ? companies : people;
      const id = body.id;
      const patch = body.patch || {};
      const i = list.findIndex(x => x.id === id);
      if (i < 0) return { statusCode: 404, headers, body: JSON.stringify({ ok: false, error: 'not found' }) };
      list[i] = { ...list[i], ...patch, id, _updatedAt: new Date().toISOString() };
      await store.set(key, JSON.stringify(list));
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (action === 'deleteCompany' || action === 'deletePerson') {
      const key = action === 'deleteCompany' ? 'companies' : 'people';
      const list = action === 'deleteCompany' ? companies : people;
      const id = body.id;
      const next = list.filter(x => x.id !== id);
      await store.set(key, JSON.stringify(next));
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, removed: list.length - next.length }) };
    }

    if (action === 'enrich') {
      // FREE enrichment - no paid APIs. Strategy:
      //   1. Crawl the company's About/Team/Contact pages looking for the
      //      person's name nearby an email (mailto: or plain text).
      //   2. If not found there, crawl Wikipedia + Wikidata for biographical
      //      info and any linked official site / IMDb id.
      //   3. As a last resort, derive a likely email pattern from any
      //      same-domain emails already harvested in the deep-crawl
      //      (e.g. firstname@domain, first.last@domain) and surface them as
      //      *unverified candidates* (never silently set as verified).
      const id = body.personId;
      const person = people.find(p => p.id === id);
      if (!person) return { statusCode: 404, headers, body: JSON.stringify({ ok: false, error: 'person not found' }) };
      const company = companies.find(c => c.id === person.company_id);
      const found = { emails: [], phones: [], urls: [], wiki: null, candidates: [] };

      // ── Strategy 1: deep-crawl the company website for the name (parallel) ──
      if (company?.website) {
        const base = company.website.replace(/\/+$/, '');
        const paths = ['/team', '/leadership', '/about', '/contact'];
        const nameRe = new RegExp(person.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const emailRe = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;
        const phoneRe = /(?:(?:\+?1[\s.\-]?)?(?:\(?\d{3}\)?[\s.\-]?)\d{3}[\s.\-]?\d{4})/g;
        const fetchOne = async (p) => {
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 4000);
          try {
            const r = await fetch(base + p, {
              headers: { 'User-Agent': 'WETYR-FilmIntel/1.0 (+mailto:info@wetyr.com)' },
              signal: ctrl.signal,
            });
            if (!r.ok) return null;
            const html = (await r.text()).slice(0, 200_000);
            const m = html.match(nameRe);
            if (!m) return null;
            const idx = m.index || 0;
            const window = html.slice(Math.max(0, idx - 800), idx + 1500);
            return {
              url: base + p,
              emails: (window.match(emailRe) || []).map(e => e.toLowerCase()),
              phones: (window.match(phoneRe) || []),
            };
          } catch { return null; } finally { clearTimeout(tid); }
        };
        const results = await Promise.all(paths.map(fetchOne));
        results.filter(Boolean).forEach(r => {
          r.emails.forEach(e => found.emails.push(e));
          r.phones.forEach(ph => found.phones.push(ph));
          found.urls.push(r.url);
        });
      }

      // ── Strategy 2: Wikipedia summary (free, no auth) ──
      try {
        const wikiTitle = encodeURIComponent(person.name.replace(/\s+/g, '_'));
        const wr = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${wikiTitle}`, {
          headers: { 'User-Agent': 'WETYR-FilmIntel/1.0 (+mailto:info@wetyr.com)', Accept: 'application/json' },
        });
        if (wr.ok) {
          const wj = await wr.json();
          if (wj.type === 'standard' || wj.type === 'disambiguation') {
            found.wiki = {
              extract: wj.extract,
              url: wj.content_urls?.desktop?.page,
              imdb: null, // populated below from Wikidata
            };
          }
        }
      } catch { /* ignore */ }

      // ── Strategy 3: pattern candidates from same-domain harvested emails ──
      if (company?.website) {
        const domain = company.website.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
        const [first, ...rest] = (person.name || '').toLowerCase().split(/\s+/);
        const last = (rest.pop() || '').toLowerCase().replace(/[^a-z]/g, '');
        if (first && last) {
          // Only suggest patterns we've actually OBSERVED on this domain
          const observed = new Set();
          people.forEach(pp => {
            if (pp.email && pp.email.toLowerCase().endsWith('@' + domain)) {
              const local = pp.email.split('@')[0].toLowerCase();
              if (/^[a-z]+\.[a-z]+$/.test(local)) observed.add('first.last');
              else if (/^[a-z]+$/.test(local) && local.length > 2) observed.add('first');
              else if (/^[a-z]\.[a-z]+$/.test(local)) observed.add('f.last');
              else if (/^[a-z][a-z]+$/.test(local) && local.length > 3) observed.add('flast');
            }
          });
          if (observed.has('first.last')) found.candidates.push(`${first}.${last}@${domain}`);
          if (observed.has('first'))      found.candidates.push(`${first}@${domain}`);
          if (observed.has('f.last'))     found.candidates.push(`${first[0]}.${last}@${domain}`);
          if (observed.has('flast'))      found.candidates.push(`${first[0]}${last}@${domain}`);
        }
      }

      // ── Strategy 4 (OPTIONAL): Hunter.io email-finder ──
      // Runs if HUNTER_API_KEY is set in Netlify env. Two modes:
      //   (a) Person has a company website -> hit that one domain directly.
      //   (b) Person is unaffiliated talent (cast / director / DP / etc with
      //       no company link) -> fan out across the major Hollywood
      //       talent-agency domains (CAA, WME, UTA, Gersh, Paradigm, A3,
      //       APA, Buchwald, ICM, Verve) since talent emails ALWAYS route
      //       through reps. Save the highest-confidence hit.
      if (process.env.HUNTER_API_KEY) {
        // Top 5 agencies cover ~85% of working actors in the US/UK market.
        // Each click on unaffiliated talent burns 5 Hunter credits, so we
        // cap aggressively. Add more to this list if a contact is being
        // missed (CAA + WME + UTA alone catch most working actors).
        const TALENT_AGENCY_DOMAINS = [
          'caa.com', 'wmeagency.com', 'unitedtalent.com', 'gersh.com', 'paradigmagency.com',
        ];
        const [first, ...rest] = (person.name || '').trim().split(/\s+/);
        const last = rest.pop() || '';
        if (first && last) {
          const domains = [];
          if (company?.website) {
            domains.push(company.website.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, ''));
          } else {
            // Unaffiliated talent, fan out across agencies
            domains.push(...TALENT_AGENCY_DOMAINS);
          }
          const hits = [];
          await Promise.all(domains.map(async (domain) => {
            try {
              const url = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(first)}&last_name=${encodeURIComponent(last)}&api_key=${process.env.HUNTER_API_KEY}`;
              const hr = await fetch(url, { headers: { 'User-Agent': 'WETYR-FilmIntel/1.0 (+mailto:info@wetyr.com)', Accept: 'application/json' } });
              if (!hr.ok) return;
              const hj = await hr.json();
              const d = hj?.data;
              if (d?.email) {
                // Capture EVERY freshness-relevant field Hunter returns.
                // last_seen_on (per source) is the single best staleness
                // signal: it tells us when Hunter's crawl actually saw the
                // email in the wild.
                const sources = (d.sources || []);
                let mostRecentSeen = null;
                sources.forEach(s => {
                  if (s.last_seen_on && (!mostRecentSeen || s.last_seen_on > mostRecentSeen)) mostRecentSeen = s.last_seen_on;
                });
                hits.push({
                  domain,
                  email: d.email,
                  score: Number(d.score || 0),
                  position: d.position || null,
                  seniority: d.seniority || null,
                  department: d.department || null,
                  verification: d.verification?.result || null,
                  verificationDate: d.verification?.date || null,
                  lastSeenOn: mostRecentSeen,
                  sources: sources.slice(0, 2).map(s => ({ uri: s.uri, last_seen_on: s.last_seen_on })),
                });
              }
            } catch { /* skip this domain */ }
          }));
          // Sort by score desc. Save ALL hits - talent commonly has reps
          // at multiple agencies (CAA + theatrical, WME + commercials, etc),
          // and we want every contact path on the card. Source-tagged so
          // user can see which agency each email belongs to.
          hits.sort((a, b) => b.score - a.score);
          if (hits.length) {
            found.hunter = hits[0];           // best for primary email field
            found.hunterAll = hits;           // full list for emails[] array
            // Push ALL Hunter emails to found.emails (deduped)
            hits.forEach(h => {
              const e = h.email.toLowerCase();
              if (!found.emails.includes(e)) found.emails.push(e);
            });
            found.urls.push(`hunter: ${hits.length} agency hit(s) - top ${hits[0].domain} @${hits[0].score}%`);
            if (hits[0].sources?.[0]?.uri) found.urls.push(hits[0].sources[0].uri);
          }
        }
      }

      // ── Persist if ANY strategy found an email or phone ──
      const emailToSet = (found.emails || [])[0];
      const phoneToSet = (found.phones || [])[0];
      if (emailToSet || phoneToSet) {
        const i = people.findIndex(p => p.id === id);
        const today = new Date().toISOString().slice(0, 10);
        const sourceTag = found.hunter
          ? `Hunter ${found.hunter.score}% via ${found.hunter.domain} (${found.hunter.verification || 'unverified'})`
          : (found.urls[0] || 'site crawl');
        const noteAdd = ` [enriched ${today} - ${sourceTag}]`;

        // Build the multi-email list: existing email + all newly-found
        // emails, deduped, with source tag if we know it (Hunter agency).
        const existingEmails = Array.isArray(people[i].emails) ? people[i].emails.slice() : (people[i].email ? [{ address: people[i].email, source: 'manual' }] : []);
        const existingAddrs = new Set(existingEmails.map(e => (typeof e === 'string' ? e : e.address).toLowerCase()));
        const newEmails = [];
        if (found.hunterAll && found.hunterAll.length) {
          // Hunter mode - capture full metadata so freshness scoring can work
          found.hunterAll.forEach(h => {
            const addr = h.email.toLowerCase();
            if (!existingAddrs.has(addr)) {
              newEmails.push({
                address: addr,
                source: h.domain,
                score: h.score,
                title: h.position || null,        // role at time Hunter saw it
                seniority: h.seniority || null,
                department: h.department || null,
                verification: h.verification,
                verificationDate: h.verificationDate || null,
                lastSeenOn: h.lastSeenOn || null,  // Hunter's last sighting date
                harvestedAt: new Date().toISOString(),
                addedAt: today,
              });
              existingAddrs.add(addr);
            }
          });
        } else {
          // Site-crawl / candidate mode - just the address
          (found.emails || []).forEach(e => {
            const addr = String(e).toLowerCase();
            if (!existingAddrs.has(addr)) {
              newEmails.push({ address: addr, source: 'site-crawl', addedAt: today });
              existingAddrs.add(addr);
            }
          });
        }
        let mergedEmails = existingEmails.concat(newEmails);

        // ── AUTO-ARCHIVE ON COMPANY CHANGE ──
        // If we have a previous company on this person AND we're scraping for
        // a different company today, the existing emails sourced from the OLD
        // company are presumed stale. Mark (don't delete) so freshness scoring
        // demotes them and the UI can collapse them under "Historical".
        if (company && company.name && people[i].company && people[i].company !== company.name) {
          const oldCompanyDomain = (() => {
            const oldCo = companies.find(c => c.name === people[i].company);
            return companyDomain(oldCo);
          })();
          if (oldCompanyDomain) {
            mergedEmails = mergedEmails.map(em => {
              if (typeof em === 'string') return em;
              const eDom = emailDomain(em.address);
              const fromOld = eDom === oldCompanyDomain || (em.source && em.source.includes(oldCompanyDomain));
              if (fromOld && !em._archivedAt) {
                return { ...em, _archivedAt: new Date().toISOString(), _archivedReason: `person moved from ${people[i].company} to ${company.name}` };
              }
              return em;
            });
          }
        }

        // Primary email: pick the freshest (composite score), not just the
        // newest Hunter hit. This prevents a low-confidence agency hit from
        // overwriting a verified production-co address.
        const cmapPrim = Object.fromEntries(companies.map(c => [c.id, c]));
        const tmpPersonForRank = { ...people[i], emails: mergedEmails, company_id: people[i].company_id };
        const ranked = decoratePersonEmails(tmpPersonForRank, cmapPrim).emails;
        const primaryEmail = ranked[0]?.address
                          || (found.hunter && found.hunter.email && found.hunter.email.toLowerCase())
                          || people[i].email
                          || emailToSet
                          || '';

        people[i] = {
          ...people[i],
          email: primaryEmail,
          emails: mergedEmails,
          phone: people[i].phone || phoneToSet || '',
          notes: (people[i].notes || '') + noteAdd,
          _enrichedAt: new Date().toISOString(),
          _enrichSource: found.hunter ? 'hunter' : 'site-crawl',
          _hunterScore: found.hunter?.score,
        };
        await store.set('people', JSON.stringify(people));
        return { statusCode: 200, headers, body: JSON.stringify({
          ok: true,
          verified: true,
          saved: { email: people[i].email, emails: mergedEmails, phone: people[i].phone },
          person: people[i],
          found,
        }) };
      }
      const reasonMsg = company?.website
        ? 'No verified email on company site. Returning unverified candidates / wiki only.'
        : 'No company linked. Searched ' + (process.env.HUNTER_API_KEY ? 'CAA, WME, UTA, Gersh, Paradigm via Hunter + Wikipedia' : 'Wikipedia only') + '. Tip: edit this contact and link them to their agency for better results.';
      return { statusCode: 200, headers, body: JSON.stringify({
        ok: !!(found.candidates.length || found.wiki || found.hunter),
        verified: false,
        reason: reasonMsg,
        found,
      }) };
    }

    if (action === 'enrich-company') {
      // Pull every contact channel for a company:
      //   1. Hunter.io domain-search (1 paid call, returns up to 10 indexed
      //      emails with name/title/dept/score per company domain).
      //   2. Site crawl /team /about /contact /press /investors for extra
      //      emails + phone numbers via regex.
      // Persists to company.emails[] = [{address, source, score?, name?, title?, addedAt}]
      // Keeps company.email + .email_secondary as the top two for backward compat.
      const id = body.companyId;
      const company = companies.find(c => c.id === id);
      if (!company) return { statusCode: 404, headers, body: JSON.stringify({ ok: false, error: 'company not found' }) };
      const found = { emails: [], phones: [], urls: [], hunterEmails: [], hunterMeta: null, candidates: [] };

      // Extract domain from website
      let domain = '';
      if (company.website) {
        try {
          const u = new URL(company.website.startsWith('http') ? company.website : 'https://' + company.website);
          domain = u.hostname.replace(/^www\./, '').toLowerCase();
        } catch { /* ignore */ }
      }

      // ── Strategy 1: Hunter.io domain-search ──
      if (domain && process.env.HUNTER_API_KEY) {
        try {
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 6000);
          const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=25&api_key=${process.env.HUNTER_API_KEY}`;
          const r = await fetch(url, { signal: ctrl.signal });
          clearTimeout(tid);
          if (r.ok) {
            const j = await r.json();
            const data = j?.data || {};
            found.hunterMeta = {
              organization: data.organization || null,
              pattern: data.pattern || null,
              total: data.emails?.length || 0,
            };
            (data.emails || []).forEach(e => {
              if (!e.value) return;
              found.hunterEmails.push({
                address: e.value.toLowerCase(),
                first_name: e.first_name || '',
                last_name: e.last_name || '',
                position: e.position || '',
                department: e.department || '',
                seniority: e.seniority || '',
                confidence: Number(e.confidence || 0),
                verification: e.verification?.status || null,
                sources: (e.sources || []).slice(0, 1).map(s => s.uri).filter(Boolean),
              });
              found.emails.push(e.value.toLowerCase());
            });
            found.urls.push(`hunter: ${found.hunterEmails.length} email(s) for ${domain}`);
          }
        } catch { /* skip */ }
      }

      // ── Strategy 2: site crawl for emails + phones ──
      if (company.website) {
        const base = company.website.replace(/\/+$/, '');
        const paths = ['/', '/team', '/about', '/contact', '/press', '/investors'];
        const emailRe = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;
        const phoneRe = /(?:(?:\+?1[\s.\-]?)?(?:\(?\d{3}\)?[\s.\-]?)\d{3}[\s.\-]?\d{4})/g;
        const BAD = /(example|sentry|wixpress|godaddy|cloudflare|squarespace|@2x|@3x|\.png|\.jpg|\.svg|\.webp)/i;
        const fetchOne = async (p) => {
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 4000);
          try {
            const r = await fetch(base + p, {
              headers: { 'User-Agent': 'WETYR-FilmIntel/1.0 (+mailto:info@wetyr.com)' },
              signal: ctrl.signal,
            });
            if (!r.ok) return null;
            const html = (await r.text()).slice(0, 250_000);
            return {
              url: base + p,
              emails: (html.match(emailRe) || []).filter(e => !BAD.test(e)).map(e => e.toLowerCase()),
              phones: (html.match(phoneRe) || []),
            };
          } catch { return null; } finally { clearTimeout(tid); }
        };
        const results = await Promise.all(paths.map(fetchOne));
        results.filter(Boolean).forEach(r => {
          r.emails.forEach(e => { if (!found.emails.includes(e)) found.emails.push(e); });
          r.phones.forEach(ph => { if (!found.phones.includes(ph)) found.phones.push(ph); });
          if (r.emails.length || r.phones.length) found.urls.push(r.url);
        });
      }

      // ── Persist if we found anything ──
      if (found.emails.length || found.phones.length) {
        const i = companies.findIndex(c => c.id === id);
        const today = new Date().toISOString().slice(0, 10);

        // Build emails[] array, deduped against existing
        const existingEmails = Array.isArray(companies[i].emails)
          ? companies[i].emails.slice()
          : [
              ...(companies[i].email ? [{ address: companies[i].email, source: 'manual' }] : []),
              ...(companies[i].email_secondary ? [{ address: companies[i].email_secondary, source: 'manual' }] : []),
            ];
        const existingAddrs = new Set(existingEmails.map(e => (typeof e === 'string' ? e : e.address).toLowerCase()));

        // Add Hunter hits first (richer metadata), then site-crawl extras
        const newEmails = [];
        found.hunterEmails.forEach(h => {
          if (!existingAddrs.has(h.address)) {
            newEmails.push({
              address: h.address,
              source: 'hunter:' + (domain || 'domain-search'),
              score: h.confidence,
              name: [h.first_name, h.last_name].filter(Boolean).join(' '),
              title: h.position,
              department: h.department,
              verification: h.verification,
              addedAt: today,
            });
            existingAddrs.add(h.address);
          }
        });
        found.emails.forEach(addr => {
          const lo = addr.toLowerCase();
          if (!existingAddrs.has(lo)) {
            newEmails.push({ address: lo, source: 'site-crawl', addedAt: today });
            existingAddrs.add(lo);
          }
        });
        const mergedEmails = existingEmails.concat(newEmails);

        // Phones array
        const existingPhones = Array.isArray(companies[i].phones)
          ? companies[i].phones.slice()
          : [
              ...(companies[i].phone ? [companies[i].phone] : []),
              ...(companies[i].phone_secondary ? [companies[i].phone_secondary] : []),
            ];
        const phoneSet = new Set(existingPhones.map(p => String(p).replace(/\D/g, '')));
        const mergedPhones = existingPhones.slice();
        found.phones.forEach(ph => {
          const k = String(ph).replace(/\D/g, '');
          if (k.length >= 10 && k.length <= 15 && !phoneSet.has(k)) {
            mergedPhones.push(ph);
            phoneSet.add(k);
          }
        });

        // Primary email + secondary stay populated for backward compat
        const primaryEmail = mergedEmails[0]
          ? (typeof mergedEmails[0] === 'string' ? mergedEmails[0] : mergedEmails[0].address)
          : (companies[i].email || '');
        const secondaryEmail = mergedEmails[1]
          ? (typeof mergedEmails[1] === 'string' ? mergedEmails[1] : mergedEmails[1].address)
          : (companies[i].email_secondary || '');

        const sourceTag = found.hunterEmails.length
          ? `Hunter ${found.hunterEmails.length} email(s) for ${domain}`
          : (found.urls[0] || 'site crawl');
        const noteAdd = ` [enriched ${today} - ${sourceTag}]`;

        companies[i] = {
          ...companies[i],
          email: primaryEmail,
          email_secondary: secondaryEmail,
          emails: mergedEmails,
          phone: mergedPhones[0] || companies[i].phone || '',
          phone_secondary: mergedPhones[1] || companies[i].phone_secondary || '',
          phones: mergedPhones,
          notes: (companies[i].notes || '') + noteAdd,
          _enrichedAt: new Date().toISOString(),
          _enrichSource: found.hunterEmails.length ? 'hunter+crawl' : 'site-crawl',
        };
        await store.set('companies', JSON.stringify(companies));
        return { statusCode: 200, headers, body: JSON.stringify({
          ok: true,
          verified: true,
          saved: { addedEmails: newEmails.length, totalEmails: mergedEmails.length, totalPhones: mergedPhones.length },
          company: companies[i],
          found,
        }) };
      }

      return { statusCode: 200, headers, body: JSON.stringify({
        ok: !!(found.urls.length),
        verified: false,
        reason: domain
          ? (process.env.HUNTER_API_KEY ? 'No emails/phones found via Hunter or site crawl.' : 'No HUNTER_API_KEY set; site crawl alone returned nothing.')
          : 'No website on file. Add a website to this company so we can crawl it.',
        found,
      }) };
    }

    if (action === 'freshen-batch') {
      // ── BULK FRESHEN: walk the rolodex finding stale primary emails and
      //    re-running the find-newest pipeline on each. Strict wall-clock
      //    budget so we don't hit the 26s function timeout - returns a
      //    cursor and the client can call again to continue.
      // body: { limit?: number, threshold?: number, offset?: number }
      //   limit     - max contacts to process this call (default 5, max 12)
      //   threshold - freshness score below which we re-fresh (default 60)
      //   offset    - skip the first N candidates (for pagination)
      const t0 = Date.now();
      const BUDGET_MS = 22_000;
      const limit = Math.min(12, Math.max(1, parseInt(body.limit, 10) || 5));
      const threshold = Math.max(0, Math.min(150, parseInt(body.threshold, 10) || 60));
      const offset = Math.max(0, parseInt(body.offset, 10) || 0);

      // Score everyone, find candidates whose top email is below threshold
      // OR who have no email at all but DO have a name (could discover one).
      const cmap = Object.fromEntries(companies.map(c => [c.id, c]));
      const candidates = [];
      for (const p of people) {
        const dec = decoratePersonEmails(p, cmap);
        const topScore = dec.emails?.[0]?._freshness ?? -1;
        const everScraped = !!p._lastFindNewest?.at;
        // Skip if recently scraped (within 14 days) and didn't find anything
        if (everScraped && p._lastFindNewest && !p._lastFindNewest.foundAt && p._lastFindNewest.attempted) {
          const ageDays = (Date.now() - new Date(p._lastFindNewest.at).getTime()) / 86400000;
          if (ageDays < 14) continue;
        }
        // Need either: no emails, or a stale top email
        if (dec.emails?.length === 0 || topScore < threshold) {
          candidates.push({ p, topScore });
        }
      }
      candidates.sort((a, b) => a.topScore - b.topScore); // worst first
      const total = candidates.length;
      const slice = candidates.slice(offset, offset + limit);

      // Snapshot ONCE before mutating the batch
      const snapKey = await snapshotBeforeWrite(store, 'freshen-batch');

      const results = [];
      let processed = 0;
      let foundCount = 0;
      let companiesMutated = false;
      let bailed = false;
      for (const { p, topScore } of slice) {
        if (Date.now() - t0 > BUDGET_MS) { bailed = true; break; }
        try {
          const res = await findNewestForPerson(p, companies, { foundVia: 'freshen-batch', skipVerify: true });
          // Replace the person in-place
          const idx = people.findIndex(x => x.id === p.id);
          if (idx >= 0) people[idx] = res.updatedPerson;
          if (res.companiesChanged) companiesMutated = true;
          if (res.found) foundCount++;
          results.push({
            name: p.name,
            wasScore: topScore,
            found: res.found,
            newEmail: res.newEmail?.address || null,
            currentCompany: res.currentCompany?.name || null,
            project: res.latestProject || null,
            traceLast: res.trace.slice(-2),
          });
          processed++;
        } catch (e) {
          results.push({ name: p.name, wasScore: topScore, error: e.message });
          processed++;
        }
      }

      // Persist once at the end of the batch
      if (processed > 0) {
        await store.set('people', JSON.stringify(people));
        if (companiesMutated) await store.set('companies', JSON.stringify(companies));
      }

      const nextOffset = offset + processed;
      return { statusCode: 200, headers, body: JSON.stringify({
        ok: true,
        processed,
        foundCount,
        bailed,
        runMs: Date.now() - t0,
        snapshotKey: snapKey,
        paging: {
          offset, limit, nextOffset,
          totalCandidates: total,
          hasMore: nextOffset < total && !bailed,
          remaining: Math.max(0, total - nextOffset),
        },
        threshold,
        results,
      }) };
    }

    if (action === 'find-newest-email') {
      // ── INTELLIGENCE LAYER: find a contact's CURRENT email (single) ──
      // Delegates to the shared findNewestForPerson() helper. SMTP verify on,
      // since this is one-at-a-time and the user wants the strongest signal.
      const id = body.personId;
      const person = people.find(p => p.id === id);
      if (!person) return { statusCode: 404, headers, body: JSON.stringify({ ok: false, error: 'person not found' }) };

      const res = await findNewestForPerson(person, companies, { foundVia: 'find-newest-email', skipVerify: false });
      const idx = people.findIndex(x => x.id === id);
      if (idx >= 0) people[idx] = res.updatedPerson;
      await store.set('people', JSON.stringify(people));
      if (res.companiesChanged) await store.set('companies', JSON.stringify(companies));

      return { statusCode: 200, headers, body: JSON.stringify({
        ok: true,
        found: res.found,
        person: people[idx],
        currentCompany: res.currentCompany,
        currentTitle: res.currentTitle,
        latestProject: res.latestProject,
        resolvedDomain: res.resolvedDomain,
        newEmail: res.newEmail,
        verify: res.verify,
        trace: res.trace,
      }) };
    }

    if (action === 'reset') {
      // Wipe + re-seed (admin escape hatch). Snapshot first so it can be undone.
      await snapshotBeforeWrite(store, 'pre-reset');
      await store.set('companies', JSON.stringify(SEED_COMPANIES.slice()));
      await store.set('people', JSON.stringify(SEED_PEOPLE.slice()));
      await store.set('_meta', JSON.stringify( { resetAt: new Date().toISOString(), version: 1 }));
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, reset: true }) };
    }

    if (action === 'listSnapshots') {
      const list = await store.list({ prefix: '_snapshot_' });
      const keys = (list.blobs || []).map(b => b.key).sort().reverse();
      // Pull metadata for each (small read - just the header)
      const snaps = [];
      for (const k of keys.slice(0, 20)) {
        try {
          const s = await store.get(k, { type: 'json' });
          snaps.push({
            key: k,
            at: s?.at || null,
            label: s?.label || null,
            companiesCount: s?.companiesCount ?? 0,
            peopleCount: s?.peopleCount ?? 0,
          });
        } catch { /* skip */ }
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, snapshots: snaps }) };
    }

    if (action === 'snapshotNow') {
      const key = await snapshotBeforeWrite(store, body.label || 'manual');
      return { statusCode: 200, headers, body: JSON.stringify({ ok: !!key, key }) };
    }

    if (action === 'restoreSnapshot') {
      const key = body.key;
      if (!key || !/^_snapshot_/.test(key)) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'invalid snapshot key' }) };
      const snap = await store.get(key, { type: 'json' });
      if (!snap || !Array.isArray(snap.companies) || !Array.isArray(snap.people)) {
        return { statusCode: 404, headers, body: JSON.stringify({ ok: false, error: 'snapshot not found or malformed' }) };
      }
      // Snapshot the CURRENT state before restoring (so the restore is itself undoable)
      await snapshotBeforeWrite(store, 'pre-restore-of-' + key);
      await store.set('companies', JSON.stringify(snap.companies));
      await store.set('people', JSON.stringify(snap.people));
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, restored: { companies: snap.companies.length, people: snap.people.length, from: key, takenAt: snap.at } }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'unknown action' }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: e.message, stack: (e.stack || '').split('\n').slice(0, 3) }) };
  }
};
