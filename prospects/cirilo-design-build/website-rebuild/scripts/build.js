// build.js - wraps pages/*.html with _header.html + _footer.html, copies assets, writes to dist/
// Inlines the SSI-style <!--#include file="_header.html" --> and <!--#include file="_footer.html" --> markers.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGES = path.join(ROOT, 'pages');
const ASSETS = path.join(ROOT, 'assets');
const DIST = path.join(ROOT, 'dist');

// ── Clean dist ──────────────────────────────────────────────────
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

// ── Read shared partials ────────────────────────────────────────
const header = fs.readFileSync(path.join(PAGES, '_header.html'), 'utf8');
const footer = fs.readFileSync(path.join(PAGES, '_footer.html'), 'utf8');

// ── Head enhancer: ensure OG/Twitter/JSON-LD on every indexable page ──
const SITE = 'https://cirilodb.com';
const OG_IMG = 'https://images.unsplash.com/photo-1572331165267-854da2b10ccc?auto=format&fit=crop&w=1200&q=80';
function esc(s) { return String(s || '').replace(/"/g, '&quot;'); }
function enhanceHead(html, urlPath) {
  if (/noindex/i.test(html)) return html; // private pages opt out
  const titleM = html.match(/<title>([^<]*)<\/title>/i);
  const title = titleM ? titleM[1].trim() : 'Cirilo Design + Build';
  const descM = html.match(/name=["']description["']\s+content=["']([^"']*)["']/i);
  const desc = descM ? descM[1] : '';
  const url = SITE + (urlPath || '/');
  let inject = '';
  if (!/property=["']og:title/i.test(html)) {
    inject += `\n<meta property="og:type" content="website">\n<meta property="og:site_name" content="Cirilo Design + Build">\n<meta property="og:title" content="${esc(title)}">\n<meta property="og:description" content="${esc(desc)}">\n<meta property="og:url" content="${url}">\n<meta property="og:image" content="${OG_IMG}">`;
  }
  if (!/name=["']twitter:card/i.test(html)) {
    inject += `\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="${esc(title)}">\n<meta name="twitter:description" content="${esc(desc)}">\n<meta name="twitter:image" content="${OG_IMG}">`;
  }
  if (!/application\/ld\+json/i.test(html)) {
    const ld = { '@context': 'https://schema.org', '@graph': [
      { '@type': 'Organization', '@id': SITE + '/#org', name: 'Cirilo Design + Build', url: SITE, telephone: '+1-704-000-0000', areaServed: 'Charlotte, North Carolina and across NC', sameAs: [] },
      { '@type': 'WebSite', '@id': SITE + '/#website', url: SITE, name: 'Cirilo Design + Build', publisher: { '@id': SITE + '/#org' } }
    ] };
    inject += `\n<script type="application/ld+json">${JSON.stringify(ld)}</script>`;
  }
  if (inject) html = html.replace(/<\/head>/i, inject + '\n</head>');
  // Performance: lazy-load + async-decode any content <img> that opts in via class or lacks loading.
  html = html.replace(/<img (?![^>]*\bloading=)/gi, '<img loading="lazy" decoding="async" ');
  // Accessibility: give the first <main> a skip-link target id.
  html = html.replace(/<main(?![^>]*\bid=)/i, '<main id="main"');
  return html;
}
function slugFromDst(dst) {
  let rel = path.relative(DIST, dst).replace(/\\/g, '/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return '/' + rel.slice(0, -('/index.html'.length));
  return '/' + rel.replace(/\.html$/, '');
}

// ── Process each page ───────────────────────────────────────────
function processPages(dir, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let count = 0;
  for (const e of entries) {
    if (e.name.startsWith('_')) continue; // skip partials
    const src = path.join(dir, e.name);
    const dst = path.join(outDir, e.name);
    if (e.isDirectory()) {
      count += processPages(src, dst);
      continue;
    }
    if (!e.name.endsWith('.html')) {
      fs.copyFileSync(src, dst);
      count++;
      continue;
    }
    let html = fs.readFileSync(src, 'utf8');
    html = html.replace(/<!--#include\s+file="_header\.html"\s*-->/g, header);
    html = html.replace(/<!--#include\s+file="_footer\.html"\s*-->/g, footer);
    html = enhanceHead(html, slugFromDst(dst));
    fs.writeFileSync(dst, html);
    count++;
  }
  return count;
}

// ── Copy assets/ recursively ────────────────────────────────────
function cpRecursive(src, dst) {
  const s = fs.statSync(src);
  if (s.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const e of fs.readdirSync(src)) cpRecursive(path.join(src, e), path.join(dst, e));
  } else {
    fs.copyFileSync(src, dst);
  }
}

// ── Generate _headers (cache + security) ────────────────────────
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'"
].join('; ');

const headersFile = `# Cloudflare Pages _headers - security + caching
/*
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  Cross-Origin-Opener-Policy: same-origin
  X-DNS-Prefetch-Control: off
  Content-Security-Policy: ${csp}

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*.html
  Cache-Control: public, max-age=300, s-maxage=600
`;

// ── Generate _redirects (clean URLs, legacy fallbacks) ──────────
const redirectsFile = `# Cloudflare Pages _redirects - clean URLs + legacy fallbacks
# /book is now the dedicated booking wizard; legacy aliases point to it
/book-online                   /book                          301
/book-consultation             /book                          301
`;

// ── Generate robots.txt ─────────────────────────────────────────
const robotsFile = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /portal
Disallow: /proposal
Disallow: /vendors

Sitemap: https://cirilodb-rebuild.pages.dev/sitemap.xml
`;

// ── Generate sitemap.xml ────────────────────────────────────────
const pageList = ['/'];
function collectPages(dir, prefix='') {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('_')) continue;
    if (e.isDirectory()) {
      collectPages(path.join(dir, e.name), prefix + '/' + e.name);
      continue;
    }
    if (!e.name.endsWith('.html')) continue;
    if (e.name === 'index.html' && prefix === '') continue; // already in list as /
    // Skip noindexed pages (e.g. the private proposal/sign experience).
    const body = fs.readFileSync(path.join(dir, e.name), 'utf8');
    if (/noindex/i.test(body)) continue;
    const slug = e.name === 'index.html' ? prefix : `${prefix}/${e.name.replace('.html', '')}`;
    pageList.push(slug);
  }
}
collectPages(PAGES);

const today = new Date().toISOString().split('T')[0];
const sitemapFile = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pageList.map(p => `  <url>
    <loc>https://cirilodb-rebuild.pages.dev${p}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${p === '/' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>
`;

// ── Run build ───────────────────────────────────────────────────
console.log('━━━ cirilodb-rebuild build ━━━');
const pageCount = processPages(PAGES, DIST);
console.log(`pages processed: ${pageCount}`);

if (fs.existsSync(ASSETS)) {
  cpRecursive(ASSETS, path.join(DIST, 'assets'));
  console.log('assets copied');
}

// ── Copy standalone app dirs (admin, portal) as-is, no partial inlining ──
['admin', 'portal', 'vendors'].forEach(function (dir) {
  var src = path.join(ROOT, dir);
  if (fs.existsSync(src)) { cpRecursive(src, path.join(DIST, dir)); console.log(dir + '/ copied'); }
});

// ── Copy Pages Functions (functions/ -> dist/functions/) ──
var FN = path.join(ROOT, 'functions');
if (fs.existsSync(FN)) { cpRecursive(FN, path.join(DIST, 'functions')); console.log('functions/ copied'); }

fs.writeFileSync(path.join(DIST, '_headers'), headersFile);
fs.writeFileSync(path.join(DIST, '_redirects'), redirectsFile);
fs.writeFileSync(path.join(DIST, 'robots.txt'), robotsFile);
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemapFile);

// Count final files
let total = 0;
function countF(d) {
  for (const e of fs.readdirSync(d)) {
    const f = path.join(d, e);
    if (fs.statSync(f).isDirectory()) countF(f); else total++;
  }
}
countF(DIST);

console.log(`_headers, _redirects, robots.txt, sitemap.xml written`);
console.log(`${total} total files in dist/`);
console.log('━━━ ready to deploy ━━━');
