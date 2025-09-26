// js/cart.js
(() => {
  const STORAGE_KEY = 'dhk_cart_v1';

  // ---------- Storage ----------
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
    render();          // re-render whichever context is present
    updateHeaderCount();
  }
  function clear() { write([]); }

  // ---------- Utils ----------
  const fmt = (n) => (n || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  const keyFor = (item) => item.id + (item.variant ? `__${item.variant}` : '');
  const subtotal = (items) => (items || []).reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);

  // ---------- Public API ----------
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
        price: Number(item.price) || 0,  // cents
        variant: item.variant || null,
        thumbnail: item.thumbnail || null,
        qty: 1,
        url: item.url || null,
      });
    }
    write(items);
    if (options.open) openDrawer(); // no-op on pages without drawer
  }

  function remove(key) {
    const items = read().filter((it) => it.key !== key);
    write(items);
  }

  // ---------- Element getters: Drawer ----------
  const drawerEls = () => ({
    wrapper:    document.getElementById('cart-drawer'),
    items:      document.getElementById('cart-items'),
    empty:      document.getElementById('cart-empty'),
    subtotal:   document.getElementById('cart-subtotal'),
    checkout:   document.getElementById('cart-checkout'),
    overlay:    document.querySelector('#cart-drawer .cart-drawer__overlay'),
    panel:      document.querySelector('#cart-drawer .cart-drawer__panel'),
  });

  // ---------- Element getters: Page ----------
  const pageEls = () => ({
    wrapper:    document.getElementById('cart-page'),
    items:      document.getElementById('cartp-items'),
    empty:      document.getElementById('cartp-empty'),
    subtotal:   document.getElementById('cartp-subtotal'),
    checkout:   document.getElementById('cartp-checkout'),
  });

  // Decide where to render
  function getContext() {
    const d = drawerEls();
    if (d.items && d.empty && d.subtotal) return { type: 'drawer', ...d };
    const p = pageEls();
    if (p.items && p.empty && p.subtotal) return { type: 'page', ...p };
    return { type: 'none' };
  }

  // ---------- Drawer control (safe no-op on page) ----------
  function openDrawer() {
    const ctx = getContext();
    if (ctx.type !== 'drawer') return;
    ctx.wrapper.classList.add('is-open');
    ctx.wrapper.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('no-scroll');
    ctx.panel?.focus();
  }
  function closeDrawer() {
    const ctx = getContext();
    if (ctx.type !== 'drawer') return;
    ctx.wrapper.classList.remove('is-open');
    ctx.wrapper.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('no-scroll');
  }

  // ---------- Shared row HTML ----------
  function rowHtml(it) {
    const priceEach = fmt((Number(it.price) || 0) / 100);
    const linePrice = fmt(((Number(it.price) || 0) * (Number(it.qty) || 1)) / 100);
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
  }

  // ---------- Render (auto chooses drawer or page) ----------
  function render() {
    const ctx = getContext();
    const items = read();

    // If neither drawer nor page exists, just update header bubble and bail.
    if (ctx.type === 'none') {
      updateHeaderCount();
      return;
    }

    if (items.length === 0) {
      ctx.items.innerHTML = '';
      ctx.empty.hidden = false;
      ctx.subtotal.textContent = fmt(0);
      if (ctx.checkout) ctx.checkout.disabled = true;
      return;
    }

    ctx.empty.hidden = true;
    ctx.items.innerHTML = items.map(rowHtml).join('');
    ctx.subtotal.textContent = fmt(subtotal(items) / 100);
    if (ctx.checkout) ctx.checkout.disabled = false;
  }

  // ---------- Header bubble/count ----------
  function updateHeaderCount() {
    const items = read();
    const count = items.reduce((n, it) => n + (Number(it.qty) || 1), 0);

    document.querySelectorAll('[data-cart-count], .cart-count').forEach((el) => {
      el.textContent = count > 0 ? String(count) : '';
      if ('hidden' in el) el.hidden = count === 0;
    });

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

  // ---------- Events ----------
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
    // open/close triggers (drawer only; safe if missing)
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-cart-open]')) {
        e.preventDefault();
        openDrawer();
      }
      if (e.target.closest('[data-cart-close]')) {
        e.preventDefault();
        closeDrawer();
      }
      const { type, overlay } = getContext();
      if (type === 'drawer' && overlay && e.target === overlay) {
        closeDrawer();
      }
    });

    // Esc to close drawer
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDrawer();
    });

    // Item controls (works for drawer or page)
    const attach = () => {
      const ctx = getContext();
      const container = ctx.items;
      if (container && !container._dhkBound) {
        container.addEventListener('click', onItemsClick);
        container._dhkBound = true;
      }
    };
    // Bind initially and rebind after each render in case DOM replaced
    attach();
    const origRender = render;
    render = function patchedRender() { // eslint-disable-line no-func-assign
      origRender();
      attach();
    };
  }

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', () => {
    render();
    updateHeaderCount();
    bindGlobalEvents();
  });

  // Expose minimal API
  window.Cart = { add, remove, clear, read, open: openDrawer, close: closeDrawer };
})();
