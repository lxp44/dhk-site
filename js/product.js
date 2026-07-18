// js/product.js
// DHK product page renderer — banner + editorial gallery + sticky details.

(() => {
  "use strict";

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  const PRICE = (cents) =>
    (Number(cents || 0) / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });

  function getHandle() {
    const params = new URLSearchParams(window.location.search);

    return (
      params.get("handle") ||
      params.get("id")
    );
  }

  function normalizeProducts(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (
      data &&
      Array.isArray(data.products)
    ) {
      return data.products;
    }

    return [];
  }

  async function loadProducts() {
    const response = await fetch(
      `data/products.json?ts=${Date.now()}`,
      {
        cache: "no-cache",
      }
    );

    if (!response.ok) {
      throw new Error(
        `Unable to load products: HTTP ${response.status}`
      );
    }

    const data = await response.json();

    return normalizeProducts(data);
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function splitDescription(html) {
    if (
      !html ||
      typeof html !== "string"
    ) {
      return {
        introHtml:
          "<p>No description available.</p>",
        detailsHtml: "",
      };
    }

    const wrapper =
      document.createElement("div");

    wrapper.innerHTML = html;

    wrapper
      .querySelectorAll("video")
      .forEach((video) => {
        video.remove();
      });

    const heading =
      wrapper.querySelector("h3");

    const list =
      wrapper.querySelector("ul");

    if (!heading || !list) {
      return {
        introHtml:
          wrapper.innerHTML.trim(),

        detailsHtml: "",
      };
    }

    const headingText =
      heading.textContent.trim();

    const listHTML =
      list.outerHTML;

    heading.remove();
    list.remove();

    return {
      introHtml:
        wrapper.innerHTML.trim(),

      detailsHtml: `
        <h3>
          ${escapeHTML(headingText)}
        </h3>

        ${listHTML}
      `,
    };
  }

  function getGalleryImages(product) {
    const source =
      Array.isArray(product.images)
        ? product.images
        : [];

    const images =
      source.filter(Boolean);

    if (
      !images.length &&
      product.thumbnail
    ) {
      images.push(
        product.thumbnail
      );
    }

    return [
      ...new Set(images),
    ];
  }

  function shouldShowBanner(product) {
    const collection = String(
      product.collection || ""
    ).toLowerCase();

    return (
      Boolean(product.bannerImage) ||
      collection === "comic" ||
      collection === "blanks"
    );
  }

  function renderBanner(
    product,
    fallbackImage
  ) {
    if (
      !shouldShowBanner(product)
    ) {
      return "";
    }

    const bannerImage =
      product.bannerImage ||
      fallbackImage;

    if (!bannerImage) {
      return "";
    }

    const title =
      product.displayTitle ||
      product.title ||
      "Product";

    return `
      <section
        class="pdv2-banner"
        aria-label="${escapeHTML(title)} campaign image"
      >
        <img
          src="${escapeHTML(bannerImage)}"
          alt="${escapeHTML(title)} campaign"
          fetchpriority="high"
        >
      </section>
    `;
  }

  function renderDesktopGallery(
    images,
    title
  ) {
    if (!images.length) {
      return `
        <div
          class="pdv2-gallery-placeholder"
          aria-hidden="true"
        ></div>
      `;
    }

    return images
      .map(
        (src, index) => `
          <figure
            class="pdv2-gallery-item"
          >
            <img
              src="${escapeHTML(src)}"
              alt="${escapeHTML(title)} view ${index + 1}"
              loading="${index === 0 ? "eager" : "lazy"}"
              decoding="async"
            >
          </figure>
        `
      )
      .join("");
  }

  function renderMobileGallery(
    images,
    title
  ) {
    if (!images.length) {
      return `
        <div
          class="pdv2-mobile-placeholder"
          aria-hidden="true"
        ></div>
      `;
    }

    return `
      <div
        class="pdv2-mobile-track"
        id="mobile-product-track"
      >
        ${images
          .map(
            (src, index) => `
              <figure
                class="pdv2-mobile-slide"
              >
                <img
                  src="${escapeHTML(src)}"
                  alt="${escapeHTML(title)} view ${index + 1}"
                  loading="${index === 0 ? "eager" : "lazy"}"
                  decoding="async"
                >
              </figure>
            `
          )
          .join("")}
      </div>

      <div
        class="pdv2-mobile-count"
        aria-hidden="true"
      >
        <span id="pdv2-current-slide">
          1
        </span>

        /

        ${images.length}
      </div>
    `;
  }

  function renderOptions(
    product,
    suffix = ""
  ) {
    const options =
      Array.isArray(product.options)
        ? product.options
        : [];

    if (!options.length) {
      return "";
    }

    const selectId =
      `pd-option${suffix}`;

    return `
      <div class="pdv2-option-group">
        <div class="pdv2-option-heading">
          <label for="${selectId}">
            Size
          </label>

          <button
            class="pdv2-size-guide"
            type="button"
            data-size-guide
          >
            View size guide
          </button>
        </div>

        <select
          id="${selectId}"
          class="pdv2-select"
          aria-label="Choose size"
        >
          <option
            value=""
            selected
            disabled
          >
            Select a size
          </option>

          ${options
            .map(
              (option) => `
                <option
                  value="${escapeHTML(option)}"
                >
                  ${escapeHTML(option)}
                </option>
              `
            )
            .join("")}
        </select>
      </div>
    `;
  }

  function renderProductInfo(
    product,
    introHtml,
    detailsHtml,
    mobile = false
  ) {
    const suffix =
      mobile
        ? "-mobile"
        : "";

    const title =
      product.displayTitle ||
      product.title ||
      "Product";

    const brand =
      product.brandLabel ||
      "Dark Harlem Knight";

    const collectionLabel =
      product.collectionLabel ||
      brand;

    const hasOptions =
      Array.isArray(product.options) &&
      product.options.length > 0;

    return `
      <div class="pdv2-info-inner">
        <p class="pdv2-eyebrow">
          ${escapeHTML(collectionLabel)}
        </p>

        <h1 class="pdv2-title">
          ${escapeHTML(title)}
        </h1>

        <p class="pdv2-price">
          ${PRICE(product.price)}
        </p>

        <div class="pdv2-rule"></div>

        ${
          product.color
            ? `
              <p class="pdv2-color">
                <span>Color:</span>

                ${escapeHTML(product.color)}
              </p>

              <div class="pdv2-rule"></div>
            `
            : ""
        }

        ${renderOptions(
          product,
          suffix
        )}

        <button
          id="add-to-cart${suffix}"
          class="pdv2-add"
          type="button"
          data-id="${escapeHTML(product.id)}"
        >
          ${
            hasOptions
              ? "Select a size"
              : "Add to cart"
          }
        </button>

        <p class="pdv2-policy">
          Final sale. No returns or exchanges.
        </p>

        <div class="pdv2-tabs">
          <details open>
            <summary>
              Description
            </summary>

            <div class="pdv2-panel">
              ${introHtml}
            </div>
          </details>

          <details>
            <summary>
              Size &amp; Fit
            </summary>

            <div class="pdv2-panel">
              ${
                detailsHtml ||
                `
                  <p>
                    See the selected product details
                    for sizing and construction
                    information.
                  </p>
                `
              }
            </div>
          </details>

          <details>
            <summary>
              Shipping &amp; Returns
            </summary>

            <div class="pdv2-panel">
              <p>
                Orders are processed after
                payment confirmation. Tracking
                is provided when the order ships.
              </p>
            </div>
          </details>
        </div>
      </div>
    `;
  }

  function bindMobileCounter(root) {
    const track =
      root.querySelector(
        "#mobile-product-track"
      );

    const current =
      root.querySelector(
        "#pdv2-current-slide"
      );

    if (!track || !current) {
      return;
    }

    const update = () => {
      const width =
        track.clientWidth || 1;

      const slide =
        Math.round(
          track.scrollLeft / width
        ) + 1;

      current.textContent =
        String(slide);
    };

    track.addEventListener(
      "scroll",
      update,
      {
        passive: true,
      }
    );

    update();
  }

  function bindCart(
    root,
    product,
    images
  ) {
    function addToCart(
      suffix = ""
    ) {
      const select =
        root.querySelector(
          `#pd-option${suffix}`
        );

      const hasOptions =
        Array.isArray(product.options) &&
        product.options.length > 0;

      const variant =
        select
          ? select.value
          : null;

      const button =
        root.querySelector(
          `#add-to-cart${suffix}`
        );

      if (
        hasOptions &&
        !variant
      ) {
        if (select) {
          select.focus();
        }

        if (button) {
          button.textContent =
            "Select a size";
        }

        return;
      }

      if (
        !window.Cart ||
        typeof window.Cart.add !== "function"
      ) {
        console.error(
          "Cart system is unavailable."
        );

        return;
      }

      window.Cart.add(
        {
          id: product.id,

          title:
            product.displayTitle ||
            product.title,

          priceCents:
            Number(product.price) || 0,

          thumbnail:
            product.thumbnail ||
            images[0] ||
            "",

          variant,

          url:
            `product.html?id=${encodeURIComponent(
              product.id
            )}`,

          stripePriceId:
            product.stripePriceId ||
            null,
        },
        {
          open: true,
        }
      );
    }

    root
      .querySelector(
        "#add-to-cart"
      )
      ?.addEventListener(
        "click",
        () => {
          addToCart("");
        }
      );

    root
      .querySelector(
        "#add-to-cart-mobile"
      )
      ?.addEventListener(
        "click",
        () => {
          addToCart("-mobile");
        }
      );

    root
      .querySelectorAll(
        ".pdv2-select"
      )
      .forEach((select) => {
        select.addEventListener(
          "change",
          () => {
            const suffix =
              select.id.endsWith(
                "-mobile"
              )
                ? "-mobile"
                : "";

            const button =
              root.querySelector(
                `#add-to-cart${suffix}`
              );

            if (button) {
              button.textContent =
                "Add to cart";
            }
          }
        );
      });
  }

  function render(
    root,
    product
  ) {
    const images =
      getGalleryImages(product);

    const title =
      product.displayTitle ||
      product.title ||
      "Product";

    const {
      introHtml,
      detailsHtml,
    } = splitDescription(
      product.description
    );

    root.innerHTML = `
      <article
        class="pdv2-product"
        data-collection="${escapeHTML(
          product.collection || "dhk"
        )}"
      >
        ${renderBanner(
          product,
          images[0]
        )}

        <section
          class="pdv2-desktop"
          aria-label="Product details"
        >
          <div class="pdv2-desktop-grid">
            <div class="pdv2-gallery-column">
              ${renderDesktopGallery(
                images,
                title
              )}
            </div>

            <aside class="pdv2-info-column">
              ${renderProductInfo(
                product,
                introHtml,
                detailsHtml,
                false
              )}
            </aside>
          </div>
        </section>

        <section
          class="pdv2-mobile"
          aria-label="Product details"
        >
          <div class="pdv2-mobile-gallery">
            ${renderMobileGallery(
              images,
              title
            )}
          </div>

          <div class="pdv2-mobile-info">
            ${renderProductInfo(
              product,
              introHtml,
              detailsHtml,
              true
            )}
          </div>
        </section>
      </article>
    `;

    bindMobileCounter(root);

    bindCart(
      root,
      product,
      images
    );
  }

  document.addEventListener(
    "DOMContentLoaded",
    async () => {
      const root =
        document.getElementById(
          "product-root"
        );

      if (!root) {
        return;
      }

      const handle =
        getHandle();

      if (!handle) {
        root.innerHTML = `
          <p class="pdv2-error">
            Product not found.
          </p>
        `;

        return;
      }

      try {
        const products =
          await loadProducts();

        const product =
          products.find(
            (item) =>
              item.id === handle ||
              item.handle === handle
          );

        if (!product) {
          root.innerHTML = `
            <p class="pdv2-error">
              Product not found.
            </p>
          `;

          return;
        }

        render(
          root,
          product
        );

        window.scrollTo(
          0,
          0
        );
      } catch (error) {
        console.error(
          "Error loading product:",
          error
        );

        root.innerHTML = `
          <p class="pdv2-error">
            Error loading product.
          </p>
        `;
      }
    }
  );
})();
