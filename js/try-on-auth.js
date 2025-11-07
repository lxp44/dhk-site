// js/try-on-auth.js
(() => {
  // Modal + controls
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
  const worldBtn  = document.getElementById('world-load'); // new button

  // Expose selected avatar URL for other scripts
  let lastAvatarUrl = "";
  window.DHKAuth = window.DHKAuth || {};
  Object.defineProperty(window.DHKAuth, "selectedAvatarUrl", { get: () => lastAvatarUrl });

  // --------------- Identity helpers ---------------
  const idw = () => (typeof netlifyIdentity !== "undefined" ? netlifyIdentity : null);
  const currentUser = () => (idw() ? idw().currentUser() : null);

  function identityReady(timeoutMs = 7000) {
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

  // --------------- Saved avatar helpers ---------------
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

  // --------------- UI helpers ---------------
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

  // --------------- RPM open + subscribe ---------------
  function openRPM() {
    // only set src once (avoid reload loops on iOS)
    if (rpmFrame && !rpmFrame.src) rpmFrame.src = "https://demo.readyplayer.me/avatar?frameApi";
    if (rpmWrap) rpmWrap.style.display = "block";
    if (urlWrap) urlWrap.style.display = "none";

    const subscribe = () => {
      try {
        // subscribe to export event
        rpmFrame.contentWindow.postMessage(
          { target: "readyplayer.me", type: "subscribe", eventName: "v1.avatar.exported" },
          "https://demo.readyplayer.me"
        );
      } catch {}
    };

    rpmFrame.onload = () => { subscribe(); setTimeout(subscribe, 120); };
    // Fallback: subscribe again after a small delay (helps Safari)
    setTimeout(subscribe, 400);
  }

  // --------------- URL normalization ---------------
  function normalizeAvatarUrl(input) {
    try {
      const u = new URL(input);
      // Only normalize Ready Player Me links
      if (u.hostname.endsWith("readyplayer.me")) {
        // If it's not already a model file, append .glb
        if (!/\.(glb|gltf|vrm)$/i.test(u.pathname)) {
          u.pathname = u.pathname.replace(/\/?$/, ".glb");
        }
        // Trim noisy query for fewer CORS/caching surprises
        u.search = "";
        return u.toString();
      }
      // If it already points to a .glb anywhere else, keep it
      if (u.pathname.endsWith(".glb")) return u.toString();
    } catch {}
    return input;
  }

  // --------------- RPM message listener ---------------
  window.addEventListener("message", async (e) => {
    // ensure message originates from RPM
    const okOrigin = typeof e.origin === "string" && /(^|\.)readyplayer\.me$/i.test(new URL(e.origin).hostname);
    if (!okOrigin) return;

    let data = e.data;
    if (typeof data === "string") { try { data = JSON.parse(data); } catch {} }
    if (!data || data.source !== "readyplayer.me") return;

    if (data.eventName === "v1.avatar.exported" && data.data?.url) {
      const glbUrl = normalizeAvatarUrl(data.data.url);
      try { await saveAvatarUrlToIdentity(glbUrl); } catch {}
      announceAvatar(glbUrl);
    }
  });

  // --------------- Manual paste flow ---------------
  async function saveManualUrl() {
    const val = (urlInput?.value || "").trim();
    if (!val) return alert("Paste a valid URL.");
    const glbUrl = normalizeAvatarUrl(val);
    const final  = await saveAvatarUrlToIdentity(glbUrl);
    announceAvatar(final);
  }

  // --------------- Load World button (safety net) ---------------
  if (worldBtn) {
    worldBtn.addEventListener("click", async () => {
      if (worldBtn.disabled) return;
      try {
        worldBtn.textContent = "Loading…";
        worldBtn.disabled = true;

        if (window.DHKWorld?.loadWorldOnce) {
          await window.DHKWorld.loadWorldOnce(); // provided by try-on.js
        } else {
          // broadcast a fallback event other scripts could listen to
          window.dispatchEvent(new Event("dhk:load-world"));
        }

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

  // --------------- Public API: require login & get avatar ---------------
  async function requireAuthAndAvatar() {
    await identityReady();

    // Ensure login
    let user = currentUser();
    if (!user) {
      show(gateEl);
      gateBtn?.addEventListener("click", () => idw()?.open("login"), { once: true });
      await new Promise((resolve) => {
        const done = () => { idw().off("login", done); hide(gateEl); resolve(); };
        idw().on("login", done);
      });
      user = currentUser();
    }
    hide(gateEl);

    // Always open modal so the user can press "Load World"
    show(modalEl);
    mountUseSavedButton();

    // If we already have a saved avatar, announce it now (enables the button)
    const saved = getSavedAvatarUrl();
    if (saved) announceAvatar(saved);

    // Wire actions (create / load / paste)
    btnCreate?.addEventListener("click", openRPM, { once: true });
    btnLoad  ?.addEventListener("click", () => {
      const url = getSavedAvatarUrl();
      if (url) announceAvatar(url);
      else { if (urlWrap) urlWrap.style.display = "block"; if (rpmWrap) rpmWrap.style.display = "none"; }
    }, { once: true });
    urlSave  ?.addEventListener("click", saveManualUrl);
    urlCancel?.addEventListener("click", () => hide(urlWrap));

    // Resolve as soon as we know an avatar URL (modal stays until Load World)
    if (lastAvatarUrl) return lastAvatarUrl;
    return await new Promise((resolve) => {
      const onSel = (e) => {
        const url = e.detail?.url;
        if (url) { window.removeEventListener("dhk:avatar-selected", onSel); resolve(url); }
      };
      window.addEventListener("dhk:avatar-selected", onSel);
    });
  }

  // Expose public method
  window.DHKAuth.requireAuthAndAvatar = requireAuthAndAvatar;
})();