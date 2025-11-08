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
  const worldBtn  = document.getElementById('world-load');

  // Expose latest selected URL
  let lastAvatarUrl = "";
  window.DHKAuth = window.DHKAuth || {};
  Object.defineProperty(window.DHKAuth, "selectedAvatarUrl", { get: () => lastAvatarUrl });

  // ---------- Identity ----------
  const idw = () => (typeof netlifyIdentity !== "undefined" ? netlifyIdentity : null);
  const currentUser = () => (idw() ? idw().currentUser() : null);

  function identityReady(timeoutMs = 8000) {
    return new Promise((resolve) => {
      const w = idw();
      if (!w) return resolve(null);
      try { w.init({ APIUrl: window.location.origin + "/.netlify/identity" }); } catch {}
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(w.currentUser()); } };
      w.on("init", finish);
      const start = Date.now();
      const t = setInterval(() => {
        if (w.currentUser() || Date.now() - start > timeoutMs) { clearInterval(t); finish(); }
      }, 200);
    });
  }

  // ---------- Saved avatar ----------
  function getSavedAvatarUrl() {
    const u = currentUser();
    return u?.user_metadata?.avatarUrl || localStorage.getItem("dhk_avatar_url") || "";
  }

  async function saveAvatarUrlToIdentity(url) {
    const w = idw(); const u = currentUser();
    if (!w || !u) throw new Error("No identity session");
    const token = await u.jwt();
    const res = await fetch("/.netlify/identity/user", {
      method: "PUT",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ user_metadata: { avatarUrl: url } })
    });
    const updated = await res.json();
    w.setUser(updated);
    try { localStorage.setItem("dhk_avatar_url", updated.user_metadata?.avatarUrl || url); } catch {}
    return updated.user_metadata?.avatarUrl || url;
  }

  // ---------- UI helpers ----------
  const show = (el, mode = "flex") => { if (el) el.style.display = mode; };
  const hide = (el) => { if (el) el.style.display = "none"; };

  function enableWorldBtn() {
    if (!worldBtn) return;
    worldBtn.disabled = false;
    worldBtn.classList.add("ready");
    if (!worldBtn.textContent || /loading/i.test(worldBtn.textContent)) worldBtn.textContent = "Load World";
  }

  function announceAvatar(url) {
    lastAvatarUrl = url;
    try { localStorage.setItem("dhk_avatar_url", url); } catch {}
    window.dispatchEvent(new CustomEvent("dhk:avatar-selected", { detail: { url } }));
    enableWorldBtn();
  }

  function mountUseSavedButton() {
    if (!modalEl || document.getElementById("avatar-use-saved")) return;
    const host = document.querySelector("#avatar-modal .chooser-tabs") || document.querySelector("#avatar-modal .modal-header") || modalEl;
    const btn = document.createElement("button");
    btn.id = "avatar-use-saved";
    btn.type = "button";
    btn.textContent = "Use my saved avatar";
    btn.className = "btn chip";
    btn.style.display = getSavedAvatarUrl() ? "inline-flex" : "none";
    btn.addEventListener("click", () => {
      const url = getSavedAvatarUrl();
      if (!url) return alert("No saved avatar yet.");
      announceAvatar(url);
    });
    host.appendChild(btn);

    window.addEventListener("storage", (e) => {
      if (e.key === "dhk_avatar_url") btn.style.display = e.newValue ? "inline-flex" : "none";
    });
  }

  // ---------- Ready Player Me ----------
  function openRPM() {
    if (!rpmFrame) return;

    if (!rpmFrame.src) {
      rpmFrame.src = "https://demo.readyplayer.me/avatar?frameApi";
      rpmFrame.setAttribute("allow", "camera; microphone; autoplay; clipboard-write");
      rpmFrame.setAttribute("allowfullscreen", "true");
    }
    if (rpmWrap) rpmWrap.style.display = "block";
    if (urlWrap) urlWrap.style.display = "none";

    // subscribe with retries (avoid origin mismatch while still about:blank)
    const subscribe = () => {
      try {
        rpmFrame.contentWindow.postMessage(
          { target: "readyplayer.me", type: "subscribe", eventName: "v1.avatar.exported" },
          "*" // target any; we'll filter on receive using e.origin
        );
      } catch {}
    };
    rpmFrame.onload = () => { subscribe(); setTimeout(subscribe, 120); setTimeout(subscribe, 400); };
    setTimeout(subscribe, 1000);
  }

  function normalizeAvatarUrl(input) {
    try {
      const u = new URL(input);
      if (u.hostname.endsWith("readyplayer.me")) {
        if (!/\.(glb|gltf|vrm)$/i.test(u.pathname)) {
          if (/^\/[a-z0-9_-]+$/i.test(u.pathname)) u.pathname += ".glb";
        }
        u.search = ""; // keep lean for CORS
        return u.toString();
      }
      if (u.pathname.endsWith(".glb")) return u.toString();
    } catch {}
    return input;
  }

  // Receive RPM exported avatar
  window.addEventListener("message", async (e) => {
    const originOk = typeof e.origin === "string" && /(^|\.)readyplayer\.me$/i.test(new URL(e.origin).hostname);
    let data = e.data;
    if (typeof data === "string") { try { data = JSON.parse(data); } catch {} }
    if (!originOk || !data || data.source !== "readyplayer.me") return;

    if (data.eventName === "v1.avatar.exported" && data.data?.url) {
      const glb = normalizeAvatarUrl(data.data.url);
      try { await saveAvatarUrlToIdentity(glb); } catch {}
      announceAvatar(glb);
    }
  });

  // Manual paste flow
  async function saveManualUrl() {
    const val = (urlInput?.value || "").trim();
    if (!val) return alert("Paste a valid URL.");
    const glb = normalizeAvatarUrl(val);
    const final = await saveAvatarUrlToIdentity(glb);
    announceAvatar(final);
  }

  // Safety net: Load World button
  if (worldBtn) {
    worldBtn.addEventListener("click", async () => {
      if (worldBtn.disabled) return;
      try {
        worldBtn.textContent = "Loading…";
        worldBtn.disabled = true;
        if (window.DHKWorld?.loadWorldOnce) await window.DHKWorld.loadWorldOnce();
        hide(modalEl);
        worldBtn.textContent = "Load World";
      } catch (err) {
        console.error("Load World failed:", err);
        alert("Could not load the world yet.");
        worldBtn.disabled = false;
        worldBtn.textContent = "Load World";
      }
    });
  }

  // ---------- Public API ----------
  async function requireAuthAndAvatar() {
    await identityReady();

    // login gate
    let user = currentUser();
    if (!user) {
      show(gateEl);
      gateBtn?.addEventListener("click", () => idw()?.open("login"), { once: true });
      await new Promise((resolve) => {
        const done = () => { idw().off("login", done); hide(gateEl); resolve(); };
        idw().on("login", done);
      });
      user = currentUser();
      hide(gateEl);
    } else {
      hide(gateEl);
    }

    // modal
    show(modalEl);
    mountUseSavedButton();

    const saved = getSavedAvatarUrl();
    if (saved) announceAvatar(saved);
    else {
      btnCreate?.addEventListener("click", openRPM, { once: true });
      btnLoad?.addEventListener("click", () => {
        const s = getSavedAvatarUrl();
        if (s) announceAvatar(s);
        else {
          if (urlWrap) urlWrap.style.display = "block";
          if (rpmWrap) rpmWrap.style.display = "none";
        }
      }, { once: true });
      urlSave?.addEventListener("click", saveManualUrl);
      urlCancel?.addEventListener("click", () => hide(urlWrap));
    }

    if (lastAvatarUrl) return lastAvatarUrl;
    return await new Promise((resolve) => {
      const onSel = (e) => {
        const url = e.detail?.url;
        if (url) {
          window.removeEventListener("dhk:avatar-selected", onSel);
          resolve(url);
        }
      };
      window.addEventListener("dhk:avatar-selected", onSel);
    });
  }

  window.DHKAuth.requireAuthAndAvatar = requireAuthAndAvatar;
})();