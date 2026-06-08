// upload-html-to-kv.js
// Uploads ALL .html files in the repo to Cloudflare Workers KV so the
// catch-all CF Pages Function (functions/[[path]].js) can serve them.
//
// Called by .github/workflows/deploy.yml before `wrangler pages deploy`.
//
// Required env vars:
//   CF_API_KEY             — Cloudflare Global API Key (X-Auth-Key)
//   CF_EMAIL               — Cloudflare account email (X-Auth-Email)
//   CLOUDFLARE_ACCOUNT_ID  — CF account ID
//   KV_NAMESPACE_ID        — Target KV namespace ID
//
// Uses X-Auth-Email + X-Auth-Key auth (Global API Key) because the
// scoped CLOUDFLARE_API_TOKEN used for `wrangler pages deploy` only has
// Cloudflare Pages:Edit permission and cannot write to Workers KV.
//
// KV key format: repo-relative path with .html stripped.
//   index.html              → "index"
//   about.html              → "about"
//   courses/exam.html       → "courses/exam"
//   404.html                → "404"
'use strict';

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const CF_API_KEY   = process.env.CF_API_KEY;
const CF_EMAIL     = process.env.CF_EMAIL;
const ACCOUNT_ID   = process.env.CLOUDFLARE_ACCOUNT_ID;
const NAMESPACE_ID = process.env.KV_NAMESPACE_ID;

// Directories to skip entirely
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'tmp', '.git', '.claude', '.netlify',
  '.wrangler', '.cursor', 'functions', 'netlify', 'scripts',
  'cloudflare', 'supabase', '.github',
]);

// Max uncompressed body per CF KV bulk-put request. CF's hard limit is
// 100 MB but in practice 75 MB batches over many requests would push
// individual requests past CF's edge 100s timeout (HTTP 524). 8 MB keeps
// each upload comfortably under 30s wall clock even on slow runners.
const MAX_BATCH_BYTES = 8 * 1024 * 1024;

// Retry config for CF transient errors (524 gateway timeout, 5xx)
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 2000;

// -----------------------------------------------------------------
// Recursively find all .html files
// -----------------------------------------------------------------
function findHtml(dir, results) {
  results = results || [];
  let entries;
  try { entries = fs.readdirSync(dir); } catch (_) { return results; }

  for (const entry of entries) {
    if (entry.startsWith('.') && entry !== '.well-known') continue;
    if (SKIP_DIRS.has(entry)) continue;

    const full = path.join(dir, entry);
    let stat;
    try { stat = fs.statSync(full); } catch (_) { continue; }

    if (stat.isDirectory()) {
      findHtml(full, results);
    } else if (entry.endsWith('.html')) {
      results.push(full);
    }
  }
  return results;
}

// -----------------------------------------------------------------
// Convert a file path to a KV key
// -----------------------------------------------------------------
function toKey(filePath) {
  let key = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  if (key.endsWith('.html')) key = key.slice(0, -5);
  return key;
}

// -----------------------------------------------------------------
// PUT a batch of {key, value} pairs via CF KV Bulk Write API
// Auth: X-Auth-Email + X-Auth-Key (Global API Key)
// -----------------------------------------------------------------
function bulkPutOnce(pairs) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(pairs), 'utf8');

    const req = https.request({
      hostname: 'api.cloudflare.com',
      path:     `/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NAMESPACE_ID}/bulk`,
      method:   'PUT',
      headers: {
        'X-Auth-Email':   CF_EMAIL,
        'X-Auth-Key':     CF_API_KEY,
        'Content-Type':   'application/json',
        'Content-Length': body.length,
      },
      timeout: 90 * 1000, // socket timeout before CF's 100s edge timeout
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        // Transient CF errors (502/503/504/524) should be retried, not parsed
        if (res.statusCode === 502 || res.statusCode === 503 || res.statusCode === 504 || res.statusCode === 524) {
          return reject(new Error(`CF transient ${res.statusCode}`));
        }
        let parsed;
        try { parsed = JSON.parse(data); } catch (_) {
          return reject(new Error(
            `CF API non-JSON response (HTTP ${res.statusCode}): ${data.slice(0, 300)}`
          ));
        }
        if (parsed.success) {
          resolve(parsed);
        } else {
          reject(new Error(`CF KV bulk put failed: ${JSON.stringify(parsed.errors)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('socket timeout')); });
    req.write(body);
    req.end();
  });
}

// Retry wrapper: retries on transient CF errors + socket timeouts with
// exponential backoff. After MAX_RETRIES the original error escapes.
async function bulkPut(pairs) {
  let lastErr = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await bulkPutOnce(pairs);
    } catch (e) {
      lastErr = e;
      const msg = (e && e.message) || String(e);
      const transient = /transient|timeout|ECONN|ETIMEDOUT|EAI_AGAIN/i.test(msg);
      if (!transient || attempt === MAX_RETRIES) throw e;
      const wait = RETRY_BACKOFF_MS * Math.pow(2, attempt);
      console.warn(`  retry ${attempt + 1}/${MAX_RETRIES} after ${wait}ms (reason: ${msg.slice(0,60)})`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

// -----------------------------------------------------------------
// Main
// -----------------------------------------------------------------
async function main() {
  if (!CF_API_KEY || !CF_EMAIL || !ACCOUNT_ID || !NAMESPACE_ID) {
    console.error(
      'ERROR: Set CF_API_KEY, CF_EMAIL, CLOUDFLARE_ACCOUNT_ID, and KV_NAMESPACE_ID env vars.\n' +
      'CF_API_KEY must be the Cloudflare Global API Key (not the scoped Pages deploy token).\n' +
      'Add it as a GitHub Actions secret named CF_API_KEY.'
    );
    process.exit(1);
  }

  console.log('Scanning HTML files...');
  const files = findHtml(process.cwd());
  console.log(`Found ${files.length} HTML files`);

  let batchPairs    = [];
  let batchBytes    = 0;
  let batchNum      = 0;
  let totalUploaded = 0;

  async function flushBatch() {
    if (batchPairs.length === 0) return;
    batchNum++;
    const mb = (batchBytes / 1024 / 1024).toFixed(1);
    console.log(`Uploading batch ${batchNum}: ${batchPairs.length} keys (~${mb} MB)...`);
    await bulkPut(batchPairs);
    totalUploaded += batchPairs.length;
    console.log(`  Batch ${batchNum} done. Total uploaded: ${totalUploaded}/${files.length}`);
    batchPairs = [];
    batchBytes = 0;
  }

  for (const file of files) {
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch (e) {
      console.warn(`  Skipping ${file}: ${e.message}`);
      continue;
    }

    const key = toKey(file);
    const est = Math.ceil(Buffer.byteLength(content, 'utf8') * 1.12) + key.length + 40;

    if (batchPairs.length > 0 && batchBytes + est > MAX_BATCH_BYTES) {
      await flushBatch();
    }

    batchPairs.push({ key, value: content });
    batchBytes += est;
  }

  await flushBatch();

  console.log(
    `\nDone. Uploaded ${totalUploaded} HTML pages to KV namespace ${NAMESPACE_ID}` +
    ` in ${batchNum} batch(es).`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload shared components (footer.html → _footer, nav.html → _nav)
// These are fetched by functions/[[path]].js at request time to inject into
// every page served from KV.  Keyed with underscore prefix to distinguish them
// from real page content.
// ─────────────────────────────────────────────────────────────────────────────
async function uploadSharedComponents() {
  const pairs = [];
  for (const [file, key] of [['footer.html', '_footer'], ['nav.html', '_nav']]) {
    let value;
    try { value = fs.readFileSync(path.join(process.cwd(), file), 'utf8'); } catch (e) {
      console.warn(`  Skipping ${file}: ${e.message}`);
      continue;
    }
    pairs.push({ key, value });
  }
  if (pairs.length === 0) return;
  console.log(`Uploading shared components: ${pairs.map(p => p.key).join(', ')}...`);
  await bulkPut(pairs);
  console.log('  Shared components uploaded.');
}

main()
  .then(uploadSharedComponents)
  .catch(err => {
    console.error('upload-html-to-kv FAILED:', err.message || String(err));
    process.exit(1);
  });
