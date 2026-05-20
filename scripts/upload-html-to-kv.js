// scripts/upload-html-to-kv.js - Uploads all root-level HTML files to BLOBS_MARKCMO_PAGES_HTML KV
// Usage: node scripts/upload-html-to-kv.js [--dry-run]
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const KV_NS_ID = '0340e4af3ed44224ac380d1d35014834';
const BATCH_SIZE = 2000;
const DRY_RUN = process.argv.includes('--dry-run');

const rootDir = process.cwd();
const htmlFiles = fs.readdirSync(rootDir)
  .filter(f => f.endsWith('.html'));

console.log(`Found ${htmlFiles.length} HTML files`);
if (DRY_RUN) { console.log('DRY RUN - not uploading'); process.exit(0); }

let uploaded = 0;
let batch = [];
let batchNum = 0;

function flushBatch(b) {
  if (b.length === 0) return;
  batchNum++;
  const tmpFile = path.join(require('os').tmpdir(), `markcmo-html-batch-${batchNum}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify(b), 'utf8');
  console.log(`Uploading batch ${batchNum}: ${b.length} entries...`);
  try {
    execSync(`wrangler kv bulk put --namespace-id="${KV_NS_ID}" --remote "${tmpFile}"`, { stdio: 'inherit' });
  } catch(e) {
    console.error(`Batch ${batchNum} failed:`, e.message);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch(_) {}
  }
  uploaded += b.length;
  console.log(`Progress: ${uploaded}/${htmlFiles.length}`);
}

for (const f of htmlFiles) {
  const key = f.replace(/\.html$/, ''); // store without .html extension
  const html = fs.readFileSync(path.join(rootDir, f), 'utf8');
  batch.push({ key, value: html });
  if (batch.length >= BATCH_SIZE) {
    flushBatch(batch);
    batch = [];
  }
}
flushBatch(batch);
console.log(`Done. Uploaded ${uploaded} HTML files to KV namespace ${KV_NS_ID}`);