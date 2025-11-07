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

  let lastAvatarUrl = "";
  window.DHKAuth = window.DHKAuth || {};
  Object.defineProperty(window.DHKAuth, "selectedAvatarUrl", { get: () => lastAvatarUrl });

  // ---------- Identity helpers ----------
  const idw = () => (typeof netlifyIdentity !== "undefined" ? netlifyIdentity : null);
  const currentUser = () => (idw() ? idw().currentUser() : null);

  function identityReady(timeoutMs = 8000) {
    return new Promise((resolve) => {
      const w = idw();
      if (!w) return resolve(null);
      try { w.init(); } catch {}
      let settled = false;
      const finish = () => { if (!settled) { settled = true; resolve(w.currentUser()); } };

      // event path
      w.on("init", () => finish());

      // poll path (covers iOS/Safari timing + “Logged in” screen)
      const t0 = Date.now();
      const iv = setInterval(() => {
        const u = w.currentUser();
        if (u || (Date.now() - t0) > timeoutMs) {
          clearInterval(iv); finish();
        }
      }, 250);
    });
  }

  // also used later when the widget already shows "Logged in"
  function waitForUser({ maxMs = 15000 } = {}) {
    return new Promise((resolve) => {
      const w = idw();
      if (!w) return resolve(null);

      let done = false;
      const finish = () => { if (!done) { done = true; cleanup(); resolve(w.currentUser()); } };
      const cleanup = () => {
        try { w.off("login", finish); w.off("init", finish); } catch {}
        clearInterval(iv);
        clearTimeout(to);
      };

      // events + polling + timeout
      w.on("login", finish);
      w.on("init", finish);
      const iv = setInterval(() => { if (w.currentUser()) finish(); }, 300);
      const to = setTimeout(finish, maxMs);
    });
  }

  // ---------- Saved avatar helpers ----------
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
    worldBtn.textContent = "Load World";
  }

  function announceAvatar(url) {
    lastAvatarUrl = url;
    try { localStorage.setItem("dhk_avatar_url", url); } catch {}
    window.dispatchEvent(new CustomEvent("dhk:avatar-selected", { detail: { url } }));
    enableWorldBtn();
  }

  function mountUseSavedButton() {
    if (!modalEl || document.getElementById("avatar-use-saved")) return;
    const host = document.querySelector("#avatar-modal .chooser-tabs")
             || document.querySelector("#avatar-modal .modal-header")
             || modalEl;
    const btn = document.createElement("button");
    btn.id = "avatar-use-saved";
    btn.type = "button";
    btn.textContent = "Use my saved avatar";
    btn.className = "chip-saved-avatar";
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

  // ---------- RPM open + subscribe ----------
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
        // use "*" to avoid the early about:blank mismatch; we still filter on receive
        rpmFrame.contentWindow.postMessage(
          { target: "readyplayer.me", type: "subscribe", eventName: "v1.avatar.exported" },
          "*"
        );
      } catch {}
    };
    rpmFrame.onload = () => { subscribe(); setTimeout(subscribe, 150); setTimeout(subscribe, 600); };
    setTimeout(subscribe, 1200);
  }

  // ---------- Normalize RPM links to .glb ----------
  function normalizeAvatarUrl(input) {
    try {
      const u = new URL(input);
      if (u.hostname.endsWith("readyplayer.me")) {
        if (!/\.(glb|gltf|vrm)$/i.test(u.pathname)) {
          if (/^\/[a-z0-9_-]+$/i.test(u.pathname)) u.pathname += ".glb";
        }
        u.search = ""; // keep it lean for CORS
        return u.toString();
      }
      if (u.pathname.endsWith(".glb")) return u.toString();
    } catch {}
    return input;
  }

  // ---------- Receive RPM export ----------
  window.addEventListener("message", async (e) => {
    // only accept messages from *.readyplayer.me
    let okOrigin = false;
    try { okOrigin = /(^|\.)readyplayer\.me$/i.test(new URL(e.origin).hostname); } catch {}
    if (!okOrigin) return;

    let data = e.data;
    if (typeof data === "string") { try { data = JSON.parse(data); } catch {} }
    if (!data || data.source !== "readyplayer.me") return;

    if (data.eventName === "v1.avatar.exported" && data.data?.url) {
      const glb = normalizeAvatarUrl(data.data.url);
      try { await saveAvatarUrlToIdentity(glb); } catch {}
      announceAvatar(glb);
    }
  });

  // ---------- Manual paste ----------
  async function saveManualUrl() {
    const val = (urlInput?.value || "").trim();
    if (!val) return alert("Paste a valid URL.");
    const glb = normalizeAvatarUrl(val);
    const final = await saveAvatarUrlToIdentity(glb);
    announceAvatar(final);
  }

  // ---------- Bind Load World (safety) ----------
  worldBtn?.addEventListener("click", async () => {
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

  // ---------- Public API ----------
  async function requireAuthAndAvatar() {
    await identityReady();

    // 1) login gate
    let user = currentUser();
    if (!user) {
      show(gateEl);
      gateBtn?.addEventListener("click", () => idw()?.open("login"));
      // resolve on login OR when currentUser becomes non-null (covers “Logged in” screen)
      await waitForUser({ maxMs: 20000 });
      hide(gateEl);
      user = currentUser();
    } else {
      hide(gateEl);
    }

    // 2) open avatar modal
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
        if (url) { window.removeEventListener("dhk:avatar-selected", onSel); resolve(url); }
      };
      window.addEventListener("dhk:avatar-selected", onSel);
    });
  }

  window.DHKAuth.requireAuthAndAvatar = requireAuthAndAvatar;
})();