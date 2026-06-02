// scripts/gen-shorts.js
// Renders MarkCMO short-form REELS in FOUR distinct visual styles (each format
// looks different on purpose). Source = functions/_lib/shorts-content.mjs.
//
//   node scripts/gen-shorts.js <type> <id|all> [outDir]
//   types: stat | myth | story | hottake
//   e.g.   node scripts/gen-shorts.js stat all ./daily-assets
//          node scripts/gen-shorts.js myth myth02 ./daily-assets
//
// Output: <outDir>/<id>.mp4   (1080x1920, H.264/yuv420p, silent AAC)
// Requires ffmpeg (resolver: $FFMPEG, then tools/ff, then PATH).

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const W = 1080, H = 1920, FPS = 30;

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

// ── brand palette (+ format accents) ──────────────────────────────────────────
const C = {
  ink: '#0A0F2C', inkDeep: '#0D1235', gold: '#C9A84C', goldDeep: '#A8862F',
  off: '#FAFAF8', muted: '#B7BCCB',
  red: '#E5484D', green: '#46A758',
  paper: '#F4F1EA', paperInk: '#15193A', paperMuted: '#5A5F73',
};
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">`;

function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
const RESET = `*{margin:0;padding:0;box-sizing:border-box;} html,body{width:${W}px;height:${H}px;}`;

const HANDLE = '@officialmarkcmo';
// Comment-to-DM CTA per format. Each word maps to an ACTIVE markchat keyword_rule
// (match_type=contains, capture_lead=true) so a comment auto-fires a lead DM:
//   SCALE/SYSTEM -> /system, AUDIT/LEAK/LINK/STUCK -> /leak-audit, PROOF/CMO -> /book
const CTA = {
  stat:    { word: 'SCALE', line: 'Comment SCALE and I will DM you the system' },
  myth:    { word: 'AUDIT', line: 'Comment AUDIT for the free leak audit' },
  story:   { word: 'PROOF', line: 'Comment PROOF and I will send the breakdown' },
  hottake: { word: 'LINK',  line: 'Comment LINK for the free playbook' },
};

// ── headshot (used only on the stat card) ─────────────────────────────────────
const HEADSHOT_PATH = path.join(__dirname, '..', 'brand', 'mark-headshot.png');
let HEADSHOT_URI = null;
try { if (fs.existsSync(HEADSHOT_PATH)) HEADSHOT_URI = 'data:image/png;base64,' + fs.readFileSync(HEADSHOT_PATH).toString('base64'); } catch (e) {}

// ════════════════════════════ LOOK 1: STAT REVEAL ════════════════════════════
// Navy, a giant gold numeral that owns the frame, payoff + takeaway beneath.
function statHtml(s, cta) {
  const nLen = (s.num || '').length;
  const nSize = nLen <= 2 ? 440 : nLen <= 3 ? 360 : 300;
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${RESET}
  body{background:radial-gradient(120% 80% at 50% 18%, ${C.inkDeep} 0%, ${C.ink} 70%);
    color:${C.off};font-family:'Outfit',sans-serif;position:relative;overflow:hidden;}
  .glow{position:absolute;width:1200px;height:1200px;border-radius:50%;left:50%;top:-340px;transform:translateX(-50%);
    background:radial-gradient(circle, rgba(201,168,76,0.20) 0%, rgba(201,168,76,0) 65%);}
  .wrap{position:absolute;inset:170px 100px 360px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;z-index:3;}
  .kicker{font-family:'Space Grotesk',sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:0.22em;
    color:${C.gold};font-size:38px;margin-bottom:6px;}
  .num{font-family:'Space Grotesk',sans-serif;font-weight:700;color:${C.gold};font-size:${nSize}px;
    line-height:1;letter-spacing:-0.02em;text-shadow:0 18px 60px rgba(201,168,76,0.30);}
  .line{margin-top:34px;color:${C.off};font-weight:600;font-size:56px;line-height:1.18;max-width:860px;}
  .sub{margin-top:22px;color:${C.muted};font-weight:400;font-size:40px;}
  .cta{position:absolute;z-index:4;left:50%;transform:translateX(-50%);bottom:200px;white-space:nowrap;
    background:${C.gold};color:${C.ink};font-family:'Space Grotesk',sans-serif;font-weight:700;
    font-size:36px;letter-spacing:0.01em;padding:18px 40px;border-radius:60px;box-shadow:0 14px 40px rgba(201,168,76,0.28);}
  .foot{position:absolute;z-index:4;left:50%;transform:translateX(-50%);bottom:118px;color:${C.muted};
    font-family:'Space Grotesk',sans-serif;font-weight:500;font-size:34px;opacity:.85;}
</style></head><body>
  <div class="glow"></div>
  <div class="wrap">
    <div class="kicker">${esc(s.kicker)}</div>
    <div class="num">${esc(s.num)}</div>
    <div class="line">${esc(s.line)}</div>
    ${s.sub ? `<div class="sub">${esc(s.sub)}</div>` : ''}
  </div>
  ${cta ? `<div class="cta">${esc(cta.line)}</div>` : ''}
  <div class="foot">${HANDLE}</div>
</body></html>`;
}

// ════════════════════════════ LOOK 2: MYTH vs TRUTH ══════════════════════════
// Two cards: a red "MYTH" card with a struck-through claim, then a gold "TRUTH"
// card with the correction. Distinct color world per card.
function mythTruthHtml(m, role /* 'myth' | 'truth' */, cta) {
  const isMyth = role === 'myth';
  const accent = isMyth ? C.red : C.gold;
  const label = isMyth ? 'Myth' : 'Truth';
  const text = isMyth ? m.myth : m.truth;
  const strike = isMyth
    ? `position:relative;` : '';
  const strikeBar = isMyth
    ? `<span style="position:absolute;left:-10px;right:-10px;top:52%;height:8px;background:${C.red};border-radius:4px;transform:rotate(-3deg);opacity:.92;"></span>` : '';
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${RESET}
  body{background:linear-gradient(160deg, ${C.ink} 0%, ${C.inkDeep} 100%);
    color:${C.off};font-family:'Outfit',sans-serif;position:relative;overflow:hidden;}
  .glow{position:absolute;width:1100px;height:1100px;border-radius:50%;bottom:-360px;right:-300px;
    background:radial-gradient(circle, ${isMyth ? 'rgba(229,72,77,0.16)' : 'rgba(201,168,76,0.18)'} 0%, rgba(0,0,0,0) 68%);}
  .wrap{position:absolute;inset:200px 110px 260px;display:flex;flex-direction:column;justify-content:center;z-index:3;}
  .pill{align-self:flex-start;display:inline-flex;align-items:center;gap:16px;
    font-family:'Space Grotesk',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;
    font-size:40px;color:${C.ink};background:${accent};padding:18px 34px;border-radius:60px;margin-bottom:52px;}
  .claim{${strike}font-family:'Space Grotesk',sans-serif;font-weight:700;color:${C.off};
    font-size:96px;line-height:1.08;letter-spacing:-0.01em;max-width:900px;${isMyth ? 'opacity:.82;' : ''}}
  .cta{position:absolute;z-index:4;left:110px;bottom:198px;white-space:nowrap;
    background:${C.gold};color:${C.ink};font-family:'Space Grotesk',sans-serif;font-weight:700;
    font-size:34px;padding:16px 34px;border-radius:54px;box-shadow:0 14px 40px rgba(0,0,0,0.30);}
  .tag{position:absolute;z-index:4;left:110px;bottom:120px;color:${C.muted};
    font-family:'Space Grotesk',sans-serif;font-weight:500;font-size:34px;opacity:.85;}
  .rail{position:absolute;left:0;top:0;bottom:0;width:14px;background:${accent};}
</style></head><body>
  <div class="rail"></div>
  <div class="glow"></div>
  <div class="wrap">
    <div class="pill">${esc(label)}</div>
    <div class="claim">${esc(text)}${strikeBar}</div>
  </div>
  ${(!isMyth && cta) ? `<div class="cta">${esc(cta.line)}</div>` : ''}
  <div class="tag">${HANDLE} &middot; ${esc(m.kicker || '')}</div>
</body></html>`;
}

// ════════════════════════════ LOOK 3: STORY BUILD ════════════════════════════
// Light "paper" background, ink text. Lines accumulate one at a time; the final
// frame dims the story and slams the gold punchline. Inverted palette on purpose.
function storyHtml(story, upto /* number of lines shown */, isPunch, cta) {
  const lines = story.lines.slice(0, upto).map((ln, i) => {
    const dim = isPunch ? 'opacity:.38;' : (i === upto - 1 ? '' : 'opacity:.5;');
    return `<div class="ln" style="${dim}">${esc(ln)}</div>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${RESET}
  body{background:${C.paper};color:${C.paperInk};font-family:'Outfit',sans-serif;position:relative;overflow:hidden;}
  .edge{position:absolute;left:0;top:0;right:0;height:14px;background:${C.gold};}
  .wrap{position:absolute;inset:200px 120px 240px;display:flex;flex-direction:column;justify-content:center;z-index:3;}
  .kicker{font-family:'Space Grotesk',sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:0.2em;
    color:${C.goldDeep};font-size:34px;margin-bottom:46px;}
  .ln{font-family:'Space Grotesk',sans-serif;font-weight:700;color:${C.paperInk};
    font-size:74px;line-height:1.12;letter-spacing:-0.01em;margin-bottom:26px;}
  .punch{margin-top:30px;font-family:'Space Grotesk',sans-serif;font-weight:700;color:${C.ink};
    font-size:88px;line-height:1.08;background:${C.gold};display:inline;
    box-decoration-break:clone;-webkit-box-decoration-break:clone;padding:6px 16px;border-radius:6px;}
  .cta{position:absolute;z-index:4;left:120px;bottom:196px;white-space:nowrap;
    background:${C.ink};color:${C.off};font-family:'Space Grotesk',sans-serif;font-weight:700;
    font-size:34px;padding:16px 34px;border-radius:54px;box-shadow:0 14px 40px rgba(21,25,58,0.25);}
  .foot{position:absolute;z-index:4;left:120px;bottom:120px;color:${C.paperMuted};
    font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:32px;}
</style></head><body>
  <div class="edge"></div>
  <div class="wrap">
    <div class="kicker">${esc(story.kicker)}</div>
    ${lines}
    ${isPunch ? `<div><span class="punch">${esc(story.punch)}</span></div>` : ''}
  </div>
  ${(isPunch && cta) ? `<div class="cta">${esc(cta.line)}</div>` : ''}
  <div class="foot">${HANDLE}</div>
</body></html>`;
}

// ════════════════════════════ LOOK 4: HOT TAKE ═══════════════════════════════
// Solid gold field, ink text, one contrarian line. Loops (progress bar resets).
function hotTakeHtml(h, cta) {
  const tLen = (h.take || '').length;
  const tSize = tLen > 90 ? 86 : tLen > 60 ? 104 : 124;
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${RESET}
  body{background:linear-gradient(160deg, ${C.gold} 0%, ${C.goldDeep} 100%);
    color:${C.ink};font-family:'Outfit',sans-serif;position:relative;overflow:hidden;}
  .q{position:absolute;top:120px;left:110px;font-family:'Space Grotesk',sans-serif;font-weight:700;
    font-size:240px;line-height:1;color:rgba(10,15,44,0.14);}
  .wrap{position:absolute;inset:300px 110px 240px;display:flex;flex-direction:column;justify-content:center;z-index:3;}
  .label{font-family:'Space Grotesk',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.22em;
    color:${C.ink};font-size:34px;opacity:.7;margin-bottom:34px;}
  .take{font-family:'Space Grotesk',sans-serif;font-weight:700;color:${C.ink};
    font-size:${tSize}px;line-height:1.1;letter-spacing:-0.01em;}
  .cta{position:absolute;z-index:4;left:110px;bottom:200px;white-space:nowrap;
    background:${C.ink};color:${C.gold};font-family:'Space Grotesk',sans-serif;font-weight:700;
    font-size:36px;padding:18px 38px;border-radius:58px;box-shadow:0 14px 40px rgba(10,15,44,0.28);}
  .foot{position:absolute;z-index:4;left:110px;bottom:120px;color:${C.ink};
    font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:34px;opacity:.8;}
  .loop{position:absolute;z-index:4;right:110px;bottom:120px;color:${C.ink};
    font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:30px;letter-spacing:0.14em;text-transform:uppercase;opacity:.7;}
</style></head><body>
  <div class="q">&ldquo;</div>
  <div class="wrap">
    <div class="label">Hot take</div>
    <div class="take">${esc(h.take)}</div>
  </div>
  ${cta ? `<div class="cta">${esc(cta.line)}</div>` : ''}
  <div class="foot">${HANDLE}</div>
  <div class="loop">&#8635; loops</div>
</body></html>`;
}

// ── render + encode helpers ───────────────────────────────────────────────────
function shoot(htmlPath, pngPath) {
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'mcshort-'));
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

// Single still -> MP4 with a gentle zoom and an optional progress bar (t-keyed).
function buildStill(pngPath, outPath, { secs = 4, bar = false, barColor = '0xC9A84C' } = {}) {
  const frames = Math.round(secs * FPS);
  const chain = [
    `zoompan=z='min(zoom+0.0009,1.06)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS}`,
  ];
  if (bar) chain.push(`drawbox=x=0:y=ih-12:w='iw*t/${secs}':h=12:color=${barColor}:t=fill`);
  chain.push('format=yuv420p');
  const args = [
    '-y', '-i', pngPath,
    '-f', 'lavfi', '-t', String(secs), '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-vf', chain.join(','), '-t', String(secs),
    '-map', '0:v', '-map', '1:a', '-r', String(FPS),
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '20',
    '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', outPath,
  ];
  execFileSync(FFMPEG, args, { stdio: 'ignore' });
  if (!fs.existsSync(outPath)) throw new Error('ffmpeg produced no mp4 for ' + path.basename(outPath));
}

// Multiple frames -> MP4 via chained xfade (configurable transition + pacing).
function buildSlides(frames, outPath, { hold = 2.5, slide = 0.45, transition = 'fade' } = {}) {
  const n = frames.length;
  if (n === 1) return buildStill(frames[0], outPath, { secs: hold });
  const inputs = [];
  frames.forEach(f => { inputs.push('-loop', '1', '-t', String(hold), '-i', f); });
  let filt = '', prev = '0:v';
  for (let i = 1; i < n; i++) {
    const off = (i * (hold - slide)).toFixed(2);
    const out = (i === n - 1) ? 'v' : `x${i}`;
    filt += `[${prev}][${i}:v]xfade=transition=${transition}:duration=${slide}:offset=${off}[${out}];`;
    prev = out;
  }
  filt = filt.replace(/;$/, '');
  const total = (n * hold - (n - 1) * slide).toFixed(2);
  const args = [
    '-y', ...inputs,
    '-f', 'lavfi', '-t', total, '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-filter_complex', filt, '-map', '[v]', '-map', `${n}:a`,
    '-r', String(FPS), '-pix_fmt', 'yuv420p',
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '20',
    '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', outPath,
  ];
  execFileSync(FFMPEG, args, { stdio: 'ignore' });
  if (!fs.existsSync(outPath)) throw new Error('ffmpeg produced no mp4 for ' + path.basename(outPath));
}

// ── per-type renderers ────────────────────────────────────────────────────────
function renderOne(type, item, outDir, tmp) {
  const out = path.join(outDir, `${item.id}.mp4`);
  const cta = item.cta || CTA[type];
  const write = (name, html) => { const p = path.join(tmp, name + '.html'); fs.writeFileSync(p, html); return p; };
  const png = (name) => path.join(tmp, name + '.png');

  if (type === 'stat') {
    const h = write(item.id, statHtml(item, cta)); const p = png(item.id); shoot(h, p);
    buildStill(p, out, { secs: 4 });
  } else if (type === 'hottake' || type === 'abc') {
    const h = write(item.id, hotTakeHtml(item, cta)); const p = png(item.id); shoot(h, p);
    buildStill(p, out, { secs: 3, bar: true, barColor: '0x0A0F2C' });
  } else if (type === 'myth') {
    const frames = ['myth', 'truth'].map(role => {
      const nm = `${item.id}-${role}`; const h = write(nm, mythTruthHtml(item, role, cta)); const p = png(nm); shoot(h, p); return p;
    });
    buildSlides(frames, out, { hold: 2.6, slide: 0.5, transition: 'slideup' });
  } else if (type === 'story') {
    const frames = [];
    for (let i = 1; i <= item.lines.length; i++) {
      const nm = `${item.id}-l${i}`; const h = write(nm, storyHtml(item, i, false, cta)); const p = png(nm); shoot(h, p); frames.push(p);
    }
    const nm = `${item.id}-punch`; const h = write(nm, storyHtml(item, item.lines.length, true, cta)); const p = png(nm); shoot(h, p); frames.push(p);
    buildSlides(frames, out, { hold: 1.4, slide: 0.3, transition: 'fade' });
  } else {
    throw new Error('unknown type ' + type);
  }
  return out;
}

async function main() {
  const mod = await import('../functions/_lib/shorts-content.mjs');
  const SHORTS = mod.SHORTS;
  const type = process.argv[2];
  const which = process.argv[3];
  const outDir = path.resolve(process.argv[4] || path.join(process.cwd(), 'reel-preview'));
  if (!type || !which || !SHORTS[type]) {
    console.error('usage: node scripts/gen-shorts.js <stat|myth|story|hottake> <id|all> [outDir]');
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcshorts-'));
  const bank = SHORTS[type];
  const targets = which === 'all' ? bank : bank.filter(x => x.id === which);
  if (!targets.length) { console.error(`No ${type} item matched "${which}"`); process.exit(1); }

  let n = 0;
  for (const item of targets) {
    const out = renderOne(type, item, outDir, tmp);
    if (out) { n++; console.log(`${type} ${item.id}: ${path.basename(out)}`); }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`Done. ${n} ${type} video(s) in ${outDir}\nffmpeg: ${FFMPEG}`);
}

main().catch(err => { console.error(err); process.exit(1); });
