// scripts/gen-loops.js
// Renders a MarkCMO "loop card" REEL: a single 1080x1920 page holding ONE punchy
// marketing paragraph for ~3 seconds, with a slow zoom and a gold progress bar
// that fills then resets — so on IG's auto-loop the viewer keeps re-reading the
// same dense paragraph. High dwell-time + replays with almost no production cost.
//
//   node scripts/gen-loops.js <dayNumber> [outDir]
//   node scripts/gen-loops.js all [outDir]
//
// Source text = that day's hook headline + caption paragraph.
// Output: <outDir>/day<NN>-loop.mp4  (H.264, yuv420p, silent AAC, ~3s)
//
// Requires ffmpeg (same resolver as gen-reels.js: $FFMPEG, tools/ff, then PATH).

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

let DAYS;
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const W = 1080, H = 1920;
const SECS = 3, FPS = 30; // 3-second loop

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
  return 'ffmpeg';
}
const FFMPEG = findFfmpeg();

const C = { ink: '#0A0F2C', inkDeep: '#0D1235', gold: '#C9A84C', off: '#FAFAF8', muted: '#B7BCCB' };
const FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">`;

function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
function trim(s, n) { s = String(s || '').trim(); return s.length > n ? s.slice(0, n - 1).replace(/[\s,.;:]+\S*$/, '') + '...' : s; }

// One 1080x1920 paragraph page.
function loopHtml(kicker, headline, paragraph) {
  const pLen = paragraph.length;
  const pSize = pLen > 280 ? 44 : pLen > 190 ? 50 : pLen > 120 ? 56 : 62;
  const hLen = headline.length;
  const hSize = hLen > 60 ? 70 : hLen > 34 ? 84 : 96;
  return `<!doctype html><html><head><meta charset="utf-8">${FONT_LINKS}
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:${W}px;height:${H}px;}
  body{background:linear-gradient(165deg, ${C.ink} 0%, ${C.inkDeep} 100%);
    color:${C.off};font-family:'Outfit',sans-serif;position:relative;overflow:hidden;}
  .glow{position:absolute;width:1100px;height:1100px;border-radius:50%;
    background:radial-gradient(circle, rgba(201,168,76,0.13) 0%, rgba(201,168,76,0) 70%);
    top:-300px;left:-280px;}
  .wrap{position:absolute;inset:150px 110px 230px;display:flex;flex-direction:column;justify-content:center;z-index:3;}
  .kicker{font-family:'Space Grotesk',sans-serif;font-weight:600;text-transform:uppercase;
    letter-spacing:0.16em;color:${C.gold};font-size:32px;margin-bottom:30px;}
  .kicker::after{content:'';display:block;width:80px;height:4px;background:${C.gold};margin-top:20px;border-radius:2px;}
  h1{font-family:'Space Grotesk',sans-serif;font-weight:700;color:${C.off};
    font-size:${hSize}px;line-height:1.06;letter-spacing:-0.01em;margin-bottom:40px;}
  .para{color:${C.off};font-weight:400;font-size:${pSize}px;line-height:1.5;max-width:880px;}
  .cta{position:absolute;z-index:4;left:110px;bottom:198px;white-space:nowrap;
    background:${C.gold};color:${C.ink};font-family:'Space Grotesk',sans-serif;font-weight:700;
    font-size:34px;padding:16px 34px;border-radius:54px;box-shadow:0 14px 40px rgba(201,168,76,0.26);}
  .foot{position:absolute;z-index:4;left:110px;bottom:120px;color:${C.muted};
    font-family:'Space Grotesk',sans-serif;font-weight:500;font-size:34px;opacity:.85;}
  .loop{position:absolute;z-index:4;right:110px;bottom:120px;color:${C.gold};
    font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:30px;letter-spacing:0.14em;
    text-transform:uppercase;opacity:.9;}
</style></head><body>
  <div class="glow"></div>
  <div class="wrap">
    ${kicker ? `<div class="kicker">${esc(kicker)}</div>` : ''}
    ${headline ? `<h1>${esc(headline)}</h1>` : ''}
    <div class="para">${esc(paragraph)}</div>
  </div>
  <div class="cta">Comment AUDIT for the free leak audit</div>
  <div class="foot">@officialmarkcmo</div>
  <div class="loop">&#8635; loops</div>
</body></html>`;
}

function shoot(htmlPath, pngPath) {
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'mcloop-'));
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

// Still PNG -> 3s MP4: gentle zoom (zoompan) + a gold progress bar that fills
// across the bottom over the 3 seconds (drawbox width keyed to frame number).
function buildLoopMp4(pngPath, outPath) {
  const frames = SECS * FPS; // 90
  const vf = [
    `zoompan=z='min(zoom+0.0008,1.05)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS}`,
    `drawbox=x=0:y=ih-12:w='iw*t/${SECS}':h=12:color=0xC9A84C:t=fill`,
    `format=yuv420p`,
  ].join(',');
  const args = [
    '-y', '-i', pngPath,
    '-f', 'lavfi', '-t', String(SECS), '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-vf', vf, '-t', String(SECS),
    '-map', '0:v', '-map', '1:a',
    '-r', String(FPS), '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '20',
    '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart',
    outPath,
  ];
  execFileSync(FFMPEG, args, { stdio: 'ignore' });
  if (!fs.existsSync(outPath)) throw new Error('ffmpeg produced no mp4 for ' + path.basename(outPath));
}

function renderDayLoop(day, outDir, tmp) {
  const dd = String(day.day).padStart(2, '0');
  const slides = day.slides || [];
  const hook = slides[0] ? trim(slides[0].h, 64) : trim(day.title || '', 64);
  const kicker = (day.pillar || day.theme || 'Marketing truth');
  const paragraph = trim(day.caption || (slides[1] && slides[1].b) || '', 320);
  if (!paragraph) { console.log(`Day ${day.day}: no paragraph text`); return null; }
  const base = `day${dd}-loop`;
  const htmlPath = path.join(tmp, base + '.html');
  const pngPath = path.join(tmp, base + '.png');
  fs.writeFileSync(htmlPath, loopHtml(kicker, hook, paragraph));
  shoot(htmlPath, pngPath);
  const out = path.join(outDir, `day${dd}-loop.mp4`);
  buildLoopMp4(pngPath, out);
  return out;
}

async function main() {
  const mod = await import('../functions/_lib/daily-content.mjs');
  DAYS = mod.DAYS;
  const arg = process.argv[2];
  const outDir = path.resolve(process.argv[3] || path.join(process.cwd(), 'reel-preview'));
  if (!arg) { console.error('usage: node scripts/gen-loops.js <dayNumber|all> [outDir]'); process.exit(1); }
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcloops-'));

  const targets = (arg === 'all' ? DAYS : DAYS.filter(d => d.day === parseInt(arg, 10)))
    .filter(d => d.kind === 'carousel');
  if (!targets.length) { console.error('No carousel day matched.'); process.exit(1); }

  let n = 0;
  for (const day of targets) {
    const out = renderDayLoop(day, outDir, tmp);
    if (out) { n++; console.log(`Day ${day.day}: ${path.basename(out)}`); }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`Done. ${n} loop video(s) in ${outDir}\nffmpeg: ${FFMPEG}`);
}

main().catch(err => { console.error(err); process.exit(1); });
