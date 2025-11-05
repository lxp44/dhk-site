(() => {
  // ------- DOM -------
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

  // ------- Identity helpers (robust on mobile) -------
  function idWidget() {
    return (typeof netlifyIdentity !== 'undefined') ? netlifyIdentity : null;
  }
  function currentUser() {
    const w = idWidget();
    return w ? w.currentUser() : null;
  }
  function getSavedAvatarUrl() {
    const user = currentUser();
    return user?.user_metadata?.avatarUrl || localStorage.getItem('dhk_avatar_url') || '';
  }
  function identityReady(timeoutMs = 7000) {
    return new Promise((resolve) => {
      const w = idWidget();
      if (!w) return resolve(null);
      let settled = false;
      const done = () => { if (!settled) { settled = true; resolve(w.currentUser()); } };

      try { w.init(); } catch {}
      w.on('init', done);

      const started = Date.now();
      const poll = setInterval(() => {
        if (w.currentUser()) { clearInterval(poll); done(); }
        else if (Date.now() - started > timeoutMs) { clearInterval(poll); done(); }
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
    try { localStorage.setItem('dhk_avatar_url', updated.user_metadata?.avatarUrl || url); } catch {}
    return updated;
  }

  function showGate()  { if (g) g.style.display = 'flex'; }
  function hideGate()  { if (g) g.style.display = 'none'; }
  function showModal() { if (modal) modal.style.display = 'flex'; }
  function hideModal() {
    if (modal)   modal.style.display = 'none';
    if (rpmWrap) rpmWrap.style.display = 'none';
    if (urlWrap) urlWrap.style.display = 'none';
  }

  // ------- Ready Player Me flow -------
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

    const onMsg = async (e) => {
      let data = e.data;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch {} }
      if (!data || data.source !== 'readyplayer.me') return;

      if (data.eventName === 'v1.avatar.exported' && data.data?.url) {
        window.removeEventListener('message', onMsg);
        const finalUrl = data.data.url;
        try {
          await saveAvatarUrlToIdentity(finalUrl);
          window.dispatchEvent(new CustomEvent('dhk:avatar-selected', { detail: { url: finalUrl } }));
          document.body.classList.remove('rpm-open','modal-open');
          hideModal();
        } catch (err) {
          console.error(err);
          alert('Could not save avatar.');
        }
      }
    };
    window.addEventListener('message', onMsg);

    if (rpmFrame) {
      rpmFrame.onload = () => subscribeRPMExportOnce(rpmFrame.contentWindow);
    }
  }

  // ------- “Use my saved avatar” pill -------
  function mountUseSavedButton() {
    if (!modal || document.getElementById('avatar-use-saved')) return;

    const headerHost =
      document.querySelector('#avatar-modal .chooser-tabs') ||
      document.querySelector('#avatar-modal .modal-header') ||
      modal;

    const btn = document.createElement('button');
    btn.id = 'avatar-use-saved';
    btn.type = 'button';
    btn.textContent = 'Use my saved avatar';
    btn.className = 'chip-saved-avatar';
    btn.style.display = getSavedAvatarUrl() ? 'inline-flex' : 'none';

    btn.addEventListener('click', () => {
      const url = getSavedAvatarUrl();
      if (!url) { alert('No saved avatar yet.'); return; }
      window.dispatchEvent(new CustomEvent('dhk:avatar-selected', { detail: { url } }));
      hideModal();
    });

    headerHost.appendChild(btn);

    // reflect future changes (e.g., export finishes)
    window.addEventListener('storage', (e) => {
      if (e.key === 'dhk_avatar_url') {
        btn.style.display = e.newValue ? 'inline-flex' : 'none';
      }
    });
  }

  // ------- Manual URL path -------
  async function saveManualUrl() {
    const val = (urlInput?.value || '').trim();
    if (!val) return alert('Paste a valid URL.');
    try {
      await saveAvatarUrlToIdentity(val);
      localStorage.setItem('dhk_avatar_url', val);
    } catch {}
    window.dispatchEvent(new CustomEvent('dhk:avatar-selected', { detail: { url: val } }));
    hideModal();
  }

  // ------- Load Saved button -------
  function tryLoadSaved() {
    const stored = getSavedAvatarUrl();
    if (stored) {
      window.dispatchEvent(new CustomEvent('dhk:avatar-selected', { detail: { url: stored } }));
      hideModal();
    } else {
      if (urlWrap) urlWrap.style.display = 'block';
      if (rpmWrap) rpmWrap.style.display = 'none';
    }
  }

  // ------- Public gate: ensure sign-in + avatar, return URL -------
  async function requireAuthAndAvatar() {
    const w = idWidget();
    if (!w) throw new Error('Netlify Identity not loaded');

    await identityReady();

    // 1) Ensure login
    let user = currentUser();
    if (!user) {
      showGate();
      btnSignin?.addEventListener('click', () => w.open('login'), { once: true });
      await new Promise((resolve) => {
        const done = () => { w.off('login', done); hideGate(); resolve(); };
        w.on('login', done);
      });
      user = currentUser();
    }
    hideGate();

    // 2) Prefer saved (Identity metadata, then local mirror)
    const stored = getSavedAvatarUrl();
    if (stored) {
      try { localStorage.setItem('dhk_avatar_url', stored); } catch {}
      return stored;
    }

    // 3) No avatar yet — show chooser
    showModal();
    mountUseSavedButton();
    btnCreate?.addEventListener('click', openRPM, { once: true });
    btnLoad  ?.addEventListener('click', tryLoadSaved, { once: true });
    urlSave  ?.addEventListener('click', saveManualUrl);
    urlCancel?.addEventListener('click', hideModal);

    // Resolve when the app broadcasts a selection
    const finalUrl = await new Promise((resolve) => {
      const onSelected = (e) => {
        const url = e.detail?.url;
        if (url) {
          try { localStorage.setItem('dhk_avatar_url', url); } catch {}
          window.removeEventListener('dhk:avatar-selected', onSelected);
          resolve(url);
        }
      };
      window.addEventListener('dhk:avatar-selected', onSelected);
    });

    return finalUrl;
  }

  // Cross-tab sync (if avatar saved elsewhere)
  window.addEventListener('storage', (e) => {
    if (e.key === 'dhk_avatar_url' && e.newValue) {
      window.dispatchEvent(new CustomEvent('dhk:avatar-selected', { detail: { url: e.newValue } }));
    }
  });

  // Topbar chip shortcut (optional)
  document.addEventListener('DOMContentLoaded', () => {
    const chip = document.querySelector('.chip');
    chip?.addEventListener('click', () => { if (window.netlifyIdentity) netlifyIdentity.open('login'); });
    if (document.getElementById('avatar-modal')) setTimeout(mountUseSavedButton, 0);
  });

  // Expose API
  window.DHKAuth = { requireAuthAndAvatar };
})();