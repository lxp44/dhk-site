// js/try-on-auth.js
(() => {
  const g = document.getElementById('auth-gate');
  const btnSignin = document.getElementById('gate-signin');
  const modal = document.getElementById('avatar-modal');
  const btnCreate = document.getElementById('avatar-create');
  const btnLoad   = document.getElementById('avatar-load');
  const rpmWrap   = document.getElementById('rpm-wrap');
  const rpmFrame  = document.getElementById('rpm-iframe');
  const urlWrap   = document.getElementById('url-wrap');
  const urlInput  = document.getElementById('avatar-url-input');
  const urlSave   = document.getElementById('avatar-url-save');
  const urlCancel = document.getElementById('avatar-cancel');

  // ---- Identity helpers (robust on mobile) ----
  function idWidget() {
    return (typeof netlifyIdentity !== 'undefined') ? netlifyIdentity : null;
  }
  function currentUser() {
    const w = idWidget();
    return w ? w.currentUser() : null;
  }

  function identityReady(timeoutMs = 7000) {
    return new Promise((resolve, reject) => {
      const w = idWidget();
      if (!w) return reject(new Error('Netlify Identity not loaded'));

      let settled = false;
      const done = (user) => { if (!settled) { settled = true; resolve(user || w.currentUser()); } };

      // Ensure init is called (safe to repeat)
      try { w.init(); } catch {}

      // Fires once when identity bootstraps (incl. mobile Safari)
      w.on('init', done);

      // Safety: if init never fires (rare), poll for a bit
      const started = Date.now();
      const poll = setInterval(() => {
        if (w.currentUser()) { clearInterval(poll); done(w.currentUser()); }
        else if (Date.now() - started > timeoutMs) { clearInterval(poll); done(null); }
      }, 250);
    });
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
    w.setUser(updated);
    // local mirror (cross-device fallback)
    localStorage.setItem('dhk_avatar_url', updated.user_metadata?.avatarUrl || url);
    return updated;
  }

  function showGate()  { if (g) g.style.display = 'flex'; }
  function hideGate()  { if (g) g.style.display = 'none'; }
  function showModal() { if (modal) modal.style.display = 'flex'; }
  function hideModal() {
    if (modal) modal.style.display = 'none';
    if (rpmWrap) rpmWrap.style.display = 'none';
    if (urlWrap) urlWrap.style.display = 'none';
  }

  // ---- Ready Player Me flow (create) ----
  function subscribeRPMExportOnce(frameWin) {
    try {
      frameWin.postMessage({ target: 'readyplayerme', type: 'subscribe', eventName: 'v1.avatar.exported' }, '*');
    } catch {}
  }

  function openRPM() {
    const url = 'https://demo.readyplayer.me/avatar?frameApi';
    if (rpmFrame) rpmFrame.src = url;
    if (rpmWrap) rpmWrap.style.display = 'block';
    if (urlWrap) urlWrap.style.display = 'none';

    // One-time listener per open
    const onMsg = async (e) => {
      let data = e.data;
      if (typeof data === "string") { try { data = JSON.parse(data); } catch {} }
      if (!data || data.source !== 'readyplayer.me') return;

      if (data.eventName === 'v1.avatar.exported' && data.data?.url) {
        window.removeEventListener('message', onMsg);
        const finalUrl = data.data.url;
        try {
          await saveAvatarUrlToIdentity(finalUrl);
          // Tell world scene to load it
          window.dispatchEvent(new CustomEvent("dhk:avatar:selected", { detail: { url: finalUrl } }));
          document.body.classList.remove("rpm-open","modal-open");
          hideModal();
        } catch (err) {
          console.error(err);
          alert('Could not save avatar.');
        }
      }
    };
    window.addEventListener('message', onMsg);

    if (rpmFrame) {
      rpmFrame.onload = () => {
        subscribeRPMExportOnce(rpmFrame.contentWindow);
      };
    }
  }

  // Chip shortcut in topbar
  document.addEventListener('DOMContentLoaded', () => {
    const chip = document.querySelector('.chip');
    chip?.addEventListener('click', () => {
      if (window.netlifyIdentity) netlifyIdentity.open('login');
    });
  });

  // ---- Manual URL fallback ----
  async function saveManualUrl() {
    const val = (urlInput?.value || '').trim();
    if (!val) return alert('Paste a valid URL.');
    await saveAvatarUrlToIdentity(val);
    window.dispatchEvent(new CustomEvent("dhk:avatar:selected", { detail: { url: val } }));
    hideModal();
  }

  // ---- Load Saved button behavior ----
  async function tryLoadSaved() {
    const w = idWidget();
    const user = currentUser();
    const stored = user?.user_metadata?.avatarUrl || localStorage.getItem('dhk_avatar_url') || '';

    if (stored) {
      // Immediately use saved
      window.dispatchEvent(new CustomEvent("dhk:avatar:selected", { detail: { url: stored } }));
      hideModal();
      return;
    }
    // No saved — show URL input as fallback
    if (urlWrap) urlWrap.style.display = 'block';
    if (rpmWrap) rpmWrap.style.display = 'none';
  }

  // ---- Public gate: wait for sign-in + avatar ----
  async function requireAuthAndAvatar() {
    const w = idWidget();
    if (!w) throw new Error('Netlify Identity not loaded');

    // Wait until Identity is initialized (mobile-safe)
    await identityReady();

    // 1) Ensure login
    let user = currentUser();
    if (!user) {
      showGate();

      // Clicking "Sign In" opens the widget
      btnSignin?.addEventListener('click', () => w.open('login'), { once: true });

      // Resolve on login
      await new Promise((resolve) => {
        const done = () => { w.off('login', done); hideGate(); resolve(); };
        w.on('login', done);
      });
      user = currentUser();
    }
    hideGate();

    // 2) Ensure avatar (prefer Identity metadata, then localStorage)
    const stored = user?.user_metadata?.avatarUrl || localStorage.getItem('dhk_avatar_url') || '';
    if (stored) {
      localStorage.setItem('dhk_avatar_url', stored);
      return stored;
    }

    // No avatar → show chooser
    showModal();

    // Wire once
    btnCreate?.addEventListener('click', openRPM, { once: true });
    btnLoad  ?.addEventListener('click', () => { tryLoadSaved(); }, { once: true });
    urlSave  ?.addEventListener('click', saveManualUrl);
    urlCancel?.addEventListener('click', hideModal);

    // Resolve when avatar is ready (created or manual)
    const finalUrl = await new Promise((resolve) => {
      const onSelected = (e) => {
        const url = e.detail?.url;
        if (url) {
          localStorage.setItem('dhk_avatar_url', url);
          window.removeEventListener('dhk:avatar-selected', onSelected);
          resolve(url);
        }
      };
      window.addEventListener('dhk:avatar-selected', onSelected);
    });

    return finalUrl;
  }

  // Cross-tab sync (e.g., if avatar saved elsewhere)
  window.addEventListener('storage', (e) => {
    if (e.key === 'dhk_avatar_url' && e.newValue) {
      window.dispatchEvent(new CustomEvent('dhk:avatar-selected', { detail: { url: e.newValue } }));
    }
  });

  // Expose to window
  window.DHKAuth = { requireAuthAndAvatar };
})();