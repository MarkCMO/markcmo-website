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
// Inlined partials - single source of truth.
// To edit nav/footer, modify partials/master-nav.html or master-footer.html
// and re-run: python scripts/inline-partials.py
const MASTER_NAV_HTML = `<!--
  master-nav.html  —  CANONICAL TOP NAV for markcmo.com
  ───────────────────────────────────────────────────────────────────
  This is the single source of truth for the site header. It is read
  by functions/_middleware.js at request time and injected into the
  start of <body> on every HTML page that does NOT already contain
  <nav class="nav" id="mainNav"> (e.g. the homepage, which has it
  inlined for SEO/perf).

  ANY change here propagates to every page in the site on next request
  (modulo edge cache TTL). DO NOT edit per-page navs — edit here.

  Includes:
    - Scoped CSS variables (mc-* prefix to avoid colliding with page CSS)
    - The <nav> element + <div class="mobile-drawer">
    - Hamburger toggle JS

  Mobile breakpoint: collapses links + button into hamburger drawer
  at max-width 1100px (matches homepage).
-->

<style id="mc-master-nav-css">
/* Scoped CSS variables - safe to embed even if the page already has them */
.mc-master-nav,.mc-master-nav-drawer {
  --mc-bg:      #0A0F2C;
  --mc-accent:  #C9A84C;
  --mc-border:  rgba(255,255,255,0.08);
  --mc-text2:   #A1A1AA;
  --mc-text3:   #71717A;
}

.mc-master-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  height: 64px; padding: 0 5vw;
  display: flex; align-items: center; justify-content: space-between;
  background: rgba(10,15,44,0.85);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--mc-border);
  font-family: -apple-system, BlinkMacSystemFont, 'Outfit', 'Inter', 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}
.mc-master-nav a { text-decoration: none; color: inherit; }

.mc-master-nav .mc-logo {
  display: flex; align-items: center; gap: 10px;
  font-family: 'Outfit', sans-serif; font-size: 1.1rem; font-weight: 700;
  color: #fff;
}
.mc-master-nav .mc-logo-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  overflow: hidden; flex-shrink: 0;
  border: 2px solid var(--mc-accent);
  box-shadow: 0 0 10px rgba(201,168,76,0.35);
}
.mc-master-nav .mc-logo-avatar img {
  width: 100%; height: 100%; object-fit: cover; object-position: center top;
}
.mc-master-nav .mc-logo-text { display: flex; flex-direction: column; line-height: 1.1; }
.mc-master-nav .mc-logo-text strong { font-size: 0.95rem; font-weight: 800; color: #fff; }
.mc-master-nav .mc-logo-text span { font-size: 0.65rem; font-weight: 500; color: var(--mc-text3); letter-spacing: 0.06em; text-transform: uppercase; }

.mc-master-nav .mc-links {
  display: flex; align-items: center; gap: 2.5rem;
  list-style: none; margin: 0; padding: 0;
}
.mc-master-nav .mc-links a {
  font-size: 0.875rem; font-weight: 500; color: var(--mc-text2);
  transition: color 0.15s;
}
.mc-master-nav .mc-links a:hover { color: #fff; }
.mc-master-nav .mc-links a.mc-accent { color: var(--mc-accent); font-weight: 600; }

.mc-master-nav .mc-right { display: flex; align-items: center; gap: 1.5rem; }
.mc-master-nav .mc-btn {
  font-size: 0.875rem; font-weight: 600; color: #0a0f2c;
  background: var(--mc-accent); padding: 0.55rem 1.25rem;
  border-radius: 8px; transition: opacity 0.15s, transform 0.15s;
  letter-spacing: 0.01em;
}
.mc-master-nav .mc-btn:hover { opacity: 0.88; transform: translateY(-1px); }

.mc-master-nav .mc-ham {
  display: none; flex-direction: column; gap: 5px;
  cursor: pointer; padding: 4px;
}
.mc-master-nav .mc-ham span {
  display: block; width: 22px; height: 2px;
  background: #fff; border-radius: 2px;
  transition: transform 0.2s, opacity 0.2s;
}

.mc-master-nav-drawer {
  display: none; position: fixed; inset: 0; z-index: 99;
  background: var(--mc-bg); padding: 80px 6vw 40px;
  flex-direction: column; gap: 1.25rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Outfit', 'Inter', sans-serif;
}
.mc-master-nav-drawer.mc-open { display: flex; }
.mc-master-nav-drawer a {
  font-size: 1.2rem; font-weight: 600; color: #fff;
  padding: 0.6rem 0; border-bottom: 1px solid var(--mc-border);
  text-decoration: none;
}
.mc-master-nav-drawer a.mc-accent { color: var(--mc-accent); font-weight: 700; }

/* Spacer so page content doesn't render under the fixed nav */
.mc-master-nav-spacer { height: 64px; }

/* Mobile collapse - hide links + button, show hamburger */
@media (max-width: 1100px) {
  .mc-master-nav .mc-links { display: none; }
  .mc-master-nav .mc-right .mc-btn { display: none; }
  .mc-master-nav .mc-ham { display: flex; }
}
</style>

<nav class="mc-master-nav" id="mcMasterNav">
  <a href="/" class="mc-logo">
    <div class="mc-logo-avatar">
      <img src="/assets/mark-gabrielli.jpg" alt="Mark Gabrielli" onerror="this.parentElement.innerHTML='<span style=\\'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-family:Outfit,sans-serif;font-weight:900;font-size:1rem;color:#fff;background:#C9A84C\\'>M</span>'" />
    </div>
    <div class="mc-logo-text">
      <strong>Mark Gabrielli</strong>
      <span>Fractional CMO &amp; COO</span>
    </div>
  </a>
  <ul class="mc-links">
    <li><a href="/about">About</a></li>
    <li><a href="/services">Services</a></li>
    <li><a href="/magnet-framework" class="mc-accent">MAGNET&trade;</a></li>
    <li><a href="/portfolio">Portfolio</a></li>
    <li><a href="/apps" class="mc-accent">Apps</a></li>
    <li><a href="/links">Links</a></li>
    <li><a href="/results">Results</a></li>
    <li><a href="/blog">Insights</a></li>
    <li><a href="https://academy.markcmo.com" target="_blank" rel="noopener" class="mc-accent">Academy</a></li>
  </ul>
  <div class="mc-right">
    <a href="/book" class="mc-btn">Book a Free Call</a>
  </div>
  <div class="mc-ham" id="mcMasterHam" aria-label="Menu" role="button" tabindex="0"><span></span><span></span><span></span></div>
</nav>

<div class="mc-master-nav-drawer" id="mcMasterDrawer">
  <a href="/about">About</a>
  <a href="/services">Services</a>
  <a href="/magnet-framework" class="mc-accent">MAGNET Framework&trade;</a>
  <a href="/portfolio">Portfolio</a>
  <a href="/apps" class="mc-accent">Apps</a>
  <a href="/links">Links</a>
  <a href="/results">Results</a>
  <a href="/blog">Insights</a>
  <a href="https://academy.markcmo.com" target="_blank" rel="noopener">Academy</a>
  <a href="/book" class="mc-accent">Book a Free Strategy Call &rarr;</a>
</div>

<div class="mc-master-nav-spacer" aria-hidden="true"></div>

<script id="mc-master-nav-js">
(function(){
  var ham = document.getElementById('mcMasterHam');
  var drawer = document.getElementById('mcMasterDrawer');
  if (!ham || !drawer) return;
  function toggle(){ drawer.classList.toggle('mc-open'); }
  function close(){ drawer.classList.remove('mc-open'); }
  ham.addEventListener('click', toggle);
  ham.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  drawer.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', close); });
})();
</script>
`;

const MASTER_FOOTER_HTML = `<!--
  master-footer.html  —  CANONICAL FOOTER for markcmo.com
  ───────────────────────────────────────────────────────────────────
  Single source of truth for the site footer. Injected by
  functions/_middleware.js into every HTML page that does NOT
  already contain <footer class="mc-master-footer"> or the legacy
  homepage <footer> with .footer-main inside.

  Mirrors the homepage footer exactly: brand block + 7 link columns
  + bottom bar with social links. Mobile collapses to 2 columns.

  DO NOT edit per-page footers — edit here. Change here propagates
  to every page on next request.
-->

<style id="mc-master-footer-css">
.mc-master-footer {
  --mc-bg:      #0A0F2C;
  --mc-bg2:     #050919;
  --mc-bg3:     #0E1438;
  --mc-accent:  #C9A84C;
  --mc-border:  rgba(255,255,255,0.08);
  --mc-text3:   #71717A;

  background: var(--mc-bg2);
  color: var(--mc-text3);
  font-family: -apple-system, BlinkMacSystemFont, 'Outfit', 'Inter', 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  border-top: 1px solid var(--mc-border);
  margin-top: 4rem;
}
.mc-master-footer a { color: var(--mc-text3); text-decoration: none; transition: color 0.15s; }
.mc-master-footer a:hover { color: #fff; }
.mc-master-footer ul { list-style: none; margin: 0; padding: 0; }

.mc-master-footer .mc-foot-main {
  max-width: 1400px; margin: 0 auto;
  padding: 4rem clamp(1.5rem, 6vw, 6rem) 3rem;
  display: grid; grid-template-columns: 2fr repeat(7, 1fr); gap: 2rem;
}
.mc-master-footer .mc-foot-brand { }
.mc-master-footer .mc-foot-logo-text {
  font-family: 'Outfit', sans-serif; font-size: 1.1rem; font-weight: 800;
  color: #fff; margin-bottom: 0.75rem;
}
.mc-master-footer .mc-foot-logo-text span { color: var(--mc-accent); }
.mc-master-footer .mc-foot-about {
  font-size: 0.825rem; line-height: 1.7; color: var(--mc-text3); margin-bottom: 1.25rem;
}
.mc-master-footer .mc-foot-chips {
  display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1.25rem;
}
.mc-master-footer .mc-foot-chip {
  font-size: 0.65rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--mc-text3); border: 1px solid var(--mc-border);
  padding: 0.25rem 0.6rem; border-radius: 4px;
}
.mc-master-footer .mc-foot-socials { display: flex; gap: 0.6rem; }
.mc-master-footer .mc-foot-soc {
  width: 34px; height: 34px; border-radius: 8px;
  background: var(--mc-bg3); border: 1px solid var(--mc-border);
  color: var(--mc-text3); display: flex; align-items: center; justify-content: center;
  font-size: 0.8rem; font-weight: 700; transition: all 0.15s;
}
.mc-master-footer .mc-foot-soc:hover { background: var(--mc-accent); border-color: var(--mc-accent); color: #fff; }
.mc-master-footer .mc-foot-col h4 {
  font-size: 0.7rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--mc-text3); margin: 0 0 1rem; font-family: inherit;
}
.mc-master-footer .mc-foot-col ul { display: flex; flex-direction: column; gap: 0.6rem; }
.mc-master-footer .mc-foot-col ul li a {
  font-size: 0.8125rem; color: var(--mc-text3); transition: color 0.15s;
}
.mc-master-footer .mc-foot-col ul li a.mc-accent { color: var(--mc-accent); font-weight: 600; }
.mc-master-footer .mc-foot-col ul li a:hover { color: #fff; }
.mc-master-footer .mc-foot-bar {
  border-top: 1px solid var(--mc-border);
  padding: 1.5rem clamp(1.5rem, 6vw, 6rem);
  max-width: 1400px; margin: 0 auto;
  display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 0.5rem;
}
.mc-master-footer .mc-foot-copy { font-size: 0.8rem; color: var(--mc-text3); }
.mc-master-footer .mc-foot-bar-links { display: flex; gap: 1.25rem; }
.mc-master-footer .mc-foot-bar-links a { font-size: 0.8rem; color: var(--mc-text3); transition: color 0.15s; }
.mc-master-footer .mc-foot-bar-links a:hover { color: #fff; }

@media (max-width: 1100px) {
  .mc-master-footer .mc-foot-main { grid-template-columns: 1fr 1fr 1fr 1fr; }
  .mc-master-footer .mc-foot-brand { grid-column: span 4; }
}
@media (max-width: 900px) {
  .mc-master-footer .mc-foot-main { grid-template-columns: 1fr 1fr; }
  .mc-master-footer .mc-foot-brand { grid-column: span 2; }
}
</style>

<footer class="mc-master-footer" id="mcMasterFooter">
  <div class="mc-foot-main">
    <div class="mc-foot-brand">
      <div class="mc-foot-logo-text">Mark <span>Gabrielli</span></div>
      <p class="mc-foot-about">Fractional CMO, COO &amp; Executive Consultant. I help businesses from $1M to $100M find what's broken, build what scales, and execute what others only talk about.</p>
      <div class="mc-foot-chips">
        <span class="mc-foot-chip">WETYR Founder</span>
        <span class="mc-foot-chip">Fractional C-Suite</span>
        <span class="mc-foot-chip">AI Strategist</span>
        <span class="mc-foot-chip">CST Certified</span>
      </div>
      <div class="mc-foot-socials">
        <a href="https://www.linkedin.com/in/marklgabrielli/" target="_blank" rel="noopener" class="mc-foot-soc" aria-label="LinkedIn">in</a>
        <a href="mailto:mark@markcmo.com" class="mc-foot-soc" aria-label="Email">@</a>
      </div>
    </div>
    <div class="mc-foot-col"><h4>C-Suite</h4><ul>
      <li><a href="/fractional-cmo">Fractional CMO</a></li>
      <li><a href="/fractional-coo">Fractional COO</a></li>
      <li><a href="/fractional-ceo">Fractional CEO</a></li>
      <li><a href="/fractional-cto">Fractional CTO</a></li>
      <li><a href="/fractional-cfo">Fractional CFO</a></li>
      <li><a href="/executive-advisory">Executive Advisory</a></li>
      <li><a href="/services">All Services</a></li>
    </ul></div>
    <div class="mc-foot-col"><h4>Marketing</h4><ul>
      <li><a href="/demand-generation">Demand Generation</a></li>
      <li><a href="/lead-generation">Lead Generation</a></li>
      <li><a href="/b2b-marketing">B2B Marketing</a></li>
      <li><a href="/content-marketing">Content Marketing</a></li>
      <li><a href="/email-marketing">Email Marketing</a></li>
      <li><a href="/digital-marketing">Digital Marketing</a></li>
      <li><a href="/social-media-marketing">Social Media</a></li>
      <li><a href="/linkedin-marketing">LinkedIn Marketing</a></li>
      <li><a href="/paid-social">Paid Social</a></li>
      <li><a href="/ppc-management">PPC Management</a></li>
      <li><a href="/local-seo">Local SEO</a></li>
      <li><a href="/crm-automation">CRM Automation</a></li>
      <li><a href="/marketing-automation">Marketing Automation</a></li>
      <li><a href="/account-based-marketing">ABM</a></li>
      <li><a href="/go-to-market-strategy">Go-to-Market</a></li>
      <li><a href="/marketing-audit">Marketing Audit</a></li>
      <li><a href="/marketing-strategy">Marketing Strategy</a></li>
    </ul></div>
    <div class="mc-foot-col"><h4>Compare</h4><ul>
      <li><a href="/fractional-cmo-cost">CMO Cost</a></li>
      <li><a href="/compare/fractional-cmo-vs-full-time-cmo/">vs Full-Time CMO</a></li>
      <li><a href="/compare/fractional-cmo-vs-marketing-agency/">vs Agency</a></li>
      <li><a href="/compare/fractional-cmo-vs-vp-of-marketing/">vs VP of Marketing</a></li>
      <li><a href="/compare/fractional-cmo-vs-consultant/">vs Consultant</a></li>
      <li><a href="/compare/fractional-cmo-vs-interim-cmo/">vs Interim CMO</a></li>
      <li><a href="/chief-outsiders-alternative">Chief Outsiders Alt.</a></li>
    </ul></div>
    <div class="mc-foot-col"><h4>By Stage</h4><ul>
      <li><a href="/fractional-cmo-pre-revenue">Pre-Revenue</a></li>
      <li><a href="/fractional-cmo-series-a">Series A</a></li>
      <li><a href="/fractional-cmo-series-b">Series B</a></li>
      <li><a href="/fractional-cmo-bootstrapped-companies">Bootstrapped</a></li>
      <li><a href="/fractional-cmo-pe-backed-companies">PE-Backed</a></li>
      <li><a href="/fractional-cmo-venture-capital">VC-Backed</a></li>
      <li><a href="/best-fractional-cmo">Best Fractional CMO</a></li>
    </ul></div>
    <div class="mc-foot-col"><h4>Industries</h4><ul>
      <li><a href="/fractional-cmo-saas">SaaS</a></li>
      <li><a href="/fractional-cmo-healthcare">Healthcare</a></li>
      <li><a href="/fractional-cmo-fintech">Fintech</a></li>
      <li><a href="/fractional-cmo-ai">AI Companies</a></li>
      <li><a href="/fractional-cmo-b2b">B2B</a></li>
      <li><a href="/fractional-cmo-ecommerce">eCommerce</a></li>
      <li><a href="/industries">All Industries</a></li>
    </ul></div>
    <div class="mc-foot-col"><h4>Cities</h4><ul>
      <li><a href="/fractional-cmo-dallas-fort-worth">Dallas-Fort Worth</a></li>
      <li><a href="/fractional-cmo-greater-houston">Houston</a></li>
      <li><a href="/fractional-cmo-greater-chicago">Chicago</a></li>
      <li><a href="/fractional-cmo-greater-atlanta">Atlanta</a></li>
      <li><a href="/fractional-cmo-greater-miami">Miami</a></li>
      <li><a href="/fractional-cmo-greater-boston">Boston</a></li>
      <li><a href="/fractional-cmo-near-me">CMO Near Me</a></li>
    </ul></div>
    <div class="mc-foot-col"><h4>Learn</h4><ul>
      <li><a href="/magnet-framework" class="mc-accent">MAGNET Framework&trade;</a></li>
      <li><a href="/blog">Insights &amp; Blog</a></li>
      <li><a href="/about">About Mark</a></li>
      <li><a href="/testimonials">Testimonials</a></li>
      <li><a href="/faq">FAQ</a></li>
      <li><a href="/contact">Contact</a></li>
      <li><a href="https://academy.markcmo.com" target="_blank" rel="noopener" class="mc-accent">Academy</a></li>
    </ul></div>
  </div>
  <div class="mc-foot-bar">
    <span class="mc-foot-copy">&copy; 2026 Mark Gabrielli &middot; markcmo.com &middot; All rights reserved.</span>
    <div class="mc-foot-bar-links">
      <a href="https://www.linkedin.com/in/marklgabrielli/" target="_blank" rel="noopener">LinkedIn</a>
      <a href="https://x.com/markgcmo" target="_blank" rel="noopener">X / Twitter</a>
      <a href="https://medium.com/@mark_louis_gabrielli_jr" target="_blank" rel="noopener">Medium</a>
      <a href="https://www.tiktok.com/@mark.gabrielli.cmo" target="_blank" rel="noopener">TikTok</a>
    </div>
  </div>
</footer>
`;

function getMasterNav() { return MASTER_NAV_HTML; }
function getMasterFooter() { return MASTER_FOOTER_HTML; }

// Exact paths that already have their own nav/footer inlined and should
// NOT receive injection.
//
// HISTORY: '/' and '/index.html' USED to be here so the homepage kept its
// inline nav + footer. But some script on the homepage was removing the
// inline <footer> from the DOM at load time, leaving the page footerless.
// Solution: remove them from this set so middleware injects the master
// nav + master footer on the homepage too. The master nav is a faithful
// copy of the homepage's inline nav, so this is functionally identical
// for users but eliminates the footer-removal bug.
const PATHS_WITH_OWN_CHROME = new Set([
  // Empty for now - all paths get master injection unless matched by
  // SKIP_PATH_PREFIXES below.
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

// Strips the OLD inline nav (`<nav class="nav" id="mainNav">`) and the
// mobile drawer (`<div class="mobile-drawer" id="mobileDrawer">`) from
// pages where we're injecting the master. Without this, pillar pages
// stack two navs - the old inline one + the new master one.
//
// Same logic for the OLD footer (any `<footer>` not the master) - we
// remove it and let the injected master footer be the only one.
//
// IMPORTANT: identity checks use exact class strings, NOT regex \bword\b,
// because hyphens are word boundaries in JS regex. /\bnav\b/.test('mc-master-nav')
// returns TRUE because the regex matches the trailing "nav" segment after
// the hyphen. So we use a token-aware containsClass helper that splits on
// whitespace and checks for exact membership.
function hasClass(el, name) {
  const cls = el.getAttribute('class') || '';
  return cls.split(/\s+/).indexOf(name) >= 0;
}

class OldNavRemover {
  element(el) {
    const id = el.getAttribute('id') || '';
    // Skip the master nav explicitly
    if (id === 'mcMasterNav' || hasClass(el, 'mc-master-nav')) return;
    // Remove the legacy homepage-style inline nav
    if (id === 'mainNav' || hasClass(el, 'nav')) {
      el.remove();
    }
  }
}
class OldDrawerRemover {
  element(el) {
    const id = el.getAttribute('id') || '';
    // Skip the master drawer
    if (id === 'mcMasterDrawer' || hasClass(el, 'mc-master-nav-drawer')) return;
    if (id === 'mobileDrawer' || hasClass(el, 'mobile-drawer')) {
      el.remove();
    }
  }
}
class OldFooterRemover {
  element(el) {
    const id = el.getAttribute('id') || '';
    // Skip the master footer
    if (id === 'mcMasterFooter' || hasClass(el, 'mc-master-footer')) return;
    el.remove();
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
  if (!ct.includes('text/html')) return response;

  const message = (env.MAINTENANCE_MESSAGE || '').trim();
  const injectChrome = shouldInjectChrome(url);
  if (!message && !injectChrome) return response;

  const rewriter = new HTMLRewriter();

  if (injectChrome) {
    const navHtml = getMasterNav();
    const footHtml = getMasterFooter();

    // Strip the page's OLD inline nav/drawer/footer so we don't render
    // doubled chrome. HTMLRewriter handlers fire in DOM order during the
    // same streaming pass - el.remove() runs before el.prepend()/append()
    // on <body>, so the removed elements are gone by the time the master
    // ones get appended/prepended.
    rewriter.on('nav', new OldNavRemover());
    rewriter.on('div', new OldDrawerRemover());
    rewriter.on('footer', new OldFooterRemover());

    if (navHtml) rewriter.on('body', new NavInjector(navHtml));
    if (footHtml) rewriter.on('body', new FooterInjector(footHtml));
  }

  if (message) {
    rewriter.on('head', new HeadInjector(BANNER_CSS));
    rewriter.on('body', new BannerInjector(message));
  }

  const transformed = rewriter.transform(response);

  // Cache-Control override: HTML pages used to ship with max-age=3600
  // (1 hour browser cache), which meant nav/footer changes wouldn't
  // appear in returning visitors' browsers for up to an hour. For pages
  // we inject the master chrome into, shorten the browser TTL so nav
  // updates propagate fast, while keeping a longer edge TTL so CF still
  // caches at the edge.
  //   max-age=60       browser caches for 60 sec
  //   s-maxage=300     CF edge caches for 5 min
  //   must-revalidate  stale content forces a fresh check
  if (injectChrome) {
    const out = new Response(transformed.body, transformed);
    out.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, must-revalidate');
    return out;
  }
  return transformed;
}
