// scripts/gen-reels.js
// Renders a MarkCMO "text-carousel" REEL: a 6-second, 1080x1920 vertical MP4
// where 4 branded text cards slide past like a carousel. Built to be replayed:
// each card holds ~1.8s, so a viewer cannot read everything in one pass and the
// reel loops, which drives watch-time + replays (a top IG ranking signal).
//
//   node scripts/gen-reels.js <dayNumber> [outDir]
//   node scripts/gen-reels.js all [outDir]
//
// Source text = that day's carousel slides (hook headline + 3 value slides).
// Output: <outDir>/day<NN>-reel.mp4  (H.264, yuv420p, silent AAC track)
//
// Requires ffmpeg. Looks for it at $FFMPEG, then the bundled tools/ff build,
// then PATH.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

let DAYS;

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const W = 1080, H = 1920;

// ── locate ffmpeg ─────────────────────────────────────────────────────────────
function findFfmpeg() {
  if (process.env.FFMPEG && fs.existsSync(process.env.FFMPEG)) return process.env.FFMPEG;
  const ffRoot = path.join(__dirname, '..', 'tools', 'ff');
  if (fs.existsSync(ffRoot)) {
    const stack = [ffRoot];
    while (stack.length) {
      const dir = stack.pop();
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) stack.push(p);
        else if (/^ffmpeg(\.exe)?$/i.test(ent.name)) return p;
      }
    }
  }
  return 'ffmpeg'; // assume on PATH
}
const FFMPEG = findFfmpeg();

// ── brand tokens (mirror gen-slides.js / 07-visual-brand-system.md) ───────────
const C = {
  ink: '#0A0F2C', inkDeep: '#0D1235', gold: '#C9A84C',
  off: '#FAFAF8', muted: '#B7BCCB',
};
const FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">`;

function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
function isNote(b) { return typeof b === 'string' && b.trim().startsWith('('); }
function trim(s, n) { s = String(s || '').trim(); return s.length > n ? s.slice(0, n - 1).replace(/[\s,.;:]+\S*$/, '') + '...' : s; }

// Optional headshot composite on the first (hook) card only.
const HEADSHOT_PATH = path.join(__dirname, '..', 'brand', 'mark-headshot.png');
let HEADSHOT_URI = null;
try { if (fs.existsSync(HEADSHOT_PATH)) HEADSHOT_URI = 'data:image/png;base64,' + fs.readFileSync(HEADSHOT_PATH).toString('base64'); } catch (e) {}

// A single 1080x1920 card. `pos`/`total` draw the carousel progress dots.
function cardHtml(card, pos, total, withFace, isLast) {
  const kicker = card.k ? `<div class="kicker">${esc(card.k)}</div>` : '';
  const hLen = (card.h || '').length;
  const hSize = hLen > 90 ? 86 : hLen > 60 ? 104 : hLen > 32 ? 124 : 140;
  const body = card.b && !isNote(card.b)
    ? `<div class="body">${esc(trim(card.b, 150))}</div>` : '';
  const dots = Array.from({ length: total }, (_, i) =>
    `<span class="dot${i === pos ? ' on' : ''}"></span>`).join('');
  const face = withFace && HEADSHOT_URI ? `<img class="me" src="${HEADSHOT_URI}" alt="">` : '';
  return `<!doctype html><html><head><meta charset="utf-8">${FONT_LINKS}
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:${W}px;height:${H}px;}
  body{background:linear-gradient(165deg, ${C.ink} 0%, ${C.inkDeep} 100%);
    color:${C.off};font-family:'Outfit',sans-serif;position:relative;overflow:hidden;}
  .glow{position:absolute;width:1000px;height:1000px;border-radius:50%;
    background:radial-gradient(circle, rgba(201,168,76,0.12) 0%, rgba(201,168,76,0) 70%);
    top:-260px;right:-260px;}
  .wrap{position:absolute;inset:120px 110px;display:flex;flex-direction:column;justify-content:center;z-index:3;}
  .wrap.faced{top:230px;bottom:auto;height:660px;justify-content:flex-start;}
  .kicker{font-family:'Space Grotesk',sans-serif;font-weight:600;text-transform:uppercase;
    letter-spacing:0.14em;color:${C.gold};font-size:34px;margin-bottom:34px;}
  .kicker::after{content:'';display:block;width:80px;height:4px;background:${C.gold};
    margin-top:22px;border-radius:2px;}
  h1{font-family:'Space Grotesk',sans-serif;font-weight:700;color:${C.off};
    font-size:${hSize}px;line-height:1.05;letter-spacing:-0.01em;}
  .body{margin-top:40px;color:${C.muted};font-weight:400;font-size:42px;line-height:1.45;max-width:880px;}
  .me{position:absolute;z-index:1;bottom:0;right:-20px;height:900px;
    filter:drop-shadow(0 12px 50px rgba(0,0,0,0.5));}
  .foot{position:absolute;z-index:4;left:110px;bottom:120px;color:${C.muted};
    font-family:'Space Grotesk',sans-serif;font-weight:500;font-size:36px;opacity:.85;}
  .dots{position:absolute;z-index:4;right:110px;bottom:128px;display:flex;gap:16px;}
  .dot{width:18px;height:18px;border-radius:50%;background:rgba(255,255,255,0.22);}
  .dot.on{background:${C.gold};width:46px;border-radius:10px;}
  .repl{position:absolute;z-index:4;left:0;right:0;top:150px;text-align:center;
    font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:30px;letter-spacing:0.12em;
    text-transform:uppercase;color:${C.gold};opacity:.9;}
</style></head><body>
  <div class="glow"></div>
  ${face}
  <div class="repl">Save this -&gt; read it all</div>
  <div class="wrap${withFace ? ' faced' : ''}">
    ${kicker}
    <h1>${esc(card.h)}</h1>
    ${body}
  </div>
  <div class="foot">@officialmarkcmo</div>
  <div class="dots">${dots}</div>
</body></html>`;
}

function shoot(htmlPath, pngPath) {
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'mcreel-'));
  try {
    if (fs.existsSync(pngPath)) fs.rmSync(pngPath, { force: true });
    execFileSync(CHROME, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-sandbox',
      '--force-device-scale-factor=1', `--user-data-dir=${udd}`,
      `--window-size=${W},${H}`, '--virtual-time-budget=3500',
      '--default-background-color=00000000', `--screenshot=${pngPath}`,
      'file:///' + htmlPath.replace(/\\/g, '/'),
    ], { stdio: 'ignore' });
    if (!fs.existsSync(pngPath)) throw new Error(`Chrome produced no screenshot for ${path.basename(pngPath)}`);
  } finally { fs.rmSync(udd, { recursive: true, force: true }); }
}

// Build the full card list for a carousel day: the hook headline (with Mark's
// face) followed by EVERY slide in the deck (value slides + the CTA), so the
// reel shows the whole carousel, not just a teaser. The video gets longer as the
// deck grows; buildMp4 paces each card slow enough to read.
function cardsForDay(day) {
  const slides = (day.slides || []);
  if (!slides.length) return [];
  const hook = slides[0];
  const cards = [{ k: 'MarkCMO', h: trim(hook.h, 90), b: '' }]; // hook card, face, no body
  for (let i = 1; i < slides.length; i++) {
    const s = slides[i];
    cards.push({ k: s.k, h: s.h, b: s.b });
  }
  return cards;
}

// Build the 6s sliding MP4 from N rendered frames using xfade=slideleft.
function buildMp4(frames, outPath) {
  const n = frames.length;
  // Hold each card long enough to read the body copy; slide between them.
  // Total = n*T - (n-1)*D  (e.g. 8 cards -> 8*2.3 - 7*0.5 = 14.9s).
  const T = 2.3, D = 0.5;
  const inputs = [];
  frames.forEach(f => { inputs.push('-loop', '1', '-t', String(T), '-i', f); });
  // chained xfade. offset_k = k*(T-D)
  let filt = '', prev = '0:v';
  for (let i = 1; i < n; i++) {
    const off = (i * (T - D)).toFixed(2);
    const out = (i === n - 1) ? 'v' : `x${i}`;
    filt += `[${prev}][${i}:v]xfade=transition=slideleft:duration=${D}:offset=${off}[${out}];`;
    prev = out;
  }
  filt = filt.replace(/;$/, '');
  // total runtime of the slide chain — the silent audio track must span it or
  // -shortest would truncate the video back down.
  const total = (n * T - (n - 1) * D).toFixed(2);
  // silent stereo AAC track so IG always accepts the reel
  const args = [
    '-y', ...inputs,
    '-f', 'lavfi', '-t', total, '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-filter_complex', filt,
    '-map', '[v]', '-map', `${n}:a`,
    '-r', '30', '-pix_fmt', 'yuv420p',
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '20',
    '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart',
    outPath,
  ];
  execFileSync(FFMPEG, args, { stdio: 'ignore' });
  if (!fs.existsSync(outPath)) throw new Error('ffmpeg produced no mp4 for ' + path.basename(outPath));
}

function renderDayReel(day, outDir, tmp) {
  const dd = String(day.day).padStart(2, '0');
  const cards = cardsForDay(day);
  if (cards.length < 2) { console.log(`Day ${day.day}: not enough slides for a reel`); return null; }
  const frames = cards.map((card, i) => {
    const base = `day${dd}-frame${String(i + 1).padStart(2, '0')}`;
    const htmlPath = path.join(tmp, base + '.html');
    const pngPath = path.join(tmp, base + '.png');
    fs.writeFileSync(htmlPath, cardHtml(card, i, cards.length, i === 0, i === cards.length - 1));
    shoot(htmlPath, pngPath);
    return pngPath;
  });
  const out = path.join(outDir, `day${dd}-reel.mp4`);
  buildMp4(frames, out);
  return out;
}

async function main() {
  const mod = await import('../functions/_lib/daily-content.mjs');
  DAYS = mod.DAYS;
  const arg = process.argv[2];
  const outDir = path.resolve(process.argv[3] || path.join(process.cwd(), 'reel-preview'));
  if (!arg) { console.error('usage: node scripts/gen-reels.js <dayNumber|all> [outDir]'); process.exit(1); }
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcreels-'));

  const targets = (arg === 'all' ? DAYS : DAYS.filter(d => d.day === parseInt(arg, 10)))
    .filter(d => d.kind === 'carousel');
  if (!targets.length) { console.error('No carousel day matched. Reels are built from carousel slides.'); process.exit(1); }

  let n = 0;
  for (const day of targets) {
    const out = renderDayReel(day, outDir, tmp);
    if (out) { n++; console.log(`Day ${day.day}: ${path.basename(out)}`); }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`Done. ${n} reel(s) in ${outDir}\nffmpeg: ${FFMPEG}`);
}

main().catch(err => { console.error(err); process.exit(1); });
