// scripts/post-fb.mjs
// Cross-post a short-form video to a Facebook PAGE (same MP4s we post to IG).
// Reads creds from env or a local .dev.vars; credentials are never printed.
//
//   node scripts/post-fb.mjs <type> <id> [baseUrl]      # from shorts-content bank
//   node scripts/post-fb.mjs url <videoUrl> "<caption>"  # arbitrary video
//
//   types: stat | myth | story | hottake | abc
//
// Needs (env or .dev.vars): FB_PAGE_ID, FB_PAGE_TOKEN  (Page access token with
//   pages_manage_posts + pages_read_engagement). Optional: DASHBOARD_KEY to log
//   the post into the markcmo.com posts dashboard ledger.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { publishFacebookReel, publishFacebookVideo } from '../functions/_lib/fb-poster.mjs';
import { SHORTS } from '../functions/_lib/shorts-content.mjs';
import { HASHTAGS } from '../functions/_lib/daily-content.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fromDevVars(file, keys, out) {
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let [, k, v] = m; v = v.trim().replace(/^["']|["']$/g, '');
    if (keys.includes(k) && out[k] == null) out[k] = v;
  }
  return out;
}
const KEYS = ['FB_PAGE_ID', 'FB_PAGE_TOKEN', 'DASHBOARD_KEY'];
const cfg = {};
for (const k of KEYS) if (process.env[k]) cfg[k] = process.env[k];
for (const f of [
  path.resolve(__dirname, '..', '.dev.vars'),
  path.resolve(__dirname, '..', '..', 'MarkChat', '.dev.vars'),
  path.resolve(__dirname, '..', '..', 'EmailPro', '.dev.vars'),
]) fromDevVars(f, KEYS, cfg);

const pageId = cfg.FB_PAGE_ID;
const token = cfg.FB_PAGE_TOKEN;
if (!pageId || !token) {
  console.error('Missing FB_PAGE_ID / FB_PAGE_TOKEN (env or .dev.vars).');
  console.error('Generate a Page token in Graph API Explorer with pages_manage_posts + pages_read_engagement.');
  process.exit(1);
}

const CTA = {
  stat: 'Comment SCALE and I will DM you the growth system.',
  myth: 'Comment AUDIT for the free leak audit.',
  story: 'Comment PROOF and I will send the full breakdown.',
  hottake: 'Comment LINK for the free playbook.',
  abc: 'Comment AUDIT for the free leak audit.',
};
function captionFor(type, it) {
  if (type === 'stat') return `${it.line} ${it.sub || ''}`.trim();
  if (type === 'myth') return `Myth: ${it.myth}\nTruth: ${it.truth}`;
  if (type === 'story') return `${it.lines.join(' ')} ${it.punch}`;
  if (type === 'hottake') return it.take;
  if (type === 'abc') return it.caption || it.take;
  return '';
}

const a0 = process.argv[2];
let videoUrl, caption, variant = null, angle = null, type = null;

if (a0 === 'url') {
  videoUrl = process.argv[3];
  caption = process.argv[4] || '';
  if (!videoUrl) { console.error('usage: node scripts/post-fb.mjs url <videoUrl> "<caption>"'); process.exit(1); }
} else {
  type = a0;
  const id = process.argv[3];
  const base = process.argv[4] || 'https://markcmo.com';
  const bank = SHORTS[type];
  if (!bank) { console.error('bad type (stat|myth|story|hottake|abc)'); process.exit(1); }
  const item = bank.find(x => x.id === id);
  if (!item) { console.error('bad id'); process.exit(1); }
  variant = type === 'abc' ? item.id : null;
  angle = item.angle || null;
  caption = `${captionFor(type, item)}\n\n${CTA[type] || ''}\n\n${HASHTAGS}`;
  videoUrl = `${base}/daily-assets/${item.id}.mp4`;
}

async function logToDashboard(result) {
  if (!cfg.DASHBOARD_KEY) return;
  try {
    await fetch('https://markcmo.com/api/post-dashboard?tag=1', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dashboard-key': cfg.DASHBOARD_KEY },
      body: JSON.stringify({
        channel: 'facebook', id: result.id, type: result.type,
        caption, permalink: result.permalink, variant, angle,
        test: angle ? 'hook-angle' : null,
      }),
    });
  } catch { /* best-effort */ }
}

console.log('Publishing to Facebook Page');
console.log(`  page:    ...${String(pageId).slice(-4)}`);
console.log(`  video:   ${videoUrl}`);
console.log(`  caption: ${caption.slice(0, 80)}...`);

(async () => {
  let result;
  try {
    result = await publishFacebookReel({ pageId, token, videoUrl, caption });
  } catch (e) {
    console.warn(`Reel path failed (${e.message}); falling back to feed video...`);
    result = await publishFacebookVideo({ pageId, token, videoUrl, caption });
  }
  await logToDashboard(result);
  console.log(`\nPOSTED to Facebook. id: ${result.id}  ${result.permalink}`);
})().catch(err => { console.error(`\nFAILED: ${err.message}`); process.exit(1); });
