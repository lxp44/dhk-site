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

