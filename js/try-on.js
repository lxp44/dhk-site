// js/try-on.js
(() => {
  const DATA_URL   = "data/products.json";
  const CLOSET_URL = "assets/3d/closet.glb";

  // Public fallback tracks (used for guests / if gate fails)
  const START_MUSIC = [
    "assets/media/music/track1.mp3",
    "assets/media/music/track2.mp3"
  ];

  // IDs/keys your Netlify function recognizes for gated media
  const GATED_VIDEO_ID = "unreleased-vid-1";
  const UNRELEASED_KEY = "music/unreleased/your-track-slug.mp3";

  let engine, scene, avatar, isFirstPerson = false, music, currentTrack = 0;
  let tvVideoTex = null;

  // ---------- Auth / Signed Media ----------
  function getIdentity() {
    return (typeof netlifyIdentity !== "undefined") ? netlifyIdentity : null;
  }
  function currentUser() {
    const id = getIdentity();
    return id ? id.currentUser() : null;
  }
  async function getSignedMedia(id, type) {
    const user = currentUser();
    if (!user) throw new Error("Login required");
    const token = await user.jwt();
    const res = await fetch(
      "/.netlify/functions/get-signed-media?id=" + encodeURIComponent(id) +
      "&type=" + encodeURIComponent(type || ""),
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // { url, expiresAt, id, type }
  }

  // 🔗 NEW: make sure body gets a class while the Identity modal is open
  function hookIdentity() {
    const id = getIdentity();
    if (!id) return; // widget not loaded yet

    id.on("open",  () => document.body.classList.add("identity-open"));
    id.on("close", () => document.body.classList.remove("identity-open"));
  }

  // If the widget script loads slightly after our JS, wait briefly then hook
  (function waitForIdentity() {
    if (getIdentity()) return hookIdentity();
    const t = setInterval(() => {
      if (getIdentity()) { clearInterval(t); hookIdentity(); }
    }, 200);
    setTimeout(() => clearInterval(t), 5000); // stop polling after 5s
  })();

  // ---------- Utils ----------
  async function fetchJSON(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);
    return r.json();
  }

  // ---------- Cameras ----------
  function makeArcCam(canvas) {
    const cam = new BABYLON.ArcRotateCamera(
      "arc",
      Math.PI * 1.2, 1.0, 6.5,
      new BABYLON.Vector3(0, 1.6, 0),
      scene
    );
    cam.lowerRadiusLimit = 2.2;
    cam.upperRadiusLimit = 10;
    cam.wheelPrecision   = 50;
    cam.panningSensibility = 0;
    cam.attachControl(canvas, true);
    return cam;
  }

  function makeFPSCam(canvas) {
    const cam = new BABYLON.UniversalCamera("fps", new BABYLON.Vector3(0, 1.7, -2), scene);
    cam.minZ = 0.05;
    cam.speed = 0.35;
    cam.inertia = 0.7;
    cam.angularSensibility = 5000;
    cam.attachControl(canvas, true);

    // Movement + collisions
    cam.applyGravity = true;
    cam.checkCollisions = true;
    cam.ellipsoid = new BABYLON.Vector3(0.35, 0.9, 0.35);
    cam.keysUp    = [87, 38]; // W, ↑
    cam.keysDown  = [83, 40]; // S, ↓
    cam.keysLeft  = [65, 37]; // A, ←
    cam.keysRight = [68, 39]; // D, →
    return cam;
  }

  // ---------- Closet + Interactables ----------
  async function loadCloset() {
    const result = await BABYLON.SceneLoader.ImportMeshAsync("", "", CLOSET_URL, scene);
    const root = result.meshes[0];
    root.scaling = new BABYLON.Vector3(1, 1, 1);

    scene.createDefaultEnvironment({ createSkybox: false, createGround: false });

    // Collidable surfaces based on mesh names
    scene.meshes.forEach(m => {
      const n = (m.name || "").toLowerCase();
      if (n.includes("floor") || n.includes("ground") || n.includes("wall") ||
          n.includes("door")  || n.includes("closet") || n.includes("furniture")) {
        m.checkCollisions = true;
      }
    });

    // Mirror (named "Mirror")
    const mirror = scene.getMeshByName("Mirror");
    if (mirror) {
      const mat = new BABYLON.StandardMaterial("mirrorMat", scene);
      const rt  = new BABYLON.MirrorTexture("mirrorTex", 1024, scene, true);
      rt.mirrorPlane = new BABYLON.Plane(0, 0, -1, -mirror.position.z);
      rt.renderList = scene.meshes;
      mat.reflectionTexture = rt;
      mat.reflectionTexture.level = 0.8;
      mat.diffuseColor = new BABYLON.Color3(0.02, 0.02, 0.02);
      mirror.material = mat;

      mirror.actionManager = new BABYLON.ActionManager(scene);
      mirror.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnPickTrigger,
        () => document.getElementById("view-btn")?.click()
      ));
    }

    // TV (named "TV") → fallback loop; click to try gated
    const tv = scene.getMeshByName("TV");
    if (tv) {
      tvVideoTex = new BABYLON.VideoTexture(
        "tvtex",
        "assets/media/sample-video.mp4",
        scene, true, true,
        BABYLON.VideoTexture.TRILINEAR_SAMPLINGMODE,
        { autoPlay: true, loop: true, muted: true }
      );
      const tvMat = new BABYLON.StandardMaterial("tvmat", scene);
      tvMat.emissiveTexture = tvVideoTex;
      tv.material = tvMat;

      tv.actionManager = new BABYLON.ActionManager(scene);
      tv.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnPickTrigger,
        async () => {
          try {
            const { url } = await getSignedMedia(GATED_VIDEO_ID, "video");
            const vid = tvVideoTex.video;
            const wasPlaying = !vid.paused;
            vid.src = url;
            vid.loop = true;
            if (wasPlaying) vid.play().catch(() => {});
          } catch (err) {
            console.warn("TV gated video error:", err);
            alert("Login required to view unreleased video.");
          }
        }
      ));
    }

    // Jukebox (named "Jukebox")
    const jukebox = scene.getMeshByName("Jukebox");
    if (jukebox) {
      jukebox.actionManager = new BABYLON.ActionManager(scene);
      jukebox.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnPickTrigger,
        () => document.getElementById("music-btn")?.click()
      ));
    }

    // Hover highlight + "E to interact"
    const hl = new BABYLON.HighlightLayer("hl", scene);
    let hoverMesh = null;

    const hint = document.getElementById("interact-hint") || (() => {
      const el = document.createElement("div");
      el.id = "interact-hint";
      el.textContent = "Press E to interact";
      Object.assign(el.style, {
        position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)",
        padding: "8px 12px", background: "rgba(0,0,0,.6)", color: "#fff",
        fontFamily: "Cinzel, serif", fontSize: "12px", letterSpacing: "0.1em",
        border: "1px solid rgba(255,255,255,.2)", borderRadius: "6px",
        display: "none", zIndex: 9999
      });
      document.body.appendChild(el);
      return el;
    })();

    scene.onPointerObservable.add((pi) => {
      if (pi.type !== BABYLON.PointerEventTypes.POINTERMOVE) return;
      const pick = scene.pick(scene.pointerX, scene.pointerY, m => m && m.actionManager);
      hl.removeAllMeshes();
      hoverMesh = null;
      if (pick?.hit && pick.pickedMesh?.actionManager) {
        hoverMesh = pick.pickedMesh;
        hl.addMesh(hoverMesh, BABYLON.Color3.FromHexString("#66ccff"));
        hint.style.display = "block";
      } else {
        hint.style.display = "none";
      }
    });

    window.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() !== "e" || !hoverMesh || !hoverMesh.actionManager) return;
      hoverMesh.actionManager.processTrigger(BABYLON.ActionManager.OnPickTrigger, { meshUnderPointer: hoverMesh });
    });

    scene.onDisposeObservable.add(() => hl.dispose());
  }

  // ---------- Avatar ----------
  async function loadAvatarFromUrl(avatarUrl) {
    const res = await BABYLON.SceneLoader.ImportMeshAsync("", "", avatarUrl, scene);
    const root = res.meshes[0];
    root.name = "AvatarRoot";
    root.position = new BABYLON.Vector3(0, 0, 0);
    avatar = root;
    const idle = res.animationGroups?.find(a => /idle/i.test(a.name));
    idle?.start?.(true);
  }

  // ---------- Wearables ----------
  async function wearGarment(garmentPath) {
    if (!avatar) return;
    const res = await BABYLON.SceneLoader.ImportMeshAsync("", "", garmentPath, scene);
    const gRoot = res.meshes[0];
    gRoot.name = `Garment-${Date.now()}`;
    const torso = avatar.getChildren(n => (n.name || "").toLowerCase().includes("spine"))[0] || avatar;
    gRoot.setParent(torso);
    gRoot.position = BABYLON.Vector3.Zero();
    gRoot.scaling  = new BABYLON.Vector3(1, 1, 1);
  }

  function wireRackPickers(products) {
    const byId = Object.fromEntries(products.map(p => [p.id, p]));
    scene.meshes.forEach(m => {
      const match = /^(rack|hanger)_(.+)$/i.exec(m.name || "");
      if (!match) return;
      const productId = match[2];
      if (!byId[productId]) return;

      m.actionManager = new BABYLON.ActionManager(scene);
      m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnPickTrigger,
        async () => {
          try { await wearGarment(`assets/3d/clothes/${productId}.glb`); }
          catch { alert("Garment not available yet."); }
        }
      ));
    });
  }

  function buildOutfitBar(products) {
    const panel = document.getElementById("outfit-panel");
    if (!panel) return;
    const wearable = products.filter(p => p.images && p.images.length);

    panel.innerHTML = wearable.map(p => `
      <button class="btn" data-id="${p.id}" title="${p.title}">
        ${p.title.replace('The Dark Harlem ','')}
      </button>
    `).join("");

    panel.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-id]");
      if (!btn) return;
      const id = btn.getAttribute("data-id");
      try { await wearGarment(`assets/3d/clothes/${id}.glb`); }
      catch (err) {
        console.error("Wear failed:", err);
        alert("Garment not available yet.");
      }
    });
  }

  // ---------- Mobile HUD ----------
  function ensureMobileHud() {
    if (!window.matchMedia("(max-width: 900px)").matches) return;
    if (document.getElementById("mobile-hud")) return;

    const hud = document.createElement("div");
    hud.id = "mobile-hud";
    hud.innerHTML = `
      <div id="move-stick"><div id="move-knob"></div></div>
      <div id="look-zone"></div>
    `;
    Object.assign(hud.style, { position: "absolute", inset: "0", pointerEvents: "none" });

    const stick = hud.querySelector("#move-stick");
    const knob  = hud.querySelector("#move-knob");
    const look  = hud.querySelector("#look-zone");

    Object.assign(stick.style, {
      position:"absolute", bottom:"22px", left:"22px",
      width:"120px", height:"120px", borderRadius:"999px",
      background:"rgba(255,255,255,.06)",
      border:"1px solid rgba(255,255,255,.18)",
      backdropFilter:"blur(8px)", pointerEvents:"auto", touchAction:"none"
    });
    Object.assign(knob.style, {
      position:"absolute", left:"50%", top:"50%",
      width:"64px", height:"64px", margin:"-32px 0 0 -32px",
      borderRadius:"999px",
      background:"rgba(255,255,255,.2)",
      border:"1px solid rgba(255,255,255,.35)"
    });
    Object.assign(look.style, {
      position:"absolute", right:"0", top:"0", bottom:"0", width:"55%",
      pointerEvents:"auto", touchAction:"none"
    });

    document.getElementById("tryon-root")?.appendChild(hud);
  }

  function setupMobileControls() {
    ensureMobileHud();

    const stick = document.getElementById("move-stick");
    const knob  = document.getElementById("move-knob");
    const look  = document.getElementById("look-zone");
    if (!stick || !knob || !look) return;

    const radius = 50;
    let moveVec = new BABYLON.Vector2(0, 0);
    let activeId = null;

    function setKnob(dx, dy) {
      const len = Math.hypot(dx, dy);
      const cl  = len > radius ? radius / len : 1;
      const x = dx * cl, y = dy * cl;
      knob.style.transform = `translate(${x}px, ${y}px)`;
      moveVec.x = x / radius;
      moveVec.y = -y / radius; // up = forward
    }
    function resetKnob() {
      knob.style.transform = "translate(0,0)";
      moveVec.set(0,0);
      activeId = null;
    }

    stick.addEventListener("touchstart", (e) => {
      const t = e.changedTouches[0];
      activeId = t.identifier;
      const rect = stick.getBoundingClientRect();
      const cx = rect.left + rect.width/2;
      const cy = rect.top  + rect.height/2;
      setKnob(t.clientX - cx, t.clientY - cy);
      e.preventDefault();
    }, { passive:false });

    stick.addEventListener("touchmove", (e) => {
      const t = [...e.changedTouches].find(tt => tt.identifier === activeId);
      if (!t) return;
      const rect = stick.getBoundingClientRect();
      const cx = rect.left + rect.width/2;
      const cy = rect.top  + rect.height/2;
      setKnob(t.clientX - cx, t.clientY - cy);
      e.preventDefault();
    }, { passive:false });

    stick.addEventListener("touchend", (e) => {
      if ([...e.changedTouches].some(tt => tt.identifier === activeId)) resetKnob();
    });
    stick.addEventListener("touchcancel", resetKnob);

    // Look
    let lookId = null, lastX = 0, lastY = 0;
    const lookSensX = 0.0035, lookSensY = 0.0025;

    look.addEventListener("touchstart", (e) => {
      const t = e.changedTouches[0];
      lookId = t.identifier; lastX = t.clientX; lastY = t.clientY;
    }, { passive:true });

    look.addEventListener("touchmove", (e) => {
      const t = [...e.changedTouches].find(tt => tt.identifier === lookId);
      if (!t) return;
      const dx = t.clientX - lastX;
      const dy = t.clientY - lastY;
      lastX = t.clientX; lastY = t.clientY;

      const cam = scene.activeCamera;
      if (cam && cam.name === "fps") {
        cam.rotation.y -= dx * lookSensX; // yaw
        cam.rotation.x -= dy * lookSensY; // pitch
        cam.rotation.x = BABYLON.Scalar.Clamp(cam.rotation.x, -Math.PI/2 + 0.01, Math.PI/2 - 0.01);
      }
    }, { passive:true });

    look.addEventListener("touchend", (e) => {
      if ([...e.changedTouches].some(tt => tt.identifier === lookId)) lookId = null;
    });

    // Per-frame movement
    const speed = 0.055;
    scene.onBeforeRenderObservable.add(() => {
      const cam = scene.activeCamera;
      if (!cam || cam.name !== "fps") return;
      if (moveVec.lengthSquared() < 1e-4) return;

      const fwd   = cam.getDirection(new BABYLON.Vector3(0,0,1));
      const right = cam.getDirection(new BABYLON.Vector3(1,0,0));
      fwd.y = 0; right.y = 0; fwd.normalize(); right.normalize();

      const delta = engine.getDeltaTime();
      const step  = speed * (delta * 0.6);
      const move  = fwd.scale(moveVec.y * step).add(right.scale(moveVec.x * step));
      cam.moveWithCollisions(move);
    });
  }

  // ---------- UI wiring ----------
  function bindUI(canvas) {
    const viewBtn   = document.getElementById("view-btn");
    const musicBtn  = document.getElementById("music-btn");
    const nextBtn   = document.getElementById("music-next");

    // Mirror the bottom dock buttons to these
    document.getElementById("auth-btn-dock")  ?.addEventListener("click", () => document.getElementById("auth-btn") ?.click());
    document.getElementById("view-btn-dock")  ?.addEventListener("click", () => document.getElementById("view-btn") ?.click());
    document.getElementById("music-btn-dock") ?.addEventListener("click", () => document.getElementById("music-btn")?.click());
    document.getElementById("music-next-dock")?.addEventListener("click", () => document.getElementById("music-next")?.click());
    document.getElementById("gate-signin")    ?.addEventListener("click", () => { if (window.netlifyIdentity) netlifyIdentity.open("login"); });

    viewBtn?.addEventListener("click", () => {
      isFirstPerson = !isFirstPerson;
      const active = scene.activeCamera;
      active?.detachControl(canvas);

      if (isFirstPerson) {
        scene.activeCamera = makeFPSCam(canvas);
        viewBtn.textContent = "1st Person";
        if (!/Mobi|Android/i.test(navigator.userAgent)) canvas.requestPointerLock?.();
      } else {
        document.exitPointerLock?.();
        scene.activeCamera = makeArcCam(canvas);
        viewBtn.textContent = "3rd Person";
      }
    });

    // Play/Pause (tries gated first, falls back to public)
    musicBtn?.addEventListener("click", async () => {
      try {
        if (!music) {
          let src = START_MUSIC[currentTrack];
          try {
            const { url } = await getSignedMedia(UNRELEASED_KEY, "audio");
            src = url;
          } catch (e) {
            console.warn("Falling back to public track:", e?.message || e);
          }
          music = new BABYLON.Sound("jukebox", src, scene, null, { loop: true, autoplay: true, volume: 0.6 });
          musicBtn.textContent = "Pause Music";
        } else if (music.isPlaying) {
          music.pause(); musicBtn.textContent = "Play Music";
        } else {
          music.play();  musicBtn.textContent = "Pause Music";
        }
      } catch (err) {
        console.error("Music error:", err);
        alert("Could not start the jukebox yet.");
      }
    });

    // Next public track
    nextBtn?.addEventListener("click", () => {
      if (!START_MUSIC.length) return;
      currentTrack = (currentTrack + 1) % START_MUSIC.length;
      const nextSrc = START_MUSIC[currentTrack];
      if (!music) {
        music = new BABYLON.Sound("jukebox", nextSrc, scene, null, { loop: true, autoplay: true, volume: 0.6 });
      } else {
        music.stop(); music.dispose();
        music = new BABYLON.Sound("jukebox", nextSrc, scene, null, { loop: true, autoplay: true, volume: 0.6 });
      }
      musicBtn.textContent = "Pause Music";
    });

    // V key toggles view
    window.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "v") viewBtn?.click();
    });
  }

  // ---------- Boot ----------
  async function init() {
    // 🔒 Gate: require login + avatar before the world loads
    const avatarUrl = await window.DHKAuth.requireAuthAndAvatar();

    const canvas = document.getElementById("renderCanvas");
    engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true, stencil: true, disableWebGL2Support: false
    });
    scene = new BABYLON.Scene(engine);
    scene.ambientColor = new BABYLON.Color3(0.1, 0.1, 0.12);

    // Collisions & gravity
    scene.collisionsEnabled = true;
    scene.gravity = new BABYLON.Vector3(0, -0.5, 0);

    // Camera + light
    scene.activeCamera = makeArcCam(canvas);
    const light = new BABYLON.HemisphericLight("h", new BABYLON.Vector3(0,1,0), scene);
    light.intensity = 0.9;

    await loadCloset();
    await loadAvatarFromUrl(avatarUrl);

    const products = await fetchJSON(DATA_URL);
    buildOutfitBar(products);
    wireRackPickers(products);

    bindUI(canvas);
    setupMobileControls();

    engine.runRenderLoop(() => scene.render());
    window.addEventListener("resize", () => engine.resize());
  }

  document.addEventListener("DOMContentLoaded", init);
})();
// Make body reflect when Identity or RPM modal is open (so CSS can freeze chrome)
(function () {
  // Identity => add/remove .modal-open
  if (window.netlifyIdentity) {
    netlifyIdentity.on("open",  () => document.body.classList.add("identity-open","modal-open"));
    netlifyIdentity.on("close", () => document.body.classList.remove("identity-open","modal-open"));
  }

  // Detect the RPM iframe in the DOM and toggle .modal-open
  const obs = new MutationObserver(() => {
    const rpm = document.querySelector('iframe[src*="readyplayer.me"]');
    const idm = document.querySelector('.netlify-identity-modal, .netlify-identity-widget');
    document.body.classList.toggle('rpm-open', !!rpm);
    document.body.classList.toggle('modal-open', !!(rpm || idm));
  });
  obs.observe(document.body, { childList: true, subtree: true });

  // Listen for RPM postMessages too (more reliable)
  window.addEventListener("message", (e) => {
    let data = e.data;
    if (typeof data === "string") { try { data = JSON.parse(data); } catch {} }
    if (data && data.source === "readyplayer.me") {
      if (data.eventName === "v1.frame.opened")  document.body.classList.add("rpm-open","modal-open");
      if (data.eventName === "v1.frame.closed" || data.eventName === "v1.avatar.exported")
        document.body.classList.remove("rpm-open","modal-open");
    }
  });
})();