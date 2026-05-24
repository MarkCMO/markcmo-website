;(function () {
  'use strict';

  function injectComponent(placeholderId, url) {
    var el = document.getElementById(placeholderId);
    if (!el) return;
    fetch(url)
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        var node = tmp.firstElementChild;
        if (node) el.parentNode.replaceChild(node, el);
      })
      .catch(function (e) { console.warn('Component load failed:', url, e); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      injectComponent('nav-placeholder', '/nav.html');
      injectComponent('footer-placeholder', '/footer.html');
    });
  } else {
    injectComponent('nav-placeholder', '/nav.html');
    injectComponent('footer-placeholder', '/footer.html');
  }
})();
