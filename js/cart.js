// js/cart.js
(() => {
  const STORAGE_KEY = 'dhk_cart_v1';

  // ---------- Helpers ----------
  // Convert any reasonable price input to integer cents.
  function toCents(v) {
    if (v == null) return 0;
    // If it's already cents (integer >= 100 and no '.'), accept via hint key priceCents
    if (typeof v === 'number' && Number.isFinite(v)) {
      // Heuristic: treat small numbers as dollars, big as cents
      return v >= 1000 ? Math.round(v) : Math.round(v * 100);
    }
    if (typeof v === 'string') {
      // strip $ and commas and spaces
      const clean = v.replace(/[$,\s]/g, '');
      if (clean === '') return 0;
      // if it's integer-like (no dot) assume dollars
      if (!clean.includes('.')) {
        const n = Number(clean);
        return Number.isFinite(n) ? Math.round(n * 100) : 0;
      }
      // has decimal
      const n = Number(clean);
      return Number.isFinite(n) ? Math.round(n * 100) : 0;
    }
    // Fallback
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }

  const fmt = (n) => (n || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  const keyFor = (item) => item.id + (item.variant ? `__${item.variant}` : '');

  // ---------- Storage (with migration) ----------
  function migrateItems(items) {
    // Ensure each item has priceCents (integer) and sane qty
    const out = (items || []).map((it) => {
      const copy = { ...it };
      if (copy.priceCents == null) {
        // try legacy fields
        if (copy.price != null) {
          copy.priceCents = toCents(copy.price);
          delete copy.price; // reduce confusion going forward
        } else {
          copy.priceCents = 0;
        }
      } else {
        copy.priceCents = Math.round(Number(copy.priceCents)) || 0;
      }
      copy.qty = Math.max(1, Math.round(Number(copy.qty) || 1));
      return copy;
    });
    return out;
  }

  function read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const items = Array.isArray(parsed) ? parsed : [];
      const migrated = migrateItems(items);
      // If migration changed shape, persist it back
      if (JSON.stringify(items) !== JSON.stringify(migrated)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      }
      return migrated;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
  }

  function write(items) {
    const safe = migrateItems(Array.isArray(items) ? items : []);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    render();
    updateHeaderCount();
  }

  function clear() { write([]); }

  // ---------- Totals ----------
  const subtotalCents = (items) =>
    (items || []).reduce((sum, it) => sum + (Number(it.priceCents) || 0) * (Number(it.qty) || 1), 0);

  // ---------- Public API ----------
  function add(item, options = { open: true }) {
    const items = read();
    const key = keyFor(item);
    const i = items.findIndex((it) => it.key === key);

    // Prefer item.priceCents if provided; else derive from item.price (string/number dollars)
    const priceCents =
      item.priceCents != null
        ? Math.round(Number(item.priceCents)) || 0
        : toCents(item.price);

    if (i >= 0) {
      items[i].qty = (Number(items[i].qty) || 1) + 1;
      // If the product’s price was missing previously for some reason, backfill it
      if (!items[i].priceCents && priceCents) items[i].priceCents = priceCents;
    } else {
      items.push({
        key,
        id: item.id,
        title: item.title,
        priceCents,
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

  // ---------- Element getters ----------
  const drawerEls = () => ({
    wrapper:    document.getElementById('cart-drawer'),
    items:      document.getElementById('cart-items'),
    empty:      document.getElementById('cart-empty'),
    subtotal:   document.getElementById('cart-subtotal'),
    checkout:   document.getElementById('cart-checkout'),
    overlay:    document.querySelector('#cart-drawer .cart-drawer__overlay'),
    panel:      document.querySelector('#cart-drawer .cart-drawer__panel'),
  });

  const pageEls = () => ({
    wrapper:    document.getElementById('cart-page'),
    items:      document.getElementById('cartp-items'),
    empty:      document.getElementById('cartp-empty'),
    subtotal:   document.getElementById('cartp-subtotal'),
    checkout:   document.getElementById('cartp-checkout'),
  });

  function getContext() {
    const d = drawerEls();
    if (d.items && d.empty && d.subtotal) return { type: 'drawer', ...d };
    const p = pageEls();
    if (p.items && p.empty && p.subtotal) return { type: 'page', ...p };
    return { type: 'none' };
  }

  // ---------- Drawer control ----------
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

  // ---------- Row HTML ----------
  function rowHtml(it) {
    const priceEach = fmt((Number(it.priceCents) || 0) / 100);
    const linePrice = fmt(((Number(it.priceCents) || 0) * (Number(it.qty) || 1)) / 100);
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

  // ---------- Render ----------
  function render() {
    const ctx = getContext();
    const items = read();

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
    ctx.subtotal.textContent = fmt(subtotalCents(items) / 100);
    if (ctx.checkout) ctx.checkout.disabled = false;
  }

  // ---------- Header bubble ----------
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

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDrawer();
    });

    const attach = () => {
      const ctx = getContext();
      const container = ctx.items;
      if (container && !container._dhkBound) {
        container.addEventListener('click', onItemsClick);
        container._dhkBound = true;
      }
    };
    attach();
    const origRender = render;
    render = function patchedRender() {
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

  // Expose API
  window.Cart = { add, remove, clear, read, open: openDrawer, close: closeDrawer };
})();
