// js/product.js
// Renders product.html from data/products.json using ?handle=<product id>

(function () {
  const PRICE = (cents) =>
    (Number(cents || 0) / 100).toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
    });

  function paramHandle() {
    const p = new URLSearchParams(location.search);
    // Prefer ?handle=… but also accept ?id=… as a fallback
    return p.get("handle") || p.get("id");
  }

  function normalizeProducts(data) {
    // Accept either an array or { products: [...] }
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.products)) return data.products;
    return [];
  }

  function render(root, p) {
    root.innerHTML = `
      <article class="product-detail">
        <div class="pd__gallery">
          ${p.images
            .map(
              (src, i) => `
            <img class="pd__img ${i === 0 ? "is-active" : ""}"
                 src="${src}"
                 alt="${p.title} image ${i + 1}"
                 loading="${i === 0 ? "eager" : "lazy"}">
          `
            )
            .join("")}
          <div class="pd__thumbs">
            ${p.images
              .map(
                (src, i) => `
              <button class="pd__thumb" data-idx="${i}" aria-label="View image ${i + 1}">
                <img src="${src}" alt="">
              </button>
            `
              )
              .join("")}
          </div>
        </div>

        <div class="pd__info">
          <h1 class="pd__title">${p.title}</h1>
          <div class="pd__price">${PRICE(p.price)}</div>
          <p class="pd__desc">${p.description || ""}</p>

          ${
            Array.isArray(p.options) && p.options.length
              ? `
          <label class="pd__opt-label">
            Size
            <select id="pd-option" class="pd__select" aria-label="Choose size">
              ${p.options.map((o) => `<option value="${o}">${o}</option>`).join("")}
            </select>
          </label>`
              : ""
          }

          <button id="add-to-cart" class="button button--secondary" data-id="${p.id}">
            Add to cart
          </button>
        </div>
      </article>
    `;

    // Thumb -> main image switcher
    root.querySelectorAll(".pd__thumb").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = +btn.dataset.idx;
        root.querySelectorAll(".pd__img").forEach((img, i) => {
          img.classList.toggle("is-active", i === idx);
        });
      });
    });

    // Add to cart
    const addBtn = root.querySelector("#add-to-cart");
    addBtn?.addEventListener("click", () => {
      const sizeSel = root.querySelector("#pd-option");
      const variant = sizeSel ? sizeSel.value : null;

      // Use your drawer Cart API
      window.Cart?.add({
        id: p.id,
        title: p.title,
        price: p.price, // cents
        thumbnail: p.thumbnail || p.images?.[0],
        variant,
        url: `product.html?handle=${p.id}`,
      });
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const root = document.getElementById("product-root");
    if (!root) return;

    const handle = paramHandle();
    if (!handle) {
      root.innerHTML = '<p style="color:#ccc">Product not found.</p>';
      return;
    }

    try {
      const res = await fetch("data/products.json");
      const raw = await res.json();
      const products = normalizeProducts(raw);
      const p = products.find((x) => x.id === handle);

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
