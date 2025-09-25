// js/cart.js
(() => {
  const STORAGE_KEY = 'dhk_cart_v1';

  // -------- Storage --------
  function read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
  }
  function write(items) {
    const safe = Array.isArray(items) ? items : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    renderCart();
    updateHeaderCount();
  }
  function clear() { write([]); }

  // -------- Utils --------
  const fmt = (n) => (n || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  const keyFor = (item) => item.id + (item.variant ? `__${item.variant}` : '');
  const subtotal = (items) => (items || []).reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);

  // -------- Public API --------
  function add(item, options = { open: true }) {
    const items = read();
    const key = keyFor(item);
    const i = items.findIndex((it) => it.key === key);
    if (i >= 0) {
      items[i].qty = (Number(items[i].qty) || 1) + 1;
    } else {
      items.push({
        key,
        id: item.id,
        title: item.title,
        price: Number(item.price) || 0,
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

  // -------- Drawer nodes --------
  const drawer     = () => document.getElementById('cart-drawer');
  const itemsEl    = () => document.getElementById('cart-items');
  const emptyEl    = () => document.getElementById('cart-empty');
  const subtotalEl = () => document.getElementById('cart-subtotal');
  const checkoutBtn= () => document.getElementById('cart-checkout');

  // -------- Drawer control --------
  function openDrawer() {
    const el = drawer();
    if (!el) return;
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('no-scroll');
    el.querySelector('.cart-drawer__panel')?.focus();
  }
  function closeDrawer() {
    const el = drawer();
    if (!el) return;
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('no-scroll');
  }

  // -------- Render --------
  function renderCart() {
    const cartItems = read();
    const $items = itemsEl();
    const $empty = emptyEl();
    const $subtotal = subtotalEl();
    const $checkout = checkoutBtn();

    // Not all pages have the drawer; if missing, just update header count.
    if (!$items || !$empty || !$subtotal || !$checkout) {
      updateHeaderCount();
      return;
    }

    if (cartItems.length === 0) {
      $items.innerHTML = '';
      $empty.hidden = false;
      $subtotal.textContent = fmt(0);
      $checkout.disabled = true;
      return;
    }

    $empty.hidden = true;
    $items.innerHTML = cartItems.map((it) => {
      const priceEach = fmt(Number(it.price) || 0);
      const linePrice = fmt((Number(it.price) || 0) * (Number(it.qty) || 1));
      const thumb = it.thumbnail ? `<img src="${it.thumbnail}" alt="" loading="lazy" />` : '';
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
              <span class="ci__qty" aria-live="polite">${Number(it.qty) || 1}</span>
              <button class="ci__qty-btn" type="button" data-incr aria-label="Increase quantity">+</button>
              <button class="ci__remove" type="button" data-remove aria-label="Remove">Remove</button>
            </div>
          </div>
          <div class="ci__line">${linePrice}</div>
        </div>`;
    }).join('');

    $subtotal.textContent = fmt(subtotal(cartItems));
    $checkout.disabled = false;
  }

  // -------- Header bubble/count --------
  function updateHeaderCount() {
    const items = read();
    const count = items.reduce((n, it) => n + (Number(it.qty) || 1), 0);

    // Preferred hook
    document.querySelectorAll('[data-cart-count], .cart-count').forEach((el) => {
      el.textContent = count > 0 ? String(count) : '';
      if ('hidden' in el) el.hidden = count === 0;
    });

    // Optional: ensure a bubble inside header Cart link if none present
    let bubble = document.getElementById('cart-count');
    if (!bubble) {
      const cartLink = document.querySelector('a[aria-label="Cart"]');
      if (cartLink) {
        bubble = document.createElement('span');
        bubble.id = 'cart-count';
        bubble.className = 'cart-count-bubble';
        cartLink.appendChild(bubble);
      }
    }
    if (bubble) bubble.textContent = count > 0 ? String(count) : '';
  }

  // -------- Events --------
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
      items[idx].qty = (Number(items[idx].qty) || 1) + 1;
      write(items);
    } else if (e.target.matches('[data-decr]')) {
      const next = Math.max(0, (Number(items[idx].qty) || 1) - 1);
      if (next === 0) {
        items.splice(idx, 1);
      } else {
        items[idx].qty = next;
      }
      write(items);
    }
  }

  function bindGlobalEvents() {
    // open/close triggers
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-cart-open]')) {
        e.preventDefault();
        openDrawer();
      }
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

  // -------- Init --------
  document.addEventListener('DOMContentLoaded', () => {
    renderCart();
    updateHeaderCount();
    bindGlobalEvents();
  });

  // Expose minimal API
  window.Cart = { add, remove, clear, read, open: openDrawer, close: closeDrawer };
})();
