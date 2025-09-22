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

