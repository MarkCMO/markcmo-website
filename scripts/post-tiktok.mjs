// scripts/post-tiktok.mjs
// Push a short-form video to TikTok. By default sends to the creator's INBOX as a
// DRAFT (works for unaudited apps) — Mark opens TikTok and taps post. After the
// app passes TikTok audit, pass --public to direct-post.
//
//   node scripts/post-tiktok.mjs <type> <id> [baseUrl] [--public]
//   node scripts/post-tiktok.mjs url <videoUrl> "<caption>" [--public]
//   types: stat | myth | story | hottake | abc
//
// Needs (env or .dev.vars): TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET,
//   TIKTOK_REFRESH_TOKEN. The hosting domain (markcmo.com) must be verified as a
//   URL-prefix property in the TikTok dev portal for PULL_FROM_URL to work.
//   Optional: DASHBOARD_KEY to log into the posts dashboard ledger.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { refreshToken, uploadDraft, directPost, fetchStatus } from '../functions/_lib/tiktok-poster.mjs';
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
const KEYS = ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_REFRESH_TOKEN', 'DASHBOARD_KEY'];
const cfg = {};
for (const k of KEYS) if (process.env[k]) cfg[k] = process.env[k];
for (const f of [
  path.resolve(__dirname, '..', '.dev.vars'),
  path.resolve(__dirname, '..', '..', 'MarkChat', '.dev.vars'),
  path.resolve(__dirname, '..', '..', 'EmailPro', '.dev.vars'),
]) fromDevVars(f, KEYS, cfg);

if (!cfg.TIKTOK_CLIENT_KEY || !cfg.TIKTOK_CLIENT_SECRET || !cfg.TIKTOK_REFRESH_TOKEN) {
  console.error('Missing TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET / TIKTOK_REFRESH_TOKEN (env or .dev.vars).');
  console.error('Register an app at developers.tiktok.com, add Content Posting API, and complete OAuth to get a refresh token.');
  process.exit(1);
}

const args = process.argv.slice(2).filter(a => a !== '--public');
const isPublic = process.argv.includes('--public');

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

let videoUrl, caption, variant = null, angle = null;
if (args[0] === 'url') {
  videoUrl = args[1];
  caption = args[2] || '';
  if (!videoUrl) { console.error('usage: node scripts/post-tiktok.mjs url <videoUrl> "<caption>"'); process.exit(1); }
} else {
  const type = args[0];
  const id = args[1];
  const base = args[2] && args[2].startsWith('http') ? args[2] : 'https://markcmo.com';
  const bank = SHORTS[type];
  if (!bank) { console.error('bad type (stat|myth|story|hottake|abc)'); process.exit(1); }
  const item = bank.find(x => x.id === id);
  if (!item) { console.error('bad id'); process.exit(1); }
  variant = type === 'abc' ? item.id : null;
  angle = item.angle || null;
  caption = `${captionFor(type, item)} ${CTA[type] || ''} ${HASHTAGS}`;
  videoUrl = `${base}/daily-assets/${item.id}.mp4`;
}

async function logToDashboard(result) {
  if (!cfg.DASHBOARD_KEY || !result.id) return;
  try {
    await fetch('https://markcmo.com/api/post-dashboard?tag=1', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dashboard-key': cfg.DASHBOARD_KEY },
      body: JSON.stringify({
        channel: 'tiktok', id: result.id, type: result.type,
        caption, variant, angle, test: angle ? 'hook-angle' : null,
      }),
    });
  } catch { /* best-effort */ }
}

console.log(`Publishing to TikTok (${isPublic ? 'DIRECT public — needs audited app' : 'DRAFT to inbox'})`);
console.log(`  video:   ${videoUrl}`);
console.log(`  caption: ${caption.slice(0, 80)}...`);

(async () => {
  const tok = await refreshToken({
    clientKey: cfg.TIKTOK_CLIENT_KEY,
    clientSecret: cfg.TIKTOK_CLIENT_SECRET,
    refreshToken: cfg.TIKTOK_REFRESH_TOKEN,
  });
  const accessToken = tok.access_token;
  const result = isPublic
    ? await directPost({ accessToken, videoUrl, caption, privacyLevel: 'PUBLIC_TO_EVERYONE' })
    : await uploadDraft({ accessToken, videoUrl, caption });
  if (result.id) { try { await fetchStatus({ accessToken, publishId: result.id, tries: 6 }); } catch {} }
  await logToDashboard(result);
  console.log(`\nSENT to TikTok. publish_id: ${result.id || '(none)'} — ${result.note || result.type}`);
  if (!isPublic) console.log('Open TikTok to finish posting the draft.');
})().catch(err => { console.error(`\nFAILED: ${err.message}`); process.exit(1); });
