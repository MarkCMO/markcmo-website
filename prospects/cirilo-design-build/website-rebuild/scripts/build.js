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
const SITE = process.env.CDB_SITE_URL || 'https://cirilodb.com';
const OG_IMG = 'https://images.unsplash.com/photo-1572331165267-854da2b10ccc?auto=format&fit=crop&w=1200&q=80';
// Stable IndexNow key (Bing, Yandex, Seznam, Naver). Same value must live at /<key>.txt.
const INDEXNOW_KEY = 'c1r110d8a7e94f2b8d6c0e5f3a1b9c7d';
// Optional verification tokens (set via env when Mark provides them; left blank = skipped).
const GSC_VERIFICATION = process.env.CDB_GSC_TOKEN || '';   // Google Search Console HTML-file method
const BING_VERIFICATION = process.env.CDB_BING_TOKEN || ''; // Bing Webmaster Tools XML method
// Collected during the build for llms.txt / llms-full.txt generation.
const PAGE_INDEX = [];
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
      { '@type': ['Organization', 'GeneralContractor', 'HomeAndConstructionBusiness'], '@id': SITE + '/#org',
        name: 'Cirilo Design + Build', alternateName: 'Cirilo DB', url: SITE,
        telephone: '+1-910-409-0648', email: 'Tiffany@CiriloDB.com',
        description: 'Luxury design-build firm in Charlotte, NC. Custom concrete (gunite) pools, outdoor living, renovations, and additions under one accountable team.',
        image: OG_IMG, priceRange: '$$$',
        address: { '@type': 'PostalAddress', addressLocality: 'Charlotte', addressRegion: 'NC', addressCountry: 'US' },
        areaServed: [ { '@type': 'City', name: 'Charlotte' }, { '@type': 'State', name: 'North Carolina' } ],
        contactPoint: { '@type': 'ContactPoint', telephone: '+1-910-409-0648', contactType: 'sales', areaServed: 'US', availableLanguage: 'English' },
        knowsAbout: ['custom concrete pools', 'gunite pools', 'vanishing edge pools', 'plunge pools', 'outdoor kitchens', 'pergolas', 'fire features', 'hot tubs and spas', 'pool landscaping', '3D pool design', 'pool automation', 'pool renovation', 'outdoor living', 'home additions', 'home renovations'],
        sameAs: [] },
      { '@type': 'WebSite', '@id': SITE + '/#website', url: SITE, name: 'Cirilo Design + Build', publisher: { '@id': SITE + '/#org' }, inLanguage: 'en-US' }
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
    const _slug = slugFromDst(dst);
    if (!/noindex/i.test(html)) {
      const _t = html.match(/<title>([^<]*)<\/title>/i);
      const _d = html.match(/name=["']description["']\s+content=["']([^"']*)["']/i);
      PAGE_INDEX.push({ slug: _slug, title: _t ? _t[1].trim().replace(/&amp;/g, '&') : '', desc: _d ? _d[1].replace(/&amp;/g, '&') : '' });
    }
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

// ── Generate robots.txt (search + AI answer engines explicitly welcome) ──
// Named AI / LLM / answer-engine crawlers we explicitly invite to crawl and cite.
const AI_BOTS = [
  // OpenAI
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot',
  // Anthropic (Claude)
  'ClaudeBot', 'anthropic-ai', 'Claude-Web', 'Claude-User', 'Claude-SearchBot',
  // Google (search + Gemini/AI Overviews)
  'Googlebot', 'Googlebot-Image', 'Googlebot-News', 'Storebot-Google', 'Google-Extended', 'GoogleOther', 'GoogleOther-Image', 'APIs-Google',
  // Microsoft Bing + Copilot
  'Bingbot', 'BingPreview', 'msnbot', 'msnbot-media', 'adidxbot',
  // Apple (Siri / Spotlight + AI)
  'Applebot', 'Applebot-Extended',
  // Perplexity
  'PerplexityBot', 'Perplexity-User',
  // Amazon
  'Amazonbot',
  // Meta AI
  'FacebookBot', 'meta-externalagent', 'meta-externalfetcher',
  // ByteDance / TikTok
  'Bytespider', 'TikTokSpider',
  // Common Crawl (feeds many LLMs)
  'CCBot',
  // Cohere
  'cohere-ai', 'cohere-training-data-crawler',
  // DuckDuckGo AI
  'DuckAssistBot', 'DuckDuckBot',
  // You.com
  'YouBot',
  // Mistral
  'MistralAI-User',
  // Allen Institute
  'AI2Bot', 'AI2Bot-Dolma',
  // Diffbot
  'Diffbot',
  // Timpi
  'Timpibot',
  // Huawei
  'PetalBot', 'PanguBot',
  // Yandex
  'YandexBot', 'Yandex',
  // Webz.io / Omgili (powers AI datasets)
  'Omgilibot', 'Omgili', 'Webzio-Extended',
  // ImageSift
  'ImagesiftBot',
  // Brave / Kagi / other independent indexes
  'Kagibot', 'Bravebot',
  // Quora Poe
  'Poe-Bot',
  // Misc answer/assistant crawlers
  'YandexAdditional', 'Scrapy-AI', 'Andibot', 'PhindBot', 'ChatGLM-Spider', 'iaskspider', 'Awario'
];
const robotsFile = `# Cirilo Design + Build - robots.txt
# Search engines and AI answer engines are explicitly welcome to crawl and cite this site.

# All crawlers: public pages open, private app surfaces closed.
User-agent: *
Allow: /
Disallow: /admin
Disallow: /portal
Disallow: /proposal
Disallow: /vendors

# Explicitly invited AI assistants, LLM crawlers, and answer engines.
${AI_BOTS.map(b => `User-agent: ${b}`).join('\n')}
Allow: /
Disallow: /admin
Disallow: /portal
Disallow: /proposal
Disallow: /vendors

Sitemap: ${SITE}/sitemap.xml
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
    <loc>${SITE}${p}</loc>
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

// ── AI search (GEO/AEO): llms.txt, llms-full.txt, ai.txt ────────
// Curated, machine-readable map so LLMs and answer engines can ground answers in Cirilo's content.
const SERVICE_SLUGS = ['/custom-concrete-swimming-pools', '/outdoor-living-spaces', '/home-renovations-and-remodeling', '/home-additions'];
const COMPANY_SLUGS = ['/about', '/portfolio', '/process', '/financing', '/warranty', '/faq', '/contact', '/book', '/partners', '/press'];
const cleanTitle = t => String(t || '').replace(/\s*\|\s*Cirilo Design \+ Build\s*$/i, '').replace(/\s*\|\s*Cirilo DB\s*$/i, '').trim();
const llmLine = x => `- [${cleanTitle(x.title) || x.slug}](${SITE}${x.slug})${x.desc ? ': ' + x.desc : ''}`;
const idx = PAGE_INDEX.slice().sort((a, b) => a.slug.localeCompare(b.slug));
const svc = idx.filter(x => SERVICE_SLUGS.includes(x.slug));
const guideHub = idx.filter(x => x.slug === '/guides');
const guides = idx.filter(x => x.slug.startsWith('/guides/'));
const company = idx.filter(x => COMPANY_SLUGS.includes(x.slug));
const areas = idx.filter(x => x.slug.startsWith('/service-areas'));
const ORG_SUMMARY = 'Luxury design-build firm in Charlotte, North Carolina. Custom concrete (gunite) pools, outdoor living, renovations, and additions delivered by one accountable team from design through final walkthrough. NC licensed general contractor, bonded and insured, serving the Charlotte metro and across North Carolina.';

const llmsTxt = `# Cirilo Design + Build

> ${ORG_SUMMARY}

## Services
${svc.map(llmLine).join('\n')}

## Guides
${guides.map(llmLine).join('\n')}

## Company
${company.map(llmLine).join('\n')}

## Service Areas
- [Service Areas](${SITE}/service-areas/): Charlotte metro neighborhoods, ZIP codes, and North Carolina cities served. The complete list of location pages is in the sitemap at ${SITE}/sitemap.xml.

## Contact
- Phone: (910) 409-0648
- Email: Tiffany@CiriloDB.com
- Location: Charlotte, NC
- Booking: ${SITE}/book
`;

const llmsFull = `# Cirilo Design + Build - Full Content Index

> ${ORG_SUMMARY}

This file lists every public page so AI assistants and answer engines can ground responses in Cirilo's own content. Canonical site: ${SITE}

## Services
${svc.map(llmLine).join('\n')}

## Guides (Authority Library)
${guideHub.concat(guides).map(llmLine).join('\n')}

## Company
${company.map(llmLine).join('\n')}

## Service Areas (${areas.length})
${areas.map(llmLine).join('\n')}
`;

const aiTxt = `# ai.txt - AI usage policy for ${SITE.replace(/^https?:\/\//, '')}
# Cirilo Design + Build welcomes AI assistants, LLMs, and answer engines to read, index, and cite this site.
User-agent: *
Allow: /
Disallow: /admin
Disallow: /portal
Disallow: /proposal
Disallow: /vendors

Preferred-Citation: Cirilo Design + Build (${SITE})
Contact: Tiffany@CiriloDB.com
Content-Map: ${SITE}/llms.txt
Sitemap: ${SITE}/sitemap.xml
`;

fs.writeFileSync(path.join(DIST, 'llms.txt'), llmsTxt);
fs.writeFileSync(path.join(DIST, 'llms-full.txt'), llmsFull);
fs.writeFileSync(path.join(DIST, 'ai.txt'), aiTxt);

// ── IndexNow key file (Bing, Yandex, Seznam, Naver fast indexing) ──
fs.writeFileSync(path.join(DIST, INDEXNOW_KEY + '.txt'), INDEXNOW_KEY);

// ── Optional search-engine verification files (only when tokens provided) ──
if (GSC_VERIFICATION) {
  fs.writeFileSync(path.join(DIST, `google${GSC_VERIFICATION}.html`), `google-site-verification: google${GSC_VERIFICATION}.html`);
  console.log('google verification file written');
}
if (BING_VERIFICATION) {
  fs.writeFileSync(path.join(DIST, 'BingSiteAuth.xml'), `<?xml version="1.0"?>\n<users>\n  <user>${BING_VERIFICATION}</user>\n</users>\n`);
  console.log('bing verification file written');
}
console.log(`AI search files written: llms.txt (${svc.length} services, ${guides.length} guides), llms-full.txt (${idx.length} pages), ai.txt, IndexNow key`);

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
