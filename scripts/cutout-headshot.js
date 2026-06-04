// scripts/cutout-headshot.js
// Knocks the white studio background out of Mark's headshot to transparent,
// using the same Chrome-headless + <canvas> pipeline as gen-slides.js (no npm
// image libs needed). Run AFTER saving the raw photo to brand/mark-headshot.png.
//
//   node scripts/cutout-headshot.js [inPng] [outPng]
//
// Default: reads brand/mark-headshot.png, backs the raw up to
// brand/mark-headshot-raw.png, and writes the transparent cutout back to
// brand/mark-headshot.png (so gen-slides.js picks it up unchanged).

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const inPng = process.argv[2] || path.join(__dirname, '..', 'brand', 'mark-headshot.png');
const outPng = process.argv[3] || inPng;

if (!fs.existsSync(inPng)) {
  console.error('not found: ' + inPng + '\nSave your photo there first, then re-run.');
  process.exit(1);
}

// Detect natural dimensions + mime for PNG / GIF / JPEG (no image libs).
function imageInfo(buf) {
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { mime: 'image/png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf.length >= 10 && buf.slice(0, 3).toString('ascii') === 'GIF') {
    return { mime: 'image/gif', w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    while (o < buf.length - 8) {
      if (buf[o] !== 0xff) { o++; continue; }
      const m = buf[o + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { mime: 'image/jpeg', h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7) };
      }
      o += 2 + buf.readUInt16BE(o + 2);
    }
    throw new Error('JPEG: no SOF marker found');
  }
  throw new Error('unsupported image format (need PNG, GIF, or JPEG)');
}

const raw = fs.readFileSync(inPng);
const info = imageInfo(raw);
const { w, h } = info;
const dataUri = 'data:' + info.mime + ';base64,' + raw.toString('base64');

// Canvas knocks out near-white pixels with a soft ramp so hair/jacket edges
// don't keep a white halo. Tunables: FULL (fully transparent above this min-channel
// value) and SOFT (start of the ramp). Raise FULL if any background survives;
// lower it if it eats into the white shirt/pocket-square.
const FULL = 244;  // min(r,g,b) >= this  -> alpha 0
const SOFT = 222;  // min(r,g,b) <= this  -> alpha 255 (keep)

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:transparent;}
  canvas{display:block;position:absolute;top:0;left:0;}
</style></head><body>
<canvas id="c" width="${w}" height="${h}"></canvas>
<script>
  const img = new Image();
  img.onload = function(){
    const cv = document.getElementById('c');
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, ${w}, ${h});
    const id = ctx.getImageData(0, 0, ${w}, ${h});
    const d = id.data;
    const FULL = ${FULL}, SOFT = ${SOFT};
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i+1], b = d[i+2];
      const m = Math.min(r, g, b);
      if (m >= FULL) { d[i+3] = 0; }
      else if (m > SOFT) {
        // linear ramp between SOFT and FULL
        const a = Math.round(255 * (FULL - m) / (FULL - SOFT));
        if (a < d[i+3]) d[i+3] = a;
      }
    }
    ctx.putImageData(id, 0, 0);
  };
  img.src = "${dataUri}";
</script>
</body></html>`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cutout-'));
const htmlPath = path.join(tmp, 'cutout.html');
const shotPath = path.join(tmp, 'cutout.png');
fs.writeFileSync(htmlPath, html);

const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'mcchrome-'));
try {
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-sandbox',
    '--force-device-scale-factor=1',
    `--user-data-dir=${udd}`,
    `--window-size=${w},${h}`,
    '--virtual-time-budget=4000',
    '--default-background-color=00000000',
    `--screenshot=${shotPath}`,
    'file:///' + htmlPath.replace(/\\/g, '/'),
  ], { stdio: 'ignore' });
} finally {
  fs.rmSync(udd, { recursive: true, force: true });
}

if (!fs.existsSync(shotPath)) { console.error('Chrome produced no output'); process.exit(1); }

// Back up the raw original (only on the default in-place overwrite).
if (outPng === inPng) {
  const rawBak = path.join(path.dirname(inPng), 'mark-headshot-raw.png');
  if (!fs.existsSync(rawBak)) fs.copyFileSync(inPng, rawBak);
  console.log('raw backed up -> ' + rawBak);
}

fs.copyFileSync(shotPath, outPng);
const outSize = imageInfo(fs.readFileSync(outPng));
console.log(`cutout written -> ${outPng}  (${outSize.w}x${outSize.h})`);
console.log('If edges keep white halo, raise FULL; if it eats the shirt, lower it.');
