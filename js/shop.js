// js/shop.js
(() => {
  const GRID_ID = "shop-grid";
  const DATA_URL = "data/products.json";

  async function fetchProducts() {
    try {
      const resp = await fetch(DATA_URL, { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const list = await resp.json();
      return Array.isArray(list) ? list : (list.products || []);
    } catch (err) {
      console.error("Failed to load products:", err);
      return [];
    }
  }

  const fmt = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

  function cardHTML(p) {
    const thumb = p.thumbnail || (p.images && p.images[0]) || "";
    const hover = p.hoverImage || thumb;
    const url = p.url || `product.html?handle=${encodeURIComponent(p.id)}`;

    return `
      <article class="product-card" data-url="${url}">
        <a class="pc__media-link" href="${url}" aria-label="${p.title}">
          <div class="pc__media">
            ${thumb ? `
              <img
                src="${thumb}"
                alt="${p.title}"
                loading="lazy"
                class="pc__img"
                data-default="${thumb}"
                data-hover="${hover}"
                data-url="${url}"
              >
            ` : ""}
          </div>
        </a>

        <a class="pc__info pc__info-link" href="${url}" aria-label="${p.title}">
          <h3 class="pc__title">${p.title}</h3>
          <div class="pc__price">${fmt(p.price)}</div>
        </a>
      </article>
    `;
  }

  function bindDesktopHoverSwap() {
    const isDesktopLike = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!isDesktopLike) return;

    document.querySelectorAll(".pc__img").forEach((img) => {
      const defaultSrc = img.dataset.default;
      const hoverSrc = img.dataset.hover;

      if (hoverSrc && hoverSrc !== defaultSrc) {
        const preload = new Image();
        preload.src = hoverSrc;
      }

      const mediaLink = img.closest(".pc__media-link");
      if (!mediaLink) return;

      mediaLink.addEventListener("mouseenter", () => {
        img.src = hoverSrc;
      });

      mediaLink.addEventListener("mouseleave", () => {
        img.src = defaultSrc;
      });
    });
  }

  function bindMobileTapReveal() {
    const isMobileLike = window.matchMedia("(hover: none), (pointer: coarse)").matches;
    if (!isMobileLike) return;

    let activeImg = null;

    const resetImage = (img) => {
      if (!img) return;
      img.src = img.dataset.default;
      img.dataset.tapState = "default";
      img.closest(".product-card")?.classList.remove("is-tapped");
    };

    const activateImage = (img) => {
      if (!img) return;
      img.src = img.dataset.hover || img.dataset.default;
      img.dataset.tapState = "hover";
      img.closest(".product-card")?.classList.add("is-tapped");
    };

    document.querySelectorAll(".pc__img").forEach((img) => {
      const defaultSrc = img.dataset.default;
      const hoverSrc = img.dataset.hover || defaultSrc;
      const url = img.dataset.url;

      if (hoverSrc && hoverSrc !== defaultSrc) {
        const preload = new Image();
        preload.src = hoverSrc;
      }

      img.dataset.tapState = "default";

      const mediaLink = img.closest(".pc__media-link");
      if (!mediaLink) return;

      mediaLink.addEventListener("click", (e) => {
        const alreadyActive = activeImg === img;
        const isHoverState = img.dataset.tapState === "hover";

        if (!alreadyActive) {
          e.preventDefault();
          if (activeImg) resetImage(activeImg);
          activateImage(img);
          activeImg = img;
          return;
        }

        if (alreadyActive && !isHoverState) {
          e.preventDefault();
          activateImage(img);
          activeImg = img;
          return;
        }

        if (alreadyActive && isHoverState) {
          window.location.href = url;
        }
      });
    });

    document.querySelectorAll(".pc__info-link").forEach((link) => {
      link.addEventListener("click", () => {
        if (activeImg) {
          resetImage(activeImg);
          activeImg = null;
        }
      });
    });

    document.addEventListener("click", (e) => {
      const insideCard = e.target.closest(".product-card");
      if (!insideCard && activeImg) {
        resetImage(activeImg);
        activeImg = null;
      }
    });
  }

  async function renderGrid() {
    const grid = document.getElementById(GRID_ID);
    if (!grid) return;

    grid.innerHTML = `<div class="loading">Loading…</div>`;

    const products = await fetchProducts();

    if (!products.length) {
      grid.innerHTML = `<p>No products yet.</p>`;
      return;
    }

    grid.innerHTML = products.map(cardHTML).join("");

    bindDesktopHoverSwap();
    bindMobileTapReveal();
  }

  document.addEventListener("DOMContentLoaded", renderGrid);
})();