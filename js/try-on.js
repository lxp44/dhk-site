// js/try-on.js
(() => {
  const DATA_URL   = "data/products.json";
  const CLOSET_URL = "assets/3d/closet.glb";     // mansion closet scene (exported GLB)

  // Public fallback tracks (play for guests / if gate fails)
  const START_MUSIC = [
    "assets/media/music/track1.mp3",
    "assets/media/music/track2.mp3"
  ];

  // IDs your Netlify function recognizes for gated media
  const GATED_AUDIO_ID = "jukebox-1";     // 🔒 unreleased song id
  const GATED_VIDEO_ID = "unreleased-vid-1"; // 🔒 unreleased video id

  let engine, scene, camera, avatar, isFirstPerson = false, music, currentTrack = 0;
  let tvVideoTex = null;

  // ---------- Auth / Signed Media ----------
  function getIdentity() {
    // netlify-identity-widget should be loaded in the page head
    return (typeof netlifyIdentity !== "undefined") ? netlifyIdentity : null;
  }
  function currentUser() {
    const id = getIdentity();
    return id ? id.currentUser() : null;
  }

  async function getSignedMedia(id, type) {
    const user = currentUser();
    if (!user) throw new Error("Login required");
    const token = await user.jwt(); // Netlify Identity JWT

    const res = await fetch(
      "/.netlify/functions/get-signed-media?id=" + encodeURIComponent(id) +
      "&type=" + encodeURIComponent(type || ""),
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // { url, expiresAt, id, type }
  }

  // ---------- Utils ----------
  async function fetchJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);
    return r.json();
  }

  function makeArcCam(canvas) {
    const cam = new BABYLON.ArcRotateCamera(
      "cam",
      Math.PI * 1.2,
      1.0,
      6.5,
      new BABYLON.Vector3(0, 1.6, 0),
      scene
    );
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
    return cam;
  }

  async function loadCloset() {
    const result = await BABYLON.SceneLoader.ImportMeshAsync("", "", CLOSET_URL, scene);
    const root = result.meshes[0];
    root.scaling = new BABYLON.Vector3(1,1,1);

    scene.createDefaultEnvironment({ createSkybox: false, createGround: false });

    // Mirror plane support (if your GLB includes a mesh named "Mirror")
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

    // TV Screen (mesh named "TV") -> start with public loop, allow gated swap on click
    const tv = scene.getMeshByName("TV");
    if (tv) {
      tvVideoTex = new BABYLON.VideoTexture(
        "tvtex",
        "assets/media/sample-video.mp4", // public fallback
        scene,
        true,
        true,
        BABYLON.VideoTexture.TRILINEAR_SAMPLINGMODE,
        { autoPlay: true, loop: true, muted: true }
      );
      const tvMat = new BABYLON.StandardMaterial("tvmat", scene);
      tvMat.emissiveTexture = tvVideoTex;
      tv.material = tvMat;

      // Click TV to attempt loading gated unreleased video for logged-in users
      tv.actionManager = new BABYLON.ActionManager(scene);
      tv.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnPickTrigger,
        async () => {
          try {
            const { url } = await getSignedMedia(GATED_VIDEO_ID, "video");
            // swap the source (keep loop/mute)
            const vid = tvVideoTex.video;
            const wasPlaying = !vid.paused;
            vid.src = url;
            vid.loop = true;
            // preserve muted to avoid autoplay issues; user can unmute in your UI if you add controls
            if (wasPlaying) vid.play().catch(() => {});
          } catch (err) {
            console.warn("TV gated video error:", err);
            // brief on-screen hint (optional)
            BABYLON.GUI && alert("Login required to view unreleased video.");
          }
        }
      ));
    }
  }

  // Load avatar (use your pre-made GLB)
  async function loadAvatar() {
    const res = await BABYLON.SceneLoader.ImportMeshAsync("", "", "assets/3d/avatars/dhk_base.glb", scene);
    const root = res.meshes[0];
    root.name = "AvatarRoot";
    root.position = new BABYLON.Vector3(0, 0, 0);
    avatar = root;
    const idle = res.animationGroups?.find(a => /idle/i.test(a.name));
    idle?.start(true);
  }

  // Attach clothing: load garment GLB and parent to avatar bone
  async function wearGarment(garmentPath) {
    if (!avatar) return;

    const res = await BABYLON.SceneLoader.ImportMeshAsync("", "", garmentPath, scene);
    const gRoot = res.meshes[0];
    gRoot.name = `Garment-${Date.now()}`;

    // If garment is skinned: skeleton should bind correctly.
    // Otherwise, parent to torso/spine.
    const torso = avatar.getChildren((n) => n.name.toLowerCase().includes("spine"))[0] || avatar;
    gRoot.setParent(torso);

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
      const path = `assets/3d/clothes/${id}.glb`; // convention: product id => GLB path
      try {
        await wearGarment(path);
      } catch (err) {
        console.error('Wear failed:', err);
        alert('Garment not available yet.');
      }
    });
  }

  function bindUI(canvas) {
    const viewBtn  = document.getElementById('view-btn');
    const musicBtn = document.getElementById('music-btn');
    const nextBtn  = document.getElementById('music-next'); // optional next-track button if you add one

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

  // Add near START_MUSIC: the private (unreleased) R2 key
const UNRELEASED_KEY = "music/unreleased/your-track-slug.mp3";

// In bindUI(canvas) where you handle the music button:
musicBtn?.addEventListener('click', async () => {
  try {
    if (!music) {
      // Try to fetch a signed URL for the unreleased track
      let src = START_MUSIC[currentTrack]; // fallback (public)
      try {
        const { url } = await getSignedMedia(UNRELEASED_KEY, "audio");
        src = url; // use signed URL if identity + function succeed
      } catch (e) {
        console.warn("Falling back to public track:", e?.message || e);
      }

      music = new BABYLON.Sound("jukebox", src, scene, null, {
        loop: true, autoplay: true, volume: 0.6
      });
      musicBtn.textContent = "Pause Music";
    } else if (music.isPlaying) {
      music.pause(); musicBtn.textContent = "Play Music";
    } else {
      music.play(); musicBtn.textContent = "Pause Music";
    }
  } catch (err) {
    console.error("Music error:", err);
    alert("Could not start the jukebox yet.");
  }
});

    // Optional: cycle public tracks
    nextBtn?.addEventListener('click', () => {
      if (!START_MUSIC.length) return;
      currentTrack = (currentTrack + 1) % START_MUSIC.length;
      const nextSrc = START_MUSIC[currentTrack];
      if (!music) {
        music = new BABYLON.Sound("jukebox", nextSrc, scene, null, { loop: true, autoplay: true, volume: .6 });
      } else {
        music.stop();
        music.dispose();
        music = new BABYLON.Sound("jukebox", nextSrc, scene, null, { loop: true, autoplay: true, volume: .6 });
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
