// js/nav.js
(function () {
  const drawer = document.getElementById('mobileDrawer');
  const openBtn = document.getElementById('menuOpen');
  const closeBtn = document.getElementById('menuClose');

  if (!drawer || !openBtn || !closeBtn) return;

  const focusableSel = 'a, button, [tabindex]:not([tabindex="-1"])';
  let lastFocused = null;

  function openDrawer() {
    lastFocused = document.activeElement;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    const first = drawer.querySelector(focusableSel);
    first && first.focus();
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    lastFocused && lastFocused.focus();
  }

  openBtn.addEventListener('click', openDrawer);
  closeBtn.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
  });

  drawer.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (a) closeDrawer();
  });
})();

