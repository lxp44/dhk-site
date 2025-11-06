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

  // ---------- Identity helpers ----------
  const idw = () => (typeof netlifyIdentity !== 'undefined' ? netlifyIdentity : null);
  const currentUser = () => (idw() ? idw().currentUser() : null);

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

  // ---------- Saved avatar helpers ----------
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

  // ---------- UI helpers ----------
  const show = (el) => { if (el) el.style.display = 'flex'; };
  const hide = (el) => { if (el) el.style.display = 'none'; };

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
      window.dispatchEvent(new CustomEvent('dhk:avatar-selected', { detail: { url } }));
      hide(modalEl);
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

    // Subscribe once the iframe is ready
    rpmFrame.onload = () => {
      try {
        rpmFrame.contentWindow.postMessage({ target: 'readyplayer.me', type: 'subscribe', eventName: 'v1.avatar.exported' }, '*');
      } catch {}
    };
  }

  // Global RPM listener → dispatch selected & close
  window.addEventListener('message', async (e) => {
    let data = e.data;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch {} }
    if (!data || data.source !== 'readyplayer.me') return;

    if (data.eventName === 'v1.avatar.exported' && data.data?.url) {
      const url = data.data.url;
      try { await saveAvatarUrlToIdentity(url); } catch {}
      try { localStorage.setItem('dhk_avatar_url', url); } catch {}
      window.dispatchEvent(new CustomEvent('dhk:avatar-selected', { detail: { url } }));
      document.body.classList.remove('rpm-open','modal-open');
      hide(modalEl);
    }
  });

  // Manual URL save
  async function saveManualUrl() {
    const val = (urlInput?.value || '').trim();
    if (!val) return alert('Paste a valid URL.');
    const final = await saveAvatarUrlToIdentity(val);
    try { localStorage.setItem('dhk_avatar_url', final); } catch {}
    window.dispatchEvent(new CustomEvent('dhk:avatar-selected', { detail: { url: final } }));
    hide(modalEl);
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

    // Prefer saved URL (identity or local mirror)
    const saved = getSavedAvatarUrl();
    if (saved) {
      try { localStorage.setItem('dhk_avatar_url', saved); } catch {}
      return saved;
    }

    // No saved → show chooser
    show(modalEl);
    mountUseSavedButton();
    btnCreate?.addEventListener('click', openRPM, { once: true });
    btnLoad  ?.addEventListener('click', () => {
      const url = getSavedAvatarUrl();
      if (url) {
        window.dispatchEvent(new CustomEvent('dhk:avatar-selected', { detail: { url } }));
        hide(modalEl);
      } else {
        if (urlWrap) urlWrap.style.display = 'block';
        if (rpmWrap) rpmWrap.style.display = 'none';
      }
    }, { once: true });
    urlSave  ?.addEventListener('click', saveManualUrl);
    urlCancel?.addEventListener('click', () => hide(modalEl));

    // Resolve when avatar is chosen anywhere
    return await new Promise((resolve) => {
      const onSel = (e) => {
        const url = e.detail?.url;
        if (url) {
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