// upload-html-to-kv.js
// Uploads ALL .html files in the repo to Cloudflare Workers KV so the
// catch-all CF Pages Function (functions/[[path]].js) can serve them.
//
// Called by .github/workflows/deploy.yml before `wrangler pages deploy`.
//
// Required env vars:
//   CLOUDFLARE_API_TOKEN   — CF API token with KV:Edit permission
//   CLOUDFLARE_ACCOUNT_ID  — CF account ID (5b4ea6b5589fe12f29bea5d7e43fe03c)
//   KV_NAMESPACE_ID        — Target KV namespace (0340e4af3ed44224ac380d1d35014834)
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

const ACCOUNT_ID   = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN    = process.env.CLOUDFLARE_API_TOKEN;
const NAMESPACE_ID = process.env.KV_NAMESPACE_ID;

// Directories to skip entirely (no HTML served from here)
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'tmp', '.git', '.claude', '.netlify',
  '.wrangler', '.cursor', 'functions', 'netlify', 'scripts',
  'cloudflare', 'supabase', '.github',
]);

// Max body size per CF KV bulk-put request (CF hard limit: 100 MB)
const MAX_BATCH_BYTES = 75 * 1024 * 1024; // 75 MB safety margin

// -----------------------------------------------------------------
// Recursively find all .html files
// -----------------------------------------------------------------
function findHtml(dir, results) {
  results = results || [];
  let entries;
  try { entries = fs.readdirSync(dir); } catch (_) { return results; }

  for (const entry of entries) {
    // Skip hidden dirs except .well-known
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
// PUT a batch of {key, value} pairs to the CF KV Bulk Write API
// https://developers.cloudflare.com/api/resources/kv/subresources/namespace_bulk/
// -----------------------------------------------------------------
function bulkPut(pairs) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(pairs), 'utf8');

    const req = https.request({
      hostname: 'api.cloudflare.com',
      path:     `/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NAMESPACE_ID}/bulk`,
      method:   'PUT',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type':  'application/json',
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
  if (!ACCOUNT_ID || !API_TOKEN || !NAMESPACE_ID) {
    console.error(
      'ERROR: Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and KV_NAMESPACE_ID env vars.'
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
    // Rough byte estimate: content + ~10% JSON escape overhead + key + structural overhead
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
