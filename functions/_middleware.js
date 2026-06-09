// functions/_middleware.js
//
// Global HTML middleware for every markcmo.com request:
//
//   1. Master nav + footer injection
//      Reads partials/master-nav.html and partials/master-footer.html
//      and injects them into <body> on every HTML response except the
//      paths listed in PATHS_WITH_OWN_CHROME (the homepage, admin, etc).
//      Single source of truth - edit the partials once and every page
//      picks up the change on next deploy.
//
//   2. Maintenance banner
//      Driven by env.MAINTENANCE_MESSAGE. Empty/unset = no banner.

// ────────────────────────────────────────────────────────────────────
// 1. Master nav + footer
// ────────────────────────────────────────────────────────────────────

// In-memory cache per worker isolate. Workers stay warm so we avoid
// re-fetching the partials on every HTML hit. To bust after editing,
// just redeploy (which spawns fresh isolates).
let _navPartial = null;
let _footPartial = null;

async function loadPartial(env, path) {
  try {
    const url = `https://placeholder.invalid${path}`;
    const res = await env.ASSETS.fetch(new Request(url));
    if (!res.ok) {
      console.warn(`master-partial fetch ${path} -> HTTP ${res.status}`);
      return '';
    }
    return await res.text();
  } catch (e) {
    console.warn(`master-partial fetch ${path} crashed:`, e && e.message);
    return '';
  }
}

async function getMasterNav(env) {
  if (_navPartial === null) {
    _navPartial = await loadPartial(env, '/partials/master-nav.html');
  }
  return _navPartial;
}
async function getMasterFooter(env) {
  if (_footPartial === null) {
    _footPartial = await loadPartial(env, '/partials/master-footer.html');
  }
  return _footPartial;
}

// Exact paths that already have their own nav/footer inlined and should
// NOT receive injection. The homepage is the canonical source of truth;
// admin/auth/checkout pages have their own chrome.
//
// NOTE: this is matched by exact path (with and without trailing
// /index.html), not a prefix. For prefix-based skips, see SKIP_PATH_PREFIXES.
const PATHS_WITH_OWN_CHROME = new Set([
  '/',
  '/index.html',
]);

// Path prefixes that should NEVER have nav/footer injected (admin
// tools, API responses, embeds, the partials themselves).
const SKIP_PATH_PREFIXES = [
  '/api/',
  '/admin/',           // admin tool UIs
  '/partials/',        // the partials themselves
  '/.well-known/',
  '/courses/',         // course player chrome differs
  '/access/',          // access portals
];

// Static asset extensions - skip middleware entirely
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
    // Read opt-out attribute on <body>. Pages can set
    // <body data-master-chrome="off"> to disable injection without
    // editing this middleware.
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

// ────────────────────────────────────────────────────────────────────
// 2. Maintenance banner (legacy - kept for ops use)
// ────────────────────────────────────────────────────────────────────

const BANNER_CSS = `
  #maint-bar{position:fixed;top:0;left:0;right:0;z-index:99999;background:#0f172a;border-bottom:2px solid #f97316;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;font-size:13.5px;font-weight:450;letter-spacing:0.01em;padding:11px 48px;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 2px 16px rgba(0,0,0,.4);text-align:center;line-height:1.4;}
  #maint-bar .maint-icon{font-size:15px;flex-shrink:0;opacity:.9;}
  #maint-bar .maint-label{font-weight:700;color:#fb923c;font-size:13.5px;margin-right:4px;text-transform:uppercase;letter-spacing:0.06em;font-size:11px;}
  #maint-bar .maint-sep{color:#475569;margin:0 6px;}
  #maint-bar .maint-text{color:#cbd5e1;}
  #maint-bar .maint-close{position:absolute;right:14px;top:50%;transform:translateY(-50%);background:none;border:none;color:#64748b;font-size:18px;cursor:pointer;line-height:1;padding:4px 8px;transition:color .15s;}
  #maint-bar .maint-close:hover{color:#f1f5f9;}
  body{padding-top:46px !important;}
`;
const BANNER_SCRIPT = `
  (function(){
    var bar=document.getElementById('maint-bar');
    if(!bar)return;
    var key='maint_v2_'+encodeURIComponent(bar.dataset.msg||'').slice(0,40);
    if(sessionStorage.getItem(key)){bar.style.display='none';document.body.style.paddingTop='0';return;}
    bar.querySelector('.maint-close').addEventListener('click',function(){
      bar.style.display='none';document.body.style.paddingTop='0';sessionStorage.setItem(key,'1');
    });
  })();
`;
class HeadInjector {
  constructor(css) { this.css = css; }
  element(el) { el.append(`<style>${this.css}</style>`, { html: true }); }
}
class BannerInjector {
  constructor(message) { this.message = message; }
  element(el) {
    const safe = this.message.replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const html = `<div id="maint-bar" data-msg="${safe}"><span class="maint-icon">&#9888;</span><span class="maint-label">Maintenance</span><span class="maint-sep">&mdash;</span><span class="maint-text">${safe}</span><button class="maint-close" aria-label="Dismiss">&times;</button></div><script>${BANNER_SCRIPT}<\/script>`;
    el.prepend(html, { html: true });
  }
}

// ────────────────────────────────────────────────────────────────────
// Main handler
// ────────────────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request, env, next } = context;

  if (request.method !== 'GET' && request.method !== 'HEAD') return next();

  const url = new URL(request.url);
  const ext = url.pathname.split('.').pop().toLowerCase();
  if (SKIP_EXTS.has(ext)) return next();

  const response = await next();
  const ct = response.headers.get('content-type') || '';

  // Always tag responses with a debug header so we can verify middleware
  // is firing. Remove once nav injection is confirmed working.
  const dbg = { ct: ct.slice(0, 30), path: url.pathname.slice(0, 60) };

  if (!ct.includes('text/html')) {
    const out = new Response(response.body, response);
    out.headers.set('X-MW', `skip:nothtml ct=${dbg.ct}`);
    return out;
  }

  const message = (env.MAINTENANCE_MESSAGE || '').trim();
  const injectChrome = shouldInjectChrome(url);
  dbg.injectChrome = injectChrome;
  dbg.hasAssets = !!(env.ASSETS && typeof env.ASSETS.fetch === 'function');

  if (!message && !injectChrome) {
    const out = new Response(response.body, response);
    out.headers.set('X-MW', `skip:nochrome path=${dbg.path}`);
    return out;
  }

  const rewriter = new HTMLRewriter();
  let navLen = 0, footLen = 0;

  if (injectChrome) {
    const [navHtml, footHtml] = await Promise.all([
      getMasterNav(env),
      getMasterFooter(env),
    ]);
    navLen = navHtml ? navHtml.length : 0;
    footLen = footHtml ? footHtml.length : 0;
    if (navHtml) rewriter.on('body', new NavInjector(navHtml));
    if (footHtml) rewriter.on('body', new FooterInjector(footHtml));
  }

  if (message) {
    rewriter.on('head', new HeadInjector(BANNER_CSS));
    rewriter.on('body', new BannerInjector(message));
  }

  const transformed = rewriter.transform(response);
  // Clone so we can add a debug header (transformed responses' headers
  // are read-only on the streaming Response).
  const out = new Response(transformed.body, transformed);
  out.headers.set('X-MW', `inject path=${dbg.path} assets=${dbg.hasAssets} nav=${navLen} foot=${footLen}`);
  return out;
}
