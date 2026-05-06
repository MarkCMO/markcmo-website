/**
 * nav.js — loaded by city / state / county pages.
 * Delegates all nav+footer injection to components.js.
 * Also handles scroll-progress bar on these pages.
 */
(function () {
  /* Load components.js if not already loaded */
  if (!window.__markCmoComponents) {
    window.__markCmoComponents = true;
    var s = document.createElement('script');
    s.src = '/components.js';
    document.head.appendChild(s);
  }

  /* Scroll progress bar (city / county pages only) */
  window.addEventListener('scroll', function () {
    var sp = document.getElementById('sp');
    if (!sp) return;
    var h = document.documentElement;
    sp.style.width = ((h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100) + '%';
  });
})();
