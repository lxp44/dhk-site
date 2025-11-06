// js/try-on-auth.js
(() => {
  const gateEl    = document.getElementById('auth-gate');
  const gateBtn   = document.getElementById('gate-signin');
  const modalEl   = document.getElementById('avatar-modal');
  const btnCreate = document.getElementById('avatar-create');
  const btnLoad   = document.getElementById('avatar-load');
  const rpmWrap   = document.getElementById('rpm-wrap');
  const rpmFrame  = document.getElementById('rpm-iframe');
  const urlWrap   = document.getElementById('url-wrap');
  const urlInput  = document.getElementById('avatar-url-input');
  const urlSave   = document.getElementById('avatar-url-save');
  const urlCancel = document.getElementById('avatar-cancel');
  const worldBtn  = document.getElementById('world-load'); // NEW

  // ---------- Helpers ----------
  const idw = () => (typeof netlifyIdentity !== 'undefined' ? netlifyIdentity : null);
  const currentUser = () => (idw() ? idw().currentUser() : null);

  function enableWorldLoadButton() {
    if (!worldBtn) return;
    worldBtn.removeAttribute('disabled');
    worldBtn.classList.add('ready');
    if (!worldBtn.textContent || /loading/i.test(worldBtn.textContent)) {
      worldBtn.textContent = 'Load World';
    }
  }

  const show = (el, mode = 'flex') => { if (el) el.style.display = mode; };
  const hide = (el) => { if (el) el.style.display = 'none'; };

  function identityReady(timeoutMs = 7000) {
    return new Promise((resolve) => {
      const w = idw();
      if (!w) return resolve(null);
      try { w.init(); } catch {}
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(w.currentUser()); } };
      w.on('init', finish);
      const start = Date.now();
      const t = setInterval(() => {
        if (w.currentUser() || Date.now() - start > timeoutMs) {
          clearInterval(t); finish();
        }
      }, 200);
    });
  }

  // ---------- Saved avatar ----------
  function getSavedAvatarUrl() {
    const u = currentUser();
    return u?.user_metadata?.avatarUrl || localStorage.getItem('dhk_avatar_url') || '';
  }

  async function saveAvatarUrlToIdentity(url) {
    const w = idw(); const u = currentUser();
    if (!w || !u) throw new Error('No identity session');
    const token = await u.jwt();
    const res = await fetch('/.netlify/identity/user', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_metadata: { avatarUrl: url } })
    });
    const updated = await res.json();
    w.setUser(updated);
    try { localStorage.setItem('dhk_avatar_url', updated.user_metadata?.avatarUrl || url); } catch {}
    return updated.user_metadata?.avatarUrl || url;
  }

  function mountUseSavedButton() {
    if (!modalEl || document.getElementById('avatar-use-saved')) return;
    const host = document.querySelector('#avatar-modal .chooser-tabs') ||
                 document.querySelector('#avatar-modal .modal-header') || modalEl;
    const btn = document.createElement('button');
    btn.id = 'avatar-use-saved';
    btn.type = 'button';
    btn.textContent = 'Use my saved avatar';
    btn.className = 'chip-saved-avatar';
    btn.style.display = getSavedAvatarUrl() ? 'inline-flex' : 'none';

    btn.addEventListener('click', () => {
      const url = getSavedAvatarUrl();
      if (!url) return alert('No saved avatar yet.');
      // Announce selection but DO NOT close the modal; enable world button
      window.dispatchEvent(new CustomEvent('dhk:avatar-selected', { detail: { url } }));
      enableWorldLoadButton();
    });

    host.appendChild(btn);
    window.addEventListener('storage', (e) => {
      if (e.key === 'dhk_avatar_url') btn.style.display = e.newValue ? 'inline-flex' : 'none';
    });
  }

  // ---------- RPM flow ----------
  function openRPM() {
    if (rpmFrame) rpmFrame.src = 'https://demo.readyplayer.me/avatar?frameApi';
    if (rpmWrap) { rpmWrap.style.display = 'block'; }
    if (urlWrap) { urlWrap.style.display = 'none'; }

    rpmFrame.onload = () => {
      try {
        rpmFrame.contentWindow.postMessage(
          { target: 'readyplayer.me', type: 'subscribe', eventName: 'v1.avatar.exported' },
          '*'
        );
      } catch {}
    };
  }

  // Global RPM listener → dispatch selected (keep modal open; enable world)
  window.addEventListener('message', async (e) => {
    let data = e.data;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch {} }
    if (!data || data.source !== 'readyplayer.me') return;

    if (data.eventName === 'v1.avatar.exported' && data.data?.url) {
      const url = data.data.url;
      try { await saveAvatarUrlToIdentity(url); } catch {}
      try { localStorage.setItem('dhk_avatar_url', url); } catch {}
      window.dispatchEvent(new CustomEvent('dhk:avatar-selected', { detail: { url } }));

      // DO NOT close modal – user must press "Load World"
      enableWorldLoadButton();
    }
  });

  // Manual URL save (keep modal open)
  async function saveManualUrl() {
    const val = (urlInput?.value || '').trim();
    if (!val) return alert('Paste a valid URL.');
    const final = await saveAvatarUrlToIdentity(val);
    try { localStorage.setItem('dhk_avatar_url', final); } catch {}
    window.dispatchEvent(new CustomEvent('dhk:avatar-selected', { detail: { url: final } }));
    enableWorldLoadButton();
  }

  // ---------- Public gate ----------
  async function requireAuthAndAvatar() {
    await identityReady();

    // Ensure login
    let user = currentUser();
    if (!user) {
      show(gateEl);
      gateBtn?.addEventListener('click', () => idw()?.open('login'), { once: true });
      await new Promise((resolve) => {
        const done = () => { idw().off('login', done); hide(gateEl); resolve(); };
        idw().on('login', done);
      });
      user = currentUser();
      hide(gateEl);
    } else {
      hide(gateEl);
    }

    // Prefer saved URL
    const saved = getSavedAvatarUrl();
    if (saved) {
      // Always open the modal so the user can press "Load World"
      show(modalEl);
      mountUseSavedButton();
      enableWorldLoadButton();
      // Announce immediately (so scene knows the chosen avatar), but keep modal open
      window.dispatchEvent(new CustomEvent('dhk:avatar-selected', { detail: { url: saved } }));
      return saved;
    }

    // No saved → show chooser
    show(modalEl);
    mountUseSavedButton();

    btnCreate?.addEventListener('click', openRPM, { once: true });

    btnLoad?.addEventListener('click', () => {
      const url = getSavedAvatarUrl();
      if (url) {
        window.dispatchEvent(new CustomEvent('dhk:avatar-selected', { detail: { url } }));
        enableWorldLoadButton();
      } else {
        if (urlWrap) urlWrap.style.display = 'block';
        if (rpmWrap) rpmWrap.style.display = 'none';
      }
    }, { once: true });

    urlSave  ?.addEventListener('click', saveManualUrl);
    urlCancel?.addEventListener('click', () => hide(urlWrap));

    // Resolve when avatar is chosen, but keep the modal open so user can click "Load World"
    return await new Promise((resolve) => {
      const onSel = (e) => {
        const url = e.detail?.url;
        if (url) {
          enableWorldLoadButton();
          // Do NOT hide the modal here.
          window.removeEventListener('dhk:avatar-selected', onSel);
          resolve(url);
        }
      };
      window.addEventListener('dhk:avatar-selected', onSel);
    });
  }

  // Expose
  window.DHKAuth = { requireAuthAndAvatar };
})();