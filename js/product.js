// js/product.js
// Render product.html from data/products.json using ?handle=<id> or ?id=<id>

(() => {
  // ---- Money (cents -> $X.XX)
  const PRICE = (cents) =>
    (Number(cents || 0) / 100).toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
    });

  // === GLOBAL SALE CONFIG ===
  // Toggle this to turn a site-wide % off back on in the FUTURE.
  const SALE_ACTIVE = false;     // ⬅️ SALE OFF (was true)
  const SALE_PERCENT = 40;       // 40% OFF when active

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

  function render(root, p) {
    const hasOptions = Array.isArray(p.options) && p.options.length > 0;
    const imgs = Array.isArray(p.images) ? p.images : [];
    const firstImg = imgs.length ? imgs[0] : "";

    const originalPriceCents = Number(p.price) || 0;
    const salePriceCents = applySale(originalPriceCents);

    // Only show crossed-out + sale if sale is actually active and changes price
    const showSale =
      SALE_ACTIVE &&
      SALE_PERCENT > 0 &&
      salePriceCents < originalPriceCents;

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
            ${
              showSale
                ? `
                  <span class="price-original" style="opacity:.55;text-decoration:line-through;margin-right:6px;">
                    ${PRICE(originalPriceCents)}
                  </span>
                  <span class="price-sale">
                    ${PRICE(salePriceCents)}
                  </span>
                `
                : `
                  <span class="price-normal">
                    ${PRICE(originalPriceCents)}
                  </span>
                `
            }
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

    // Add to cart (uses salePriceCents, which == full price when SALE_ACTIVE=false)
    root.querySelector("#add-to-cart")?.addEventListener("click", () => {
      const sizeSel = root.querySelector("#pd-option");
      const variant = sizeSel ? sizeSel.value : null;

      window.Cart?.add(
        {
          id: p.id,
          title: p.title,
          priceCents: salePriceCents,
          thumbnail: p.thumbnail || firstImg || "",
          variant,
          url: `product.html?id=${p.id}`,
          stripePriceId: p.stripePriceId || null,
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