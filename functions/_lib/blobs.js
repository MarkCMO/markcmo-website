// blobs.js
// Cloudflare KV-backed implementation of the Netlify Blobs API surface.
// Lets the existing 65 functions that use `require('@netlify/blobs')`
// or `require('./blobs')` (Netlify's wrapper) keep working unchanged.
//
// Mapping:
//   Netlify Blobs store name "facility-listings"  -> Cloudflare KV binding BLOBS_FACILITY_LISTINGS
//   Netlify Blobs store name "claim-queue"        -> KV binding BLOBS_CLAIM_QUEUE
//   Netlify Blobs store name "email-templates"    -> KV binding BLOBS_EMAIL_TEMPLATES
//   etc.
//
// Convention: KV binding name = "BLOBS_" + store name uppercase with
// hyphens converted to underscores. The shim picks the right binding
// at runtime from `getStore(name)`.
//
// Operations supported (matches @netlify/blobs interface):
//   store.get(key, { type: 'json' })  -> Promise<value | null>
//   store.set(key, value)             -> Promise<void>
//   store.setJSON(key, value)         -> Promise<void>
//   store.delete(key)                 -> Promise<void>
//   store.list({ prefix, cursor })    -> Promise<{ blobs: [{key}], cursor }>
//
// Limitations vs Netlify Blobs:
//   - Cloudflare KV is eventually consistent (60s edge propagation).
//     Most reads in this app are not on the hot path, so this is fine.
//   - KV per-key max size: 25 MB (Netlify Blobs is 5 GB). Big objects
//     should go to R2 instead. Check before storing photos here.

let _kvBindings = {};

export function _installKvBindings(env) {
  _kvBindings = {};
  for (const [k, v] of Object.entries(env || {})) {
    if (k.startsWith('BLOBS_') && v && typeof v.get === 'function' && typeof v.put === 'function') {
      // Map "BLOBS_FACILITY_LISTINGS" -> "facility-listings"
      const storeName = k.replace(/^BLOBS_/, '').toLowerCase().replace(/_/g, '-');
      _kvBindings[storeName] = v;
    }
  }
}

function getKv(storeName) {
  const kv = _kvBindings[storeName];
  if (!kv) {
    console.warn('[blobs-shim] No KV binding for store: ' + storeName + '. Set up wrangler.toml with [[kv_namespaces]] binding=BLOBS_' + storeName.toUpperCase().replace(/-/g, '_'));
  }
  return kv;
}

class StoreShim {
  constructor(name) {
    this.name = name;
  }

  async get(key, opts) {
    const kv = getKv(this.name);
    if (!kv) return null;
    const type = opts && opts.type;
    if (type === 'json') return kv.get(key, 'json').catch(() => null);
    if (type === 'arrayBuffer') return kv.get(key, 'arrayBuffer').catch(() => null);
    if (type === 'stream') return kv.get(key, 'stream').catch(() => null);
    return kv.get(key, 'text').catch(() => null);
  }

  async set(key, value) {
    const kv = getKv(this.name);
    if (!kv) return;
    return kv.put(key, value);
  }

  async setJSON(key, value) {
    const kv = getKv(this.name);
    if (!kv) return;
    return kv.put(key, JSON.stringify(value));
  }

  async delete(key) {
    const kv = getKv(this.name);
    if (!kv) return;
    return kv.delete(key);
  }

  async list(opts) {
    const kv = getKv(this.name);
    if (!kv) return { blobs: [], cursor: null };
    const result = await kv.list({
      prefix: (opts && opts.prefix) || undefined,
      cursor: (opts && opts.cursor) || undefined,
      limit: (opts && opts.limit) || 1000
    });
    return {
      blobs: (result.keys || []).map(k => ({ key: k.name, size: k.metadata?.size, etag: k.metadata?.etag })),
      cursor: result.cursor || null
    };
  }
}

export function getStore(name) {
  return new StoreShim(name);
}

// Default export mimics the @netlify/blobs ESM shape some files use
export default { getStore };
