// scripts/post-sample-reel.js
// One-off: publish a sample text-carousel REEL to Instagram to prove the pipeline
// end-to-end. Reads IG creds from env, else from the local MarkChat/.dev.vars
// (same @officialmarkcmo account). Credentials are never printed.
//
//   node scripts/post-sample-reel.js [videoUrl] [day]
//
// Defaults: the already-deployed day31 reel + Day 31 caption.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { publishReel } from '../functions/_lib/ig-poster.mjs';
import { DAYS, HASHTAGS } from '../functions/_lib/daily-content.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── read creds without echoing them ──────────────────────────────────────────
function fromDevVars(file, keys) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let [, k, v] = m;
    v = v.trim().replace(/^["']|["']$/g, '');
    if (keys.includes(k)) out[k] = v;
  }
  return out;
}

const MARKCHAT_DEVVARS = path.resolve(__dirname, '..', '..', '..', 'MarkChat', '.dev.vars');
const local = fromDevVars(MARKCHAT_DEVVARS, ['IG_USER_ID', 'IG_ACCESS_TOKEN']);

const igUserId = process.env.IG_USER_ID || local.IG_USER_ID;
const token = process.env.IG_ACCESS_TOKEN || local.IG_ACCESS_TOKEN;

if (!igUserId || !token) {
  console.error('Missing IG_USER_ID / IG_ACCESS_TOKEN (env or MarkChat/.dev.vars).');
  process.exit(1);
}

const videoUrl = process.argv[2] || 'https://markcmo.com/daily-assets/day31-reel.mp4';
const dayNum = parseInt(process.argv[3] || '31', 10);
const day = DAYS.find(d => d.day === dayNum) || DAYS[0];
const CTA = 'Comment AUDIT and I will DM you the free 9-point leak audit.';
const caption = `${day.caption}\n\n${CTA}\n\n${HASHTAGS}`;

console.log(`Publishing sample REEL`);
console.log(`  account id: ...${String(igUserId).slice(-4)}`);
console.log(`  video:      ${videoUrl}`);
console.log(`  caption:    ${caption.slice(0, 80)}...`);

publishReel({ igUserId, token, videoUrl, caption })
  .then(r => { console.log(`\nPOSTED. reel id: ${r.id} (container ${r.container})`); })
  .catch(err => { console.error(`\nFAILED: ${err.message}`); process.exit(1); });
