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
    const url = p.url || `product.html?handle=${encodeURIComponent(p.id)}`;
    return `
      <a class="product-card" href="${url}">
        <div class="pc__media">
          ${thumb ? `<img src="${thumb}" alt="${p.title}" loading="lazy">` : ""}
        </div>
        <div class="pc__info">
          <h3 class="pc__title">${p.title}</h3>
          <div class="pc__price">${fmt(p.price)}</div>
        </div>
      </a>
    `;
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
  }

  document.addEventListener("DOMContentLoaded", renderGrid);
})();
