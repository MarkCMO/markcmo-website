// scripts/inline-partials.mjs
//
// Reads partials/master-nav.html + master-footer.html and inlines them
// into functions/_middleware.js as JS template literals. This makes the
// middleware self-contained - no runtime env.ASSETS.fetch dependency.
//
// Run after editing either partial:
//   node scripts/inline-partials.mjs

import fs from 'node:fs';

const navHtml = fs.readFileSync('partials/master-nav.html', 'utf-8');
const footHtml = fs.readFileSync('partials/master-footer.html', 'utf-8');

function toJsTemplate(s) {
  // Escape backslash, then backtick, then ${} interpolation triggers
  return '`' + s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`';
}

const navLit = toJsTemplate(navHtml);
const footLit = toJsTemplate(footHtml);

const mw = fs.readFileSync('functions/_middleware.js', 'utf-8');

// Replace the entire "1. Master nav + footer" section
const startMarker = '// ────────────────────────────────────────────────────────────────────\n// 1. Master nav + footer';
const endMarker = '// ────────────────────────────────────────────────────────────────────\n// 2. Maintenance banner';

const startIdx = mw.indexOf(startMarker);
const endIdx = mw.indexOf(endMarker);
if (startIdx < 0 || endIdx < 0) {
  console.error('Could not find markers in _middleware.js');
  process.exit(1);
}

const newBlock = `// ────────────────────────────────────────────────────────────────────
// 1. Master nav + footer (INLINED - single source of truth)
// ────────────────────────────────────────────────────────────────────
//
// Both partials are inlined as JS template literals. To edit the nav
// or footer, edit partials/master-nav.html or partials/master-footer.html
// and re-run \`node scripts/inline-partials.mjs\`. This eliminates the
// env.ASSETS.fetch dependency that was returning empty strings in
// production.

const MASTER_NAV_HTML = ${navLit};

const MASTER_FOOTER_HTML = ${footLit};

function getMasterNav() { return MASTER_NAV_HTML; }
function getMasterFooter() { return MASTER_FOOTER_HTML; }

// Exact paths that already have their own nav/footer inlined and should
// NOT receive injection. The homepage is the canonical source of truth.
const PATHS_WITH_OWN_CHROME = new Set([
  '/',
  '/index.html',
]);

// Path prefixes that should NEVER have nav/footer injected (admin tools,
// API responses that happen to be HTML, embeds, etc).
const SKIP_PATH_PREFIXES = [
  '/api/',
  '/admin/',
  '/partials/',
  '/.well-known/',
  '/courses/',
  '/access/',
];

const SKIP_EXTS = new Set([
  'css','js','json','xml','txt','ico','png','jpg','jpeg','webp','svg','gif',
  'woff','woff2','ttf','pdf','zip','map','mp4','mp3','avif',
]);

function shouldInjectChrome(url) {
  if (PATHS_WITH_OWN_CHROME.has(url.pathname)) return false;
  for (const p of SKIP_PATH_PREFIXES) {
    if (url.pathname.startsWith(p)) return false;
  }
  return true;
}

class NavInjector {
  constructor(html) { this.html = html; }
  element(el) {
    if (!this.html) return;
    const attr = el.getAttribute('data-master-chrome');
    if (attr === 'off' || attr === 'false') return;
    el.prepend(this.html, { html: true });
  }
}
class FooterInjector {
  constructor(html) { this.html = html; }
  element(el) {
    if (!this.html) return;
    const attr = el.getAttribute('data-master-chrome');
    if (attr === 'off' || attr === 'false') return;
    el.append(this.html, { html: true });
  }
}

`;

const updated = mw.substring(0, startIdx) + newBlock + mw.substring(endIdx);

// Also remove old duplicated declarations (SKIP_EXTS, etc) that may now exist twice
// by stripping any subsequent re-declarations of the same identifiers
const dedupes = ['const SKIP_EXTS = new Set', 'function shouldInjectChrome', 'class NavInjector', 'class FooterInjector', 'const PATHS_WITH_OWN_CHROME', 'const SKIP_PATH_PREFIXES'];
let final = updated;
for (const d of dedupes) {
  const firstIdx = final.indexOf(d);
  if (firstIdx < 0) continue;
  const secondIdx = final.indexOf(d, firstIdx + d.length);
  if (secondIdx < 0) continue;
  // Find end of second declaration's block (next blank line after closing brace)
  const tail = final.substring(secondIdx);
  const matchEnd = tail.search(/^\}\s*\n\s*\n/m);
  if (matchEnd < 0) continue;
  const removeStart = secondIdx;
  const removeEnd = secondIdx + matchEnd + 2; // include the closing brace + newline
  final = final.substring(0, removeStart) + final.substring(removeEnd);
  console.log(`Removed duplicate: ${d}`);
}

fs.writeFileSync('functions/_middleware.js', final);
console.log(`✓ Inlined nav (${navHtml.length} chars) + footer (${footHtml.length} chars)`);
console.log(`✓ Middleware: ${final.length} chars total`);
