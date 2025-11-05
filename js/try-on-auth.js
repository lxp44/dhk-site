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
  function idWidget() { return (typeof netlifyIdentity !== 'undefined') ? netlifyIdentity : null; }
  function currentUser() { const w = idWidget(); return w ? w.currentUser() : null; }

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
    w.setUser(updated); // update local identity instance
    return updated;
  }

  function showGate()  { if (g) g.style.display = 'flex'; }
  function hideGate()  { if (g) g.style.display = 'none'; }
  function showModal() { if (modal) modal.style.display = 'flex'; }
  function hideModal() { if (modal) modal.style.display = 'none'; if (rpmWrap) rpmWrap.style.display='none'; if (urlWrap) urlWrap.style.display='none'; }

  // Centralize the “finalize avatar” flow
  async function finalizeAvatar(finalUrl) {
    if (!finalUrl) return;
    try {
      // persist to identity + localStorage
      try {
        await saveAvatarUrlToIdentity(finalUrl);
      } catch (e) {
        // if identity save fails (rare), at least cache locally
        console.warn("Identity save failed, caching locally:", e);
      }
      localStorage.setItem('dhk_avatar_url', finalUrl);
    } finally {
      // Fire both events for compatibility
      document.dispatchEvent(new CustomEvent('dhk:avatar-ready',   { detail: { avatarUrl: finalUrl } }));
      window.dispatchEvent(new CustomEvent('dhk:avatar:selected', { detail: { url: finalUrl } }));
      // Optional: hide the modal (fade then remove)
      document.getElementById("avatar-modal")?.classList.add("fade-out");
      setTimeout(() => document.getElementById("avatar-modal")?.remove(), 500);
      document.body.classList.remove("rpm-open","modal-open");
    }
  }

  // ---- Ready Player Me flow (create) ----
  function openRPM() {
    const url = 'https://demo.readyplayer.me/avatar?frameApi';
    rpmFrame.src = url;
    rpmWrap.style.display = 'block';
    urlWrap.style.display = 'none';

    // Tell iframe we’re ready (per RPM frame API)
    rpmFrame.onload = () => {
      rpmFrame.contentWindow.postMessage({
        target: 'readyplayerme',
        type: 'subscribe',
        eventName: 'v1.avatar.exported'
      }, '*');
    };
  }

  // Global RPM message bridge (works even if openRPM wasn't used)
  window.addEventListener("message", async (e) => {
    let data = e.data;
    if (typeof data === "string") { try { data = JSON.parse(data); } catch {} }
    if (!data || (data.source !== "readyplayer.me" && data.source !== "readyplayerme")) return;

    if (data.eventName === "v1.avatar.exported" && data.data?.url) {
      const finalUrl = data.data.url; // GLB/VRM hosted by RPM
      await finalizeAvatar(finalUrl);
    }
  });

  // TRY ON topbar chip → prompt login
  document.addEventListener('DOMContentLoaded', () => {
    const chip = document.querySelector('.chip');
    chip?.addEventListener('click', () => { if (window.netlifyIdentity) netlifyIdentity.open('login'); });
  });

  // ---- Manual URL fallback ----
  async function saveManualUrl() {
    const val = (urlInput.value || '').trim();
    if (!val) return alert('Paste a valid URL.');
    await finalizeAvatar(val);
    hideModal();
  }

  // Also wire minimal saver as you requested
  document.getElementById("avatar-url-save")?.addEventListener("click", async () => {
    const val = document.getElementById("avatar-url-input")?.value?.trim();
    if (!val) return;
    await finalizeAvatar(val);
  });

  // ---- Public gate: wait for sign-in + avatar ----
  async function requireAuthAndAvatar() {
    const w = idWidget();
    if (!w) throw new Error('Netlify Identity not loaded');

    // Ensure login
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

    // Prefer identity metadata, fallback to localStorage
    const stored = user?.user_metadata?.avatarUrl || localStorage.getItem('dhk_avatar_url') || '';
    if (stored) {
      localStorage.setItem('dhk_avatar_url', stored);
      return stored;
    }

    // No avatar yet → show chooser
    showModal();

    // Wire chooser buttons
    btnCreate?.addEventListener('click', openRPM);
    btnLoad?.addEventListener('click', () => { urlWrap.style.display = 'block'; rpmWrap.style.display = 'none'; });
    urlSave?.addEventListener('click', saveManualUrl);
    urlCancel?.addEventListener('click', hideModal);

    // Resolve when avatar is ready
    const avatarUrl = await new Promise((resolve) => {
      const onReady = (e) => {
        const url = e.detail?.avatarUrl;
        if (url) {
          localStorage.setItem('dhk_avatar_url', url);
          document.removeEventListener('dhk:avatar-ready', onReady);
          resolve(url);
        }
      };
      document.addEventListener('dhk:avatar-ready', onReady);
    });

    return avatarUrl;
  }

  // Expose to window
  window.DHKAuth = { requireAuthAndAvatar };

  // --- Bridge: when avatar ready, tell the world scene to load it (redundant safety) ---
  document.addEventListener("dhk:avatar-ready", (e) => {
    const url = e.detail?.avatarUrl;
    if (url) {
      window.dispatchEvent(new CustomEvent("dhk:avatar:selected", { detail: { url } }));
    }
  });

})();