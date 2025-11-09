(() => {
  const modal = document.getElementById("avatar-modal");
  const authGate = document.getElementById("auth-gate");
  const rpmWrap = document.getElementById("rpm-wrap");
  const rpmFrame = document.getElementById("rpm-iframe");
  const urlWrap = document.getElementById("url-wrap");
  const urlInput = document.getElementById("avatar-url-input");

  function showModal(show) {
    modal.style.display = show ? "flex" : "none";
  }

  // Save avatar URL to localStorage + identity metadata
  async function saveAvatarUrlToIdentity(url) {
    const user = netlifyIdentity.currentUser();
    if (user) {
      await user.update({ data: { avatarUrl: url } });
    }
    localStorage.setItem("dhk_avatar_url", url);
    return url;
  }

  // Announce avatar selection to try-on.js
  function announceAvatar(url) {
    const evt = new CustomEvent("dhk:avatar-selected", { detail: { url } });
    window.dispatchEvent(evt);
    showModal(true);
  }

  // Receive avatar from Ready Player Me
  window.addEventListener("message", async (e) => {
    let data = e.data;
    if (typeof data === "string") try { data = JSON.parse(data); } catch {}
    if (!data || data.source !== "readyplayer.me") return;
    if (data.eventName === "v1.avatar.exported" && data.data?.url) {
      const url = data.data.url;
      await saveAvatarUrlToIdentity(url);
      announceAvatar(url);
    }
  });

  // Manual save flow
  document.getElementById("avatar-url-save")?.addEventListener("click", async () => {
    const val = (urlInput?.value || "").trim();
    if (!val) return alert("Paste a valid URL.");
    const final = await saveAvatarUrlToIdentity(val);
    announceAvatar(final);
  });

  document.getElementById("avatar-cancel")?.addEventListener("click", () => showModal(false));

  // Avatar create/load buttons
  document.getElementById("avatar-create")?.addEventListener("click", () => {
    rpmFrame.src = "https://demo.readyplayer.me/avatar?frameApi";
    rpmWrap.style.display = "block";
    urlWrap.style.display = "none";
    showModal(true);
  });

  document.getElementById("avatar-load")?.addEventListener("click", async () => {
    const saved = localStorage.getItem("dhk_avatar_url");
    if (saved) return announceAvatar(saved);
    alert("No saved avatar found. Create one first.");
  });

  // Wait for identity-ready from try-on.html
  document.addEventListener("dhk:identity-ready", (e) => {
    const user = e.detail?.user || netlifyIdentity.currentUser();
    if (!user) return netlifyIdentity.open("login");

    const url = user.user_metadata?.avatarUrl || localStorage.getItem("dhk_avatar_url");
    if (url) announceAvatar(url);
    else showModal(true);

    authGate.style.display = "none";
  });

  // Expose helper for try-on.js
  window.DHKAuth = {
    requireAuthAndAvatar: async function () {
      return new Promise((resolve) => {
        const user = netlifyIdentity.currentUser();
        if (user) {
          const url = user.user_metadata?.avatarUrl || localStorage.getItem("dhk_avatar_url");
          if (url) return resolve(url);
        }
        document.addEventListener("dhk:avatar-selected", (e) => resolve(e.detail?.url));
        showModal(true);
      });
    },
  };
})();