// migrate-blobs-to-kv.js - Export Netlify Blobs -> Cloudflare KV for MarkCMO
// export NETLIFY_AUTH_TOKEN=... && export NETLIFY_SITE_ID=609d74ca-5f2a-4caa-aa7c-3f6922a7bcb4
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const STORES = [
  ['documents', 'BLOBS_DOCUMENTS'],
];

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const ONLY = (args.find(a => a.startsWith('--store=')) || '').split('=')[1] || null;
const BATCH_SIZE = 500;

async function loadBlobs() {
  try { return require('@netlify/blobs'); }
  catch (e) { console.error('Missing @netlify/blobs. Run: npm i @netlify/blobs'); process.exit(1); }
}
async function exportStore(getStore, storeName) {
  const store = getStore({ name: storeName, consistency: 'strong', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
  const items = [];
  let cursor = undefined;
  do {
    const result = await store.list({ cursor, limit: 1000 });
    for (const blob of (result.blobs || [])) {
      const value = await store.get(blob.key, { type: 'text' });
      if (value !== null) items.push({ key: blob.key, value });
    }
    cursor = result.cursor;
  } while (cursor);
  return items;
}
async function main() {
  const { getStore } = await loadBlobs();
  const targets = ONLY ? STORES.filter(([n]) => n === ONLY) : STORES;
  for (const [storeName, binding] of targets) {
    console.log(`\n--- ${storeName} -> ${binding} ---`);
    const items = await exportStore(getStore, storeName);
    console.log(`  fetched ${items.length} items`);
    if (DRY || items.length === 0) { console.log(DRY ? '  [dry-run]' : '  (empty)'); continue; }
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const tmp = fs.mkdtempSync(os.tmpdir() + '/markcmo-kv-') + '/batch.json';
      fs.writeFileSync(tmp, JSON.stringify(batch));
      execSync(`wrangler kv bulk put --binding="${binding}" "${tmp}" --remote`, { stdio: 'inherit' });
      fs.unlinkSync(tmp);
    }
  }
  console.log('\n=== Migration complete ===');
}
main().catch(e => { console.error(e); process.exit(1); });