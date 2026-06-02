// scripts/gen-slides.js
// Renders MarkCMO carousel days into ready-to-post 1080x1350 PNG slides,
// using the exact brand tokens from 07-visual-brand-system.md.
//
//   node scripts/gen-slides.js <dayNumber> [outDir]
//   node scripts/gen-slides.js all [outDir]
//
// Output: <outDir>/day<NN>-slide<MM>.png  (one PNG per slide)

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
// Content now lives in the native CF module (ESM). Loaded via dynamic import in main().
let DAYS, AUDIT_LINK;

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const W = 1080, H = 1350;

// Mark's headshot, composited onto hook slides + reel covers when present.
// Drop a transparent-background PNG cutout here and re-run the generator.
const HEADSHOT_PATH = path.join(__dirname, '..', 'brand', 'mark-headshot.png');
let HEADSHOT_URI = null;
(function loadHeadshot() {
  try {
    if (fs.existsSync(HEADSHOT_PATH)) {
      HEADSHOT_URI = 'data:image/png;base64,' + fs.readFileSync(HEADSHOT_PATH).toString('base64');
    }
  } catch (e) { /* fall back to placeholder */ }
})();
function meImg(cls) {
  return HEADSHOT_URI ? `<img class="me ${cls}" src="${HEADSHOT_URI}" alt="">` : '';
}

const C = {
  ink: '#0A0F2C', inkDeep: '#0D1235', gold: '#C9A84C',
  off: '#FAFAF8', muted: '#B7BCCB', hair: 'rgba(255,255,255,0.08)',
};

function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
function isNote(b) { return typeof b === 'string' && b.trim().startsWith('('); }

// "The CMO who actually *builds* (gold on x)" -> strip the (paren note),
// turn *word* into a gold span. Returns safe HTML.
function coverMarkup(raw) {
  let s = String(raw || '').replace(/\([^)]*\)/g, '').trim();
  const parts = s.split(/(\*[^*]+\*)/g).filter(Boolean);
  return parts.map(p => {
    const m = p.match(/^\*([^*]+)\*$/);
    return m ? `<span class="g">${esc(m[1])}</span>` : esc(p);
  }).join('');
}

const FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">`;

function slideHtml(slide, idx, total, day) {
  const counter = `${String(idx + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  const isHook = idx === 0;
  const isCTA = /^cta$/i.test(slide.k || '') || idx === total - 1;
  const showBody = slide.b && !isNote(slide.b);
  const hLen = (slide.h || '').length;
  // headline size scales down for long lines so it always fits the safe box
  const hSize = hLen > 90 ? 58 : hLen > 60 ? 70 : hLen > 32 ? 86 : 104;

  const withFace = (isHook || isCTA) && !!HEADSHOT_URI;
  const facePlaceholder = (isHook || isCTA)
    ? (HEADSHOT_URI ? meImg('me-slide') : `<div class="face">your face<br>here</div>`) : '';

  const ctaLink = isCTA
    ? `<div class="ctaLink">${esc(AUDIT_LINK)}</div>` : '';

  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${W}px; height:${H}px; }
  body {
    background: linear-gradient(160deg, ${C.ink} 0%, ${C.inkDeep} 100%);
    color:${C.off}; font-family:'Outfit',sans-serif;
    position:relative; overflow:hidden;
  }
  /* Text always lives in its own column. When Mark's photo is on the slide the
     column is clamped to the LEFT ~half so the photo (right/bottom-right) never
     sits in front of the words. No overlap, ever. */
  .safe { position:absolute; inset:96px; display:flex; flex-direction:column; z-index:3; }
  .safe.faced { right:auto; width:520px; }
  .kicker {
    font-family:'Space Grotesk',sans-serif; font-weight:600; text-transform:uppercase;
    letter-spacing:0.12em; color:${C.gold}; font-size:26px;
  }
  .kicker::after {
    content:''; display:block; width:64px; height:3px; background:${C.gold};
    margin-top:18px; border-radius:2px;
  }
  .mid { flex:1; display:flex; flex-direction:column; justify-content:center; }
  h1 {
    font-family:'Space Grotesk',sans-serif; font-weight:700; color:${C.off};
    font-size:${withFace ? Math.min(hSize, 62) : hSize}px; line-height:1.06; letter-spacing:-0.01em;
    ${isHook && !withFace ? 'font-size:' + Math.min(hSize, 78) + 'px;' : ''}
  }
  .body {
    margin-top:34px; max-width:${withFace ? 520 : 840}px; font-weight:400; color:${C.muted};
    font-size:${withFace ? 30 : 34}px; line-height:1.5;
  }
  .ctaLink {
    margin-top:30px; display:inline-block; align-self:flex-start;
    font-family:'Space Grotesk',sans-serif; font-weight:600; color:${C.ink};
    background:${C.gold}; padding:16px 26px; border-radius:14px; font-size:30px;
  }
  .foot {
    position:absolute; z-index:2; left:96px; bottom:84px; color:${C.muted};
    font-family:'Space Grotesk',sans-serif; font-weight:500; font-size:26px; opacity:.8;
  }
  /* Counter sits bottom-right normally, but moves to TOP-right on photo slides
     so it never lands on Mark's shoulder. */
  .counter {
    position:absolute; z-index:4; color:${C.gold};
    font-family:'Space Grotesk',sans-serif; font-weight:600; font-size:30px; letter-spacing:0.08em;
    ${withFace ? 'top:96px; right:96px;' : 'right:96px; bottom:84px;'}
  }
  .face {
    position:absolute; right:96px; bottom:150px; width:230px; height:230px;
    border:2px dashed ${C.gold}; border-radius:24px; color:${C.muted};
    display:flex; align-items:center; justify-content:center; text-align:center;
    font-family:'Space Grotesk',sans-serif; font-weight:500; font-size:24px;
    text-transform:uppercase; letter-spacing:0.08em; line-height:1.3;
  }
  .swipe {
    position:absolute; right:0; top:50%; transform:translateY(-50%);
    width:10px; height:180px; background:${C.gold}; opacity:.6;
    border-radius:6px 0 0 6px;
  }
  .me { position:absolute; z-index:1; bottom:0; right:0;
    filter:drop-shadow(0 10px 40px rgba(0,0,0,0.45)); }
  /* 500x500 cutout scaled to 600 tall, flush bottom-right. Mark's body is
     centered in the square, so his visible figure starts ~x600 - clear of the
     520px-wide text column that ends at x616. */
  .me-slide { height:600px; right:0; }
</style></head><body>
  ${(!isHook && !isCTA) ? '<div class="swipe"></div>' : ''}
  <div class="safe${withFace ? ' faced' : ''}">
    ${slide.k ? `<div class="kicker">${esc(slide.k)}</div>` : ''}
    <div class="mid">
      <h1>${esc(slide.h)}</h1>
      ${showBody ? `<div class="body">${esc(slide.b)}</div>` : ''}
      ${ctaLink}
    </div>
  </div>
  ${facePlaceholder}
  <div class="foot">@officialmarkcmo</div>
  <div class="counter">${counter}</div>
</body></html>`;
}

// ── Reel cover: 1080x1920, text kept in the centered 1080x1350 safe zone ──────
const RW = 1080, RH = 1920;
function coverHtml(day) {
  const caption = coverMarkup(day.cover || day.title || '');
  const faceBox = HEADSHOT_URI
    ? meImg('me-cover')
    : (day.face ? `<div class="face">your face<br>top-right</div>` : '');
  return `<!doctype html><html><head><meta charset="utf-8">${FONT_LINKS}
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:${RW}px;height:${RH}px;}
  body{background:linear-gradient(165deg, ${C.ink} 0%, ${C.inkDeep} 100%);
    color:${C.off};font-family:'Outfit',sans-serif;position:relative;overflow:hidden;}
  .glow{position:absolute;width:900px;height:900px;border-radius:50%;
    background:radial-gradient(circle, rgba(201,168,76,0.10) 0%, rgba(201,168,76,0) 70%);
    top:-200px;right:-200px;}
  /* All text lives in a TOP block above Mark's head; the photo fills the lower
     two-thirds. They never overlap. */
  .topblock{position:absolute;z-index:2;top:300px;left:96px;right:96px;}
  .kicker{font-family:'Space Grotesk',sans-serif;font-weight:600;text-transform:uppercase;
    letter-spacing:0.14em;color:${C.gold};font-size:30px;margin-bottom:30px;}
  .cap{font-family:'Space Grotesk',sans-serif;font-weight:700;color:${C.off};
    font-size:92px;line-height:1.05;letter-spacing:-0.01em;}
  .cap .g{color:${C.gold};}
  .uline{margin-top:34px;width:180px;height:8px;background:${C.gold};border-radius:4px;}
  .foot{margin-top:26px;color:${C.muted};
    font-family:'Space Grotesk',sans-serif;font-weight:500;font-size:30px;}
  .me{position:absolute;z-index:1;bottom:0;right:0;
    filter:drop-shadow(0 12px 50px rgba(0,0,0,0.5));}
  .me-cover{height:1180px;right:-30px;}
  .face{position:absolute;bottom:120px;right:96px;width:250px;height:250px;
    border:2px dashed ${C.gold};border-radius:26px;color:${C.muted};
    display:flex;align-items:center;justify-content:center;text-align:center;
    font-family:'Space Grotesk',sans-serif;font-weight:500;font-size:26px;
    text-transform:uppercase;letter-spacing:0.06em;line-height:1.3;}
</style></head><body>
  <div class="glow"></div>
  ${faceBox}
  <div class="topblock">
    <div class="kicker">Reel &middot; Day ${day.day}</div>
    <div class="cap">${caption}</div>
    <div class="uline"></div>
    <div class="foot">@officialmarkcmo</div>
  </div>
</body></html>`;
}

// ── On-screen text card: transparent PNG overlay, drop onto footage ───────────
function onscreenHtml(text, idx) {
  const t = String(text || '');
  const size = t.length > 24 ? 88 : t.length > 14 ? 110 : 132;
  return `<!doctype html><html><head><meta charset="utf-8">${FONT_LINKS}
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:${RW}px;height:${RH}px;background:transparent;}
  body{font-family:'Space Grotesk',sans-serif;position:relative;}
  .wrap{position:absolute;left:90px;right:90px;top:50%;transform:translateY(-50%);text-align:center;}
  .chip{display:inline-block;background:${C.gold};color:${C.ink};font-weight:600;
    font-size:30px;letter-spacing:0.1em;text-transform:uppercase;padding:10px 22px;
    border-radius:12px;margin-bottom:34px;}
  .t{color:#fff;font-weight:700;font-size:${size}px;line-height:1.1;letter-spacing:-0.01em;
    text-shadow:0 6px 30px rgba(0,0,0,0.85), 0 2px 8px rgba(0,0,0,0.9);}
</style></head><body>
  <div class="wrap">
    <div class="chip">Beat ${idx + 1}</div>
    <div class="t">${esc(t)}</div>
  </div>
</body></html>`;
}

function shoot(htmlPath, pngPath, w, h, transparent) {
  // Isolated user-data-dir so a running Chrome can't hijack the launch and
  // make --headless exit 0 without actually writing the screenshot.
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'mcchrome-'));
  try {
    if (fs.existsSync(pngPath)) fs.rmSync(pngPath, { force: true }); // ensure a stale file can't masquerade as success
    execFileSync(CHROME, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars',
      '--no-sandbox', '--force-device-scale-factor=1',
      `--user-data-dir=${udd}`,
      `--window-size=${w},${h}`,
      '--virtual-time-budget=3500',
      `--default-background-color=${transparent ? '00000000' : '00000000'}`,
      `--screenshot=${pngPath}`,
      'file:///' + htmlPath.replace(/\\/g, '/'),
    ], { stdio: 'ignore' });
    if (!fs.existsSync(pngPath)) throw new Error(`Chrome produced no screenshot for ${path.basename(pngPath)}`);
  } finally {
    fs.rmSync(udd, { recursive: true, force: true });
  }
}

function write(tmp, outDir, base, html, w, h, transparent) {
  const htmlPath = path.join(tmp, base + '.html');
  const pngPath = path.join(outDir, base + '.png');
  fs.writeFileSync(htmlPath, html);
  shoot(htmlPath, pngPath, w, h, transparent);
  return pngPath;
}

function renderDay(day, outDir, tmp) {
  const dd = String(day.day).padStart(2, '0');
  const made = [];
  if (day.kind === 'carousel') {
    const total = day.slides.length;
    day.slides.forEach((slide, i) => {
      const base = `day${dd}-slide${String(i + 1).padStart(2, '0')}`;
      made.push(write(tmp, outDir, base, slideHtml(slide, i, total, day), W, H, true));
    });
  } else if (day.kind === 'reel') {
    made.push(write(tmp, outDir, `day${dd}-cover`, coverHtml(day), RW, RH, false));
    (day.onscreen || []).forEach((t, i) => {
      const base = `day${dd}-osd${String(i + 1).padStart(2, '0')}`;
      made.push(write(tmp, outDir, base, onscreenHtml(t, i), RW, RH, true));
    });
  }
  return made;
}

async function main() {
  const mod = await import('../functions/_lib/daily-content.mjs');
  DAYS = mod.DAYS; AUDIT_LINK = mod.AUDIT_LINK;

  const arg = process.argv[2];
  // Resolve to an ABSOLUTE path: headless Chrome resolves a relative
  // --screenshot path against its own working dir, not node's, so it would
  // silently write the PNG elsewhere and leave the real file stale.
  const outDir = path.resolve(process.argv[3] || path.join(process.cwd(), 'slide-preview'));
  if (!arg) { console.error('usage: node scripts/gen-slides.js <dayNumber|all> [outDir]'); process.exit(1); }
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcslides-'));

  const targets = arg === 'all'
    ? DAYS
    : DAYS.filter(d => d.day === parseInt(arg, 10));

  let count = 0;
  for (const day of targets) {
    const made = renderDay(day, outDir, tmp);
    count += made.length;
    console.log(`Day ${day.day} (${day.kind}): ${made.length} asset(s)`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`Done. ${count} PNG(s) in ${outDir}`);
}

main().catch(err => { console.error(err); process.exit(1); });
