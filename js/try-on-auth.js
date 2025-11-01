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

  // ---- Helpers ----
  function idWidget() {
    return (typeof netlifyIdentity !== 'undefined') ? netlifyIdentity : null;
  }
  function currentUser() {
    const w = idWidget();
    return w ? w.currentUser() : null;
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
      body: JSON.stringify({
        user_metadata: { avatarUrl: url }
      })
    });
    if (!res.ok) throw new Error('Failed to save avatar');
    const updated = await res.json();
    // Update the local identity instance with new user data
    w.setUser(updated);
    return updated;
  }

  function showGate()  { if (g) g.style.display = 'flex'; }
  function hideGate()  { if (g) g.style.display = 'none'; }
  function showModal() { if (modal) modal.style.display = 'flex'; }
  function hideModal() { if (modal) modal.style.display = 'none'; rpmWrap.style.display='none'; urlWrap.style.display='none'; }

  // ---- Ready Player Me flow (create) ----
  function openRPM() {
    // Use the hosted RPM Studio; request GLB export
    const url = 'https://demo.readyplayer.me/avatar?frameApi';
    rpmFrame.src = url;
    rpmWrap.style.display = 'block';
    urlWrap.style.display = 'none';

    // Listen for avatar exported message
    window.addEventListener('message', async function onMsg(e) {
      const data = e.data;
      if (!data) return;
      // RPM posts messages with "v1.avatar.exported"
      if (typeof data === 'object' && data.source === 'readyplayerme' && data.eventName === 'v1.avatar.exported') {
        window.removeEventListener('message', onMsg);
        const glbUrl = data.data?.url; // exported GLB
        if (!glbUrl) return alert('No avatar URL returned.');
        try {
          await saveAvatarUrlToIdentity(glbUrl);
          hideModal();
          document.dispatchEvent(new CustomEvent('dhk:avatar-ready', { detail: { avatarUrl: glbUrl } }));
        } catch (err) {
          console.error(err);
          alert('Could not save avatar.');
        }
      }
    });
    // Tell iframe we’re ready (per RPM frame API)
    rpmFrame.onload = () => {
      rpmFrame.contentWindow.postMessage({ target: 'readyplayerme', type: 'subscribe', eventName: 'v1.avatar.exported' }, '*');
    };
  }
  
document.addEventListener('DOMContentLoaded', () => {
  const chip = document.querySelector('.chip'); // the TRY ON chip in topbar
  chip?.addEventListener('click', () => {
    if (window.netlifyIdentity) netlifyIdentity.open('login');
  });
});
  // ---- Load existing (URL prompt fallback) ----
  async function saveManualUrl() {
    const val = (urlInput.value || '').trim();
    if (!val) return alert('Paste a valid URL.');
    await saveAvatarUrlToIdentity(val);
    hideModal();
    document.dispatchEvent(new CustomEvent('dhk:avatar-ready', { detail: { avatarUrl: val } }));
  }

  // ---- Public gate: wait for sign-in + avatar ----
  async function requireAuthAndAvatar() {
    // 1) Ensure identity is ready
    const w = idWidget();
    if (!w) throw new Error('Netlify Identity not loaded');

    // Open gate if needed
    let user = currentUser();
    if (!user) {
      showGate();
      await new Promise((resolve) => {
        const done = () => { hideGate(); resolve(); };
        w.on('login', done);
        btnSignin?.addEventListener('click', () => w.open(), { once: true });
      });
      user = currentUser();
    } else {
      hideGate();
    }

    // 2) Ensure avatar
    // Prefer identity user_metadata, fallback to localStorage
    const stored = user?.user_metadata?.avatarUrl || localStorage.getItem('dhk_avatar_url') || '';
    if (stored) {
      // keep local mirror up to date
      localStorage.setItem('dhk_avatar_url', stored);
      return stored;
    }

    // no avatar -> show chooser
    showModal();

    // wire buttons
    btnCreate?.addEventListener('click', openRPM);
    btnLoad?.addEventListener('click', () => { urlWrap.style.display = 'block'; rpmWrap.style.display = 'none'; });
    urlSave?.addEventListener('click', saveManualUrl);
    urlCancel?.addEventListener('click', hideModal);

    // resolve when avatar is ready
    const avatarUrl = await new Promise((resolve) => {
      const onReady = (e) => {
        document.removeEventListener('dhk:avatar-ready', onReady);
        const url = e.detail?.avatarUrl;
        if (url) localStorage.setItem('dhk_avatar_url', url);
        resolve(url);
      };
      document.addEventListener('dhk:avatar-ready', onReady);
    });

    return avatarUrl;
  }

  // Expose to window
  window.DHKAuth = { requireAuthAndAvatar };
})();