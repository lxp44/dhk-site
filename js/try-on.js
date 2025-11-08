// js/try-on.js
(() => {
  const DATA_URL   = "data/products.json";
  const WORLD_ROOT = "assets/3d/";
  const WORLD_FILE = "bedroom.glb";

  let engine, scene, avatar;
  let worldLoaded = false;
  let chosenAvatarUrl = "";
  let tvVideoTex = null;
  let spawnPoint = new BABYLON.Vector3(0, 0, 0);
  let spawnYaw = 0;

  const getIdentity  = () => (typeof netlifyIdentity !== "undefined" ? netlifyIdentity : null);
  const currentUser  = () => (getIdentity() ? getIdentity().currentUser() : null);

  async function getSignedMedia(id, type){
    const user = currentUser();
    if (!user) throw new Error("Login required");
    const token = await user.jwt();
    const res = await fetch(`/.netlify/functions/get-signed-media?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type||"")}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async function fetchJSON(url){
    const r = await fetch(url, { cache: "no-store" });
    if(!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);
    return r.json();
  }

  function makeArcCam(canvas) {
    const cam = new BABYLON.ArcRotateCamera("arc", Math.PI * 1.2, 1.0, 6.5, new BABYLON.Vector3(0, 1.6, 0), scene);
    cam.lowerRadiusLimit = 2.2; cam.upperRadiusLimit = 10; cam.wheelPrecision = 50; cam.panningSensibility = 0; cam.attachControl(canvas, true);
    return cam;
  }

  function buildLights() {
    const h = new BABYLON.HemisphericLight("h", new BABYLON.Vector3(0,1,0), scene);
    h.intensity = 0.9;
  }

  async function loadWorld() {
    if (worldLoaded) return;
    console.log("🌎 Loading world:", WORLD_ROOT + WORLD_FILE);

    const result = await BABYLON.SceneLoader.ImportMeshAsync("", WORLD_ROOT, WORLD_FILE, scene);
    const root = result.meshes[0];
    root.name = "WorldRoot";

    // TV video surface
    const tv = scene.getMeshByName("TV");
    if (tv){
      tvVideoTex = new BABYLON.VideoTexture(
        "tvtex",
        "assets/media/sample-video.mp4",
        scene,
        true,  // generateMipMaps
        true,  // invertY for video
        BABYLON.VideoTexture.TRILINEAR_SAMPLINGMODE,
        { autoPlay:true, loop:true, muted:true }
      );
      const tvMat = new BABYLON.StandardMaterial("tvmat", scene);
      tvMat.emissiveTexture = tvVideoTex;
      tv.material = tvMat;

      tv.actionManager = new BABYLON.ActionManager(scene);
      tv.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, async ()=>{
          try{
            const { url } = await getSignedMedia("unreleased-vid-1","video");
            const vid = tvVideoTex.video;
            const wasPlaying = !vid.paused;
            vid.src = url;
            vid.loop = true;
            if (wasPlaying) vid.play().catch(()=>{});
          } catch {
            alert("Login required to view unreleased video.");
          }
        })
      );
    }

    // Spawn extraction
    const spawnNode =
      scene.getTransformNodeByName("Spawn") ||
      scene.getTransformNodeByName("spawn") ||
      scene.getTransformNodeByName("PlayerStart") ||
      scene.getTransformNodeByName("player_start");

    if (spawnNode) {
      spawnPoint = spawnNode.getAbsolutePosition?.() || spawnNode.position.clone();
      const r = spawnNode.rotationQuaternion
        ? spawnNode.rotationQuaternion.toEulerAngles()
        : (spawnNode.rotation || new BABYLON.Vector3(0,0,0));
      spawnYaw = r.y || 0;
    }

    worldLoaded = true;
    console.log("✅ Bedroom world loaded");

    // If avatar was chosen before the world, re-place it now
    if (chosenAvatarUrl) await replaceAvatar(chosenAvatarUrl);
  }

  async function replaceAvatar(avatarUrl){
    if (!avatarUrl){ console.warn("No avatar URL to load."); return; }
    console.log("🧍 Loading avatar:", avatarUrl);

    if (avatar){ try{ avatar.dispose(); }catch{} avatar = null; }

    try{
      // Let Babylon derive root; avatarUrl may be cross-origin RPM GLB
      const res  = await BABYLON.SceneLoader.ImportMeshAsync("", "", avatarUrl, scene);
      const root = res.meshes[0]; root.name = "AvatarRoot"; avatar = root;

      const bounds = root.getHierarchyBoundingVectors?.();
      if (bounds){
        const height = bounds.max.y - bounds.min.y;
        const s = 1.75 / Math.max(0.01, height);
        root.scaling.set(s,s,s);

        const footLift = -bounds.min.y * s;
        const pos = spawnPoint || BABYLON.Vector3.Zero();
        root.position.set(pos.x, pos.y + footLift, pos.z);
        root.rotation = root.rotation || new BABYLON.Vector3(0,0,0);
        root.rotation.y = spawnYaw || 0;
      }

      const idle = res.animationGroups?.find(a=>/idle/i.test(a.name));
      idle?.start(true);

      console.log("✅ Avatar loaded.");
    } catch(err){
      console.error("❌ Failed to load avatar:", err);
    }
  }

  function buildOutfitBar(products){
    // (stub) — Your existing outfit bar logic hooks here.
    // Keep IDs (#outfit-panel) the same; not changing your UI structure.
  }

  function wireRackPickers(products){
    // (stub) — Hook your clickable “rack” meshes or UI buttons to swap meshes/materials.
  }

  function bindUI(canvas){
    const loadWorldBtn = document.getElementById("world-load");
    loadWorldBtn?.addEventListener("click", async () => {
      if (worldLoaded) return;
      loadWorldBtn.disabled = true;
      loadWorldBtn.textContent = "Loading…";
      try {
        await loadWorld();
        loadWorldBtn.textContent = "World Loaded";
        const modal = document.getElementById("avatar-modal");
        if (modal) modal.style.display = "none";
        document.documentElement.classList.remove("avatar-open"); /* NEW */
      } catch (e) {
        console.error(e);
        alert("Could not load world.");
        loadWorldBtn.disabled = false;
        loadWorldBtn.textContent = "Load World";
      }
    });

    // Camera toggle (example: you already have #view-btn)
    const viewBtn = document.getElementById("view-btn");
    let thirdPerson = true;
    viewBtn?.addEventListener("click", () => {
      thirdPerson = !thirdPerson;
      if (thirdPerson) {
        scene.activeCamera?.dispose?.();
        scene.activeCamera = new BABYLON.ArcRotateCamera("arc", Math.PI * 1.2, 1.0, 6.5, new BABYLON.Vector3(0, 1.6, 0), scene);
        scene.activeCamera.attachControl(canvas, true);
        viewBtn.textContent = "3rd Person";
      } else {
        scene.activeCamera?.dispose?.();
        const cam = new BABYLON.UniversalCamera("fps", new BABYLON.Vector3(spawnPoint.x, spawnPoint.y + 1.7, spawnPoint.z - 2), scene);
        cam.minZ = 0.05; cam.speed = 0.35; cam.inertia = 0.7; cam.angularSensibility = 5000;
        cam.applyGravity = true; cam.checkCollisions = true; cam.ellipsoid = new BABYLON.Vector3(0.35, 0.9, 0.35);
        cam.attachControl(canvas, true);
        scene.activeCamera = cam;
        viewBtn.textContent = "1st Person";
      }
    });
  }

  async function init(){
    try{
      console.log("🚀 Initializing...");
      const avatarUrl = await window.DHKAuth.requireAuthAndAvatar(); // waits for login + choose avatar
      chosenAvatarUrl = avatarUrl || "";

      const canvas = document.getElementById("renderCanvas");
      engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer:true, stencil:true });
      scene  = new BABYLON.Scene(engine);
      scene.ambientColor = new BABYLON.Color3(0.1,0.1,0.12);
      scene.collisionsEnabled = true;
      scene.gravity = new BABYLON.Vector3(0,-0.5,0);

      scene.activeCamera = makeArcCam(canvas);
      buildLights();

      // Show the avatar immediately (will be re-placed after the world loads)
      if (chosenAvatarUrl) { await replaceAvatar(chosenAvatarUrl); }

      // Products bar (optional)
      try{
        const products = await fetchJSON(DATA_URL);
        buildOutfitBar(products);
        wireRackPickers(products);
      } catch (err){ console.warn("Products failed to load:", err); }

      bindUI(canvas);

      // Render loop
      engine.runRenderLoop(() => scene.render());
      window.addEventListener("resize", () => engine.resize());
    } catch (err) {
      console.error("❌ init() failed:", err);
    }
  }

  // When an avatar is selected after init, remember & prep world button
  window.addEventListener("dhk:avatar-selected", (e) => {
    const url = e.detail?.url;
    if (!url) return;
    chosenAvatarUrl = url;
    document.getElementById("world-load")?.removeAttribute("disabled");
    if (worldLoaded) replaceAvatar(url);
  });

  document.addEventListener("DOMContentLoaded", init);
})();