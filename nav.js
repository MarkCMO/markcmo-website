// Nav hamburger toggle for dark-theme pages (MAGNET Framework, etc.)
(function () {
  var ham = document.getElementById('navHam');
  var drawer = document.getElementById('mobileDrawer');
  var close = document.getElementById('drawerClose');
  if (!ham || !drawer) return;

  function openDrawer() {
    drawer.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    document.body.style.overflow = '';
  }

  ham.addEventListener('click', openDrawer);
  if (close) close.addEventListener('click', closeDrawer);

  // Close when clicking outside
  document.addEventListener('click', function (e) {
    if (drawer.classList.contains('open') && !drawer.contains(e.target) && e.target !== ham) {
      closeDrawer();
    }
  });
})();
