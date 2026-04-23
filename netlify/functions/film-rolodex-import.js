// netlify/functions/film-rolodex-import.js
// Bulk-import companies and/or people via pasted CSV.
// Expected headers (case-insensitive, any subset works):
//   companies: name, type, parent, hq, city, region, country, website, phone, imdb, sec_cik, tags, notes
//   people:    name, title, company, company_id, dept, email, phone, linkedin, imdb, notes, tags
//
// POST { mode: 'companies'|'people', csv: '<text>' }
//   -> { ok, mode, added, updated, skipped, total, errors[] }
//
// Same admin-cookie auth as film-rolodex.js.

const { getStore } = require('@netlify/blobs');

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

// Tiny RFC4180-ish CSV parser. Handles quoted fields, escaped quotes, CRLF.
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (inQ) {
      if (c === '"' && n === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v !== ''));
}

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function makeId(prefix, name) {
  const base = slug(name) || Math.random().toString(36).slice(2, 10);
  return `${prefix}-${base}-${Math.random().toString(36).slice(2, 6)}`;
}

function normalize(v) {
  if (v == null) return '';
  return String(v).trim();
}

exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'POST only' }) };

  const secret = process.env.ADMIN_SESSION_SECRET || process.env.TOKEN_SECRET || 'fallback';
  const cookies = parseCookies(event.headers.cookie || event.headers.Cookie || '');
  const token = cookies[COOKIE_NAME];
  const auth = token ? await verifyToken(token, secret) : null;
  if (!auth) return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: 'auth required' }) };

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'bad json' }) }; }

  const mode = body.mode === 'people' ? 'people' : 'companies';
  const csv = (body.csv || '').trim();
  if (!csv) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'csv body empty' }) };

  const rows = parseCSV(csv);
  if (rows.length < 2) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'need header row + at least 1 data row' }) };

  const headerRow = rows[0].map(h => normalize(h).toLowerCase());
  const dataRows = rows.slice(1);

  const colIdx = (name) => headerRow.indexOf(name);
  const get = (r, name) => {
    const i = colIdx(name);
    return i >= 0 ? normalize(r[i]) : '';
  };

  try {
    const store = getStore({ name: STORE_NAME, consistency: 'strong' });
    const existingCompanies = (await store.get('companies', { type: 'json' })) || [];
    const existingPeople = (await store.get('people', { type: 'json' })) || [];

    const errors = [];
    let added = 0, updated = 0, skipped = 0;

    if (mode === 'companies') {
      const byName = new Map(existingCompanies.map(c => [slug(c.name), c]));
      for (let r = 0; r < dataRows.length; r++) {
        const row = dataRows[r];
        const name = get(row, 'name');
        if (!name) { skipped++; continue; }
        const tagsField = get(row, 'tags');
        const company = {
          name,
          type: get(row, 'type') || 'prodco',
          parent: get(row, 'parent') || undefined,
          hq: get(row, 'hq') || undefined,
          city: get(row, 'city') || undefined,
          region: get(row, 'region') || undefined,
          country: get(row, 'country') || undefined,
          website: get(row, 'website') || undefined,
          phone: get(row, 'phone') || undefined,
          imdb: get(row, 'imdb') || undefined,
          sec_cik: get(row, 'sec_cik') || undefined,
          notes: get(row, 'notes') || undefined,
          tags: tagsField ? tagsField.split(/[;|,]/).map(t => t.trim()).filter(Boolean) : undefined,
        };
        // strip undefined
        Object.keys(company).forEach(k => company[k] === undefined && delete company[k]);

        const key = slug(name);
        const existing = byName.get(key);
        if (existing) {
          Object.assign(existing, company, { _updatedAt: new Date().toISOString(), _updatedBy: auth.sub || 'admin' });
          updated++;
        } else {
          const id = makeId('c', name);
          const row2 = { id, ...company, _addedAt: new Date().toISOString(), _addedBy: auth.sub || 'admin', _source: 'csv-import' };
          existingCompanies.push(row2);
          byName.set(key, row2);
          added++;
        }
      }
      await store.setJSON('companies', existingCompanies);
    } else {
      // people
      const cByName = new Map(existingCompanies.map(c => [slug(c.name), c.id]));
      const pByKey = new Map(existingPeople.map(p => [`${slug(p.name)}|${p.company_id || ''}`, p]));

      for (let r = 0; r < dataRows.length; r++) {
        const row = dataRows[r];
        const name = get(row, 'name');
        if (!name) { skipped++; continue; }
        const companyName = get(row, 'company');
        const companyIdRaw = get(row, 'company_id');
        const company_id = companyIdRaw || (companyName ? cByName.get(slug(companyName)) : undefined);
        if (companyName && !company_id) {
          errors.push(`row ${r + 2}: company "${companyName}" not found - person added without company link`);
        }
        const tagsField = get(row, 'tags');
        const person = {
          name,
          title: get(row, 'title') || undefined,
          company_id: company_id || undefined,
          dept: get(row, 'dept') || undefined,
          email: get(row, 'email') || undefined,
          phone: get(row, 'phone') || undefined,
          linkedin: get(row, 'linkedin') || undefined,
          imdb: get(row, 'imdb') || undefined,
          notes: get(row, 'notes') || undefined,
          tags: tagsField ? tagsField.split(/[;|,]/).map(t => t.trim()).filter(Boolean) : undefined,
        };
        Object.keys(person).forEach(k => person[k] === undefined && delete person[k]);

        const key = `${slug(name)}|${company_id || ''}`;
        const existing = pByKey.get(key);
        if (existing) {
          Object.assign(existing, person, { _updatedAt: new Date().toISOString(), _updatedBy: auth.sub || 'admin' });
          updated++;
        } else {
          const id = makeId('p', name);
          const row2 = { id, ...person, _addedAt: new Date().toISOString(), _addedBy: auth.sub || 'admin', _source: 'csv-import' };
          existingPeople.push(row2);
          pByKey.set(key, row2);
          added++;
        }
      }
      await store.setJSON('people', existingPeople);
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        ok: true, mode, added, updated, skipped,
        total: mode === 'companies' ? existingCompanies.length : existingPeople.length,
        errors,
      }),
    };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
