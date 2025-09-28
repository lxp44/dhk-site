// js/product.js
// Render product.html from data/products.json using ?handle=<id> or ?id=<id>

(() => {
  // ---- Money (cents -> $X.XX)
  const PRICE = (cents) =>
    (Number(cents || 0) / 100).toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
    });

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

  async function loadProducts() {
    const res = await fetch("data/products.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    return normalizeProducts(raw);
  }

  function render(root, p) {
    const hasOptions = Array.isArray(p.options) && p.options.length > 0;
    const imgs = Array.isArray(p.images) ? p.images : [];
    const firstImg = imgs.length ? imgs[0] : "";

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
          <div class="pd__price">${PRICE(p.price)}</div>

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

    // Inject rich HTML description
    const descEl = root.querySelector("#pd-desc");
    if (descEl) {
      if (p.description) descEl.innerHTML = p.description;
      else descEl.remove();
    }

    // Thumbnail -> main image switcher
    root.querySelectorAll(".pd__thumb").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = +btn.dataset.idx || 0;
        const mainImg = root.querySelector(".product-main img");
        if (mainImg && imgs[idx]) {
          mainImg.src = imgs[idx];
          mainImg.alt = `${p.title} image ${idx + 1}`;
        }
      });
    });

    // Add to cart (now includes priceCents + stripePriceId)
    root.querySelector("#add-to-cart")?.addEventListener("click", () => {
      const sizeSel = root.querySelector("#pd-option");
      const variant = sizeSel ? sizeSel.value : null;

      window.Cart?.add(
        {
          id: p.id,
          title: p.title,
          priceCents: Number(p.price) || 0,                 // cents (preferred by cart)
          thumbnail: p.thumbnail || firstImg || "",
          variant,
          url: `product.html?id=${p.id}`,
          stripePriceId: p.stripePriceId || null,           // <-- used by Stripe Checkout
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