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

  // public surface
  let lastAvatarUrl = "";
  window.DHKAuth = window.DHKAuth || {};
  Object.defineProperty(window.DHKAuth, "selectedAvatarUrl", { get: () => lastAvatarUrl });

  // ---------- Identity ----------
  const idw = () => (typeof netlifyIdentity !== "undefined" ? netlifyIdentity : null);
  const currentUser = () => (idw() ? idw().currentUser() : null);

  // Init identity pointing explicitly at www domain (keeps sessions consistent)
  (function initIdentity() {
    const ID_URL = "https://www.darkharlemknight.com/.netlify/identity";
    try { idw()?.init({ APIUrl: ID_URL }); } catch {}
    idw()?.on("open", () => {
      document.documentElement.classList.add('netlify-identity-open');
      document.body.classList.add('netlify-identity-open');
    });
    idw()?.on("close", () => {
      document.documentElement.classList.remove('netlify-identity-open');
      document.body.classList.remove('netlify-identity-open');
    });
  })();

  function identityReady(timeoutMs = 7000) {
    return new Promise((resolve) => {
      const w = idw();
      if (!w) return resolve(null);
      try { w.init(); } catch {}
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
    if (!worldBtn.textContent || /loading/i.test(worldBtn.textContent)) {
      worldBtn.textContent = "Load World";
    }
  }

  function announceAvatar(url) {
    lastAvatarUrl = url;
    try { localStorage.setItem("dhk_avatar_url", url); } catch {}
    window.dispatchEvent(new CustomEvent("dhk:avatar-selected", { detail: { url } }));
    enableWorldBtn();
  }

  function mountUseSavedButton() {
    if (!modalEl || document.getElementById("avatar-use-saved")) return;
    const host =
      document.querySelector("#avatar-modal .chooser-tabs") ||
      document.querySelector("#avatar-modal .modal-header") ||
      modalEl;

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

  // ---------- RPM open + subscribe ----------
  function openRPM() {
    if (!rpmFrame) return;

    // set src once
    if (!rpmFrame.src) {
      rpmFrame.src = "https://demo.readyplayer.me/avatar?frameApi";
      rpmFrame.setAttribute("allow", "camera; microphone; autoplay; clipboard-write");
      rpmFrame.setAttribute("allowfullscreen", "true");
    }

    if (rpmWrap) rpmWrap.style.display = "block";
    if (urlWrap) urlWrap.style.display = "none";

    const subscribe = () => {
      try {
        // Use "*" to avoid the early about:blank mismatch; we verify origin on receive.
        rpmFrame.contentWindow.postMessage(
          { target: "readyplayer.me", type: "subscribe", eventName: "v1.avatar.exported" },
          "*"
        );
      } catch {}
    };

    rpmFrame.onload = () => {
      subscribe();
      setTimeout(subscribe, 100);
      setTimeout(subscribe, 300);
      setTimeout(subscribe, 800);
    };
    setTimeout(subscribe, 1500);
  }

  // ---------- Normalize RPM links to .glb ----------
  function normalizeAvatarUrl(input) {
    try {
      const u = new URL(input);
      if (u.hostname.endsWith("readyplayer.me")) {
        if (!/\.(glb|gltf|vrm)$/i.test(u.pathname)) {
          // social/share link → direct file
          if (/^\/[a-z0-9_-]+$/i.test(u.pathname)) u.pathname += ".glb";
        }
        u.search = "";
        return u.toString();
      }
      if (u.pathname.endsWith(".glb")) return u.toString();
    } catch {}
    return input;
  }

  // ---------- Receive RPM export ----------
  window.addEventListener("message", async (e) => {
    // verify message origin
    const ok = typeof e.origin === "string" && /(^|\.)readyplayer\.me$/i.test(new URL(e.origin).hostname);
    let data = e.data;
    if (typeof data === "string") { try { data = JSON.parse(data); } catch {} }
    if (!ok || !data || data.source !== "readyplayer.me") return;

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

  // ---------- Bind “Load World” (safety) ----------
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
    if (saved) {
      // preload selection so “Load World” is enabled immediately
      announceAvatar(saved);
    } else {
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