// js/product.js
// Render single product page (product.html)

async function loadProducts() {
  const res = await fetch("data/products.json");
  const data = await res.json();
  return data.products;
}

function getProductHandle() {
  const params = new URLSearchParams(window.location.search);
  return params.get("handle");
}

function renderProduct(product) {
  const container = document.querySelector("#product-detail");
  if (!container) return;

  container.innerHTML = `
    <div class="product-gallery">
      ${product.images
        .map((img) => `<img src="${img}" alt="${product.title}" />`)
        .join("")}
    </div>
    <div class="product-info">
      <h1>${product.title}</h1>
      <p class="price">$${(product.price / 100).toFixed(2)}</p>
      <p class="desc">${product.description}</p>

      <label>Size</label>
      <select id="variant">
        ${product.options
          .map((opt) => `<option value="${opt}">${opt}</option>`)
          .join("")}
      </select>

      <button id="add-to-cart" data-id="${product.id}">Add to Cart</button>
    </div>
  `;

  // Add to cart
  document.querySelector("#add-to-cart").addEventListener("click", () => {
    const variant = document.querySelector("#variant").value;
    addToCart(product.id, variant);
    alert("Added to cart!");
  });
}

function addToCart(id, variant) {
  let cart = JSON.parse(localStorage.getItem("cart") || "[]");
  cart.push({ id, variant, qty: 1 });
  localStorage.setItem("cart", JSON.stringify(cart));
}

document.addEventListener("DOMContentLoaded", async () => {
  const handle = getProductHandle();
  const products = await loadProducts();
  const product = products.find((p) => p.id === handle);

  if (product) {
    renderProduct(product);
  } else {
    document.querySelector("#product-detail").innerHTML =
      "<p>Product not found.</p>";
  }
});
(async function () {
(async function () {
  const root = document.getElementById('product-root');
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) {
    root.innerHTML = '<p style="color:#ccc">Product not found.</p>';
    return;
  }

  try {
    const res = await fetch('data/products.json');
    // Example
const res = await fetch('data/products.json');
const products = await res.json(); // NOW an array, not obj.products

    const p = products.find(x => x.id === id);
    if (!p) {
      root.innerHTML = '<p style="color:#ccc">Product not found.</p>';
      return;
    }

    root.innerHTML = `
      <article class="product-detail">
        <div class="pd__gallery">
          ${p.images.map((src, i) => `
            <img class="pd__img ${i===0?'is-active':''}" src="${src}" alt="${p.title} image ${i+1}" loading="${i===0?'eager':'lazy'}">
          `).join('')}
          <div class="pd__thumbs">
            ${p.images.map((src, i) => `
              <button class="pd__thumb" data-idx="${i}" aria-label="View image ${i+1}">
                <img src="${src}" alt="">
              </button>
            `).join('')}
          </div>
        </div>

        <div class="pd__info">
          <h1 class="pd__title">${p.title}</h1>
          <div class="pd__price">$${p.price.toFixed(2)}</div>
          <p class="pd__desc">${p.description || ''}</p>

          ${Array.isArray(p.options) && p.options.length ? `
          <label class="pd__opt-label">
            Size
            <select id="pd-option" class="pd__select" aria-label="Choose size">
              ${p.options.map(o => `<option value="${o}">${o}</option>`).join('')}
            </select>
          </label>` : ''}

          <button id="add-to-cart" class="button button--secondary" data-id="${p.id}">
            Add to cart
          </button>
        </div>
      </article>
    `;

    // thumbs switcher
    root.querySelectorAll('.pd__thumb').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = +btn.dataset.idx;
        root.querySelectorAll('.pd__img').forEach((img, i) => {
          img.classList.toggle('is-active', i === idx);
        });
      });
    });

    // add to cart
    const addBtn = document.getElementById('add-to-cart');
    addBtn.addEventListener('click', () => {
      const sizeSel = document.getElementById('pd-option');
      const variant = sizeSel ? sizeSel.value : null;
      window.Cart.add({
        id: p.id,
        title: p.title,
        price: p.price,
        thumbnail: p.thumbnail || p.images?.[0],
        variant
      });
    });

  } catch (e) {
    root.innerHTML = `<p style="color:#ccc">Error loading product.</p>`;
    console.error(e);
  }
})();
  const root = document.getElementById('product-root');
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) {
    root.innerHTML = '<p style="color:#ccc">Product not found.</p>';
    return;
  }

  try {
    const res = await fetch('data/products.json');
    const products = await res.json();
    const p = products.find(x => x.id === id);
    if (!p) {
      root.innerHTML = '<p style="color:#ccc">Product not found.</p>';
      return;
    }

    root.innerHTML = `
      <article class="product-detail">
        <div class="pd__gallery">
          ${p.images.map((src, i) => `
            <img class="pd__img ${i===0?'is-active':''}" src="${src}" alt="${p.title} image ${i+1}" loading="${i===0?'eager':'lazy'}">
          `).join('')}
          <div class="pd__thumbs">
            ${p.images.map((src, i) => `
              <button class="pd__thumb" data-idx="${i}" aria-label="View image ${i+1}">
                <img src="${src}" alt="">
              </button>
            `).join('')}
          </div>
        </div>

        <div class="pd__info">
          <h1 class="pd__title">${p.title}</h1>
          <div class="pd__price">$${p.price.toFixed(2)}</div>
          <p class="pd__desc">${p.description || ''}</p>

          ${Array.isArray(p.options) && p.options.length ? `
          <label class="pd__opt-label">
            Size
            <select id="pd-option" class="pd__select" aria-label="Choose size">
              ${p.options.map(o => `<option value="${o}">${o}</option>`).join('')}
            </select>
          </label>` : ''}

          <button id="add-to-cart" class="button button--secondary" data-id="${p.id}">
            Add to cart
          </button>
        </div>
      </article>
    `;

    // thumbs switcher
    root.querySelectorAll('.pd__thumb').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = +btn.dataset.idx;
        root.querySelectorAll('.pd__img').forEach((img, i) => {
          img.classList.toggle('is-active', i === idx);
        });
      });
    });

    // add to cart
    const addBtn = document.getElementById('add-to-cart');
    addBtn.addEventListener('click', () => {
      const sizeSel = document.getElementById('pd-option');
      const variant = sizeSel ? sizeSel.value : null;
      window.Cart.add({
        id: p.id,
        title: p.title,
        price: p.price,
        thumbnail: p.thumbnail || p.images?.[0],
        variant
      });
    });

  } catch (e) {
    root.innerHTML = `<p style="color:#ccc">Error loading product.</p>`;
    console.error(e);
  }
})();

