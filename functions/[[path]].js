// functions/[[path]].js
import { SITE_NAV_HTML, SITE_FOOTER_HTML } from './_lib/site-chrome.js';
// Root catch-all for Cloudflare Pages.
// Handles two responsibilities:
//
// 1. /.netlify/functions/* compatibility
//    HTML pages built for Netlify call /.netlify/functions/<name>.
//    CF Pages equivalent functions live at /api/<name>, /track, etc.
//    This function redirects (307 — preserves method + body) to the right CF path.
//
// 2. HTML page serving from KV
//    All .html files are excluded from the static CF Pages deployment to stay
//    under the 20,000-file limit.  They are uploaded to KV at deploy time by
//    scripts/upload-html-to-kv.js.  This function reads them out and serves them.
//    KV key = repo-relative path without .html  (e.g. "about", "index", "courses/exam")

// Map Netlify function names → CF Pages Function paths
const NETLIFY_FN_MAP = {
  // Public
  'public-blog':                    '/api/public-blog',
  // Tracking
  'track':                          '/track',
  // Client portal
  'client-portal-data':             '/api/client-portal-data',
  // Courses
  'course-exam':                    '/course-exam',
  'course-enroll':                  '/course-enroll',
  'course-lesson':                  '/course-lesson',
  'course-graduate':                '/course-graduate',
  'course-votes':                   '/course-votes',
  'course-curriculum':              '/course-curriculum',
  // Student portal
  'student-portal':                 '/student-portal',
  'validate-token':                 '/validate-token',
  'purchase-gate':                  '/purchase-gate',
  // Payments
  'pay':                            '/pay',
  'square-invoice-action':          '/api/square-invoice-action',
  'square-invoice-sync':            '/api/square-invoice-sync',
  'square-webhook':                 '/api/square-webhook',
  'square-webhook-register':        '/api/square-webhook-register',
  // Admin
  'admin-auth':                     '/api/admin-auth',
  'admin-data':                     '/api/admin-data',
  'admin-blog':                     '/api/admin-blog',
  'admin-links':                    '/api/admin-links',
  'admin-mc-write':                 '/api/admin-mc-write',
  'admin-upload':                   '/api/admin-upload',
  'admin-engagement-data':          '/api/admin-engagement-data',
  // Engagement docs
  'generate-engagement-docs':       '/api/generate-engagement-docs',
  'execute-document':               '/api/execute-document',
  'execute-engagement-doc':         '/api/execute-engagement-doc',
  'submit-document':                '/api/submit-document',
  'submit-engagement-doc':          '/api/submit-engagement-doc',
  'send-engagement-proposal-email': '/api/send-engagement-proposal-email',
  'get-document':                   '/api/get-document',
  // Email
  'email-form':                     '/api/email-form',
  'email-drip':                     '/api/email-drip',
  'resend-webhook':                 '/api/resend-webhook',
  // Film / Wetyr
  'film-intel':                     '/film-intel',
  'film-rolodex':                   '/film-rolodex',
  'film-rolodex-cron':              '/api/film-rolodex-cron',
  'news-feed':                      '/news-feed',
  // Script tools
  'script-upload':                  '/api/script-upload',
  'script-dissect':                 '/api/script-dissect',
  'script-result':                  '/api/script-result',
  'script-schedule':                '/api/script-schedule',
  'script-callsheet':               '/api/script-callsheet',
  'script-budget':                  '/api/script-budget',
  'script-jobs':                    '/api/script-jobs',
  'script-post':                    '/api/script-post',
  'script-orders':                  '/api/script-orders',
  'script-safety':                  '/api/script-safety',
  'script-shotlist':                '/api/script-shotlist',
  'script-locations':               '/api/script-locations',
  'script-schedule-background':     '/api/script-schedule-background',
  // Calendar
  'calendly-sync-history':          '/api/calendly-sync-history',
  'calendly-webhook':               '/api/calendly-webhook',
  // Misc
  'founding-status':                '/api/founding-status',
  'webinar-signup':                 '/api/webinar-signup',
};

// SPA directories: when /dir/* path not found in KV, serve dir/index instead.
// These are single-page apps where index.html handles all sub-routes via JS.
const SPA_INDEX = {
  'portal':   'portal/index',
  'sign':     'sign/index',
  'admin':    'admin/index',
};

// ── Nav/footer auto-injection ─────────────────────────────────────────────────
// Pages that should NOT have nav/footer injected (special/admin/utility pages).
const NO_INJECT = new Set([
  '404', 'access-required', 'nav', 'footer', 'blog-post',
  'resume-hub', 'welcome', 'verify', 'diploma', 'graduation',
  'exam', 'admin', 'admin-c7x9k2m', 'admin-directories', 'admin.html',
  'learn',
]);
function shouldInjectChrome(pagePath) {
  if (NO_INJECT.has(pagePath)) return false;
  if (pagePath.startsWith('MLG-Resume')) return false;
  if (pagePath.startsWith('admin/') || pagePath.startsWith('portal/') ||
      pagePath.startsWith('sign/')  || pagePath.startsWith('exam/') ||
      pagePath.startsWith('learn/')) return false;
  return true;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  let p = url.pathname;

  // ── WordPress search URL (/?s=...) — redirect to homepage ────────────────
  // These are leftover WordPress search URLs that waste crawl budget.
  if (url.searchParams.has('s')) {
    return Response.redirect('https://markcmo.com/', 301);
  }

  // ── Netlify function compatibility layer ──────────────────────────────────
  if (p.startsWith('/.netlify/functions/')) {
    const rest   = p.slice('/.netlify/functions/'.length);
    const fnName = rest.split('/')[0];
    const cfPath = NETLIFY_FN_MAP[fnName];

    if (cfPath) {
      const subPath = rest.includes('/') ? rest.slice(fnName.length) : '';
      const redirectUrl = new URL(url);
      redirectUrl.pathname = cfPath + subPath;
      // 307 preserves request method and body (important for POST/PUT)
      return Response.redirect(redirectUrl.toString(), 307);
    }

    return new Response(
      JSON.stringify({ error: `Netlify function "${fnName}" not mapped to a CF Pages path` }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── HTML page serving from KV ─────────────────────────────────────────────
  if (p.startsWith('/')) p = p.slice(1);
  if (p.endsWith('/'))   p = p.slice(0, -1);
  if (p.endsWith('.html')) p = p.slice(0, -5);
  if (!p) p = 'index';

  const kv = env.BLOBS_MARKCMO_PAGES_HTML;
  if (!kv) {
    return new Response('KV not configured — BLOBS_MARKCMO_PAGES_HTML binding missing', {
      status: 503,
      headers: { 'content-type': 'text/plain' },
    });
  }

  // 1. Exact key (e.g. "about", "fractional-cmo-new-york-ny")
  let html = await kv.get(p, { type: 'text' });

  // 2. Try with .html suffix (belt-and-suspenders for legacy keys)
  if (html === null) html = await kv.get(p + '.html', { type: 'text' });

  // 3. Try path/index for directory-style URLs (/courses → "courses/index")
  if (html === null) html = await kv.get(p + '/index', { type: 'text' });

  // 4. SPA fallback: /portal/*, /sign/*, /admin/* → serve their index page
  //    The SPA's JS reads window.location to load the right content.
  if (html === null) {
    const topLevel = p.split('/')[0];
    const spaKey   = SPA_INDEX[topLevel];
    if (spaKey) html = await kv.get(spaKey, { type: 'text' });
  }

  if (html !== null) {
    // ── Nav / footer injection ────────────────────────────────────────────────
    // Automatically add the site nav and footer to any page that is missing
    // them, so every page has consistent chrome without requiring individual
    // HTML file edits.
    if (shouldInjectChrome(p) && html.includes('</body>')) {
      const missingNav    = !html.includes('id="mainNav"');
      const missingFooter = !html.includes('</footer>');
      if (missingNav || missingFooter) {
        // Ensure style.css is loaded (provides CSS variables + shared styles)
        if (!html.includes('style.css')) {
          html = html.replace('</head>',
            '<link rel="stylesheet" href="/style.css">\n</head>');
        }
      }
      if (missingNav) {
        // Insert nav immediately after <body> tag + add padding for fixed nav.
        html = html.replace(
          /<body([^>]*)>/,
          `<body$1><style>body{padding-top:64px}</style>${SITE_NAV_HTML}`
        );
      }
      if (missingFooter) {
        html = html.replace('</body>', `${SITE_FOOTER_HTML}\n</body>`);
      }
    }

    // ── Canonical URL injection ───────────────────────────────────────────────
    // Ensure every page has a self-referencing canonical to prevent duplicate
    // content issues from www/non-www, .html suffix, and old path variants.
    if (!html.includes('rel="canonical"')) {
      const canonPath    = p === 'index' ? '' : p;
      const canonicalTag = `<link rel="canonical" href="https://markcmo.com/${canonPath}">`;
      html = html.replace('</head>', canonicalTag + '\n</head>');
    }

    // ── Entity schema injection ───────────────────────────────────────────────
    // Inject Organization + Person schema with comprehensive sameAs on every
    // page that lacks it. City/service pages have no Organization schema at all.
    // This signals entity identity to every AI crawler and knowledge graph.
    if (!html.includes('"Organization"')) {
      const entitySchema = JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": "https://markcmo.com/#organization",
            "name": "MarkCMO",
            "legalName": "WETYR Corp",
            "url": "https://markcmo.com",
            "logo": "https://markcmo.com/assets/mark-gabrielli.jpg",
            "description": "MarkCMO is a fractional executive leadership practice providing part-time CMO, COO, and C-suite advisory services to growth-stage B2B companies across the United States.",
            "email": "mark@markcmo.com",
            "telephone": "+13219175738",
            "foundingDate": "2010",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Cape Canaveral",
              "addressRegion": "FL",
              "postalCode": "32920",
              "addressCountry": "US"
            },
            "areaServed": "United States",
            "priceRange": "$8,000–$20,000/month",
            "sameAs": [
              "https://www.linkedin.com/in/markgabriellijr",
              "https://www.linkedin.com/company/markcmo",
              "https://clutch.co/profile/mark-gabrielli-chief-marketing-officer",
              "https://www.crunchbase.com/person/mark-gabrielli",
              "https://twitter.com/markcmo",
              "https://x.com/markcmo",
              "https://www.facebook.com/markgabriellijr",
              "https://www.youtube.com/@markcmo",
              "https://g2.com/sellers/markcmo",
              "https://www.trustpilot.com/review/markcmo.com"
            ]
          },
          {
            "@type": "Person",
            "@id": "https://markcmo.com/#mark-gabrielli",
            "name": "Mark Gabrielli",
            "givenName": "Mark",
            "familyName": "Gabrielli",
            "alternateName": "Mark Gabrielli Jr.",
            "jobTitle": "Fractional CMO & COO",
            "description": "Mark Gabrielli is a Fractional CMO and COO with 15+ years of executive marketing and operations leadership. He founded MarkCMO to deliver C-suite-level marketing strategy to growth-stage companies across SaaS, healthcare, aerospace, fintech, and manufacturing.",
            "url": "https://markcmo.com/about",
            "image": "https://markcmo.com/assets/mark-gabrielli.jpg",
            "email": "mark@markcmo.com",
            "telephone": "+13219175738",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Cape Canaveral",
              "addressRegion": "FL",
              "addressCountry": "US"
            },
            "worksFor": { "@id": "https://markcmo.com/#organization" },
            "knowsAbout": [
              "Fractional CMO Services", "Fractional COO Services",
              "B2B Marketing Strategy", "Demand Generation",
              "Go-to-Market Strategy", "Revenue Operations",
              "Account-Based Marketing", "SaaS Growth",
              "Healthcare Marketing", "Aerospace Marketing",
              "Fintech Marketing", "Marketing Technology Stack",
              "Revenue Architecture", "Brand Strategy"
            ],
            "sameAs": [
              "https://www.linkedin.com/in/markgabriellijr",
              "https://clutch.co/profile/mark-gabrielli-chief-marketing-officer",
              "https://www.crunchbase.com/person/mark-gabrielli",
              "https://twitter.com/markcmo",
              "https://x.com/markcmo",
              "https://markcmo.com"
            ]
          }
        ]
      });
      html = html.replace('</head>',
        `<script type="application/ld+json">${entitySchema}</script>\n</head>`);
    }

    // ── DefinedTerm schema for glossary pages ─────────────────────────────────
    // "what-is-*" pages are the highest LLM citation magnets. Injecting
    // DefinedTerm schema makes the term + definition machine-readable.
    if (p.startsWith('what-is-') && !html.includes('"DefinedTerm"')) {
      const termSlug = p.replace(/^what-is-/, '').replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      const defTermSchema = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "DefinedTerm",
        "@id": `https://markcmo.com/${p}#term`,
        "name": termSlug,
        "url": `https://markcmo.com/${p}`,
        "inDefinedTermSet": {
          "@type": "DefinedTermSet",
          "name": "MarkCMO Marketing Glossary",
          "url": "https://markcmo.com/glossary"
        }
      });
      html = html.replace('</head>',
        `<script type="application/ld+json">${defTermSchema}</script>\n</head>`);
    }

    // ── Speakable schema for comparison + guide pages ────────────────────────
    // Marks key passages for voice search / AI audio responses.
    // Applied to high-intent pages that lack an existing speakable spec.
    const isSpeakablePage = (p.includes('vs-') || p.startsWith('how-to-') ||
      p.startsWith('when-') || p.startsWith('questions-to-') ||
      p === 'fractional-cmo-cost' || p === 'fractional-cmo');
    if (isSpeakablePage && !html.includes('"Speakable"') && !html.includes('"speakable"')) {
      const speakableSchema = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": `https://markcmo.com/${p}#webpage`,
        "speakable": {
          "@type": "SpeakableSpecification",
          "cssSelector": ["h1", "h2", ".speakable", "[data-speakable]",
            "p:first-of-type", ".answer-block", ".faq-answer"]
        },
        "url": `https://markcmo.com/${p}`
      });
      html = html.replace('</head>',
        `<script type="application/ld+json">${speakableSchema}</script>\n</head>`);
    }

    return new Response(html, {
      status: 200,
      headers: {
        'content-type':  'text/html; charset=utf-8',
        'cache-control': 'public, max-age=3600',
      },
    });
  }

  // 5. Fall through to static assets (CSS, JS, images, fonts, etc.)
  //    _routes.json excludes /*.css, /*.js, etc. so they never reach here,
  //    but this is a belt-and-suspenders safety net.
  const staticResponse = await context.next();
  if (staticResponse.status !== 404) return staticResponse;

  // 6. Custom 404 page, or minimal inline fallback
  const notFound = await kv.get('404', { type: 'text' });
  return new Response(notFound || '<h1>404 Not Found</h1>', {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
