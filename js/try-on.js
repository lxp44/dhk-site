// js/try-on.js
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

  function getIdentity(){ return typeof netlifyIdentity !== "undefined" ? netlifyIdentity : null; }
  function currentUser(){ const id = getIdentity(); return id ? id.currentUser() : null; }

  async function getSignedMedia(id, type){
    const user = currentUser();
    if (!user) throw new Error("Login required");
    const token = await user.jwt();
    const res = await fetch(`/.netlify/functions/get-signed-media?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type||"")}`, { headers: { Authorization: `Bearer ${token}` }});
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async function fetchJSON(url){ const r = await fetch(url, { cache: "no-store" }); if(!r.ok) throw new Error(`HTTP ${r.status} on ${url}`); return r.json(); }

  function makeArcCam(canvas) {
    const cam = new BABYLON.ArcRotateCamera("arc", Math.PI * 1.2, 1.0, 6.5, new BABYLON.Vector3(0, 1.6, 0), scene);
    cam.lowerRadiusLimit = 2.2; cam.upperRadiusLimit = 10; cam.wheelPrecision = 50; cam.panningSensibility = 0; cam.attachControl(canvas, true);
    return cam;
  }
  function makeFPSCam(canvas) {
    const cam = new BABYLON.UniversalCamera("fps", new BABYLON.Vector3(0, 1.7, -2), scene);
    cam.minZ = 0.05; cam.speed = 0.35; cam.inertia = 0.7; cam.angularSensibility = 5000; cam.attachControl(canvas, true);
    cam.applyGravity = true; cam.checkCollisions = true; cam.ellipsoid = new BABYLON.Vector3(0.35, 0.9, 0.35);
    cam.keysUp = [87, 38]; cam.keysDown = [83, 40]; cam.keysLeft = [65, 37]; cam.keysRight = [68, 39];
    return cam;
  }

    // Load world only when the user taps "Load World"
  async function loadWorld() {
    if (worldLoaded) return;
    console.log("🌎 Loading world:", WORLD_URL);
    const result = await BABYLON.SceneLoader.ImportMeshAsync("", "", WORLD_URL, scene);
    const root = result.meshes[0];
    root.name = "WorldRoot";
  
  const tv = scene.getMeshByName("TV");
    if (tv){
      tvVideoTex = new BABYLON.VideoTexture("tvtex","assets/media/sample-video.mp4",scene,true,true,BABYLON.VideoTexture.TRILINEAR_SAMPLINGMODE,{autoPlay:true,loop:true,muted:true});
      const tvMat = new BABYLON.StandardMaterial("tvmat",scene); tvMat.emissiveTexture=tvVideoTex; tv.material=tvMat;
      tv.actionManager = new BABYLON.ActionManager(scene);
      tv.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, async ()=>{
        try{
          const { url } = await getSignedMedia("unreleased-vid-1","video");
          const vid = tvVideoTex.video; const wasPlaying = !vid.paused;
          vid.src = url; vid.loop = true; if (wasPlaying) vid.play().catch(()=>{});
        } catch { alert("Login required to view unreleased video."); }
      }));
    }
    
    // capture spawn if present
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
    if (chosenAvatarUrl) await replaceAvatar(chosenAvatarUrl);
  }

  async function replaceAvatar(avatarUrl){
    if (!avatarUrl){ console.warn("No avatar URL to load."); return; }
    console.log("🧍 Loading avatar:", avatarUrl);

    if (avatar){ try{ avatar.dispose(); }catch{} avatar = null; }

    try{
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
      const idle = res.animationGroups?.find(a=>/idle/i.test(a.name)); idle?.start(true);
      console.log("✅ Avatar loaded.");
    } catch(err){
      console.error("❌ Failed to load avatar:", err);
    }
  }

  async function loadWorldOnce(){ if (worldLoaded) return true; await loadWorld(); return true; }
  window.DHKWorld = { loadWorldOnce };

 …

  // On avatar selected, remember it and enable "Load World"
  window.addEventListener("dhk:avatar-selected", (e) => {
    const url = e.detail?.url;
    if (!url) return;
    chosenAvatarUrl = url;
    document.getElementById("world-load")?.removeAttribute("disabled");
    // If the world is already up (user picked late), load it now:
    if (worldLoaded) replaceAvatar(url);
  });

  async function init() {
    try {
      console.log("🚀 Initializing...");
      const avatarUrl = await window.DHKAuth.requireAuthAndAvatar(); // waits for user choice
      chosenAvatarUrl = avatarUrl || "";

      const canvas = document.getElementById("renderCanvas");
      engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer:true, stencil:true });
      scene  = new BABYLON.Scene(engine);
      scene.activeCamera = makeArcCam(canvas);
      new BABYLON.HemisphericLight("h", new BABYLON.Vector3(0,1,0), scene).intensity = 0.9;

      // show avatar immediately if already selected; it will be re-placed after the world loads
      if (chosenAvatarUrl) { await replaceAvatar(chosenAvatarUrl); }

      bindUI(canvas);
      engine.runRenderLoop(() => scene.render());
      window.addEventListener("resize", () => engine.resize());
    } catch (err) {
      console.error("❌ init() failed:", err);
    }
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
      new BABYLON.HemisphericLight("h", new BABYLON.Vector3(0,1,0), scene).intensity = 0.9;
// 👉 show the avatar immediately (before the world), then we'll re-place it after world loads
if (chosenAvatarUrl) { await replaceAvatar(chosenAvatarUrl); }
      try{
        const products = await fetchJSON(DATA_URL);
        buildOutfitBar(products);
        wireRackPickers(products);
      } catch (err){ console.warn("Products failed to load:", err); }

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
      } catch (e) {
        console.error(e);
        alert("Could not load world.");
        loadWorldBtn.disabled = false;
        loadWorldBtn.textContent = "Load World";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();