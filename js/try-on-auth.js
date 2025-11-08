// js/try-on-auth.js
(() => {
  // DOM
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
  const worldBtn  = document.getElementById('world-load');

  // IMPORTANT: do NOT point this to the bedroom/world — avatars are separate
  const DEFAULT_AVATAR = ""; // leave blank or swap with a neutral mannequin glb if you have one

  // Identity helpers
  const idw = () => (typeof netlifyIdentity !== "undefined" ? netlifyIdentity : null);
  const currentUser = () => (idw() ? idw().currentUser() : null);

  async function identityReady(timeoutMs = 7000) {
    const w = idw();
    if (!w) return null;
    try { w.init({ APIUrl: window.location.origin + "/.netlify/identity" }); } catch {}
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(w.currentUser()); } };
      w.on("init", finish);
      const start = Date.now();
      const t = setInterval(() => {
        if (w.currentUser() || Date.now() - start > timeoutMs) {
          clearInterval(t); finish();
        }
      }, 200);
    });
  }

  const show = (el, mode = "flex") => { if (el) el.style.display = mode; };
  const hide = (el) => { if (el) el.style.display = "none"; };

  function safeLocalGet(k){ try { return localStorage.getItem(k) || ""; } catch { return ""; } }
  function safeLocalSet(k,v){ try { localStorage.setItem(k,v); } catch {} }

  function getSavedAvatarUrl() {
    const u = currentUser();
    const idMeta = u?.user_metadata?.avatarUrl || "";
    const local = safeLocalGet("dhk_avatar_url");
    return idMeta || local || "";
  }

  async function saveAvatarUrl(url) {
    // Try identity first; if not available, fall back to localStorage
    const w = idw(); const u = currentUser();
    let final = url;
    if (w && u) {
      try {
        const token = await u.jwt();
        const res = await fetch("/.netlify/identity/user", {
          method: "PUT",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ user_metadata: { avatarUrl: url } })
        });
        if (res.ok) {
          const updated = await res.json();
          w.setUser(updated);
          final = updated.user_metadata?.avatarUrl || url;
        }
      } catch {
        // ignore; we’ll still save to local
      }
    }
    safeLocalSet("dhk_avatar_url", final);
    return final;
  }

  function enableWorldBtn() {
    if (!worldBtn) return;
    worldBtn.disabled = false;
    if (!worldBtn.textContent || /loading/i.test(worldBtn.textContent)) worldBtn.textContent = "Load World";
  }

  let lastAvatarUrl = "";
  window.DHKAuth = window.DHKAuth || {};
  Object.defineProperty(window.DHKAuth, "selectedAvatarUrl", { get: () => lastAvatarUrl });

  function announceAvatar(url) {
    lastAvatarUrl = url;
    safeLocalSet("dhk_avatar_url", url);
    window.dispatchEvent(new CustomEvent("dhk:avatar-selected", { detail: { url } }));
    enableWorldBtn();
  }

  function openRPM() {
    if (!rpmFrame) return;
    if (!rpmFrame.src) {
      rpmFrame.src = "https://demo.readyplayer.me/avatar?frameApi";
      rpmFrame.setAttribute("allow", "camera; microphone; autoplay; clipboard-write");
      rpmFrame.setAttribute("allowfullscreen", "true");
    }
    if (rpmWrap) rpmWrap.style.display = "block";
    if (urlWrap) urlWrap.style.display = "none";

    const subscribe = () => {
      try {
        rpmFrame.contentWindow.postMessage(
          { target: "readyplayer.me", type: "subscribe", eventName: "v1.avatar.exported" },
          "*"
        );
      } catch {}
    };
    rpmFrame.onload = () => { subscribe(); setTimeout(subscribe, 200); setTimeout(subscribe, 600); };
  }

  function normalizeAvatarUrl(input) {
    try {
      const u = new URL(input);
      if (u.hostname.endsWith("readyplayer.me")) {
        if (!/\.(glb|gltf|vrm)$/i.test(u.pathname)) {
          if (/^\/[a-z0-9_-]+$/i.test(u.pathname)) u.pathname += ".glb";
        }
        u.search = "";
        return u.toString();
      }
      if (/\.(glb|gltf|vrm)$/i.test(u.pathname)) return u.toString();
    } catch {}
    return input;
  }

  // Accept RPM messages
  window.addEventListener("message", async (e) => {
    let data = e.data;
    if (typeof data === "string") { try { data = JSON.parse(data); } catch {} }
    const ok = (() => {
      try { return /(^|\.)readyplayer\.me$/i.test(new URL(e.origin).hostname); } catch { return false; }
    })();
    if (!ok || !data || data.source !== "readyplayer.me") return;

    if (data.eventName === "v1.avatar.exported" && data.data?.url) {
      const glb = normalizeAvatarUrl(data.data.url);
      const saved = await saveAvatarUrl(glb);
      announceAvatar(saved);
    }
  });

  async function saveManualUrl() {
    const val = (urlInput?.value || "").trim();
    if (!val) return alert("Paste a valid URL.");
    const final = await saveAvatarUrl(normalizeAvatarUrl(val));
    announceAvatar(final);
  }

  // Public API: waits for login + avatar selection, returns URL
  async function requireAuthAndAvatar() {
    await identityReady();

    // login gate
    let user = currentUser();
    if (!user) {
      show(gateEl);
      gateBtn?.addEventListener("click", () => idw()?.open("login"), { once: true });
      await new Promise((resolve) => {
        const done = () => { idw().off("login", done); hide(gateEl); resolve(); };
        idw()?.on("login", done);
      });
      user = currentUser();
      hide(gateEl);
    } else {
      hide(gateEl);
    }

    show(modalEl);

    const saved = getSavedAvatarUrl();
    if (saved) {
      announceAvatar(saved);
    } else {
      btnCreate?.addEventListener("click", openRPM, { once: true });
      btnLoad  ?.addEventListener("click", () => {
        const s = getSavedAvatarUrl();
        if (s) announceAvatar(s);
        else { if (urlWrap) urlWrap.style.display = "block"; if (rpmWrap) rpmWrap.style.display = "none"; }
      }, { once: true });
      urlSave ?.addEventListener("click", saveManualUrl);
      urlCancel?.addEventListener("click", () => hide(urlWrap));
    }

    if (lastAvatarUrl) return lastAvatarUrl;
    return await new Promise((resolve) => {
      const onSel = (e) => {
        const url = e.detail?.url;
        if (url) { window.removeEventListener("dhk:avatar-selected", onSel); resolve(url); }
      };
      window.addEventListener("dhk:avatar-selected", onSel);
    });
  }

  window.DHKAuth.requireAuthAndAvatar = requireAuthAndAvatar;
})();