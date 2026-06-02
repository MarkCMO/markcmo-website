/* ════════════════════════════════════════════════════════════
   Cirilo Design + Build - Motion Engine
   Scroll-choreographed reveals, parallax, count-up, nav state,
   magnetic hovers, marquee. Auto-targets common elements so every
   page gets motion without per-page wiring. Respects reduced-motion.
   ════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── 1. SCROLL REVEAL (auto-target + stagger) ──────────────────
  function initReveal() {
    if (reduce) { document.querySelectorAll('[data-reveal]').forEach(function(el){ el.classList.add('is-in'); }); return; }

    // Auto-tag common content blocks if not already tagged
    var autoSel = [
      'main section .container > *',
      'main section .container-narrow > *',
      '.card', '.gallery-item', '.tl-item', '.faq-item',
      '.why-card', '.service-card', '.contact-card'
    ];
    autoSel.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        if (!el.hasAttribute('data-reveal') && !el.closest('.site-header') && !el.closest('.site-footer')) {
          el.setAttribute('data-reveal', '');
        }
      });
    });

    // Stagger siblings inside a grid/list
    document.querySelectorAll('.grid, .gallery, .timeline').forEach(function (group) {
      var kids = group.querySelectorAll('[data-reveal]');
      kids.forEach(function (el, i) { el.style.setProperty('--reveal-delay', (i % 6) * 70 + 'ms'); });
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    document.querySelectorAll('[data-reveal]').forEach(function (el) { io.observe(el); });
  }

  // ── 2. PARALLAX (data-parallax="0.2") ─────────────────────────
  function initParallax() {
    if (reduce) return;
    var items = [].slice.call(document.querySelectorAll('[data-parallax]'));
    if (!items.length) return;
    var ticking = false;
    function update() {
      var vh = window.innerHeight;
      items.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var speed = parseFloat(el.getAttribute('data-parallax')) || 0.15;
        var offset = (r.top + r.height / 2 - vh / 2) * -speed;
        el.style.transform = 'translate3d(0,' + offset.toFixed(1) + 'px,0)';
      });
      ticking = false;
    }
    window.addEventListener('scroll', function () { if (!ticking) { requestAnimationFrame(update); ticking = true; } }, { passive: true });
    update();
  }

  // ── 3. COUNT-UP (data-count="500") ────────────────────────────
  function initCount() {
    var nums = document.querySelectorAll('[data-count]');
    if (!nums.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target, target = parseFloat(el.getAttribute('data-count')), suffix = el.getAttribute('data-suffix') || '';
        if (reduce) { el.textContent = target + suffix; io.unobserve(el); return; }
        var start = null, dur = 1400;
        function step(ts) {
          if (!start) start = ts;
          var p = Math.min((ts - start) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.floor(eased * target) + suffix;
          if (p < 1) requestAnimationFrame(step); else el.textContent = target + suffix;
        }
        requestAnimationFrame(step);
        io.unobserve(el);
      });
    }, { threshold: 0.5 });
    nums.forEach(function (n) { io.observe(n); });
  }

  // ── 4. NAV SCROLL STATE (shrink + solidify) ───────────────────
  function initNav() {
    var nav = document.querySelector('.site-header');
    if (!nav) return;
    var last = 0;
    function onScroll() {
      var y = window.pageYOffset;
      nav.classList.toggle('is-scrolled', y > 24);
      // hide on scroll-down, show on scroll-up (past hero)
      if (!reduce && y > 400) {
        nav.classList.toggle('is-hidden', y > last && y - last > 4);
      } else {
        nav.classList.remove('is-hidden');
      }
      last = y;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ── 5. MAGNETIC LIFT on cards/buttons ─────────────────────────
  function initMagnetic() {
    if (reduce || window.matchMedia('(hover: none)').matches) return;
    document.querySelectorAll('.btn-primary, [data-magnetic]').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var mx = (e.clientX - r.left - r.width / 2) / r.width;
        var my = (e.clientY - r.top - r.height / 2) / r.height;
        el.style.transform = 'translate(' + (mx * 6).toFixed(1) + 'px,' + (my * 6).toFixed(1) + 'px)';
      });
      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });
  }

  // ── 6. SMOOTH ANCHOR SCROLL ───────────────────────────────────
  function initAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (id.length < 2) return;
        var t = document.querySelector(id);
        if (t) { e.preventDefault(); t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }
      });
    });
  }

  function boot() {
    initReveal(); initParallax(); initCount(); initNav(); initMagnetic(); initAnchors();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
