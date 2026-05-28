// purge-cf-cache.js
//
// Purges Cloudflare edge cache for markcmo.com after a Pages deploy.
// Solves the "immutable cache strands old CSS at the edge" problem when
// non-content-hashed assets (style.css) change.
//
// Why this exists:
//   _headers had `Cache-Control: max-age=31536000, immutable` on /style.css.
//   CF Pages auto-purges files that change on deploy, but the immutable hint
//   tells CF (and browsers) to keep the cached copy regardless. Result: a
//   CSS contrast fix deployed at the origin, but visitors kept seeing the
//   4-day-old stylesheet (Age: 347766). This script forces a hard purge of
//   the canonical asset URLs after every successful deploy.
//
// Required env vars (already provided by deploy.yml from GH secrets):
//   CF_API_KEY            — Cloudflare Global API Key
//   CF_EMAIL              — Cloudflare account email
//   CLOUDFLARE_ACCOUNT_ID — CF account ID (not used by purge directly but kept for parity)
//
// We resolve zone_id at runtime by hostname → no need to hardcode it.

'use strict';

const https = require('https');

const CF_API_KEY = process.env.CF_API_KEY;
const CF_EMAIL   = process.env.CF_EMAIL;
const ZONE_NAME  = process.env.CF_ZONE_NAME || 'markcmo.com';

// URLs to nuke after each deploy. Add to this list when a new
// non-versioned asset starts misbehaving on cache.
const URLS_TO_PURGE = [
  'https://markcmo.com/style.css',
  'https://markcmo.com/components.js',
  'https://markcmo.com/components-loader.js',
  'https://markcmo.com/linkedin-widget.js',
  'https://markcmo.com/footer.html',
  'https://markcmo.com/nav.html',
  'https://markcmo.com/_headers',
];

function cfFetch(method, path, body) {
  return new Promise((resolve, reject) => {
    const headers = {
      'X-Auth-Email': CF_EMAIL,
      'X-Auth-Key': CF_API_KEY,
      'Content-Type': 'application/json',
    };
    const payload = body ? JSON.stringify(body) : null;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    const req = https.request({
      hostname: 'api.cloudflare.com',
      path: '/client/v4' + path,
      method,
      headers,
    }, res => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(chunks);
          resolve({ status: res.statusCode, data });
        } catch (e) {
          resolve({ status: res.statusCode, data: { raw: chunks } });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  if (!CF_API_KEY || !CF_EMAIL) {
    console.error('purge-cf-cache: CF_API_KEY + CF_EMAIL must be set');
    process.exit(1);
  }

  // 1. Resolve zone_id from hostname
  const zoneRes = await cfFetch('GET', `/zones?name=${encodeURIComponent(ZONE_NAME)}`);
  if (zoneRes.status !== 200 || !zoneRes.data?.success || !zoneRes.data.result?.[0]?.id) {
    console.error('purge-cf-cache: zone lookup failed', JSON.stringify(zoneRes.data, null, 2));
    process.exit(1);
  }
  const zoneId = zoneRes.data.result[0].id;
  console.log(`purge-cf-cache: zone ${ZONE_NAME} → ${zoneId}`);

  // 2. Purge the specific URLs
  const purgeRes = await cfFetch('POST', `/zones/${zoneId}/purge_cache`, { files: URLS_TO_PURGE });
  if (purgeRes.status !== 200 || !purgeRes.data?.success) {
    console.error('purge-cf-cache: purge FAILED', JSON.stringify(purgeRes.data, null, 2));
    process.exit(1);
  }
  console.log(`purge-cf-cache: purged ${URLS_TO_PURGE.length} URLs successfully`);
  for (const u of URLS_TO_PURGE) console.log('  -', u);
})();
