// functions/[[path]].js
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

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  let p = url.pathname;

  // ── Netlify function compatibility layer ──────────────────────────
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

  // ── HTML page serving from KV ─────────────────────────────────────
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
    html = await injectSharedComponents(html, kv);
    return new Response(html, {
      status: 200,
      headers: {
        'content-type':  'text/html; charset=utf-8',
        'cache-control': 'public, max-age=3600',
      },
    });
  }

  // 5. Custom 404 page, or minimal inline fallback
  const notFound = await kv.get('404', { type: 'text' });
  return new Response(notFound || '<h1>404 Not Found</h1>', {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

// ── Shared nav + footer injection ────────────────────────────────────────────
// nav.html    → KV key "_nav"    (style + <nav id="mainNav"> + mobile drawer + init script)
// footer.html → KV key "_footer" (style + <footer>…</footer>)
//
// • Nav: injected right after <body> only on pages that lack id="mainNav"
//         (compare/*, guides/*, etc. — pages with their own nav are left alone)
// • Footer: every <footer>…</footer> is replaced with the shared version
//           so all pages stay in sync when footer.html changes
async function injectSharedComponents(html, kv) {
  // Parallel KV fetch — edge-cached for 1 hour after first read
  const [sharedNav, sharedFooter] = await Promise.all([
    kv.get('_nav',    { type: 'text', cacheTtl: 3600 }),
    kv.get('_footer', { type: 'text', cacheTtl: 3600 }),
  ]);

  // ── Nav ─────────────────────────────────────────────────────────────────
  if (sharedNav && !html.includes('id="mainNav"')) {
    html = html.replace('<body>', '<body>\n' + sharedNav);
  }

  // ── Footer ──────────────────────────────────────────────────────────────
  // <footer…>…</footer> → shared footer (HTML forbids nested <footer> so this is safe)
  if (sharedFooter) {
    const footerRe = /<footer[\s\S]*?<\/footer>/i;
    if (footerRe.test(html)) {
      html = html.replace(footerRe, sharedFooter);
    } else {
      // No footer on this page — append before </body>
      html = html.replace('</body>', sharedFooter + '\n</body>');
    }
  }

  // ── LinkedIn widget ───────────────────────────────────────────────────────
  // Inject on every page that doesn't already have it (script is idempotent
  // via localStorage dismiss logic so double-loading is harmless, but skip
  // it when already present to avoid duplicate widgets).
  if (!html.includes('linkedin-widget.js')) {
    html = html.replace('</body>', '<script src="/linkedin-widget.js" defer></script>\n</body>');
  }

  return html;
}
