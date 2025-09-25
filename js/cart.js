(function () {
  const KEY = 'dhk_cart_v1';

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }
  function write(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    updateHeaderCount(items);
  }
  function updateHeaderCount(items = read()) {
    let el = document.getElementById('cart-count');
    if (!el) {
      // optional: create a small bubble in your header cart link
      const cartLink = document.querySelector('a[aria-label="Cart"]');
      if (!cartLink) return;
      el = document.createElement('span');
      el.id = 'cart-count';
      el.className = 'cart-count-bubble';
      cartLink.appendChild(el);
    }
    // Safe cart helpers
function readCart() {
  try {
    const raw = localStorage.getItem("cart");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCart(items) {
  localStorage.setItem("cart", JSON.stringify(Array.isArray(items) ? items : []));
}

// Example usage in your existing code:
document.addEventListener("DOMContentLoaded", () => {
  const items = readCart();

  function updateHeaderCount() {
    const els = document.querySelectorAll("[data-cart-count]");
    const count = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
    els.forEach((el) => (el.textContent = String(count)));
  }

  // ...when you add/remove items, always call writeCart(items) then updateHeaderCount()
  updateHeaderCount();
});

    const qty = items.reduce((n, it) => n + (it.qty || 1), 0);
    el.textContent = qty > 0 ? qty : '';
  }

  function add(item) {
    const items = read();
    const key = item.id + (item.variant ? `__${item.variant}` : '');
    const existing = items.find(it => it.key === key);
    if (existing) {
      existing.qty += 1;
    } else {
      items.push({
        key, id: item.id, title: item.title, price: item.price,
        variant: item.variant || null, thumbnail: item.thumbnail || null, qty: 1
      });
    }
    write(items);
    alert('Added to cart'); // swap for a nicer toast later
  }

  function remove(key) {
    const items = read().filter(it => it.key !== key);
    write(items);
  }

  function clear() { write([]); }

  // expose globally
  window.Cart = { add, remove, clear, read };

  // init bubble on load
  document.addEventListener('DOMContentLoaded', updateHeaderCount);
})();

// js/cart.js
(() => {
  const STORAGE_KEY = 'dhk_cart_v1';

  // ---------- Storage ----------
  function read() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      console.warn('Cart parse error, resetting.', e);
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
  }
  function write(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    renderCart();
    updateHeaderCount();
  }
  function clear() {
    write([]);
  }

  // ---------- Utils ----------
  const fmt = (n) =>
    (n || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });

  function keyFor(item) {
    return item.id + (item.variant ? `__${item.variant}` : '');
  }

  function subtotal(items) {
    return items.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 1), 0);
  }

  // ---------- Public API ----------
  function add(item, options = { open: true }) {
    const items = read();
    const key = keyFor(item);
    const existing = items.find((it) => it.key === key);
    if (existing) {
      existing.qty += 1;
    } else {
      items.push({
        key,
        id: item.id,
        title: item.title,
        price: item.price,
        variant: item.variant || null,
        thumbnail: item.thumbnail || null,
        qty: 1,
        url: item.url || null,
      });
    }
    write(items);
    if (options.open) openDrawer();
  }

  function remove(key) {
    const items = read().filter((it) => it.key !== key);
    write(items);
  }

  // ---------- Drawer ----------
  const drawer = () => document.getElementById('cart-drawer');
  const itemsEl = () => document.getElementById('cart-items');
  const emptyEl = () => document.getElementById('cart-empty');
  const subtotalEl = () => document.getElementById('cart-subtotal');
  const checkoutBtn = () => document.getElementById('cart-checkout');

  function openDrawer() {
    const el = drawer();
    if (!el) return;
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('no-scroll');
    // focus panel for a11y
    const panel = el.querySelector('.cart-drawer__panel');
    panel && panel.focus();
  }

  function closeDrawer() {
    const el = drawer();
    if (!el) return;
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('no-scroll');
  }

  // ---------- Render ----------
  function renderCart() {
    const cartItems = read();
    const hasItems = cartItems.length > 0;

    const $items = itemsEl();
    const $empty = emptyEl();
    const $subtotal = subtotalEl();
    const $checkout = checkoutBtn();

    if (!$items || !$empty || !$subtotal || !$checkout) {
      // Not on a page with a drawer (e.g., old page) — just update count and bail.
      updateHeaderCount();
      return;
    }

    if (!hasItems) {
      $items.innerHTML = '';
      $empty.hidden = false;
      $subtotal.textContent = fmt(0);
      $checkout.disabled = true;
    } else {
      $empty.hidden = true;
      $items.innerHTML = cartItems
        .map((it) => {
          const priceEach = fmt(it.price || 0);
          const linePrice = fmt((it.price || 0) * (it.qty || 1));
          const thumb = it.thumbnail
            ? `<img src="${it.thumbnail}" alt="" loading="lazy" />`
            : '';
          const variant = it.variant ? `<div class="ci__variant">${it.variant}</div>` : '';

          const titleHtml = it.url
            ? `<a class="ci__title" href="${it.url}">${it.title}</a>`
            : `<div class="ci__title">${it.title}</div>`;

          return `
          <div class="cart-item" data-key="${it.key}">
            <div class="ci__media">${thumb}</div>
            <div class="ci__info">
              ${titleHtml}
              ${variant}
              <div class="ci__price-each">${priceEach} ea</div>
              <div class="ci__controls">
                <button class="ci__qty-btn" type="button" data-decr aria-label="Decrease quantity">−</button>
                <span class="ci__qty" aria-live="polite">${it.qty || 1}</span>
                <button class="ci__qty-btn" type="button" data-incr aria-label="Increase quantity">+</button>
                <button class="ci__remove" type="button" data-remove aria-label="Remove">Remove</button>
              </div>
            </div>
            <div class="ci__line">${linePrice}</div>
          </div>`;
        })
        .join('');

      $subtotal.textContent = fmt(subtotal(cartItems));
      $checkout.disabled = false;
    }
  }

  // ---------- Events ----------
  function updateHeaderCount() {
    const items = read();
    const qty = items.reduce((n, it) => n + (it.qty || 1), 0);

    // Flexible hooks: [data-cart-count] or .cart-count (if you add one later)
    document.querySelectorAll('[data-cart-count], .cart-count').forEach((el) => {
      el.textContent = qty > 0 ? String(qty) : '';
      if ('hidden' in el) el.hidden = qty === 0;
    });
  }

  function onItemsClick(e) {
    const row = e.target.closest('.cart-item');
    if (!row) return;
    const key = row.getAttribute('data-key');
    if (!key) return;

    if (e.target.matches('[data-remove]')) {
      remove(key);
      return;
    }
    const items = read();
    const idx = items.findIndex((it) => it.key === key);
    if (idx === -1) return;

    if (e.target.matches('[data-incr]')) {
      items[idx].qty = (items[idx].qty || 1) + 1;
      write(items);
    } else if (e.target.matches('[data-decr]')) {
      const next = Math.max(0, (items[idx].qty || 1) - 1);
      if (next === 0) {
        items.splice(idx, 1);
      } else {
        items[idx].qty = next;
      }
      write(items);
    }
  }

  function bindGlobalEvents() {
    // open triggers
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-cart-open]')) {
        e.preventDefault();
        openDrawer();
      }
    });

    // close triggers (button or overlay)
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-cart-close]')) {
        e.preventDefault();
        closeDrawer();
      }
      const el = drawer();
      if (el && e.target === el.querySelector('.cart-drawer__overlay')) {
        closeDrawer();
      }
    });

    // Esc to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDrawer();
    });

    // Item controls
    const $items = itemsEl();
    if ($items) $items.addEventListener('click', onItemsClick);
  }

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', () => {
    renderCart();
    updateHeaderCount();
    bindGlobalEvents();
  });

  // Expose minimal API
  window.Cart = {
    add,
    remove,
    clear,
    read,
    open: openDrawer,
    close: closeDrawer,
  };
})();

