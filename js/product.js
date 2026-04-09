// js/product.js
// Render product.html from data/products.json using ?handle=<id> or ?id=<id>

(() => {
  // ---- Money (cents -> $X.XX)
  const PRICE = (cents) =>
    (Number(cents || 0) / 100).toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
    });

  // === GLOBAL SALE CONFIG (40% OFF ALL ITEMS) ===
  const SALE_ACTIVE = false; // turn sale on/off
  const SALE_PERCENT = 40;   // 40% OFF all items

  function applySale(cents) {
    if (!SALE_ACTIVE) return Number(cents || 0);
    return Math.round(Number(cents || 0) * (1 - SALE_PERCENT / 100));
  }

  // ---- Accept both ?handle=... and ?id=...
  function getHandle() {
    const p = new URLSearchParams(location.search);
    return p.get("handle") || p.get("id");
  }

  // ---- Accept either an array or { products: [...] }
  function normalizeProducts(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.products)) return data.products;
    return [];
  }

  // Force fresh products.json each load
  async function loadProducts() {
    const res = await fetch("data/products.json?ts=" + Date.now(), {
      cache: "no-cache",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    return normalizeProducts(raw);
  }

  // =========================
  // ✅ BATS BACKGROUND (AUTO)
  // =========================
  const BATS_SRC = "assets/video/bat.mp4";

  function safePlay(video) {
    try {
      const p = video.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }

  function absolutizeSrc(src) {
    if (!src) return src;
    if (/^(https?:)?\/\//i.test(src)) return src;
    if (src.startsWith("/")) return src;
    return "./" + src.replace(/^\.\//, "");
  }

  function forceVideoAttrs(video) {
    if (!video.classList.contains("bats-bg")) video.classList.add("bats-bg");

    try {
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;

      video.setAttribute("muted", "");
      video.setAttribute("loop", "");
      video.setAttribute("autoplay", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.setAttribute("disablepictureinpicture", "");
      video.setAttribute(
        "controlslist",
        "nodownload noplaybackrate noremoteplayback"
      );

      video.preload = "metadata";
      video.setAttribute("preload", "metadata");
      video.style.pointerEvents = "none";
    } catch (e) {}
  }

  function buildBatsVideo() {
    const v = document.createElement("video");
    v.className = "bats-bg";
    forceVideoAttrs(v);

    const s = document.createElement("source");
    s.src = absolutizeSrc(BATS_SRC);
    s.type = "video/mp4";
    v.appendChild(s);

    return v;
  }

  function ensureBatsBackground(descEl) {
    if (!descEl) return null;

    let layer = descEl.querySelector(".bats-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "bats-layer";
      descEl.insertBefore(layer, descEl.firstChild);
    }

    let v = descEl.querySelector("video.bats-bg") || layer.querySelector("video.bats-bg");
    if (v) {
      forceVideoAttrs(v);

      const source = v.querySelector("source");
      if (source?.getAttribute("src")) {
        source.setAttribute("src", absolutizeSrc(source.getAttribute("src")));
      } else if (v.getAttribute("src")) {
        v.setAttribute("src", absolutizeSrc(v.getAttribute("src")));
      }

      if (v.parentElement !== layer) layer.appendChild(v);

      try { v.load(); } catch (e) {}
      return v;
    }

    v = buildBatsVideo();
    layer.appendChild(v);
    try { v.load(); } catch (e) {}
    return v;
  }

  function hydrateBats(descEl) {
    const v = ensureBatsBackground(descEl);
    if (!v) return;

    const tryPlay = () => safePlay(v);

    tryPlay();
    setTimeout(tryPlay, 150);
    setTimeout(tryPlay, 600);
    setTimeout(tryPlay, 1400);

    v.addEventListener("loadedmetadata", tryPlay, { once: true });
    v.addEventListener("canplay", tryPlay, { once: true });

    v.addEventListener(
      "error",
      () => {
        const src =
          v.getAttribute("src") ||
          v.querySelector("source")?.getAttribute("src") ||
          "(no src)";
        console.warn("[BATS] video error for:", src, v.error);
      },
      { once: true }
    );

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") tryPlay();
    });

    if ("IntersectionObserver" in window && descEl) {
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            tryPlay();
            io.disconnect();
          }
        },
        { threshold: 0.15 }
      );
      io.observe(descEl);
    }

    const gesture = () => {
      tryPlay();
      window.removeEventListener("pointerdown", gesture);
      window.removeEventListener("touchstart", gesture);
      window.removeEventListener("click", gesture);
      window.removeEventListener("keydown", gesture);
      window.removeEventListener("scroll", gesture);
    };
    window.addEventListener("pointerdown", gesture, { once: true, passive: true });
    window.addEventListener("touchstart", gesture, { once: true, passive: true });
    window.addEventListener("click", gesture, { once: true });
    window.addEventListener("keydown", gesture, { once: true });
    window.addEventListener("scroll", gesture, { once: true, passive: true });
  }

  function render(root, p) {
    const hasOptions = Array.isArray(p.options) && p.options.length > 0;
    const imgs = Array.isArray(p.images) ? p.images : [];
    const firstImg = imgs.length ? imgs[0] : "";

    const originalPriceCents = Number(p.price) || 0;
    const salePriceCents = applySale(originalPriceCents);

    const showSale = SALE_ACTIVE && salePriceCents !== originalPriceCents;
    const priceHtml = showSale
      ? `
        <span class="price-original" style="opacity:.55;text-decoration:line-through;margin-right:6px;">
          ${PRICE(originalPriceCents)}
        </span>
        <span class="price-sale">
          ${PRICE(salePriceCents)}
        </span>
      `
      : `
        <span class="price-regular">
          ${PRICE(originalPriceCents)}
        </span>
      `;

    root.innerHTML = `
      <article class="product-detail fog-layout">
        <div class="fog-gallery">
          ${
            imgs.length
              ? imgs
                  .map(
                    (src, i) => `
                <div class="fog-image-wrap">
                  <img
                    src="${src}"
                    alt="${p.title} image ${i + 1}"
                    loading="${i === 0 ? "eager" : "lazy"}"
                    class="fog-image"
                  >
                </div>
              `
                  )
                  .join("")
              : `
              <div class="fog-image-wrap">
                <div style="height:600px;background:#111;border-radius:12px;"></div>
              </div>
            `
          }
        </div>

        <div class="fog-info">
          <h1 class="pd__title">${p.title}</h1>

          <div class="pd__price">
            ${priceHtml}
          </div>

          ${
            hasOptions
              ? `
            <label class="pd__opt-label">
              Size
              <select id="pd-option" class="pd__select" aria-label="Choose size">
                ${p.options.map((o) => `<option value="${o}">${o}</option>`).join("")}
              </select>
            </label>
          `
              : ""
          }

          <button id="add-to-cart" class="button button--secondary" data-id="${p.id}" type="button">
            Add to cart
          </button>

          <div id="pd-desc" class="pd__desc"></div>
        </div>
      </article>
    `;

    const descEl = root.querySelector("#pd-desc");
    if (descEl) {
      const html =
        typeof p.description === "string" && p.description.trim().length
          ? p.description
          : "<p style='opacity:.8'>No description available.</p>";

      descEl.innerHTML = html;
      hydrateBats(descEl);
    }

    const priceForCart = showSale ? salePriceCents : originalPriceCents;

    root.querySelector("#add-to-cart")?.addEventListener("click", () => {
      const sizeSel = root.querySelector("#pd-option");
      const variant = sizeSel ? sizeSel.value : null;

      window.Cart?.add(
        {
          id: p.id,
          title: p.title,
          priceCents: priceForCart,
          thumbnail: p.thumbnail || firstImg || "",
          variant,
          url: `product.html?id=${p.id}`,
          stripePriceId: p.stripePriceId || null,
        },
        { open: true }
      );
    });
  }

  // ---- Boot
  document.addEventListener("DOMContentLoaded", async () => {
    const root = document.getElementById("product-root");
    if (!root) return;

    const handle = getHandle();
    if (!handle) {
      root.innerHTML = '<p style="color:#ccc">Product not found.</p>';
      return;
    }

    try {
      const products = await loadProducts();
      const p = products.find((x) => x.id === handle || x.handle === handle);
      if (!p) {
        root.innerHTML = '<p style="color:#ccc">Product not found.</p>';
        return;
      }
      render(root, p);
    } catch (e) {
      console.error("Error loading product:", e);
      root.innerHTML = '<p style="color:#ccc">Error loading product.</p>';
    }
  });
})();
