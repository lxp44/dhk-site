// js/try-on-auth.js
(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('auth-btn');
    if (!btn || !window.netlifyIdentity) return;

    const setLabel = () => {
      const u = netlifyIdentity.currentUser();
      btn.textContent = u ? `Hi, ${u.user_metadata?.full_name || u.email}` : 'Sign In';
    };

    netlifyIdentity.on('init', setLabel);
    netlifyIdentity.on('login', setLabel);
    netlifyIdentity.on('logout', setLabel);
    netlifyIdentity.on('error', (e) => console.error('Identity error:', e));
    netlifyIdentity.init();

    btn.addEventListener('click', () => {
      const u = netlifyIdentity.currentUser();
      if (u) netlifyIdentity.open('user'); else netlifyIdentity.open('login');
    });
  });
})();