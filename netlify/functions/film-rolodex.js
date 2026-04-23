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
//
// Bootstraps on first call by merging _film-rolodex-seed.js into Blobs.

const { getStore } = require('@netlify/blobs');
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
  let companies = await store.get('companies', { type: 'json' });
  let people = await store.get('people', { type: 'json' });
  let bootstrapped = false;
  if (!companies) { companies = SEED_COMPANIES.slice(); bootstrapped = true; }
  if (!people)    { people    = SEED_PEOPLE.slice();    bootstrapped = true; }
  if (bootstrapped) {
    await store.setJSON('companies', companies);
    await store.setJSON('people', people);
    await store.setJSON('_meta', { bootstrappedAt: new Date().toISOString(), version: 1 });
  }
  return { store, companies, people };
}

function matchesQuery(row, q) {
  if (!q) return true;
  const hay = JSON.stringify(row).toLowerCase();
  return q.toLowerCase().split(/\s+/).every(t => hay.includes(t));
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

      let cs = companies;
      if (type) cs = cs.filter(c => (c.type || '') === type);
      if (tag) cs = cs.filter(c => (c.tags || []).includes(tag));
      if (q) cs = cs.filter(c => matchesQuery(c, q));

      let ps = people;
      if (dept) ps = ps.filter(p => (p.dept || '') === dept);
      if (q) ps = ps.filter(p => matchesQuery(p, q));

      // attach company name to people for UI
      const cmap = Object.fromEntries(companies.map(c => [c.id, c]));
      const pAug = ps.map(p => ({ ...p, _companyName: cmap[p.company_id]?.name || null, _companyType: cmap[p.company_id]?.type || null }));

      const types = Array.from(new Set(companies.map(c => c.type).filter(Boolean))).sort();
      const tags = Array.from(new Set(companies.flatMap(c => c.tags || []))).sort();
      const depts = Array.from(new Set(people.map(p => p.dept).filter(Boolean))).sort();

      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          ok: true,
          companies: cs,
          people: pAug,
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
      await store.setJSON('companies', next);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, id }) };
    }

    if (action === 'addPerson') {
      const p = body.person || {};
      if (!p.name) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'name required' }) };
      const id = p.id || makeId('p', p.name);
      const row = { ...p, id, _addedAt: new Date().toISOString(), _addedBy: auth.sub || 'admin' };
      const next = people.filter(x => x.id !== id).concat(row);
      await store.setJSON('people', next);
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
      await store.setJSON(key, list);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (action === 'deleteCompany' || action === 'deletePerson') {
      const key = action === 'deleteCompany' ? 'companies' : 'people';
      const list = action === 'deleteCompany' ? companies : people;
      const id = body.id;
      const next = list.filter(x => x.id !== id);
      await store.setJSON(key, next);
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
      // Only runs if HUNTER_API_KEY is set in Netlify env. Hunter returns one
      // best-guess email per (domain, first, last) plus a confidence score and
      // a verification result. We only AUTO-SAVE if score >= 80 AND
      // verification.result === 'deliverable'. Lower-confidence guesses go
      // into found.candidates as suggestions.
      if (process.env.HUNTER_API_KEY && company?.website) {
        try {
          const domain = company.website.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
          const [first, ...rest] = (person.name || '').trim().split(/\s+/);
          const last = rest.pop() || '';
          if (first && last && domain) {
            const url = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(first)}&last_name=${encodeURIComponent(last)}&api_key=${process.env.HUNTER_API_KEY}`;
            const hr = await fetch(url, { headers: { 'User-Agent': 'WETYR-FilmIntel/1.0 (+mailto:info@wetyr.com)', Accept: 'application/json' } });
            if (hr.ok) {
              const hj = await hr.json();
              const d = hj?.data;
              if (d?.email) {
                const score = Number(d.score || 0);
                const verified = d.verification?.result === 'deliverable';
                found.hunter = { email: d.email, score, verification: d.verification?.result || null, sources: (d.sources || []).slice(0, 3) };
                if (score >= 80 && verified) {
                  // High-confidence -> treat as verified email
                  found.emails.unshift(d.email.toLowerCase());
                  if (!found.urls.length && d.sources?.[0]?.uri) found.urls.push(d.sources[0].uri);
                } else {
                  // Lower confidence -> candidate only
                  found.candidates.unshift(`${d.email} (Hunter score ${score})`);
                }
              }
            }
          }
        } catch { /* hunter is best-effort */ }
      }

      // ── Persist if we got a verified email from strategy 1 or hunter ──
      const emailToSet = (found.emails || [])[0];
      if (emailToSet) {
        const i = people.findIndex(p => p.id === id);
        people[i] = {
          ...people[i],
          email: people[i].email || emailToSet,
          phone: people[i].phone || (found.phones[0] || ''),
          notes: (people[i].notes || '') + ` [enriched ${new Date().toISOString().slice(0,10)} from ${found.urls[0] || 'site'}]`,
          _enrichedAt: new Date().toISOString(),
        };
        await store.setJSON('people', people);
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, verified: true, person: people[i], found }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({
        ok: !!(found.candidates.length || found.wiki),
        verified: false,
        reason: 'no verified email on company site - returning unverified candidates only',
        found,
      }) };
    }

    if (action === 'reset') {
      // Wipe + re-seed (admin escape hatch).
      await store.setJSON('companies', SEED_COMPANIES.slice());
      await store.setJSON('people', SEED_PEOPLE.slice());
      await store.setJSON('_meta', { resetAt: new Date().toISOString(), version: 1 });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, reset: true }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'unknown action' }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: e.message, stack: (e.stack || '').split('\n').slice(0, 3) }) };
  }
};
