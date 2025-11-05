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

  // NEW: wait until the Identity widget has fully initialized
  function waitForIdentityReady() {
    return new Promise((resolve, reject) => {
      const w = idWidget();
      if (!w) return reject(new Error('Netlify Identity not loaded'));
      // 'init' fires once per page load with the (possibly null) user
      w.on('init', () => resolve());
      // If the widget already initialized before we attached, resolve next tick
      setTimeout(resolve, 250);
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
    return updated;
  }

  function showGate()  { if (g) g.style.display = 'flex'; }
  function hideGate()  { if (g) g.style.display = 'none'; }
  function showModal() { if (modal) modal.style.display = 'flex'; }
  function hideModal() { if (modal) modal.style.display = 'none'; if (rpmWrap) rpmWrap.style.display='none'; if (urlWrap) urlWrap.style.display='none'; }

  // Centralize finalize flow (dispatch both events + hide modal)
  async function finalizeAvatar(finalUrl) {
    if (!finalUrl) return;
    try {
      try { await saveAvatarUrlToIdentity(finalUrl); } catch (e) { console.warn("Identity save failed, caching locally:", e); }
      localStorage.setItem('dhk_avatar_url', finalUrl);
    } finally {
      document.dispatchEvent(new CustomEvent('dhk:avatar-ready',   { detail: { avatarUrl: finalUrl } }));
      window.dispatchEvent(new CustomEvent('dhk:avatar-selected', { detail: { url: finalUrl } }));
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
    rpmFrame.onload = () => {
      rpmFrame.contentWindow.postMessage({
        target: 'readyplayerme',
        type: 'subscribe',
        eventName: 'v1.avatar.exported'
      }, '*');
    };
  }

  // Global RPM message bridge (mobile/desktop)
  window.addEventListener("message", async (e) => {
    let data = e.data;
    if (typeof data === "string") { try { data = JSON.parse(data); } catch {} }
    if (!data || (data.source !== "readyplayer.me" && data.source !== "readyplayerme")) return;
    if (data.eventName === "v1.avatar.exported" && data.data?.url) {
      const finalUrl = data.data.url;
      await finalizeAvatar(finalUrl);
    }
  });

  // Manual URL fallback
  async function saveManualUrl() {
    const val = (urlInput.value || '').trim();
    if (!val) return alert('Paste a valid URL.');
    await finalizeAvatar(val);
    hideModal();
  }
  document.getElementById("avatar-url-save")?.addEventListener("click", saveManualUrl);
  urlCancel?.addEventListener('click', hideModal);

  // NEW: Hydrate any saved avatar on load/visibility (mobile-friendly)
  async function rehydrateAvatarFromStoreOrIdentity() {
    await waitForIdentityReady().catch(() => {});
    const w = idWidget();
    const user = currentUser();
    const fromIdentity = user?.user_metadata?.avatarUrl;
    const fromLocal    = localStorage.getItem('dhk_avatar_url') || '';
    const finalUrl     = fromIdentity || fromLocal || '';
    if (finalUrl) {
      // mirror cache & fire events so Babylon loads it instantly
      localStorage.setItem('dhk_avatar_url', finalUrl);
      window.dispatchEvent(new CustomEvent('dhk:avatar-selected', { detail: { url: finalUrl } }));
      document.dispatchEvent(new CustomEvent('dhk:avatar-ready', { detail: { avatarUrl: finalUrl } }));
      return finalUrl;
    }
    return '';
  }

  // Try-on chip/tab should work the same on mobile & desktop
  function wireTryOnTriggers() {
    const triggers = [
      document.querySelector('.chip'),                // existing
      document.getElementById('tryon-tab-mobile'),   // NEW (give your mobile tab this id)
      document.getElementById('tryon-tab-desktop')   // optional desktop id
    ].filter(Boolean);

    triggers.forEach(el => {
      el.addEventListener('click', async () => {
        const w = idWidget();
        await waitForIdentityReady().catch(() => {});
        const user = currentUser();
        if (!user) {
          // open login (mobile often redirects → we rehydrate on return)
          if (w) w.open('login');
          return;
        }
        // user is logged in; if we already have an avatar, just dispatch
        const existing = await rehydrateAvatarFromStoreOrIdentity();
        if (!existing) {
          // no avatar yet → open creator/URL modal
          showModal();
        }
      });
    });
  }

  // ---- Public API ----
  async function requireAuthAndAvatar() {
    const w = idWidget();
    if (!w) throw new Error('Netlify Identity not loaded');
    await waitForIdentityReady();

    // Rehydrate immediately if possible (mobile return case)
    const pre = await rehydrateAvatarFromStoreOrIdentity();
    if (pre) return pre;

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

    // Identity may now have metadata; try again
    const stored = user?.user_metadata?.avatarUrl || localStorage.getItem('dhk_avatar_url') || '';
    if (stored) {
      localStorage.setItem('dhk_avatar_url', stored);
      // fire selection so world picks it up instantly
      window.dispatchEvent(new CustomEvent('dhk:avatar-selected', { detail: { url: stored } }));
      return stored;
    }

    // No avatar yet → show chooser and resolve when ready
    showModal();
    btnCreate?.addEventListener('click', openRPM);
    btnLoad  ?.addEventListener('click', () => { urlWrap.style.display = 'block'; rpmWrap.style.display = 'none'; });

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

  // Global “ready” → also inform the world (belt & suspenders)
  document.addEventListener("dhk:avatar-ready", (e) => {
    const url = e.detail?.avatarUrl;
    if (url) window.dispatchEvent(new CustomEvent("dhk:avatar-selected", { detail: { url } }));
  });

  // --- Boot: mobile-friendly hydration hooks ---
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') rehydrateAvatarFromStoreOrIdentity();
  });
  window.addEventListener('focus', () => rehydrateAvatarFromStoreOrIdentity());
  document.addEventListener('DOMContentLoaded', () => {
    wireTryOnTriggers();
    // If the user is already logged in and has an avatar, load it instantly
    rehydrateAvatarFromStoreOrIdentity();
  });
})();