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
      <a class="product-card" href="${url}">
        <div class="pc__media">
          ${thumb ? `
            <img
              src="${thumb}"
              alt="${p.title}"
              loading="lazy"
              class="pc__img"
              data-default="${thumb}"
              data-hover="${hover}"
            >
          ` : ""}
        </div>
        <div class="pc__info">
          <h3 class="pc__title">${p.title}</h3>
          <div class="pc__price">${fmt(p.price)}</div>
        </div>
      </a>
    `;
  }

  function bindHoverSwap() {
    document.querySelectorAll(".pc__img").forEach((img) => {
      const defaultSrc = img.dataset.default;
      const hoverSrc = img.dataset.hover;

      if (hoverSrc && hoverSrc !== defaultSrc) {
        const preload = new Image();
        preload.src = hoverSrc;
      }

      const card = img.closest(".product-card");
      if (!card) return;

      card.addEventListener("mouseenter", () => {
        img.src = hoverSrc;
      });

      card.addEventListener("mouseleave", () => {
        img.src = defaultSrc;
      });
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
    bindHoverSwap();
  }

  document.addEventListener("DOMContentLoaded", renderGrid);
})();
