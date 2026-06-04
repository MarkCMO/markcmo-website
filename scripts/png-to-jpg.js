// scripts/png-to-jpg.js
// Converts carousel-slide PNGs into JPEGs for Instagram's Content Publishing API,
// which rejects PNG (HTTP 400 code 9004). No ImageMagick/sharp/ffmpeg on this box,
// so we drive headless Chrome: load the PNG into an offscreen <canvas>, flatten it
// onto a solid background (JPEG has no alpha), export toDataURL('image/jpeg'), and
// pull the base64 out of the DOM via --dump-dom.
//
//   node scripts/png-to-jpg.js <file.png | dir> [more...]
//   node scripts/png-to-jpg.js daily-assets            # converts day*-slide*.png
//
// Output: <same path>.jpg next to each source PNG. Verifies JPEG magic bytes FFD8.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const QUALITY = 0.92;
// Flatten transparency onto the brand ink so any (rare) alpha edge stays on-brand
// instead of going black. Slides are opaque already, so this is just insurance.
const BG = '#0A0F2C';

function pngDims(buf) {
  // PNG IHDR width/height are big-endian uint32 at byte offsets 16 and 20.
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function convertOne(pngPath, tmp) {
  const buf = fs.readFileSync(pngPath);
  const dims = pngDims(buf);
  if (!dims) throw new Error(`not a PNG: ${pngPath}`);
  const dataUri = 'data:image/png;base64,' + buf.toString('base64');
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<pre id="o"></pre>
<script>
  var img = new Image();
  img.onload = function () {
    var c = document.createElement('canvas');
    c.width = ${dims.w}; c.height = ${dims.h};
    var x = c.getContext('2d');
    x.fillStyle = ${JSON.stringify(BG)};
    x.fillRect(0, 0, c.width, c.height);
    x.drawImage(img, 0, 0, c.width, c.height);
    document.getElementById('o').textContent = c.toDataURL('image/jpeg', ${QUALITY});
  };
  img.src = ${JSON.stringify(dataUri)};
</script></body></html>`;

  const htmlPath = path.join(tmp, 'conv.html');
  fs.writeFileSync(htmlPath, html);
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'mcjpg-'));
  let dom;
  try {
    dom = execFileSync(CHROME, [
      '--headless=new', '--disable-gpu', '--no-sandbox',
      `--user-data-dir=${udd}`,
      '--virtual-time-budget=4000',
      '--dump-dom',
      'file:///' + htmlPath.replace(/\\/g, '/'),
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } finally {
    fs.rmSync(udd, { recursive: true, force: true });
  }

  const m = dom.match(/data:image\/jpeg;base64,([A-Za-z0-9+/=]+)/);
  if (!m) throw new Error(`canvas produced no JPEG for ${path.basename(pngPath)}`);
  const jpg = Buffer.from(m[1], 'base64');
  if (jpg.length < 4 || jpg[0] !== 0xff || jpg[1] !== 0xd8) {
    throw new Error(`output is not a valid JPEG (magic ${jpg[0]?.toString(16)}${jpg[1]?.toString(16)})`);
  }
  const outPath = pngPath.replace(/\.png$/i, '.jpg');
  fs.writeFileSync(outPath, jpg);
  return { outPath, bytes: jpg.length };
}

function collect(target) {
  const st = fs.statSync(target);
  if (st.isDirectory()) {
    // Only carousel slides get posted to IG — reel covers/osd cards are filmed manually.
    return fs.readdirSync(target)
      .filter(f => /^day\d+-slide\d+\.png$/i.test(f))
      .map(f => path.join(target, f))
      .sort();
  }
  return [target];
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) { console.error('usage: node scripts/png-to-jpg.js <file.png|dir> [...]'); process.exit(1); }
  const files = args.flatMap(collect);
  if (!files.length) { console.error('no matching PNGs'); process.exit(1); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcjpgrun-'));
  let ok = 0, kb = 0;
  try {
    for (const f of files) {
      const r = convertOne(f, tmp);
      ok++; kb += r.bytes / 1024;
      console.log(`${path.basename(f)} -> ${path.basename(r.outPath)} (${Math.round(r.bytes / 1024)} KB)`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`Done. ${ok} JPEG(s), ${Math.round(kb)} KB total.`);
}

main();
