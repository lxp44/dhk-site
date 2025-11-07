<!-- /js/try-on.js -->
<script>
(() => {
  const DATA_URL  = "data/products.json";
  const WORLD_URL = "assets/3d/bedroom.glb";

  let engine, scene, avatar;
  let isFirstPerson = false;
  let worldLoaded = false;
  let chosenAvatarUrl = "";
  let tvVideoTex = null;
  let spawnPoint = new BABYLON.Vector3(0, 0, 0);
  let spawnYaw = 0;


  // ---------- Identity ----------
  function getIdentity() {
    return typeof netlifyIdentity !== "undefined" ? netlifyIdentity : null;
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
      `/.netlify/functions/get-signed-media?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type || "")}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async function fetchJSON(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);
    return r.json();
  }

  // ---------- Cameras ----------
  function makeArcCam(canvas) {
    const cam = new BABYLON.ArcRotateCamera("arc", Math.PI * 1.2, 1.0, 6.5, new BABYLON.Vector3(0, 1.6, 0), scene);
    cam.lowerRadiusLimit = 2.2;
    cam.upperRadiusLimit = 10;
    cam.wheelPrecision = 50;
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
    cam.applyGravity = true;
    cam.checkCollisions = true;
    cam.ellipsoid = new BABYLON.Vector3(0.35, 0.9, 0.35);
    cam.keysUp = [87, 38];
    cam.keysDown = [83, 40];
    cam.keysLeft = [65, 37];
    cam.keysRight = [68, 39];
    return cam;
  }

  // ---------- World Loader ----------
  async function loadWorld() {
    console.log("🌎 Loading world:", WORLD_URL);
    const result = await BABYLON.SceneLoader.ImportMeshAsync("", "", WORLD_URL, scene);
    const root = result.meshes[0];
    root.name = "WorldRoot";
    root.scaling = new BABYLON.Vector3(1, 1, 1);

    scene.createDefaultEnvironment({ createSkybox: false, createGround: false });

    scene.meshes.forEach((m) => {
      const n = (m.name || "").toLowerCase();
      if (["floor", "ground", "wall", "door", "closet", "furniture"].some((k) => n.includes(k))) {
        m.checkCollisions = true;
      }
    });

    const spawnNode =
      scene.getTransformNodeByName("Spawn") ||
      scene.getTransformNodeByName("spawn") ||
      scene.getTransformNodeByName("PlayerStart") ||
      scene.getTransformNodeByName("player_start");

    if (spawnNode) {
      spawnPoint = spawnNode.getAbsolutePosition?.() || spawnNode.position.clone();
      const r = spawnNode.rotationQuaternion
        ? spawnNode.rotationQuaternion.toEulerAngles()
        : spawnNode.rotation || new BABYLON.Vector3(0, 0, 0);
      spawnYaw = r.y || 0;
    }

    const tv = scene.getMeshByName("TV");
    if (tv) {
      tvVideoTex = new BABYLON.VideoTexture(
        "tvtex",
        "assets/media/sample-video.mp4",
        scene,
        true,
        true,
        BABYLON.VideoTexture.TRILINEAR_SAMPLINGMODE,
        { autoPlay: true, loop: true, muted: true }
      );
      const tvMat = new BABYLON.StandardMaterial("tvmat", scene);
      tvMat.emissiveTexture = tvVideoTex;
      tv.material = tvMat;
      tv.actionManager = new BABYLON.ActionManager(scene);
      tv.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, async () => {
          try {
            const { url } = await getSignedMedia("unreleased-vid-1", "video");
            const vid = tvVideoTex.video;
            const wasPlaying = !vid.paused;
            vid.src = url;
            vid.loop = true;
            if (wasPlaying) vid.play().catch(() => {});
          } catch {
            alert("Login required to view unreleased video.");
          }
        })
      );
    }

    worldLoaded = true;
    console.log("✅ Bedroom world loaded");

    if (chosenAvatarUrl) await replaceAvatar(chosenAvatarUrl);
  }

  // ---------- Replace Avatar ----------
  async function replaceAvatar(avatarUrl) {
    if (!avatarUrl) return console.warn("No avatar URL to load.");
    console.log("🧍 Loading avatar:", avatarUrl);

    if (avatar) {
      try { avatar.dispose(); } catch {}
      avatar = null;
    }

    try {
      const res = await BABYLON.SceneLoader.ImportMeshAsync("", "", avatarUrl, scene);
      const root = res.meshes[0];
      root.name = "AvatarRoot";
      avatar = root;

      const bounds = root.getHierarchyBoundingVectors?.();
      if (bounds) {
        const height = bounds.max.y - bounds.min.y;
        const scale = 1.75 / Math.max(0.01, height);
        root.scaling.set(scale, scale, scale);
        const footLift = -bounds.min.y * scale;
        const pos = spawnPoint || BABYLON.Vector3.Zero();
        root.position.set(pos.x, pos.y + footLift, pos.z);
      }
      const idle = res.animationGroups?.find((a) => /idle/i.test(a.name));
      idle?.start(true);
      console.log("✅ Avatar loaded.");
    } catch (err) {
      console.error("❌ Failed to load avatar:", err);
    }
  }

  // ---------- World Once ----------
  async function loadWorldOnce() {
    if (worldLoaded) return true;
    await loadWorld();
    return true;
  }

  window.DHKWorld = { loadWorldOnce };

  // ---------- Avatar Event ----------
  window.addEventListener("dhk:avatar-selected", (e) => {
    const url = e.detail?.url;
    if (!url) return;
    chosenAvatarUrl = url;
    console.log("🎯 Avatar chosen:", url);
    document.getElementById("world-load")?.removeAttribute("disabled");
    if (worldLoaded) replaceAvatar(url);
  });

  // ---------- UI ----------
  function bindUI(canvas) {
    const viewBtn = document.getElementById("view-btn");
    const loadWorldBtn = document.getElementById("world-load");

    loadWorldBtn?.addEventListener("click", async () => {
      if (worldLoaded) return;
      loadWorldBtn.disabled = true;
      loadWorldBtn.textContent = "Loading…";
      try {
        await loadWorldOnce();
        loadWorldBtn.textContent = "World Loaded";
        document.getElementById("avatar-modal")?.style && (document.getElementById("avatar-modal").style.display = "none");
      } catch (err) {
        console.error(err);
        alert("Could not load world.");
        loadWorldBtn.disabled = false;
        loadWorldBtn.textContent = "Load World";
      }
    });

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
  }

  // ---------- Init ----------
  async function init() {
    try {
      console.log("🚀 Initializing try-on scene…");
      const avatarUrl = await window.DHKAuth.requireAuthAndAvatar();
      chosenAvatarUrl = avatarUrl || "";

      const canvas = document.getElementById("renderCanvas");
      engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
      scene  = new BABYLON.Scene(engine);
      scene.ambientColor = new BABYLON.Color3(0.1, 0.1, 0.12);
      scene.collisionsEnabled = true;
      scene.gravity = new BABYLON.Vector3(0, -0.5, 0);
      scene.activeCamera = makeArcCam(canvas);
      new BABYLON.HemisphericLight("h", new BABYLON.Vector3(0, 1, 0), scene).intensity = 0.9;

      try {
        const products = await fetchJSON(DATA_URL);
        buildOutfitBar(products);
        wireRackPickers(products);
      } catch (err) {
        console.warn("Products failed to load:", err);
      }

      bindUI(canvas);
      engine.runRenderLoop(() => scene.render());
      window.addEventListener("resize", () => engine.resize());
    } catch (err) {
      console.error("❌ init() failed:", err);
    }
  }

  document.addEventListener("DOMContentLoaded", init);


  // ---------- Outfit ----------
  function buildOutfitBar(products) {
    const panel = document.getElementById("outfit-panel");
    if (!panel) return;
    const wearable = products.filter((p) => p.images && p.images.length);
    panel.innerHTML = wearable.map((p) => `<button class="btn" data-id="${p.id}" title="${p.title}">${p.title.replace("The Dark Harlem ", "")}</button>`).join("");
    panel.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-id]");
      if (!btn) return;
      const id = btn.getAttribute("data-id");
      try { await wearGarment(`assets/3d/clothes/${id}.glb`); }
      catch { alert("Garment not available yet."); }
    });
  }

  function wireRackPickers(products) {
    const byId = Object.fromEntries(products.map((p) => [p.id, p]));
    scene.meshes.forEach((m) => {
      const match = /^(rack|hanger)_(.+)$/i.exec(m.name || "");
      if (!match) return;
      const productId = match[2];
      if (!byId[productId]) return;
      m.actionManager = new BABYLON.ActionManager(scene);
      m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnPickTrigger,
        async () => { try { await wearGarment(`assets/3d/clothes/${productId}.glb`); } catch { alert("Garment not available yet."); } }
      ));
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();