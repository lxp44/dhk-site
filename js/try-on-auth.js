<!-- /js/try-on-auth.js -->
<script>
(() => {
  // ==== grab UI ====
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

  // ==== Identity helpers ====
  const idw          = () => (window.netlifyIdentity || null);
  const currentUser  = () => (idw() ? idw().currentUser() : null);
  const show = (el, mode="flex") => el && (el.style.display = mode);
  const hide = (el) => el && (el.style.display = "none");

  function identityReady(timeoutMs = 8000){
    return new Promise((resolve) => {
      const w = idw(); if (!w) return resolve(null);
      try { w.init({ APIUrl: "https://www.darkharlemknight.com/.netlify/identity" }); } catch {}
      let done = false;
      const finish = () => { if (!done){ done = true; resolve(w.currentUser()); } };
      w.on("init", finish);
      const start = Date.now();
      const t = setInterval(() => {
        if (w.currentUser() || Date.now() - start > timeoutMs){ clearInterval(t); finish(); }
      }, 200);
    });
  }

  // persist avatar URL on the user (and localStorage as cache)
  async function saveAvatarUrlToIdentity(url){
    const w = idw(); const u = currentUser();
    if (!w || !u) throw new Error("No identity session");
    const token = await u.jwt();
    const res = await fetch("/.netlify/identity/user", {
      method: "PUT",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type":"application/json" },
      body: JSON.stringify({ user_metadata: { avatarUrl: url } })
    });
    const updated = await res.json();
    w.setUser(updated);
    try { localStorage.setItem("dhk_avatar_url", updated.user_metadata?.avatarUrl || url); } catch {}
    return updated.user_metadata?.avatarUrl || url;
  }

  const getSavedAvatarUrl = () =>
    currentUser()?.user_metadata?.avatarUrl || localStorage.getItem("dhk_avatar_url") || "";

  function enableWorldBtn(){
    if (!worldBtn) return;
    worldBtn.disabled = false;
    if (!worldBtn.textContent || /loading/i.test(worldBtn.textContent)) worldBtn.textContent = "Load World";
  }

  function announceAvatar(url){
    lastAvatarUrl = url;
    try { localStorage.setItem("dhk_avatar_url", url); } catch {}
    window.dispatchEvent(new CustomEvent("dhk:avatar-selected", { detail: { url } }));
    enableWorldBtn();
  }

  // ==== Ready Player Me open + subscribe (robust) ====
  function openRPM(){
    if (!rpmFrame) return;

    // set src once
    if (!rpmFrame.src){
      rpmFrame.src = "https://demo.readyplayer.me/avatar?frameApi";
      rpmFrame.allow = "camera; microphone; autoplay; clipboard-write";
      rpmFrame.setAttribute("allowfullscreen", "true");
    }

    show(rpmWrap, "block");   // <- make the iframe visible
    hide(urlWrap);

    // subscribe AFTER iframe has a contentWindow and URL
    const trySubscribe = () => {
      try {
        rpmFrame.contentWindow?.postMessage(
          { target:"readyplayer.me", type:"subscribe", eventName:"v1.avatar.exported" },
          "https://demo.readyplayer.me"
        );
      } catch {}
    };

    // onload + a few timed retries for iOS/Safari
    rpmFrame.onload = () => { trySubscribe(); setTimeout(trySubscribe, 150); setTimeout(trySubscribe, 500); };
    setTimeout(trySubscribe, 900);
  }

  // Normalize Ready Player Me share links into direct .glb URLs
  function normalizeAvatarUrl(input){
    try{
      const u = new URL(input);
      if (u.hostname.endsWith("readyplayer.me")){
        if (!/\.(glb|gltf|vrm)$/i.test(u.pathname)){
          if (/^\/[a-z0-9_-]+$/i.test(u.pathname)) u.pathname += ".glb";
        }
        u.search = ""; // clean
        return u.toString();
      }
    } catch {}
    return input;
  }

  // receive export from RPM (only trust readyplayer.me)
  window.addEventListener("message", async (e) => {
    const fromRPM = typeof e.origin === "string" && /(^|\.)readyplayer\.me$/i.test(new URL(e.origin).hostname);
    if (!fromRPM) return;

    let data = e.data;
    if (typeof data === "string"){ try { data = JSON.parse(data); } catch {} }
    if (!data || data.source !== "readyplayer.me") return;

    if (data.eventName === "v1.avatar.exported" && data.data?.url){
      const glb = normalizeAvatarUrl(data.data.url);
      try { await saveAvatarUrlToIdentity(glb); } catch {}
      announceAvatar(glb);
    }
  });

  // manual paste flow
  async function saveManualUrl(){
    const raw = (urlInput?.value || "").trim();
    if (!raw) return alert("Paste a valid URL.");
    const glb = normalizeAvatarUrl(raw);
    const final = await saveAvatarUrlToIdentity(glb);
    announceAvatar(final);
  }

  // Load-World safety net (kept)
  worldBtn?.addEventListener("click", async () => {
    if (worldBtn.disabled) return;
    try{
      worldBtn.textContent = "Loading…"; worldBtn.disabled = true;
      if (window.DHKWorld?.loadWorldOnce) await window.DHKWorld.loadWorldOnce();
      hide(modalEl);
      worldBtn.textContent = "Load World";
    } catch (err){
      console.error("Load World failed:", err);
      alert("Could not load the world yet.");
      worldBtn.disabled = false; worldBtn.textContent = "Load World";
    }
  });

  // ==== Public gate ====
  async function requireAuthAndAvatar(){
    await identityReady();

    // 1) Gate — force login if needed
    let user = currentUser();
    if (!user){
      show(gateEl);
      gateBtn?.addEventListener("click", () => idw()?.open("login"), { once:true });
      await new Promise((resolve) => {
        const done = () => { idw().off("login", done); hide(gateEl); resolve(); };
        idw().on("login", done);
      });
      user = currentUser();
      hide(gateEl);
    } else {
      hide(gateEl);
    }

    // 2) Avatar modal
    show(modalEl);
    enableWorldBtn(); // enable "Load World" if we already have an avatar

    // prefill with saved avatar if present
    const saved = getSavedAvatarUrl();
    if (saved){ announceAvatar(saved); }

    // wire buttons (idempotent)
    btnCreate?.addEventListener("click", openRPM);
    btnLoad  ?.addEventListener("click", () => {
      const s = getSavedAvatarUrl();
      if (s) announceAvatar(s);
      else { show(urlWrap, "block"); hide(rpmWrap); }
    });
    urlSave  ?.addEventListener("click", saveManualUrl);
    urlCancel?.addEventListener("click", () => hide(urlWrap));

    // 3) If no avatar yet, wait for selection once
    if (lastAvatarUrl) return lastAvatarUrl;
    return await new Promise((resolve) => {
      const onSel = (e) => {
        const url = e.detail?.url;
        if (url){ window.removeEventListener("dhk:avatar-selected", onSel); resolve(url); }
      };
      window.addEventListener("dhk:avatar-selected", onSel);
    });
  }

  window.DHKAuth.requireAuthAndAvatar = requireAuthAndAvatar;
})();
</script>