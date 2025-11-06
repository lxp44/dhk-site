(() => {
  const DATA_URL  = "data/products.json";
  const WORLD_URL = "assets/3d/bedroom.glb";

  let engine, scene, avatar, isFirstPerson = false, music, currentTrack = 0;
  let tvVideoTex = null;
  let worldLoaded = false;
  let chosenAvatarUrl = ""; // set when user picks an avatar

  // Spawn (filled if a Spawn/PlayerStart node exists in the GLB)
  let spawnPoint = new BABYLON.Vector3(0, 0, 0);
  let spawnYaw = 0;

  // ---------- Identity helpers ----------
  function getIdentity() { return (typeof netlifyIdentity !== "undefined") ? netlifyIdentity : null; }
  function currentUser() { const id = getIdentity(); return id ? id.currentUser() : null; }

  async function getSignedMedia(id, type) {
    const user = currentUser();
    if (!user) throw new Error("Login required");
    const token = await user.jwt();
    const res = await fetch(
      "/.netlify/functions/get-signed-media?id=" + encodeURIComponent(id) + "&type=" + encodeURIComponent(type || ""),
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // { url, expiresAt, id, type }
  }

  // ---------- Utils ----------
  async function fetchJSON(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);
    return r.json();
  }

  // ---------- Cameras ----------
  function makeArcCam(canvas) {
    const cam = new BABYLON.ArcRotateCamera("arc", Math.PI * 1.2, 1.0, 6.5, new BABYLON.Vector3(0, 1.6, 0), scene);
    cam.lowerRadiusLimit = 2.2; cam.upperRadiusLimit = 10; cam.wheelPrecision = 50; cam.panningSensibility = 0;
    cam.attachControl(canvas, true);
    return cam;
  }

  function makeFPSCam(canvas) {
    const cam = new BABYLON.UniversalCamera("fps", new BABYLON.Vector3(0, 1.7, -2), scene);
    cam.minZ = 0.05; cam.speed = 0.35; cam.inertia = 0.7; cam.angularSensibility = 5000;
    cam.attachControl(canvas, true);
    cam.applyGravity = true; cam.checkCollisions = true; cam.ellipsoid = new BABYLON.Vector3(0.35, 0.9, 0.35);
    cam.keysUp=[87,38]; cam.keysDown=[83,40]; cam.keysLeft=[65,37]; cam.keysRight=[68,39];
    return cam;
  }

  // ---------- World loader (BEDROOM) ----------
  async function loadWorld() {
    console.log("Loading world:", WORLD_URL);
    const result = await BABYLON.SceneLoader.ImportMeshAsync("", "", WORLD_URL, scene);
    const root = result.meshes[0];
    root.name = "WorldRoot";
    root.scaling = new BABYLON.Vector3(1, 1, 1);

    // environment off; GLB provides it
    scene.createDefaultEnvironment({ createSkybox: false, createGround: false });

    // collisions by name
    scene.meshes.forEach(m => {
      const n = (m.name || "").toLowerCase();
      if (n.includes("floor") || n.includes("ground") || n.includes("wall") || n.includes("door") || n.includes("closet") || n.includes("furniture")) {
        m.checkCollisions = true;
      }
    });

    // spawn node
    const spawnNode =
      scene.getTransformNodeByName("Spawn") ||
      scene.getTransformNodeByName("spawn") ||
      scene.getTransformNodeByName("PlayerStart") ||
      scene.getTransformNodeByName("player_start");

    if (spawnNode) {
      spawnPoint = spawnNode.getAbsolutePosition?.() || spawnNode.position.clone();
      const r = spawnNode.rotationQuaternion ? spawnNode.rotationQuaternion.toEulerAngles() : (spawnNode.rotation || new BABYLON.Vector3(0,0,0));
      spawnYaw = r.y || 0;
    }

    // TV (optional)
    const tv = scene.getMeshByName("TV");
    if (tv) {
      tvVideoTex = new BABYLON.VideoTexture(
        "tvtex", "assets/media/sample-video.mp4", scene, true, true,
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
            const { url } = await getSignedMedia("unreleased-vid-1", "video");
            const vid = tvVideoTex.video; const wasPlaying = !vid.paused;
            vid.src = url; vid.loop = true; if (wasPlaying) vid.play().catch(()=>{});
          } catch (err) { alert("Login required to view unreleased video."); }
        }
      ));
    }

    // hover highlight + E-to-interact
    const hl = new BABYLON.HighlightLayer("hl", scene);
    let hoverMesh = null;
    const hint = document.getElementById("interact-hint") || (() => {
      const el = document.createElement("div");
      el.id = "interact-hint"; el.textContent = "Press E to interact";
      Object.assign(el.style, { position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)",
        padding: "8px 12px", background: "rgba(0,0,0,.6)", color: "#fff",
        fontFamily: "Cinzel, serif", fontSize: "12px", letterSpacing: "0.1em",
        border: "1px solid rgba(255,255,255,.2)", borderRadius: "6px", display: "none", zIndex: 9999 });
      document.body.appendChild(el); return el;
    })();

    scene.onPointerObservable.add((pi) => {
      if (pi.type !== BABYLON.PointerEventTypes.POINTERMOVE) return;
      const pick = scene.pick(scene.pointerX, scene.pointerY, m => m && m.actionManager);
      hl.removeAllMeshes(); hoverMesh = null;
      if (pick?.hit && pick.pickedMesh?.actionManager) {
        hoverMesh = pick.pickedMesh; hl.addMesh(hoverMesh, BABYLON.Color3.FromHexString("#66ccff")); hint.style.display = "block";
      } else { hint.style.display = "none"; }
    });

    window.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() !== "e" || !hoverMesh || !hoverMesh.actionManager) return;
      hoverMesh.actionManager.processTrigger(BABYLON.ActionManager.OnPickTrigger, { meshUnderPointer: hoverMesh });
    });

    scene.onDisposeObservable.add(() => hl.dispose());
    console.log("✅ Bedroom world loaded");
  }

  // ---------- Load World Once ----------
  async function loadWorldOnce() {
    if (worldLoaded) return true;
    await loadWorld();
    worldLoaded = true;
    // if user already chose an avatar, spawn it now
    if (chosenAvatarUrl) await replaceAvatar(chosenAvatarUrl);
    return true;
  }

  // make available to auth.js
  window.DHKWorld = { loadWorldOnce };

  // ---------- Avatar replace ----------
  let pendingGarments = [];
  async function wearGarment(garmentPath) {
    if (!avatar) { pendingGarments.push(garmentPath); return; }
    const res = await BABYLON.SceneLoader.ImportMeshAsync("", "", garmentPath, scene);
    const gRoot = res.meshes[0];
    gRoot.name = `Garment-${Date.now()}`;
    const torso = avatar.getChildren(n => (n.name || "").toLowerCase().includes("spine"))[0] || avatar;
    gRoot.setParent(torso); gRoot.position = BABYLON.Vector3.Zero(); gRoot.scaling = new BABYLON.Vector3(1,1,1);
  }

  async function replaceAvatar(avatarUrl) {
    if (!worldLoaded) {
      chosenAvatarUrl = avatarUrl || chosenAvatarUrl;
      return;
    }

    if (avatar) {
      try { avatar.getChildMeshes?.().forEach(m => m.dispose()); } catch {}
      try { avatar.dispose?.(); } catch {}
      avatar = null;
    }

    const res  = await BABYLON.SceneLoader.ImportMeshAsync("", "", avatarUrl, scene);
    const root = res.meshes[0]; root.name = "AvatarRoot"; root.metadata = { isAvatar: true }; avatar = root;

    // scale to ~1.75m and drop feet to ground
    const bounds = root.getHierarchyBoundingVectors?.();
    let footLift = 0;
    if (bounds) {
      const height = bounds.max.y - bounds.min.y;
      const s = 1.75 / Math.max(0.01, height);
      root.scaling.set(s, s, s);
      footLift = -bounds.min.y * s;
    }

    const pos = spawnPoint || BABYLON.Vector3.Zero();
    root.position.set(pos.x, (pos.y || 0) + footLift, pos.z);
    root.rotation = root.rotation || new BABYLON.Vector3(0,0,0);
    root.rotation.y = spawnYaw || 0;

    const idle = res.animationGroups?.find(a => /idle/i.test(a.name));
    idle?.start(true);

    if (pendingGarments.length) {
      for (const g of pendingGarments) { try { await wearGarment(g); } catch {} }
      pendingGarments = [];
    }
  }

  // listen for avatar chosen from auth
  window.addEventListener("dhk:avatar-selected", (e) => {
    const url = e.detail?.url;
    if (!url) return;
    chosenAvatarUrl = url;
    document.getElementById('world-load')?.removeAttribute('disabled');
    if (worldLoaded) replaceAvatar(url);
  });

  // ---------- UI wiring ----------
  function bindUI(canvas) {
    const viewBtn  = document.getElementById("view-btn");
    const musicBtn = document.getElementById("music-btn");
    const nextBtn  = document.getElementById("music-next");
    const loadWorldBtn = document.getElementById("world-load");

    document.getElementById("auth-btn-dock")  ?.addEventListener("click", () => document.getElementById("auth-btn") ?.click());
    document.getElementById("view-btn-dock")  ?.addEventListener("click", () => document.getElementById("view-btn") ?.click());
    document.getElementById("music-btn-dock") ?.addEventListener("click", () => document.getElementById("music-btn")?.click());
    document.getElementById("music-next-dock")?.addEventListener("click", () => document.getElementById("music-next")?.click());
    document.getElementById("gate-signin")    ?.addEventListener("click", () => { if (window.netlifyIdentity) netlifyIdentity.open("login"); });

    loadWorldBtn?.addEventListener("click", async () => {
      if (worldLoaded) return;
      loadWorldBtn.disabled = true;
      loadWorldBtn.textContent = "Loading…";
      try {
        await loadWorldOnce();
        loadWorldBtn.textContent = "World Loaded";
        document.getElementById("avatar-modal")?.style && (document.getElementById("avatar-modal").style.display = "none");
        document.body.classList.remove("modal-open","rpm-open");
      } catch (e) {
        console.error(e);
        alert("Could not load the world yet.");
        loadWorldBtn.disabled = false;
        loadWorldBtn.textContent = "Load World";
      }
    });

    viewBtn?.addEventListener("click", () => {
      isFirstPerson = !isFirstPerson;
      const active = scene.activeCamera; active?.detachControl(canvas);
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

    window.addEventListener("keydown", (e) => { if (e.key.toLowerCase() === "v") viewBtn?.click(); });
  }

  // ---------- Boot ----------
  async function init() {
    const avatarUrl = await window.DHKAuth.requireAuthAndAvatar();
    chosenAvatarUrl = avatarUrl || "";

    const canvas = document.getElementById("renderCanvas");
    engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    scene  = new BABYLON.Scene(engine);
    scene.ambientColor = new BABYLON.Color3(0.1, 0.1, 0.12);
    scene.collisionsEnabled = true;
    scene.gravity = new BABYLON.Vector3(0, -0.5, 0);

    scene.activeCamera = makeArcCam(canvas);
    new BABYLON.HemisphericLight("h", new BABYLON.Vector3(0,1,0), scene).intensity = 0.9;

    try {
      const products = await fetchJSON(DATA_URL);
      buildOutfitBar(products);
      wireRackPickers(products);
    } catch (e) { console.warn("Products failed to load:", e); }

    bindUI(canvas);
    engine.runRenderLoop(() => scene.render());
    window.addEventListener("resize", () => engine.resize());
  }

  // Outfit panel + rack wiring
  function buildOutfitBar(products) {
    const panel = document.getElementById("outfit-panel");
    if (!panel) return;
    const wearable = products.filter(p => p.images && p.images.length);
    panel.innerHTML = wearable.map(p => `<button class="btn" data-id="${p.id}" title="${p.title}">${p.title.replace('The Dark Harlem ','')}</button>`).join("");
    panel.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-id]"); if (!btn) return;
      const id = btn.getAttribute("data-id");
      try { await wearGarment(`assets/3d/clothes/${id}.glb`); }
      catch { alert("Garment not available yet."); }
    });
  }

  function wireRackPickers(products) {
    const byId = Object.fromEntries(products.map(p => [p.id, p]));
    scene.meshes.forEach(m => {
      const match = /^(rack|hanger)_(.+)$/i.exec(m.name || ""); if (!match) return;
      const productId = match[2]; if (!byId[productId]) return;
      m.actionManager = new BABYLON.ActionManager(scene);
      m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnPickTrigger,
        async () => { try { await wearGarment(`assets/3d/clothes/${productId}.glb`); } catch { alert("Garment not available yet."); } }
      ));
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();