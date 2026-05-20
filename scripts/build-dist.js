// build-dist.js - Builds CF Pages static asset output dir for MarkCMO
// NOTE: .html files are excluded from dist - they are served via BLOBS_MARKCMO_PAGES_HTML KV (catch-all function)
const fs = require('fs');
const path = require('path');
const DIST = 'dist';
const TOP_LEVEL_DIRS = ['blog', 'data', 'images', 'js', 'assets', '.well-known', 'css', 'fonts', 'documents', 'docs', 'forms', 'scripts-client'];
// INTENTIONALLY EXCLUDES .html - those 21k+ pages go into KV (BLOBS_MARKCMO_PAGES_HTML)
const TOP_LEVEL_FILE_PATTERNS = [/\.css$/, /\.json$/, /\.txt$/, /\.xml$/, /\.ico$/, /\.svg$/, /\.png$/, /\.jpg$/, /\.webp$/, /\.pdf$/, /\.webmanifest$/];
const TOP_LEVEL_LITERALS = ['_headers', '_redirects', 'robots.txt', 'humans.txt', 'manifest.json'];
const NEVER = [/^node_modules/, /^\.netlify/, /^\.wrangler/, /^\.claude/, /^\.git/, /^functions/, /^netlify\b/, /^scripts/, /^cloudflare/, /^dist/, /^supabase/, /^\.env/, /\.local$/, /\.log$/, /^package(-lock)?\.json$/, /^wrangler\.toml$/, /\.py$/, /\.sh$/, /\.md$/, /\.example$/, /\.gitignore/, /\.courses-bak/, /\.cfignore/, /\.wranglerignore/];
function shouldSkip(n) { return NEVER.some(p => p.test(n)); }
function topLevelKeep(n) { if (shouldSkip(n)) return false; if (TOP_LEVEL_LITERALS.includes(n)) return true; if (TOP_LEVEL_FILE_PATTERNS.some(p => p.test(n))) return true; if (TOP_LEVEL_DIRS.includes(n)) return true; return false; }
function cpRecursive(src, dst) { const s = fs.statSync(src); if (s.isDirectory()) { fs.mkdirSync(dst, { recursive: true }); for (const e of fs.readdirSync(src)) cpRecursive(path.join(src, e), path.join(dst, e)); } else fs.copyFileSync(src, dst); }
fs.rmSync(DIST, { recursive: true, force: true }); fs.mkdirSync(DIST);
let copied = 0;
for (const e of fs.readdirSync('.')) { if (!topLevelKeep(e)) continue; cpRecursive(e, path.join(DIST, e)); copied++; }
let total = 0;
function countF(dir) { for (const e of fs.readdirSync(dir)) { const f = path.join(dir, e); if (fs.statSync(f).isDirectory()) countF(f); else total++; } }
countF(DIST);
console.log(`copied ${copied} entries; ${total} files in dist/ (HTML pages served via KV catch-all)`);
if (total > 20000) { console.error(`!! ${total} > 20000 file cap`); process.exit(1); }