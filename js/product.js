// js/product.js
// Render product.html from data/products.json using ?handle=<id> or ?id=<id>

(() => {
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  const PRICE = (cents) =>
    (Number(cents || 0) / 100).toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
    });

  const SALE_ACTIVE = false;
  const SALE_PERCENT = 40;

  function applySale(cents) {
    if (!SALE_ACTIVE) return Number(cents || 0);
    return Math.round(Number(cents || 0) * (1 - SALE_PERCENT / 100));
  }

  function getHandle() {
    const p = new URLSearchParams(location.search);
    return p.get("handle") || p.get("id");
  }

  function normalizeProducts(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.products)) return data.products;
    return [];
  }

  async function loadProducts() {
    const res = await fetch("data/products.json?ts=" + Date.now(), {
      cache: "no-cache",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    return normalizeProducts(raw);
  }

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

    let v =
      descEl.querySelector("video.bats-bg") ||
      layer.querySelector("video.bats-bg");

    if (v) {
      forceVideoAttrs(v);

      const source = v.querySelector("source");
      if (source?.getAttribute("src")) {
        source.setAttribute("src", absolutizeSrc(source.getAttribute("src")));
      } else if (v.getAttribute("src")) {
        v.setAttribute("src", absolutizeSrc(v.getAttribute("src")));
      }

      if (v.parentElement !== layer) layer.appendChild(v);

      try {
        v.load();
      } catch (e) {}
      return v;
    }

    v = buildBatsVideo();
    layer.appendChild(v);

    try {
      v.load();
    } catch (e) {}

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

    window.addEventListener("pointerdown", gesture, {
      once: true,
      passive: true,
    });
    window.addEventListener("touchstart", gesture, {
      once: true,
      passive: true,
    });
    window.addEventListener("click", gesture, { once: true });
    window.addEventListener("keydown", gesture, { once: true });
    window.addEventListener("scroll", gesture, {
      once: true,
      passive: true,
    });
  }

  function splitDescription(html) {
    if (!html || typeof html !== "string") {
      return {
        introHtml: "<p style='opacity:.8'>No description available.</p>",
        detailsHtml: "",
      };
    }

    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;

    const video = wrapper.querySelector("video.bats-bg, video");
    if (video) video.remove();

    const heading = wrapper.querySelector("h3");
    const list = wrapper.querySelector("ul");

    let introHtml = "";
    let detailsHtml = "";

    if (heading && list) {
      heading.remove();
      list.remove();
      introHtml = wrapper.innerHTML.trim();
      detailsHtml = `
        <h3>${heading.outerHTML.replace(/^<h3[^>]*>|<\/h3>$/g, "").trim()}</h3>
        ${list.outerHTML}
      `;
    } else {
      introHtml = wrapper.innerHTML.trim();
      detailsHtml = "";
    }

    return {
      introHtml,
      detailsHtml,
    };
  }

  function renderDesktopGallery(imgs, title) {
    if (!imgs.length) {
      return `
        <div class="fog-gallery">
          <div class="fog-image-wrap">
            <div style="height:600px;background:#111;border-radius:12px;"></div>
          </div>
        </div>
      `;
    }

    return `
      <div class="fog-gallery desktop-gallery">
        ${imgs
          .map(
            (src, i) => `
          <div class="fog-image-wrap">
            <img
              src="${src}"
              alt="${title} image ${i + 1}"
              loading="${i === 0 ? "eager" : "lazy"}"
              class="fog-image"
            >
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  function renderMobileGallery(imgs, title) {
    if (!imgs.length) {
      return `
        <div class="mobile-product-gallery">
          <div class="mobile-product-track" id="mobile-product-track">
            <div class="mobile-product-slide">
              <div style="height:420px;background:#111;"></div>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="mobile-product-gallery">
        <div class="mobile-product-track" id="mobile-product-track">
          ${imgs
            .map(
              (src, i) => `
            <div class="mobile-product-slide">
              <img
                src="${src}"
                alt="${title} image ${i + 1}"
                loading="${i === 0 ? "eager" : "lazy"}"
                class="mobile-product-image"
              >
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function bindMobileStickyBar(root) {
    const buyBar = root.querySelector(".mobile-buybar");
    const stopTarget = root.querySelector(".mobile-buybar-stop");
    const mq = window.matchMedia("(max-width: 900px)");

    if (!buyBar || !stopTarget) return;

    let observer = null;

    const setDesktopState = () => {
      buyBar.classList.remove("is-fixed", "is-released");
    };

    const setMobileObserver = () => {
      buyBar.classList.add("is-fixed");
      buyBar.classList.remove("is-released");

      if (observer) observer.disconnect();

      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          const shouldRelease = entry.isIntersecting;

          buyBar.classList.toggle("is-fixed", !shouldRelease);
          buyBar.classList.toggle("is-released", shouldRelease);
        },
        {
          root: null,
          threshold: 0,
          rootMargin: "0px 0px -120px 0px",
        }
      );

      observer.observe(stopTarget);
    };

    const updateMode = () => {
      if (!mq.matches) {
        if (observer) observer.disconnect();
        setDesktopState();
        return;
      }
      setMobileObserver();
    };

    updateMode();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", updateMode);
    } else if (typeof mq.addListener === "function") {
      mq.addListener(updateMode);
    }

    window.addEventListener("resize", updateMode, { passive: true });
  }

  function render(root, p) {
    const hasOptions = Array.isArray(p.options) && p.options.length > 0;
    const imgs = Array.isArray(p.images) ? p.images : [];
    const firstImg = imgs.length ? imgs[0] : "";

    const brandLabel = p.brandLabel || "DarkHarlemKnight";
    const displayTitle = p.displayTitle || "@ product title";

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

    const { introHtml, detailsHtml } = splitDescription(p.description);

    root.innerHTML = `
      <article class="product-detail fog-layout">
        <div class="mobile-only-block">
          ${renderMobileGallery(imgs, displayTitle)}
        </div>

        <div class="desktop-only-block">
          ${renderDesktopGallery(imgs, displayTitle)}
        </div>

        <div class="fog-info">
          <div class="pd__brand-glow">${brandLabel}</div>

          <h1 class="pd__title mobile-title-only">${displayTitle}</h1>
          <h1 class="pd__title desktop-title-only">${displayTitle}</h1>

          <div class="pd__price">
            ${priceHtml}
          </div>

          <div class="pd__intro mobile-intro-only">
            ${introHtml || "<p style='opacity:.8'>No description available.</p>"}
          </div>

          <div class="pd__mobile-accordion mobile-only-block">
            <details class="pd__accordion">
              <summary>Details</summary>
              <div class="pd__accordion-body">
                ${detailsHtml || "<p style='opacity:.8'>No details available.</p>"}
              </div>
            </details>
          </div>

          <div class="mobile-buybar mobile-only-block">
            ${
              hasOptions
                ? `
              <label class="pd__opt-label mobile-buybar__field">
                Size
                <select id="pd-option-mobile" class="pd__select" aria-label="Choose size">
                  ${p.options.map((o) => `<option value="${o}">${o}</option>`).join("")}
                </select>
              </label>
            `
                : ""
            }

            <button id="add-to-cart-mobile" class="button button--secondary mobile-buybar__button" data-id="${p.id}" type="button">
              Add to cart
            </button>
          </div>

          <div class="mobile-buybar-stop mobile-only-block" aria-hidden="true"></div>

          ${
            hasOptions
              ? `
            <label class="pd__opt-label desktop-only-block">
              Size
              <select id="pd-option" class="pd__select" aria-label="Choose size">
                ${p.options.map((o) => `<option value="${o}">${o}</option>`).join("")}
              </select>
            </label>
          `
              : ""
          }

          <button id="add-to-cart" class="button button--secondary desktop-only-block" data-id="${p.id}" type="button">
            Add to cart
          </button>

          <div class="pd__desktop-desc desktop-desc-only">
            <div id="pd-desc" class="pd__desc">
              ${introHtml || "<p style='opacity:.8'>No description available.</p>"}
            </div>

            <details class="pd__accordion pd__accordion--desktop">
              <summary>Details</summary>
              <div class="pd__accordion-body">
                ${detailsHtml || "<p style='opacity:.8'>No details available.</p>"}
              </div>
            </details>
          </div>
        </div>
      </article>
    `;

    const descEl = root.querySelector("#pd-desc");
    if (descEl) hydrateBats(descEl);

    root.querySelectorAll(".pd__accordion-body").forEach((el) => {
      hydrateBats(el);
    });

    const priceForCart = showSale ? salePriceCents : originalPriceCents;

    function addCurrentProductToCart(selectId) {
      const sizeSel = root.querySelector(selectId);
      const variant = sizeSel ? sizeSel.value : null;

      window.Cart?.add(
        {
          id: p.id,
          title: displayTitle,
          priceCents: priceForCart,
          thumbnail: p.thumbnail || firstImg || "",
          variant,
          url: `product.html?id=${p.id}`,
          stripePriceId: p.stripePriceId || null,
        },
        { open: true }
      );
    }

    root.querySelector("#add-to-cart")?.addEventListener("click", () => {
      addCurrentProductToCart("#pd-option");
    });

    root.querySelector("#add-to-cart-mobile")?.addEventListener("click", () => {
      addCurrentProductToCart("#pd-option-mobile");
    });

    bindMobileStickyBar(root);
  }

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

      window.scrollTo(0, 0);

      const mobileTrack = document.getElementById("mobile-product-track");
      if (mobileTrack) {
        mobileTrack.scrollLeft = 0;
      }
    } catch (e) {
      console.error("Error loading product:", e);
      root.innerHTML = '<p style="color:#ccc">Error loading product.</p>';
    }
  });
})();