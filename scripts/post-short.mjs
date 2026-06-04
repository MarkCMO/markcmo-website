// scripts/post-short.mjs
// Publish a short-form video (stat | myth | story | hottake) to Instagram.
// Reads creds from env or MarkChat/.dev.vars (same @officialmarkcmo account);
// builds a caption from shorts-content.mjs. Credentials are never printed.
//
//   node scripts/post-short.mjs <type> <id> [baseUrl]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { publishReel } from '../functions/_lib/ig-poster.mjs';
import { SHORTS } from '../functions/_lib/shorts-content.mjs';
import { HASHTAGS } from '../functions/_lib/daily-content.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fromDevVars(file, keys) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let [, k, v] = m; v = v.trim().replace(/^["']|["']$/g, '');
    if (keys.includes(k)) out[k] = v;
  }
  return out;
}
const local = fromDevVars(path.resolve(__dirname, '..', '..', '..', 'MarkChat', '.dev.vars'), ['IG_USER_ID', 'IG_ACCESS_TOKEN', 'DASHBOARD_KEY']);
const localMarkcmo = fromDevVars(path.resolve(__dirname, '..', '.dev.vars'), ['DASHBOARD_KEY']);
const igUserId = process.env.IG_USER_ID || local.IG_USER_ID;
const token = process.env.IG_ACCESS_TOKEN || local.IG_ACCESS_TOKEN;
const DASHBOARD_KEY = process.env.DASHBOARD_KEY || localMarkcmo.DASHBOARD_KEY || local.DASHBOARD_KEY;
if (!igUserId || !token) { console.error('Missing IG creds.'); process.exit(1); }

const type = process.argv[2];
const id = process.argv[3];
const base = process.argv[4] || 'https://markcmo.com';
const bank = SHORTS[type];
if (!bank) { console.error('bad type'); process.exit(1); }
const item = bank.find(x => x.id === id);
if (!item) { console.error('bad id'); process.exit(1); }

function captionFor(type, it) {
  if (type === 'stat') return `${it.line} ${it.sub || ''}`.trim();
  if (type === 'myth') return `Myth: ${it.myth}\nTruth: ${it.truth}`;
  if (type === 'story') return `${it.lines.join(' ')} ${it.punch}`;
  if (type === 'hottake') return it.take;
  if (type === 'abc') return it.caption || it.take;
  return '';
}
// Comment-to-DM CTA per type. Each word is an ACTIVE markchat keyword_rule
// (contains-match, lead capture on) so a comment auto-fires a lead DM with a link.
const CTA = {
  stat:    'Comment SCALE and I will DM you the growth system.',
  myth:    'Comment AUDIT for the free leak audit.',
  story:   'Comment PROOF and I will send the full breakdown.',
  hottake: 'Comment LINK for the free playbook.',
  abc:     'Comment AUDIT for the free leak audit.',
};
const cta = CTA[type] || 'Comment SYSTEM for the free playbook.';
const caption = `${captionFor(type, item)}\n\n${cta}\n\n${HASHTAGS}`;
const videoUrl = `${base}/daily-assets/${item.id}.mp4`;

console.log(`Publishing ${type} ${item.id}`);
console.log(`  video: ${videoUrl}`);
console.log(`  caption: ${caption.slice(0, 90)}...`);

// Best-effort: record the post (and its A/B/C variant tag) in the dashboard ledger.
async function logToDashboard(id) {
  if (!DASHBOARD_KEY || !id) return;
  const variant = type === 'abc' ? item.id : null;
  const angle = item.angle || null;
  try {
    await fetch('https://markcmo.com/api/post-dashboard?tag=1', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dashboard-key': DASHBOARD_KEY },
      body: JSON.stringify({ channel: 'instagram', id, type, variant, angle, test: angle ? 'hook-angle' : null }),
    });
  } catch { /* best-effort */ }
}

publishReel({ igUserId, token, videoUrl, caption })
  .then(async r => { await logToDashboard(r.id); console.log(`\nPOSTED. reel id: ${r.id}`); })
  .catch(err => { console.error(`\nFAILED: ${err.message}`); process.exit(1); });
