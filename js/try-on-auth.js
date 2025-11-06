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
  const worldBtn  = document.getElementById('world-load'); // ← the new button in your modal

  // expose last avatar URL (handy if other scripts want it)
  let lastAvatarUrl = "";
  window.DHKAuth = window.DHKAuth || {};
  Object.defineProperty(window.DHKAuth, "selectedAvatarUrl", {
    get: () => lastAvatarUrl
  });

  // ---------- Identity helpers ----------
  const idw = () => (typeof netlifyIdentity !== "undefined" ? netlifyIdentity : null);
  const currentUser = () => (idw() ? idw().currentUser() : null);

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

// ---------- RPM flow ----------
function openRPM() {
  if (rpmFrame && !rpmFrame.src) {
    rpmFrame.src = "https://demo.readyplayer.me/avatar?frameApi";
  }
  if (rpmWrap) rpmWrap.style.display = "block";
  if (urlWrap) urlWrap.style.display = "none";

  // Some browsers fire onload before RPM is fully ready.
  const subscribe = () => {
    try {
      rpmFrame.contentWindow.postMessage(
        { target: "readyplayer.me", type: "subscribe", eventName: "v1.avatar.exported" },
        "*"
      );
    } catch {}
  };

  // Try both: onload and a small delay as a fallback.
  rpmFrame.onload = () => { subscribe(); setTimeout(subscribe, 100); };
}

  // Helper: turn RPM share URLs into real model URLs
function normalizeRPMUrl(raw) {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    // Only normalize RPM domains
    if (/\.readyplayer\.me$/i.test(u.hostname)) {
      // If there's no file extension, assume .glb
      if (!/\.(glb|gltf|vrm)$/i.test(u.pathname)) {
        u.pathname = u.pathname.replace(/\/?$/, ".glb"); // append .glb once
      }
      // Handy params (safe no-ops if already present)
      u.searchParams.set("textureAtlas", "none");
      u.searchParams.set("pose", "t");
    }
    return u.toString();
  } catch {
    return raw; // if it's not a valid URL, let upstream validation handle it
  }
}

// ====== RPM message listener (export) ======
window.addEventListener("message", async (e) => {
  let data = e.data;
  if (typeof data === "string") { try { data = JSON.parse(data); } catch {} }
  if (!data || data.source !== "readyplayer.me") return;

  if (data.eventName === "v1.avatar.exported" && data.data?.url) {
    // Convert social/share link to a direct .glb (prevents the 404 you saw)
    const raw = data.data.url;
    const url = normalizeRPMUrl(raw);

    try { await saveAvatarUrlToIdentity(url); } catch {}
    announceAvatar(url);     // this sets lastAvatarUrl, stores to localStorage, enables "Load World"
  }
});

// ====== Manual paste flow (also normalize) ======
async function saveManualUrl() {
  const val = (urlInput?.value || "").trim();
  if (!val) return alert("Paste a valid URL.");
  const final = normalizeRPMUrl(val);
  try { await saveAvatarUrlToIdentity(final); } catch {}
  announceAvatar(final);
}
  // ---------- Bind Load World click here too (safety net) ----------
  if (worldBtn) {
    worldBtn.addEventListener("click", async () => {
      if (worldBtn.disabled) return;
      try {
        worldBtn.textContent = "Loading…";
        worldBtn.disabled = true;

        // Try use the exported helper from try-on.js
        if (window.DHKWorld?.loadWorldOnce) {
          await window.DHKWorld.loadWorldOnce();
        }

        // Close the modal so the scene is visible
        hide(modalEl);

        // Re-enable the button label for future opens
        worldBtn.textContent = "Load World";
      } catch (err) {
        console.error("Load World failed:", err);
        alert("Could not load the world yet.");
        worldBtn.disabled = false;
        worldBtn.textContent = "Load World";
      }
    });
  }

  // ---------- Public: require login and get avatar URL ----------
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
      hide(gateEl);
    } else {
      hide(gateEl);
    }

    // If we already have a saved avatar: open modal (so user can press Load World),
    // announce it immediately so the scene knows which avatar to spawn.
    const saved = getSavedAvatarUrl();
    show(modalEl);
    mountUseSavedButton();

    if (saved) {
      announceAvatar(saved);
    } else {
      // No saved → user can create or paste
      if (btnCreate) btnCreate.addEventListener("click", openRPM, { once: true });
      if (btnLoad) btnLoad.addEventListener("click", () => {
        const url = getSavedAvatarUrl();
        if (url) announceAvatar(url);
        else {
          if (urlWrap) urlWrap.style.display = "block";
          if (rpmWrap) rpmWrap.style.display = "none";
        }
      }, { once: true });
      if (urlSave)   urlSave.addEventListener("click", saveManualUrl);
      if (urlCancel) urlCancel.addEventListener("click", () => hide(urlWrap));
    }

    // Resolve once we know an avatar URL (but leave modal open until Load World is clicked)
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

  // Expose
  window.DHKAuth.requireAuthAndAvatar = requireAuthAndAvatar;
})();