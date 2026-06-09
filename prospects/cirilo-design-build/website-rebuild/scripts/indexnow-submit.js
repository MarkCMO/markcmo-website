// indexnow-submit.js - push every public URL to IndexNow (Bing, Yandex, Seznam, Naver, etc.)
// for near-instant indexing. Run AFTER a deploy: node scripts/indexnow-submit.js
// Reads dist/sitemap.xml for the URL list. The key must match build.js INDEXNOW_KEY
// and be live at https://<host>/<key>.txt (build.js writes it into dist automatically).

const fs = require('fs');
const path = require('path');

const INDEXNOW_KEY = 'c1r110d8a7e94f2b8d6c0e5f3a1b9c7d';
const SITEMAP = path.join(__dirname, '..', 'dist', 'sitemap.xml');

function main() {
  if (!fs.existsSync(SITEMAP)) {
    console.error('No dist/sitemap.xml found. Run `node scripts/build.js` first.');
    process.exit(1);
  }
  const xml = fs.readFileSync(SITEMAP, 'utf8');
  const urls = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map(m => m[1].trim());
  if (!urls.length) { console.error('No URLs in sitemap.'); process.exit(1); }

  const host = new URL(urls[0]).host;
  const keyLocation = `https://${host}/${INDEXNOW_KEY}.txt`;

  // IndexNow accepts up to 10,000 URLs per request.
  const batches = [];
  for (let i = 0; i < urls.length; i += 10000) batches.push(urls.slice(i, i + 10000));

  console.log(`IndexNow: ${urls.length} URLs, host ${host}, key file ${keyLocation}`);

  (async () => {
    for (let b = 0; b < batches.length; b++) {
      const body = { host, key: INDEXNOW_KEY, keyLocation, urlList: batches[b] };
      try {
        const res = await fetch('https://api.indexnow.org/indexnow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(body)
        });
        console.log(`batch ${b + 1}/${batches.length}: HTTP ${res.status} (${batches[b].length} urls)`);
      } catch (e) {
        console.error(`batch ${b + 1} failed:`, e.message);
      }
    }
    console.log('IndexNow submission complete. 200 or 202 means accepted.');
  })();
}

main();
