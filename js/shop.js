// js/shop.js
// Render product grid on shop.html

async function loadProducts() {
  try {
    const res = await fetch("data/products.json");
    const data = await res.json();
    return data.products;
  } catch (err) {
    console.error("Error loading products:", err);
    return [];
  }
}

function renderShop(products) {
  const grid = document.querySelector("#shop-grid");
  if (!grid) return;

  grid.innerHTML = products
    .map(
      (p) => `
      <a href="${p.url}" class="product-card">
        <div class="pc__media">
          <img src="${p.thumbnail}" alt="${p.title}" loading="lazy">
        </div>
        <div class="pc__info">
          <h3 class="pc__title">${p.title}</h3>
          <div class="pc__price">$${(p.price / 100).toFixed(2)}</div>
        </div>
      </a>
    `
    )
    .join("");
}

document.addEventListener("DOMContentLoaded", async () => {
  const products = await loadProducts();
  renderShop(products);
});
(async function () {
  const grid = document.getElementById('shop-grid');
  if (!grid) return;

  try {
    const res = await fetch('data/products.json');
    const products = await res.json();

    grid.innerHTML = products.map(p => `
      <a href="product.html?id=${encodeURIComponent(p.id)}" class="product-card" aria-label="${p.title}">
        <div class="pc__media">
          <img src="${p.thumbnail}" alt="${p.title}" loading="lazy">
        </div>
        <div class="pc__info">
          <h3 class="pc__title">${p.title}</h3>
          <div class="pc__price">$${p.price.toFixed(2)}</div>
        </div>
      </a>
    `).join('');
  } catch (e) {
    grid.innerHTML = `<p style="color:#ccc">Could not load products.</p>`;
    console.error(e);
  }
})();

