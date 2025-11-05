// js/try-on-auth.js
(() => {
  const g         = document.getElementById('auth-gate');
  const btnSignin = document.getElementById('gate-signin');
  const modal     = document.getElementById('avatar-modal');
  const btnCreate = document.getElementById('avatar-create');
  const btnLoad   = document.getElementById('avatar-load');
  const rpmWrap   = document.getElementById('rpm-wrap');
  const rpmFrame  = document.getElementById('rpm-iframe');
  const urlWrap   = document.getElementById('url-wrap');
  const urlInput  = document.getElementById('avatar-url-input');
  const urlSave   = document.getElementById('avatar-url-save');
  const urlCancel = document.getElementById('avatar-cancel');

  // ---------- Identity helpers (mobile-safe) ----------
  function idWidget() {
    return (typeof netlifyIdentity !== 'undefined') ? netlifyIdentity : null;
  }
  function currentUser() {
    const w = idWidget();
    return w ? w.currentUser() : null;
  }

  // Wait for the widget to be ready and return a user if already logged in.
  function waitIdentityReady({ timeout = 8000 } = {}) {
    return new Promise((resolve) => {
      const w = idWidget();
      if (!w) return resolve(null);

      let done = false;
      const finish = (u) => { if (!done) { done = true; resolve(u || null); } };

      // 1) init fires on all loads; may contain user
      const onInit = (u) => finish(u || w.currentUser());
      w.on('init', onInit);

      // 2) just in case init already ran
      const u0 = w.currentUser();
      if (u0) {
        // Make sure tokens/metadata are fresh (Safari sometimes stale)
        w.refresh().then(() => finish(w.currentUser())).catch(() => finish(u0));
      }

      // 3) hard timeout + poll fallback for flaky Safari
      const started = Date.now();
      const poll = setInterval(async () => {
        const u = w.currentUser();
        if (u || Date.now() - started > timeout) {
          clearInterval(poll);
          w.off && w.off('init', onInit);
          finish(u || null);
        }
      }, 200);

      // Ensure widget actually initializes
      try { w.init(); } catch {}
    });
  }

  async function ensureFreshUser() {
    const w = idWidget();
    if (!w) return null;
    try { await w.refresh(); } catch {}
    return w.currentUser();
  }

  async function saveAvatarUrlToIdentity(url) {
    const w = idWidget();
    const user = currentUser();
    if (!w || !user) throw new Error('No identity session');

    const token = await user.jwt();
    const res = await fetch('/.netlify/identity/user', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user_metadata: { avatarUrl: url } })
    });
    if (!res.ok) throw new Error('Failed to save avatar');
    const updated = await res.json();
    w.setUser(updated);               // keep local copy synced
    localStorage.setItem('dhk_avatar_url', updated?.user_metadata?.avatarUrl || url);
    return updated;
  }

  function showGate()  { if (g) g.style.display = 'flex'; }
  function hideGate()  { if (g) g.style.display = 'none'; }
  function showModal() { if (modal) modal.style.display = 'flex'; }
  function hideModal() { if (modal) modal.style.display = 'none'; if (rpmWrap) rpmWrap.style.display='none'; if (urlWrap) urlWrap.style.display='none'; }

  // ---------- RPM flow ----------
  function openRPM() {
    const url = 'https://demo.readyplayer.me/avatar?frameApi';
    if (rpmFrame) rpmFrame.src = url;
    if (rpmWrap)  rpmWrap.style.display = 'block';
    if (urlWrap)  urlWrap.style.display = 'none';

    // Subscribe on load
    if (rpmFrame) {
      rpmFrame.onload = () => {
        try {
          rpmFrame.contentWindow.postMessage(
            { target: 'readyplayerme', type: 'subscribe', eventName: 'v1.avatar.exported' },
            '*'
          );
        } catch {}
      };
    }
  }

  // Global RPM message bridge → select avatar + hide modal
  window.addEventListener('message', async (e) => {
    let data = e.data;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch {} }
    if (!data || data.source !== 'readyplayer.me') return;

    if (data.eventName === 'v1.avatar.exported' && data.data?.url) {
      const finalUrl = data.data.url;
      try { await saveAvatarUrlToIdentity(finalUrl); } catch {}
      window.dispatchEvent(new CustomEvent('dhk:avatar:selected', { detail: { url: finalUrl } }));
      document.body.classList.remove('rpm-open','modal-open');
      if (modal) { modal.classList.add('fade-out'); setTimeout(() => (modal.style.display = 'none'), 500); }
    }
  });

  // Topbar chip → open login (useful on mobile)
  document.addEventListener('DOMContentLoaded', () => {
    const chip = document.querySelector('.chip');
    chip?.addEventListener('click', () => { if (window.netlifyIdentity) netlifyIdentity.open('login'); });
  });

  async function saveManualUrl() {
    const val = (urlInput?.value || '').trim();
    if (!val) return alert('Paste a valid URL.');
    await saveAvatarUrlToIdentity(val);
    hideModal();
    window.dispatchEvent(new CustomEvent('dhk:avatar:selected', { detail: { url: val } }));
  }

  // ---------- Public API: wait for login + have an avatar URL ----------
  async function requireAuthAndAvatar() {
    const w = idWidget();
    if (!w) throw new Error('Netlify Identity not loaded');

    // 1) Ensure widget is fully initialized (fixes iOS race)
    let user = await waitIdentityReady();
    if (!user) {
      // Show gate + wire button
      showGate();
      await new Promise((resolve) => {
        const complete = async () => { hideGate(); await ensureFreshUser(); resolve(); };
        w.on('login', complete);
        btnSignin?.addEventListener('click', () => w.open('login'), { once: true });
      });
      user = await ensureFreshUser();
    } else {
      hideGate();
    }

    // 2) Try to read avatar (identity metadata first, fallback to localStorage)
    let stored = user?.user_metadata?.avatarUrl || localStorage.getItem('dhk_avatar_url') || '';

    if (stored) {
      localStorage.setItem('dhk_avatar_url', stored);
      return stored;
    }

    // 3) No avatar yet → show chooser and resolve when ready
    showModal();

    btnCreate?.addEventListener('click', openRPM);
    btnLoad?.addEventListener('click', () => { if (urlWrap) urlWrap.style.display = 'block'; if (rpmWrap) rpmWrap.style.display = 'none'; });
    urlSave?.addEventListener('click', saveManualUrl);
    urlCancel?.addEventListener('click', hideModal);

    const finalUrl = await new Promise((resolve) => {
      const onSelect = (e) => {
        window.removeEventListener('dhk:avatar-selected', onSelect);
        resolve(e.detail?.url || '');
      };
      window.addEventListener('dhk:avatar-selected', onSelect);
    });

    return finalUrl;
  }

  // Expose to window
  window.DHKAuth = { requireAuthAndAvatar };
})();