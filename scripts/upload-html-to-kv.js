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

// Max uncompressed body per CF KV bulk-put request (CF hard limit: 100 MB)
const MAX_BATCH_BYTES = 75 * 1024 * 1024;

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
function bulkPut(pairs) {
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
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
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
    req.write(body);
    req.end();
  });
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

main().catch(err => {
  console.error('upload-html-to-kv FAILED:', err.message || String(err));
  process.exit(1);
});
