(() => {
  const WORLD_URL = "assets/3d/bedroom.glb";

  let engine, scene, avatar, worldLoaded = false;
  let chosenAvatarUrl = "";

  // Ready Player Me setup
  window.addEventListener("message", (event) => {
    if (!event.data || !event.data.source || event.data.source !== "readyplayerme") return;

    if (event.data.eventName === "v1.avatar.exported") {
      const avatarUrl = event.data.data?.url;
      if (avatarUrl && avatarUrl.endsWith(".glb")) {
        console.log("🎯 Avatar exported:", avatarUrl);
        localStorage.setItem("dhk_avatar_url", avatarUrl);
        chosenAvatarUrl = avatarUrl;
        document.getElementById("world-load")?.removeAttribute("disabled");
        document.getElementById("avatar-modal").style.display = "none";
      } else {
        alert("Avatar failed to load. Make sure you used the Ready Player Me export link (ending in .glb).");
      }
    }
  });

  async function loadWorld() {
    console.log("🌎 Loading world:", WORLD_URL);
    await BABYLON.SceneLoader.AppendAsync("", WORLD_URL, scene);
    worldLoaded = true;
    console.log("✅ World loaded.");
    if (chosenAvatarUrl) await loadAvatar(chosenAvatarUrl);
  }

  async function loadAvatar(url) {
    try {
      console.log("🧍 Loading avatar:", url);
      const result = await BABYLON.SceneLoader.ImportMeshAsync("", "", url, scene);
      const root = result.meshes[0];
      root.scaling.setAll(1.6);
      root.position.set(0, 0, 0);
      avatar = root;
      console.log("✅ Avatar loaded successfully.");
    } catch (e) {
      console.error("❌ Failed to load avatar:", e);
      alert("Avatar failed to load. Make sure the URL is a valid Ready Player Me .glb file.");
    }
  }

  function bindUI(canvas) {
    const modal = document.getElementById("avatar-modal");
    const iframe = document.getElementById("rpm-iframe");

    document.getElementById("avatar-create").addEventListener("click", () => {
      modal.style.display = "flex";
      iframe.src = "https://readyplayer.me/avatar?frameApi";
    });

    document.getElementById("avatar-load").addEventListener("click", () => {
      const saved = localStorage.getItem("dhk_avatar_url");
      if (saved && saved.endsWith(".glb")) {
        chosenAvatarUrl = saved;
        document.getElementById("world-load")?.removeAttribute("disabled");
        alert("Loaded your saved avatar!");
      } else {
        alert("No saved avatar found. Please create one first.");
      }
    });

    document.getElementById("world-load").addEventListener("click", async () => {
      if (!worldLoaded) await loadWorld();
      if (chosenAvatarUrl) await loadAvatar(chosenAvatarUrl);
    });
  }

  function init() {
    const canvas = document.getElementById("renderCanvas");
    engine = new BABYLON.Engine(canvas, true);
    scene = new BABYLON.Scene(engine);
    scene.createDefaultCameraOrLight(true, true, true);

    bindUI(canvas);
    engine.runRenderLoop(() => scene.render());
    window.addEventListener("resize", () => engine.resize());
  }

  document.addEventListener("DOMContentLoaded", init);
})();