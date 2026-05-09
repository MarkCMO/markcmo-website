// Drop-in @netlify/blobs replacement backed by Supabase kv_store table.
//
// Mimics the subset of the Netlify Blobs API used by:
//   - admin-upload.js
//   - film-rolodex.js
//   - film-rolodex-cron.js
//   - film-rolodex-deep-cron.js
//   - film-rolodex-import.js
//
// Supported: getStore(name | { name }) -> { get, set, setJSON, delete, list }
//
// Why this exists: after the Cloudflare migration there is no NETLIFY_BLOBS
// auto-context and no NETLIFY_TOKEN PAT. Supabase is already on this site
// (SUPABASE_URL + SUPABASE_SERVICE_KEY env vars), so we route every blob op
// through the kv_store table.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const REST = SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/kv_store` : null;

function authHeaders() {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'content-type': 'application/json'
  };
}

function getStore(arg) {
  const storeName = typeof arg === 'string' ? arg : (arg && arg.name);
  if (!storeName) throw new Error('getStore: name required');
  if (!REST || !SUPABASE_SERVICE_KEY) throw new Error('Supabase env not set (SUPABASE_URL/SUPABASE_SERVICE_KEY)');

  // Encode safely for PostgREST: we send store_name + key via filter params.
  const enc = (s) => encodeURIComponent(s);

  return {
    // store.get(key)         -> string
    // store.get(key, { type: 'json' }) -> parsed object (or null)
    async get(key, opts) {
      const r = await fetch(`${REST}?store_name=eq.${enc(storeName)}&key=eq.${enc(key)}&select=value,raw_text`, {
        headers: authHeaders()
      });
      if (!r.ok) throw new Error('kv_store get ' + r.status + ': ' + (await r.text()).slice(0, 200));
      const rows = await r.json();
      const row = rows[0];
      if (!row) return null;
      if (opts && opts.type === 'json') {
        // Prefer JSONB value; fall back to parsing raw_text for backward-compat.
        if (row.value !== null && row.value !== undefined) return row.value;
        if (row.raw_text) { try { return JSON.parse(row.raw_text); } catch { return null; } }
        return null;
      }
      // Default text behavior: return raw_text or stringified value
      if (row.raw_text) return row.raw_text;
      if (row.value !== null && row.value !== undefined) return JSON.stringify(row.value);
      return null;
    },

    // store.set(key, value) - value is typically a string (often JSON.stringify'd already)
    async set(key, value, _opts) {
      // Try to also store a parsed JSONB version when value is JSON.
      let jsonbValue = null;
      let raw = null;
      if (typeof value === 'string') {
        raw = value;
        try { jsonbValue = JSON.parse(value); } catch { jsonbValue = null; }
      } else {
        jsonbValue = value;
        raw = JSON.stringify(value);
      }
      const row = {
        store_name: storeName, key, value: jsonbValue, raw_text: raw,
        updated_at: new Date().toISOString()
      };
      const r = await fetch(`${REST}?on_conflict=store_name,key`, {
        method: 'POST',
        headers: { ...authHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(row)
      });
      if (!r.ok) throw new Error('kv_store set ' + r.status + ': ' + (await r.text()).slice(0, 200));
    },

    // store.setJSON(key, obj) - convenience alias used by some Netlify code paths
    async setJSON(key, obj, _opts) {
      const row = {
        store_name: storeName, key, value: obj, raw_text: null,
        updated_at: new Date().toISOString()
      };
      const r = await fetch(`${REST}?on_conflict=store_name,key`, {
        method: 'POST',
        headers: { ...authHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(row)
      });
      if (!r.ok) throw new Error('kv_store setJSON ' + r.status + ': ' + (await r.text()).slice(0, 200));
    },

    // store.delete(key)
    async delete(key) {
      const r = await fetch(`${REST}?store_name=eq.${enc(storeName)}&key=eq.${enc(key)}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (!r.ok && r.status !== 404) throw new Error('kv_store delete ' + r.status + ': ' + (await r.text()).slice(0, 200));
    },

    // store.list({ prefix }) -> { blobs: [{ key }, ...] }
    async list(opts) {
      const prefix = (opts && opts.prefix) || '';
      const url = prefix
        ? `${REST}?store_name=eq.${enc(storeName)}&key=like.${enc(prefix)}*&select=key&order=key.asc&limit=1000`
        : `${REST}?store_name=eq.${enc(storeName)}&select=key&order=key.asc&limit=1000`;
      const r = await fetch(url, { headers: authHeaders() });
      if (!r.ok) throw new Error('kv_store list ' + r.status + ': ' + (await r.text()).slice(0, 200));
      const rows = await r.json();
      return { blobs: rows.map(row => ({ key: row.key })) };
    }
  };
}

module.exports = { getStore };
