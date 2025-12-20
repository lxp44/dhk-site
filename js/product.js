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

  // ---------- BATS HELPERS ----------
  function safePlay(video) {
    try {
      const p = video.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }

  function forceVideoAttrs(video) {
    // Make sure your CSS can target it
    if (!video.classList.contains("bats-bg")) video.classList.add("bats-bg");

    // Autoplay-safe / iOS-safe attributes
    try {
      video.muted = true;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;

      video.setAttribute("muted", "");
      video.setAttribute("loop", "");
      video.setAttribute("autoplay", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");

      // Extra “don’t hijack playback UI” flags (helps iOS / Safari quirks)
      video.setAttribute("disablepictureinpicture", "");
      video.setAttribute(
        "controlslist",
        "nodownload noplaybackrate noremoteplayback"
      );

      // Safer preload (preload="auto" can be throttled hard on mobile)
      video.preload = "metadata";
      video.setAttribute("preload", "metadata");
    } catch (e) {}
  }

  // ---- Ensure bats video works (desktop + iOS) ----
  function hydrateBats(descEl) {
    if (!descEl) return;

    const vids = descEl.querySelectorAll("video");
    if (!vids.length) return;

    vids.forEach((v) => {
      forceVideoAttrs(v);

      // Force media pipeline to refresh after we change attrs
      try { v.load(); } catch (e) {}

      // Try immediately
      safePlay(v);

      // Try again when metadata is ready
      v.addEventListener(
        "loadedmetadata",
        () => safePlay(v),
        { once: true }
      );

      // Try again when it can actually play
      v.addEventListener(
        "canplay",
        () => safePlay(v),
        { once: true }
      );
    });

    // Retry shortly after (helps when browser delays media init)
    setTimeout(() => {
      descEl.querySelectorAll("video.bats-bg").forEach((v) => safePlay(v));
    }, 250);

    // Retry again a bit later (desktop Safari can be stubborn)
    setTimeout(() => {
      descEl.querySelectorAll("video.bats-bg").forEach((v) => safePlay(v));
    }, 900);

    // If tab becomes visible again, retry
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        descEl.querySelectorAll("video.bats-bg").forEach((v) => safePlay(v));
      }
    });

    // Start playing as soon as the description is on-screen
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              descEl.querySelectorAll("video.bats-bg").forEach((v) => safePlay(v));
              io.disconnect();
            }
          });
        },
        { threshold: 0.15 }
      );
      io.observe(descEl);
    }

    // One user gesture fallback (covers iOS)
    const gesture = () => {
      descEl.querySelectorAll("video.bats-bg").forEach((v) => safePlay(v));
      window.removeEventListener("pointerdown", gesture);
      window.removeEventListener("touchstart", gesture);
      window.removeEventListener("click", gesture);
    };
    window.addEventListener("pointerdown", gesture, { once: true, passive: true });
    window.addEventListener("touchstart", gesture, { once: true, passive: true });
    window.addEventListener("click", gesture, { once: true });
  }

  function render(root, p) {
    const hasOptions = Array.isArray(p.options) && p.options.length > 0;
    const imgs = Array.isArray(p.images) ? p.images : [];
    const firstImg = imgs.length ? imgs[0] : "";

    const originalPriceCents = Number(p.price) || 0;
    const salePriceCents = applySale(originalPriceCents);

    // Decide how to render price block
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
      <article class="product-detail">
        <div class="pd__gallery">

          <!-- MAIN IMAGE WRAPPER -->
          <div class="product-main">
            ${
              firstImg
                ? `<img class="pd__img is-active" src="${firstImg}" alt="${p.title} image 1" loading="eager">`
                : `<div class="pd__img fallback" aria-hidden="true" style="height:320px;border-radius:12px;background:#111;display:grid;place-items:center;color:#777">No image</div>`
            }
          </div>

          <!-- THUMBNAILS -->
          ${
            imgs.length
              ? `<div class="pd__thumbs">
                  ${imgs
                    .map(
                      (src, i) => `
                    <button class="pd__thumb" data-idx="${i}" aria-label="View image ${i + 1}">
                      <img src="${src}" alt="">
                    </button>
                  `
                    )
                    .join("")}
                 </div>`
              : ""
          }
        </div>

        <div class="pd__info">
          <h1 class="pd__title">${p.title}</h1>

          <!-- PRICE BLOCK -->
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
          </label>`
              : ""
          }

          <button id="add-to-cart" class="button button--secondary" data-id="${p.id}" type="button">
            Add to cart
          </button>

          <div id="pd-desc" class="pd__desc"></div>
        </div>
      </article>
    `;

    // Inject rich HTML description (keep container visible)
    const descEl = root.querySelector("#pd-desc");
    if (descEl) {
      const html =
        typeof p.description === "string" && p.description.trim().length
          ? p.description
          : "<p style='opacity:.8'>No description available.</p>";
      descEl.innerHTML = html;

      // ✅ make bats work reliably
      hydrateBats(descEl);
    }

    // Thumbnail -> main image switcher
    const imgsLocal = imgs.slice(); // local copy for closure
    root.querySelectorAll(".pd__thumb").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = +btn.dataset.idx || 0;
        const mainImg = root.querySelector(".product-main img");
        if (mainImg && imgsLocal[idx]) {
          mainImg.src = imgsLocal[idx];
          mainImg.alt = `${p.title} image ${idx + 1}`;
        }
      });
    });

    // Decide price for cart (matches what we show)
    const priceForCart = showSale ? salePriceCents : originalPriceCents;

    // Add to cart
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

    // ===== MAGNIFYING LENS (match Collections) =====
    if (window.matchMedia && window.matchMedia("(pointer: fine)").matches) {
      const mainImg = root.querySelector(".product-main img");
      const mainWrap = root.querySelector(".product-main");

      if (mainImg && mainWrap) {
        // Ensure wrapper can host absolutely positioned lens
        if (getComputedStyle(mainWrap).position === "static") {
          mainWrap.style.position = "relative";
        }

        const lens = document.createElement("div");
        lens.className = "pd__lens";
        mainWrap.appendChild(lens);

        const zoom = 2.2;

        function moveLens(evt) {
          const rect = mainImg.getBoundingClientRect();
          const lensRect = lens.getBoundingClientRect();
          const lensR = lensRect.width / 2;

          const clientX = evt.clientX ?? (evt.touches && evt.touches[0]?.clientX);
          const clientY = evt.clientY ?? (evt.touches && evt.touches[0]?.clientY);
          if (clientX == null || clientY == null) return;

          let x = clientX - rect.left;
          let y = clientY - rect.top;

          // Clamp lens center inside the image bounds
          x = Math.max(lensR, Math.min(rect.width - lensR, x));
          y = Math.max(lensR, Math.min(rect.height - lensR, y));

          lens.style.left = `${x - lensR}px`;
          lens.style.top = `${y - lensR}px`;

          lens.style.backgroundImage = `url("${mainImg.src}")`;
          lens.style.backgroundSize = `${rect.width * zoom}px ${rect.height * zoom}px`;
          lens.style.backgroundPosition = `-${x * zoom - lensR}px -${y * zoom - lensR}px`;
        }

        function onEnter() {
          lens.classList.add("is-active");
        }
        function onLeave() {
          lens.classList.remove("is-active");
        }

        mainImg.addEventListener("mouseenter", onEnter);
        mainImg.addEventListener("mouseleave", onLeave);
        mainImg.addEventListener("mousemove", moveLens);

        // (Optional) basic support for trackpads that fire pointer events
        mainImg.addEventListener(
          "pointermove",
          (e) => {
            if (e.pointerType === "mouse" || e.pointerType === "pen") {
              moveLens(e);
            }
          },
          { passive: true }
        );
      }
    }
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