// js/try-on.js
(() => {
  const DATA_URL = "data/products.json";
  const CLOSET_URL = "assets/3d/closet.glb";     // mansion closet scene (you/your 3D artist export as GLB)
  const START_MUSIC = [
    // public tracks first; we’ll gate unreleased later
    "assets/media/music/track1.mp3",
    "assets/media/music/track2.mp3"
  ];

  let engine, scene, camera, avatar, isFirstPerson = false, music, currentTrack = 0;

  // Utils
  async function fetchJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);
    return r.json();
  }

  function makeArcCam(canvas) {
    const cam = new BABYLON.ArcRotateCamera("cam",
      Math.PI * 1.2, 1.0, 6.5, new BABYLON.Vector3(0, 1.6, 0), scene);
    cam.lowerRadiusLimit = 2.2; cam.upperRadiusLimit = 10; cam.wheelPrecision = 50;
    cam.panningSensibility = 0;
    cam.attachControl(canvas, true);
    return cam;
  }

  function makeFPSCam(canvas) {
    const cam = new BABYLON.UniversalCamera("fps", new BABYLON.Vector3(0, 1.7, -2), scene);
    cam.minZ = 0.05; cam.speed = 0.35; cam.inertia = 0.7; cam.angularSensibility = 5000;
    cam.attachControl(canvas, true);
    return cam;
  }

  async function loadCloset() {
    const result = await BABYLON.SceneLoader.ImportMeshAsync("", "", CLOSET_URL, scene);
    const root = result.meshes[0];
    root.scaling = new BABYLON.Vector3(1,1,1);

    // Simple environment + mirror (full-length)
    scene.createDefaultEnvironment({
      createSkybox: false,
      createGround: false
    });

    // If your GLB includes a plane named "Mirror", make it reflective:
    const mirror = scene.getMeshByName("Mirror");
    if (mirror) {
      const mat = new BABYLON.StandardMaterial("mirrorMat", scene);
      const rt = new BABYLON.MirrorTexture("mirrorTex", 1024, scene, true);
      rt.mirrorPlane = new BABYLON.Plane(0, 0, -1, -mirror.position.z);
      rt.renderList = scene.meshes; // include avatar when loaded
      mat.reflectionTexture = rt;
      mat.reflectionTexture.level = 0.8;
      mat.diffuseColor = new BABYLON.Color3(0.02,0.02,0.02);
      mirror.material = mat;
    }

    // TV Screen (named "TV") with video texture
    const tv = scene.getMeshByName("TV");
    if (tv) {
      const videoTex = new BABYLON.VideoTexture(
        "tvtex",
        "assets/media/sample-video.mp4",
        scene, true, true, BABYLON.VideoTexture.TRILINEAR_SAMPLINGMODE,
        { autoPlay: true, loop: true, muted: true }
      );
      const tvMat = new BABYLON.StandardMaterial("tvmat", scene);
      tvMat.emissiveTexture = videoTex;
      tv.material = tvMat;
    }
  }

  // Load avatar (Ready Player Me quick path: use a pre-made GLB for now)
  async function loadAvatar() {
    // Option A: your own GLB (stable)
    const res = await BABYLON.SceneLoader.ImportMeshAsync("", "", "assets/3d/avatars/dhk_base.glb", scene);
    const root = res.meshes[0];
    root.name = "AvatarRoot";
    root.position = new BABYLON.Vector3(0, 0, 0);
    avatar = root;
    // Optional idle anim if present
    const idle = res.animationGroups?.find(a => /idle/i.test(a.name));
    idle?.start(true);
  }

  // Attach clothing: load garment GLB and parent to avatar bone
  async function wearGarment(garmentPath) {
    if (!avatar) return;

    const res = await BABYLON.SceneLoader.ImportMeshAsync("", "", garmentPath, scene);
    const gRoot = res.meshes[0];
    gRoot.name = `Garment-${Date.now()}`;

    // If garment is skinned, it will include a skeleton matching avatar’s bindpose; otherwise parent to torso
    const torso = avatar.getChildren((n) => n.name.toLowerCase().includes("spine"))[0] || avatar;
    gRoot.setParent(torso);

    // Basic fit tweaks (tune per garment authoring)
    gRoot.position = BABYLON.Vector3.Zero();
    gRoot.scaling = new BABYLON.Vector3(1,1,1);
  }

  function buildOutfitBar(products) {
    const panel = document.getElementById('outfit-panel');
    if (!panel) return;
    const wearable = products.filter(p => p.images && p.images.length);

    panel.innerHTML = wearable.map(p => `
      <button class="btn" data-id="${p.id}" title="${p.title}">
        ${p.title.replace('The Dark Harlem ','')}
      </button>
    `).join("");

    panel.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-id]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      // Convention: garment GLB path matches product id
      const path = `assets/3d/clothes/${id}.glb`;
      try { await wearGarment(path); }
      catch (err) { console.error('Wear failed:', err); alert('Garment not available yet.'); }
    });
  }

  function bindUI(canvas) {
    const viewBtn = document.getElementById('view-btn');
    const musicBtn = document.getElementById('music-btn');

    viewBtn?.addEventListener('click', () => {
      isFirstPerson = !isFirstPerson;
      const active = scene.activeCamera;
      active?.detachControl(canvas);

      if (isFirstPerson) {
        scene.activeCamera = makeFPSCam(canvas);
        viewBtn.textContent = "1st Person";
      } else {
        scene.activeCamera = makeArcCam(canvas);
        viewBtn.textContent = "3rd Person";
      }
    });

    musicBtn?.addEventListener('click', () => {
      if (!music) {
        music = new BABYLON.Sound("jukebox", START_MUSIC[currentTrack], scene, null, {
          loop: true, autoplay: true, volume: .6
        });
        musicBtn.textContent = "Pause Music";
      } else if (music.isPlaying) {
        music.pause(); musicBtn.textContent = "Play Music";
      } else {
        music.play(); musicBtn.textContent = "Pause Music";
      }
    });

    // Keyboard quick toggle
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'v') viewBtn?.click();
    });
  }

  async function init() {
    const canvas = document.getElementById("renderCanvas");
    engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, disableWebGL2Support: false });
    scene = new BABYLON.Scene(engine);
    scene.ambientColor = new BABYLON.Color3(0.1,0.1,0.12);

    // Camera + light
    scene.activeCamera = makeArcCam(canvas);
    const light = new BABYLON.HemisphericLight("h", new BABYLON.Vector3(0,1,0), scene);
    light.intensity = 0.9;

    await loadCloset();
    await loadAvatar();

    // Build outfit buttons from your catalog
    const products = await fetchJSON(DATA_URL);
    buildOutfitBar(products);

    bindUI(canvas);

    engine.runRenderLoop(() => scene.render());
    window.addEventListener("resize", () => engine.resize());
  }

  document.addEventListener('DOMContentLoaded', init);
})();