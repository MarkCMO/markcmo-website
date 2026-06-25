// functions/[[path]].js
import { SITE_NAV_HTML, SITE_FOOTER_HTML, SITE_FOOTER_ELEMENT } from './_lib/site-chrome.js';
import { TRUNCATED_REDIRECTS } from './_lib/legacy-redirects.js';
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
  // calendly-webhook removed from the Netlify-compat map on 2026-06-08.
  // The Calendly webhook subscription was repointed directly to
  // /api/calendly-webhook so it bypasses the legacy /.netlify/functions/*
  // worker route entirely. Native Cloudflare Pages function only.
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

// ── Legacy URL recovery (301) ─────────────────────────────────────────────────
// Google still crawls old URL shapes from pre-migration sitemaps:
//   • directory-style  /fractional-cmo/kansas/manhattan  → fractional-cmo-manhattan-ks
//   • location/ prefix /location/saas-development         → saas-development
// When a page 404s, we try to rebuild the canonical flat slug and 301 to it IF
// that page actually exists in KV. This recovers ~77 GSC "Not found" URLs and
// any future legacy-shaped links, without redirecting to non-existent pages.
const STATE_NAME_TO_ABBR = {
  alabama:'al',alaska:'ak',arizona:'az',arkansas:'ar',california:'ca',colorado:'co',
  connecticut:'ct',delaware:'de',florida:'fl',georgia:'ga',hawaii:'hi',idaho:'id',
  illinois:'il',indiana:'in',iowa:'ia',kansas:'ks',kentucky:'ky',louisiana:'la',
  maine:'me',maryland:'md',massachusetts:'ma',michigan:'mi',minnesota:'mn',
  mississippi:'ms',missouri:'mo',montana:'mt',nebraska:'ne',nevada:'nv',
  'new-hampshire':'nh','new-jersey':'nj','new-mexico':'nm','new-york':'ny',
  'north-carolina':'nc','north-dakota':'nd',ohio:'oh',oklahoma:'ok',oregon:'or',
  pennsylvania:'pa','rhode-island':'ri','south-carolina':'sc','south-dakota':'sd',
  tennessee:'tn',texas:'tx',utah:'ut',vermont:'vt',virginia:'va',washington:'wa',
  'west-virginia':'wv',wisconsin:'wi',wyoming:'wy','district-of-columbia':'dc',
};

// Returns a canonical flat slug candidate for a legacy-shaped path, or null.
function legacyCanonical(p) {
  // Truncated-city-slug recovery (e.g. "lead-generation-toms" → "...-toms-river-nj").
  // Static map of ~400 stale GSC 404s; target existence is verified by the caller.
  if (TRUNCATED_REDIRECTS[p]) return TRUNCATED_REDIRECTS[p];
  // location/{slug} → {slug}
  if (p.startsWith('location/')) return p.slice('location/'.length);
  // {service}/{state-name}/{city} → {service}-{city}-{abbr}
  const m = p.match(/^([a-z0-9-]+?)\/([a-z-]+)\/([a-z0-9-]+)$/);
  if (m && STATE_NAME_TO_ABBR[m[2]]) {
    return `${m[1]}-${m[3]}-${STATE_NAME_TO_ABBR[m[2]]}`;
  }
  return null;
}

// ── Nav/footer auto-injection ─────────────────────────────────────────────────
// Pages that should NOT have nav/footer injected (special/admin/utility pages).
const NO_INJECT = new Set([
  // Homepage — has its own complete inline nav + footer; skip injection
  'index',
  // Special / admin / utility pages
  '404', 'access-required', 'nav', 'footer', 'blog-post',
  'resume-hub', 'welcome', 'verify', 'diploma', 'graduation',
  'exam', 'admin', 'admin-c7x9k2m', 'admin-directories', 'admin.html',
  'learn',
]);
function shouldInjectChrome(pagePath) {
  if (NO_INJECT.has(pagePath)) return false;
  if (pagePath.startsWith('MLG-Resume')) return false;
  // Funnel client-flow pages are self-contained + per-client THEMED. They must
  // NOT get nav/footer/style.css injected - that chrome (and the dark-site
  // style.css) overrides a light theme and produces light-on-light text. These
  // are the bare single-segment keys ('portal'/'sign' below only matched the
  // 'portal/' subpath prefix, not the page itself).
  if (pagePath === 'intake' || pagePath === 'sign' || pagePath === 'portal') return false;
  if (pagePath.startsWith('admin/') || pagePath.startsWith('portal/') ||
      pagePath.startsWith('sign/')  || pagePath.startsWith('exam/') ||
      pagePath.startsWith('learn/') || pagePath.startsWith('proposals/')) return false;
  return true;
}

// ── /health endpoint (inlined here because a separate functions/health.js
// gets shadowed by this catch-all on CF Pages — single-file functions at
// the functions/ root don't reliably beat [[path]].js on /health and the
// alert flood on 2026-05-28 was caused by the catch-all returning the 404
// page instead of the health JSON). WETYR Infrastructure Protocol §5.2.
// Tiered like academy/health: Square + Resend = critical; KV + JSONBin =
// warn-only — degraded body but still 200 so the synthetic monitor doesn't
// flap on peripheral hiccups.
const HEALTH_TIMEOUT_MS = 5000;
async function _healthWithTimeout(p, ms, label) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(label + ' timeout')), ms);
  });
  try { return await Promise.race([p, timeout]); } finally { clearTimeout(t); }
}
async function _healthCheckSquare(env) {
  const token = env.SQUARE_ACADEMY_ACCESS_TOKEN || env.SQUARE_ACCESS_TOKEN;
  if (!token) return { ok: false, error: 'no_token' };
  try {
    const r = await _healthWithTimeout(fetch('https://connect.squareup.com/v2/locations', {
      headers: { 'Authorization': 'Bearer ' + token, 'Square-Version': '2024-11-20' },
    }), HEALTH_TIMEOUT_MS, 'square');
    if (!r.ok) return { ok: false, status: r.status, error: 'http_' + r.status };
    const d = await r.json();
    return { ok: true, locations: (d.locations || []).length };
  } catch (e) { return { ok: false, error: e.message }; }
}
async function _healthCheckResend(env) {
  if (!env.RESEND_API_KEY) return { ok: false, error: 'no_key' };
  try {
    const r = await _healthWithTimeout(fetch('https://api.resend.com/domains', {
      headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY },
    }), HEALTH_TIMEOUT_MS, 'resend');
    if (!r.ok) return { ok: false, status: r.status, error: 'http_' + r.status };
    const d = await r.json();
    return { ok: true, domains: (d.data || []).length };
  } catch (e) { return { ok: false, error: e.message }; }
}
async function _healthCheckKv(env) {
  const kv = env.BLOBS_MARKCMO_PAGES_HTML;
  if (!kv) return { ok: false, error: 'no_binding' };
  try {
    await _healthWithTimeout(kv.get('index', { type: 'text' }), HEALTH_TIMEOUT_MS, 'kv');
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function _handleHealth(env) {
  const start = Date.now();
  const [square, resend, kv] = await Promise.all([
    _healthCheckSquare(env),
    _healthCheckResend(env),
    _healthCheckKv(env),
  ]);
  const checks = { square, resend, kv };
  const critical = ['square', 'resend'];
  const criticalOk = critical.every(k => checks[k] && checks[k].ok);
  const allOk      = Object.values(checks).every(c => c && c.ok);
  const status     = allOk ? 'ok' : (criticalOk ? 'degraded' : 'down');
  const httpStatus = criticalOk ? 200 : 503;
  return new Response(JSON.stringify({
    status,
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - start,
    property: 'markcmo.com',
    checks,
  }, null, 2), {
    status: httpStatus,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  let p = url.pathname;

  // ── /health (inlined — see comment above _handleHealth) ──────────────────
  if (p === '/health' || p === '/health/') {
    return _handleHealth(env);
  }

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

  // 3b. Client engagement docs under /documents/ are self-contained and must
  //     serve verbatim from KV with NO nav/footer/canonical/schema injection.
  //     They were previously excluded from this Function and served as static
  //     assets, which went stale at the CF edge. Serving from KV here is the
  //     durable fix (matches the /documents/* no-store headers).
  if (html !== null && p.startsWith('documents/')) {
    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store, no-cache, must-revalidate, private',
        'x-robots-tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex',
        'x-frame-options': 'DENY',
        'referrer-policy': 'no-referrer',
      },
    });
  }

  // 4. SPA fallback: /portal/*, /sign/*, /admin/* → serve their index page
  //    The SPA's JS reads window.location to load the right content.
  if (html === null) {
    const topLevel = p.split('/')[0];
    const spaKey   = SPA_INDEX[topLevel];
    if (spaKey) html = await kv.get(spaKey, { type: 'text' });
  }

  // 4b. Legacy URL recovery: rebuild canonical flat slug from old URL shapes
  //     (directory-style + location/ prefix) and 301 to it IF it exists.
  if (html === null) {
    const canonical = legacyCanonical(p);
    if (canonical && canonical !== p) {
      const target = await kv.get(canonical, { type: 'text' });
      if (target !== null) {
        return Response.redirect(`https://markcmo.com/${canonical}`, 301);
      }
    }
  }

  if (html !== null) {
    // ── Favicon / icon links ──────────────────────────────────────────────────
    // Every page declares the MarkCMO "M" favicon (browsers + Google result icon
    // + AI search cards). Idempotent: skipped if the page already declares an icon
    // (e.g. the homepage, which has them inline). Root /favicon.ico also covers the
    // whole origin by default as a belt-and-suspenders fallback.
    if (html.includes('</head>') && !/rel=["']?(shortcut )?icon/i.test(html)) {
      html = html.replace('</head>',
        '<link rel="icon" href="/favicon.ico" sizes="any">' +
        '<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png">' +
        '<link rel="icon" type="image/svg+xml" href="/favicon.svg">' +
        '<link rel="apple-touch-icon" href="/apple-touch-icon.png">' +
        '<link rel="manifest" href="/site.webmanifest">\n</head>');
    }
    // ── Nav / footer injection ────────────────────────────────────────────────
    // Automatically add/replace nav and footer on every page so all pages
    // share the same chrome, regardless of what HTML is stored in KV.
    //
    // Four cases handled:
    //  1. Page has NO footer          → inject SITE_FOOTER_HTML before </body>
    //  2. Page has footer-mega        → replace old footer with SITE_FOOTER_HTML
    //  3. Page has footer-main but no site-footer-css → replace with SITE_FOOTER_HTML
    //  4. Page has footer-main + site-footer-css  → skip (already correct)
    if (shouldInjectChrome(p) && html.includes('</body>')) {
      const missingNav         = !html.includes('id="mainNav"');
      const hasFooterMega      = html.includes('footer-mega') || html.includes('footer-brand-col');
      const hasFooterMain      = html.includes('footer-main');
      const hasFooterCSS       = html.includes('site-footer-css');
      const missingFooter      = !html.includes('</footer>');
      const needsFooterReplace = hasFooterMega || (hasFooterMain && !hasFooterCSS);

      if (missingNav || needsFooterReplace || missingFooter) {
        // Ensure style.css is loaded (CSS variables + shared styles)
        if (!html.includes('style.css')) {
          html = html.replace('</head>',
            '<link rel="stylesheet" href="/style.css">\n</head>');
        }
      }

      if (missingNav) {
        // Find <body> tag and insert nav + padding right after it
        const bodyIdx = html.indexOf('<body');
        const bodyEnd = html.indexOf('>', bodyIdx);
        if (bodyIdx !== -1 && bodyEnd !== -1) {
          const insertion = `<style>body{padding-top:64px}</style>${SITE_NAV_HTML}`;
          html = html.slice(0, bodyEnd + 1) + insertion + html.slice(bodyEnd + 1);
        }
      }

      if (needsFooterReplace) {
        // Strategy: replace everything from <footer to </body>, but first extract
        // any <script> tags in that region so they are re-appended after the new
        // footer. This removes orphaned footer-band divs (footer-glossary-band,
        // footer-services-band etc.) while keeping inline scripts intact.
        const fStart    = html.indexOf('<footer');
        const bodyClose = html.lastIndexOf('</body>');
        if (fStart !== -1 && bodyClose !== -1 && fStart < bodyClose) {
          // Collect <script>...</script> blocks from between </footer> and </body>
          const fEnd = html.indexOf('</footer>', fStart);
          let keptScripts = '';
          if (fEnd !== -1) {
            let region = html.slice(fEnd + '</footer>'.length, bodyClose);
            let si = region.indexOf('<script');
            while (si !== -1) {
              const se = region.indexOf('</script>', si);
              if (se === -1) break;
              keptScripts += region.slice(si, se + '</script>'.length) + '\n';
              si = region.indexOf('<script', se + '</script>'.length);
            }
          }
          html = html.slice(0, fStart) + SITE_FOOTER_HTML + '\n' + keptScripts + html.slice(bodyClose);
        } else if (fStart !== -1) {
          // Fallback: no </body> found — replace just the footer element
          const fEnd = html.indexOf('</footer>', fStart);
          if (fEnd !== -1) {
            html = html.slice(0, fStart) + SITE_FOOTER_HTML + html.slice(fEnd + '</footer>'.length);
          }
        }
      } else if (missingFooter) {
        // No footer at all — inject full footer (includes style tag)
        const bodyClose = html.lastIndexOf('</body>');
        if (bodyClose !== -1) {
          html = html.slice(0, bodyClose) + SITE_FOOTER_HTML + '\n' + html.slice(bodyClose);
        }
      }
      // hasFooterMain + hasFooterCSS → already correct, do nothing
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

    // ── City/Service schema (brand-strategy-miami-fl pattern) ────────────────
    // Inject Service + BreadcrumbList for programmatic city pages.
    // Detection: last path segment is a 2-letter US state abbreviation.
    const _US_STATES = {FL:'Florida',TX:'Texas',CA:'California',NY:'New York',
      GA:'Georgia',IL:'Illinois',PA:'Pennsylvania',OH:'Ohio',NC:'North Carolina',
      AZ:'Arizona',WA:'Washington',MA:'Massachusetts',CO:'Colorado',TN:'Tennessee',
      MN:'Minnesota',MI:'Michigan',NJ:'New Jersey',VA:'Virginia',OR:'Oregon',
      MO:'Missouri',WI:'Wisconsin',MD:'Maryland',SC:'South Carolina',
      AL:'Alabama',KY:'Kentucky',LA:'Louisiana',OK:'Oklahoma',CT:'Connecticut',
      UT:'Utah',IA:'Iowa',NV:'Nevada',AR:'Arkansas',KS:'Kansas',MS:'Mississippi',
      NM:'New Mexico',NE:'Nebraska',ID:'Idaho',WV:'West Virginia',HI:'Hawaii',
      ME:'Maine',NH:'New Hampshire',RI:'Rhode Island',MT:'Montana',DE:'Delaware',
      SD:'South Dakota',ND:'North Dakota',AK:'Alaska',VT:'Vermont',WY:'Wyoming',DC:'DC'};
    const _pParts   = p.split('-');
    const _lastSeg  = _pParts[_pParts.length - 1];
    const _stAbbr   = _lastSeg.toUpperCase();
    if (_pParts.length >= 3 && _US_STATES[_stAbbr] && !html.includes('"Service"')) {
      const _citySlug = _pParts[_pParts.length - 2];
      const _svcSlug  = _pParts.slice(0, -2).join('-');
      const _cityName = _citySlug.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
      const _svcName  = _svcSlug.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
      const _stName   = _US_STATES[_stAbbr];
      const _cityServiceSchema = JSON.stringify({
        "@context":"https://schema.org",
        "@graph":[
          {
            "@type":"Service",
            "@id":`https://markcmo.com/${p}#service`,
            "name":`${_svcName} in ${_cityName}, ${_stName}`,
            "description":`Expert ${_svcName.toLowerCase()} for businesses in ${_cityName}, ${_stName}. Delivered by Mark Gabrielli, Fractional CMO with 15+ years of executive marketing leadership.`,
            "url":`https://markcmo.com/${p}`,
            "provider":{"@id":"https://markcmo.com/#mark-gabrielli"},
            "areaServed":{"@type":"City","name":_cityName,"containedInPlace":{"@type":"State","name":_stName,"containedInPlace":{"@type":"Country","name":"United States"}}},
            "category":"Marketing Consulting",
            "serviceType":_svcName,
            "offers":{"@type":"Offer","priceCurrency":"USD","priceRange":"$8,000-$20,000","availability":"https://schema.org/InStock"}
          },
          {
            "@type":"BreadcrumbList",
            "@id":`https://markcmo.com/${p}#breadcrumb`,
            "itemListElement":[
              {"@type":"ListItem","position":1,"name":"Home","item":"https://markcmo.com/"},
              {"@type":"ListItem","position":2,"name":_svcName,"item":`https://markcmo.com/${_svcSlug}`},
              {"@type":"ListItem","position":3,"name":`${_cityName}, ${_stName}`,"item":`https://markcmo.com/${p}`}
            ]
          }
        ]
      });
      html = html.replace('</head>',
        `<script type="application/ld+json">${_cityServiceSchema}</script>\n</head>`);
    }

    // ── BreadcrumbList for all other pages ────────────────────────────────────
    // Non-city pages get a simple 2-level breadcrumb for SERP display.
    if (!html.includes('"BreadcrumbList"') && p !== 'index') {
      const _h1m = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      const _pgTitle = _h1m
        ? _h1m[1].trim()
        : p.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
      const _bcSchema = JSON.stringify({
        "@context":"https://schema.org",
        "@type":"BreadcrumbList",
        "@id":`https://markcmo.com/${p}#breadcrumb`,
        "itemListElement":[
          {"@type":"ListItem","position":1,"name":"Home","item":"https://markcmo.com/"},
          {"@type":"ListItem","position":2,"name":_pgTitle,"item":`https://markcmo.com/${p}`}
        ]
      });
      html = html.replace('</head>',
        `<script type="application/ld+json">${_bcSchema}</script>\n</head>`);
    }

    // ── E-E-A-T author byline ─────────────────────────────────────────────────
    // Inject a visible "By Mark Gabrielli" attribution line immediately after the
    // first <h1> on content pages. Signals authorship to GSC and AI crawlers.
    // Skipped on portal/sign/admin paths (handled upstream by shouldInjectChrome).
    if (shouldInjectChrome(p) &&
        !html.includes('data-eeat-byline="v1"') &&
        !html.match(/<[^>]*class=["'][^"']*\bauthor\b/i) &&
        !html.match(/\bBy\s+Mark\s+Gabrielli/i)) {
      // Name in brand gold (#C9A84C) so it pops on both dark-navy pages
      // (like /welcome-to-the-markcmo-club) and light-bg pages. Previous
      // color #222 was invisible on the dark welcome page. Wrapper color
      // bumped from #666 to #888 for slightly better dark-mode legibility
      // without losing readability on light surfaces. Left-border accent
      // also switched from red to brand gold for visual consistency.
      const _byline = '<div data-eeat-byline="v1" style="display:flex;align-items:center;' +
        'gap:10px;margin:0.35rem 0 1.75rem;padding-left:12px;border-left:3px solid #C9A84C;' +
        'font-size:0.82rem;color:#888;line-height:1.4">' +
        '<img src="/assets/mark-gabrielli.jpg" alt="Mark Gabrielli" loading="lazy" ' +
        'width="32" height="32" style="border-radius:50%;flex-shrink:0;object-fit:cover">' +
        '<span>By <strong style="color:#C9A84C">Mark Gabrielli</strong> &middot; ' +
        'Fractional CMO &amp; COO &middot; Last updated: May 2026</span></div>';
      if (/<\/h1>/i.test(html)) {
        html = html.replace(/(<\/h1>)/i, '$1' + _byline);
      } else if (/<main\b[^>]*>/i.test(html)) {
        html = html.replace(/(<main\b[^>]*>)/i, '$1' + _byline);
      }
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
