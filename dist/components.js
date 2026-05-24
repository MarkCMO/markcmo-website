/**
 * MarkCMO Global Components
 * Injects the canonical nav and footer into every page.
 * Edit /components/nav.html or /components/footer.html to update every page at once.
 */
(function () {
  'use strict';

  /* ── helpers ─────────────────────────────────────────────── */
  function get(url, cb) {
    var x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.onload = function () { if (x.status >= 200 && x.status < 400) cb(x.responseText); };
    x.onerror = function () { console.warn('MarkCMO components: could not load ' + url); };
    x.send();
  }

  /* ── nav init (scroll + hamburger + accordions) ──────────── */
  function initNav() {
    var nav = document.getElementById('mainNav');
    /* Prevent double-init (e.g. homepage has its own inline nav script) */
    if (nav && nav.dataset.cmpInit) return;
    if (nav) nav.dataset.cmpInit = '1';

    var ham = document.getElementById('navHam');
    var drawer = document.getElementById('mobileDrawer');
    var closeBtn = document.getElementById('drawerClose');

    /* scroll shrink */
    if (nav) {
      window.addEventListener('scroll', function () {
        nav.classList.toggle('scrolled', window.scrollY > 20);
      });
    }

    /* hamburger */
    function openDrawer() { if (drawer) { drawer.classList.add('open'); document.body.style.overflow = 'hidden'; } }
    function closeDrawer() { if (drawer) { drawer.classList.remove('open'); document.body.style.overflow = ''; } }
    if (ham) ham.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (drawer) {
      drawer.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeDrawer); });
    }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

    /* .sp-faq-item accordion (main site pages) */
    document.querySelectorAll('.sp-faq-q').forEach(function (q) {
      q.style.cursor = 'pointer';
      q.addEventListener('click', function () {
        var item = q.closest('.sp-faq-item');
        if (item) item.classList.toggle('open');
      });
    });

    /* .sh-faq accordion (city / state / county pages) */
    document.querySelectorAll('.sh-faq').forEach(function (faq) {
      var h3 = faq.querySelector('h3');
      var p = faq.querySelector('p');
      if (!h3 || !p) return;
      if (!faq.querySelector('.sh-faq-icon')) {
        var icon = document.createElement('span');
        icon.className = 'sh-faq-icon';
        icon.textContent = '+';
        icon.style.cssText = 'float:right;font-size:1.25rem;color:var(--ca,#1a56db);line-height:1;transition:transform .2s;';
        h3.style.cursor = 'pointer';
        h3.insertBefore(icon, h3.firstChild);
      }
      faq.addEventListener('click', function () {
        var isOpen = faq.classList.toggle('sh-faq-open');
        var ic = faq.querySelector('.sh-faq-icon');
        if (ic) ic.style.transform = isOpen ? 'rotate(45deg)' : '';
      });
    });
  }

  /* ── nav injection ───────────────────────────────────────── */
  function injectNav(html) {
    /* If canonical nav already present (id="mainNav"), just wire interactions */
    if (document.getElementById('mainNav')) {
      initNav();
      return;
    }

    /* Remove site-navigation navs but preserve semantic breadcrumb navs.
       Breadcrumb navs are identified by aria-label="Breadcrumb", class="breadcrumb",
       or being nested inside a known breadcrumb container. */
    document.querySelectorAll('nav').forEach(function (n) {
      var ariaLabel = (n.getAttribute('aria-label') || '').toLowerCase();
      var isBreadcrumb = ariaLabel === 'breadcrumb' ||
                         n.classList.contains('breadcrumb') ||
                         !!n.closest('.sh-breadcrumb, .hub-breadcrumb, .breadcrumb-wrap');
      if (!isBreadcrumb) n.remove();
    });

    /* Clean up both camelCase and hyphenated drawer IDs used by older state pages */
    var oldDrawer = document.getElementById('mobileDrawer') || document.getElementById('mobile-drawer');
    if (oldDrawer) oldDrawer.remove();

    /* Insert canonical nav at the very top of body */
    document.body.insertAdjacentHTML('afterbegin', html);
    initNav();
  }

  /* ── footer injection ────────────────────────────────────── */
  function injectFooter(html) {
    /* Always replace any existing footer with the canonical footer.
       This ensures consistent layout across city, state, service, and
       blog pages — eliminates footer-mega column-overflow and sparse-
       grid issues on older page templates. */
    var existing = document.querySelector('footer');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  }

  /* ── animated favicon ───────────────────────────────────── */
  function initFavicon() {
    /* Remove any existing ico/webp/png favicon links (they block the SVG) */
    document.querySelectorAll("link[rel*='icon']").forEach(function (el) {
      if (el.getAttribute('rel') !== 'apple-touch-icon') el.remove();
    });
    /* Inject the animated SVG favicon — Chrome/Firefox/Edge animate it natively */
    var link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = '/favicon.svg';
    document.head.appendChild(link);
  }

  /* ── run on DOM ready ────────────────────────────────────── */
  function run() {
    get('/components/nav.html', injectNav);
    get('/components/footer.html', injectFooter);
    initFavicon();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
