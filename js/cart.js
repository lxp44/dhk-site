// js/cart.js
(() => {
  if (window.__DHK_CART_LOADED__) return;           // --- Singleton guard ---
  window.__DHK_CART_LOADED__ = true;

  // ===========================
  //  STRIPE (Optional) - Frontend publishable key
  // ===========================
  const STRIPE_PUBLISHABLE_KEY = "";

  const STORAGE_KEY = 'dhk_cart_v1';

  // Discount storage + config (PLUS = 25% off)
  const DISCOUNT_STORAGE_KEY = 'dhk_discount_v1';
  const DISCOUNT_CODES = {
    PLUS: { type: 'percent', value: 25 }
  };

  // ---------- Price helpers ----------
  function toCents(v) {
    if (v == null) return 0;
    if (typeof v === 'number' && Number.isFinite(v)) {
      return v >= 1000 ? Math.round(v) : Math.round(v * 100);
    }
    if (typeof v === 'string') {
      const clean = v.replace(/[$,\s]/g, '');
      if (!clean) return 0;
      const n = Number(clean);
      if (!Number.isFinite(n)) return 0;
      return Math.round(n * 100);
    }
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }

  function centsFromElement(el) {
    if (!el) return 0;
    const pc = el.getAttribute('data-price-cents');
    if (pc != null) {
      const n = Number(pc);
      return Number.isFinite(n) ? Math.round(n) : 0;
    }
    const pd = el.getAttribute('data-price');
    if (pd != null) return toCents(pd);
    return 0;
  }

  const fmt = (n) => (n || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  const keyFor = (item) => item.id + (item.variant ? `__${item.variant}` : '');

  // ---------- Storage (with migration) ----------
  function migrateItems(items) {
    return (Array.isArray(items) ? items : []).map((it) => {
      const out = { ...it };
      out.qty = Math.max(1, Math.round(Number(out.qty) || 1));
      if (out.priceCents == null) {
        if (out.price != null) {
          out.priceCents = toCents(out.price);
          delete out.price;
        } else {
          out.priceCents = 0;
        }
      } else {
        out.priceCents = Math.round(Number(out.priceCents)) || 0;
      }
      if (!('stripePriceId' in out)) out.stripePriceId = null;
      return out;
    });
  }

  function read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const items = migrateItems(parsed);
      if (JSON.stringify(parsed) !== JSON.stringify(items)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      }
      return items;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
  }

  function write(items) {
    const safe = migrateItems(items || []);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    render();
    updateHeaderCount();
  }

  function clear() { write([]); }

  // ---------- Discount helpers ----------
  function readDiscount() {
    try {
      const raw = localStorage.getItem(DISCOUNT_STORAGE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || !d.code) return null;
      return d;
    } catch {
      localStorage.removeItem(DISCOUNT_STORAGE_KEY);
      return null;
    }
  }

  function saveDiscount(obj) {
    if (!obj) {
      localStorage.removeItem(DISCOUNT_STORAGE_KEY);
      return;
    }
    localStorage.setItem(DISCOUNT_STORAGE_KEY, JSON.stringify(obj));
  }

  function discountAmountCents(subtotalCents, d) {
    if (!d || !subtotalCents) return 0;
    if (d.type === 'percent') {
      return Math.round(subtotalCents * (d.value / 100));
    }
    if (d.type === 'fixed') {
      return Math.min(subtotalCents, Math.round(Number(d.value) || 0));
    }
    return 0;
  }

  // ---------- Totals ----------
  const subtotalCents = (items) =>
    (items || []).reduce((sum, it) => sum + (Number(it.priceCents) || 0) * (Number(it.qty) || 1), 0);

  // ---------- Public API ----------
  function add(item, options = { open: true }) {
    const items = read();
    const key = keyFor(item);
    const i = items.findIndex((it) => it.key === key);

    let priceCents = 0;
    if (item.priceCents != null) {
      priceCents = Math.round(Number(item.priceCents)) || 0;
    } else if (item.price != null) {
      priceCents = toCents(item.price);
    } else if (item.el) {
      priceCents = centsFromElement(item.el);
    }

    if (i >= 0) {
      items[i].qty = (Number(items[i].qty) || 1) + 1;
      if (!items[i].priceCents && priceCents) items[i].priceCents = priceCents;
      if (!items[i].stripePriceId && item.stripePriceId) items[i].stripePriceId = item.stripePriceId;
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
        stripePriceId: item.stripePriceId || null,
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
  // Prefer full cart page when it exists
  const p = pageEls();
  if (p.items && p.empty && p.subtotal) {
    return { type: 'page', ...p };
  }

  // Fallback to drawer (product pages, etc.)
  const d = drawerEls();
  if (d.items && d.empty && d.subtotal) {
    return { type: 'drawer', ...d };
  }

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
    const each = fmt((Number(it.priceCents) || 0) / 100);
    const line = fmt(((Number(it.priceCents) || 0) * (Number(it.qty) || 1)) / 100);
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
          <div class="ci__price-each">${each} ea</div>
          <div class="ci__controls">
            <button class="ci__qty-btn" type="button" data-decr aria-label="Decrease quantity">−</button>
            <span class="ci__qty" aria-live="polite">${Number(it.qty) || 1}</span>
            <button class="ci__qty-btn" type="button" data-incr aria-label="Increase quantity">+</button>
            <button class="ci__remove" type="button" data-remove aria-label="Remove">Remove</button>
          </div>
        </div>
        <div class="ci__line">${line}</div>
      </div>`;
  }

  // ---------- Discount UI update ----------
  function updateDiscountUi(subtotal, discountCents, d) {
    const input = document.getElementById('discount-code');
    const msg   = document.getElementById('discount-message');

    if (!input && !msg) return;

    const items = read();
    if (!items.length) {
      if (msg) {
        msg.textContent = '';
        msg.classList.remove('cart-discount__message--error');
      }
      if (input) input.value = '';
      saveDiscount(null);
      return;
    }

    if (d && discountCents > 0) {
      if (msg) {
        msg.textContent = `Code ${d.code} applied — -${fmt(discountCents / 100)} (${d.value}% off)`;
        msg.classList.remove('cart-discount__message--error');
      }
      if (input && !input.value) input.value = d.code;
    } else if (msg) {
      msg.textContent = '';
      msg.classList.remove('cart-discount__message--error');
    }
  }

  // ---------- Render ----------
  function render() {
    const ctx = getContext();
    const items = read();

    if (ctx.type === 'none') {
      updateHeaderCount();
      return;
    }

    const subtotal = subtotalCents(items);

    if (items.length === 0) {
      ctx.items.innerHTML = '';
      ctx.empty.hidden = false;
      ctx.subtotal.textContent = fmt(0);
      if (ctx.checkout) ctx.checkout.disabled = true;
      updateDiscountUi(0, 0, null);
      return;
    }

    ctx.empty.hidden = true;
    ctx.items.innerHTML = items.map(rowHtml).join('');

    if (ctx.type === 'drawer') {
      // Drawer shows raw subtotal
      ctx.subtotal.textContent = fmt(subtotal / 100);
    } else if (ctx.type === 'page') {
      const d = readDiscount();
      const discountC = discountAmountCents(subtotal, d);
      const total = Math.max(0, subtotal - discountC);
      ctx.subtotal.textContent = fmt(total / 100);
      updateDiscountUi(subtotal, discountC, d);
    }

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
      if (next === 0) items.splice(idx, 1);
      else items[idx].qty = next;
      write(items);
    }
  }

  // ---------- Stripe Checkout ----------
  async function startCheckout() {
    try {
      const items = read();

      const lineItems = items
        .filter(it => it.stripePriceId)
        .map(it => ({
          price: it.stripePriceId,
          quantity: Math.max(1, Number(it.qty) || 1),
        }));

      if (lineItems.length === 0) {
        alert("Your cart items are missing Stripe price IDs.");
        return;
      }

      const discount = readDiscount();

      const res = await fetch('/.netlify/functions/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lineItems,
          discountCode: discount ? discount.code : null,
          success_url: window.location.origin + '/success.html',
          cancel_url:  window.location.origin + '/cancel.html',
        }),
      });

      if (!res.ok) throw new Error('Checkout request failed');
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      if (STRIPE_PUBLISHABLE_KEY && window.Stripe && data.id) {
        const stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY);
        const { error } = await stripe.redirectToCheckout({ sessionId: data.id });
        if (error) throw error;
      } else {
        alert('Stripe did not return a checkout URL.');
      }
    } catch (err) {
      console.error(err);
      alert('Checkout failed. Please try again.');
    }
  }

  function bindCheckoutButtons() {
    const drawerBtn = document.getElementById('cart-checkout');
    const pageBtn   = document.getElementById('cartp-checkout');

    if (drawerBtn && !drawerBtn.__dhkBound) {
      drawerBtn.addEventListener('click', startCheckout);
      drawerBtn.__dhkBound = true;
    }
    if (pageBtn && !pageBtn.__dhkBound) {
      pageBtn.addEventListener('click', startCheckout);
      pageBtn.__dhkBound = true;
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
    }, { passive: true });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDrawer();
    });

    const attach = () => {
      const ctx = getContext();
      const container = ctx.items;
      if (container && !container.__dhkBound) {
        container.addEventListener('click', onItemsClick);
        container.__dhkBound = true;
      }
    };

    attach();
    const _render = render;
    render = function patchedRender() { // eslint-disable-line no-func-assign
      _render();
      attach();
    };
  }

  function bindDiscount() {
    const input = document.getElementById('discount-code');
    const btn   = document.getElementById('discount-apply');
    const msg   = document.getElementById('discount-message');
    if (!input || !btn) return;

    const apply = () => {
      const raw = (input.value || '').trim().toUpperCase();
      if (!raw) {
        saveDiscount(null);
        if (msg) {
          msg.textContent = '';
          msg.classList.remove('cart-discount__message--error');
        }
        render();
        return;
      }

      const cfg = DISCOUNT_CODES[raw];
      if (!cfg) {
        saveDiscount(null);
        if (msg) {
          msg.textContent = 'Code not valid.';
          msg.classList.add('cart-discount__message--error');
        }
        render();
        return;
      }

      const d = { code: raw, ...cfg };
      saveDiscount(d);
      if (msg) {
        msg.textContent = 'Code applied.';
        msg.classList.remove('cart-discount__message--error');
      }
      render();
    };

    btn.addEventListener('click', apply);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        apply();
      }
    });

    const saved = readDiscount();
    if (saved && saved.code && !input.value) {
      input.value = saved.code;
    }
  }

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', () => {
    render();
    updateHeaderCount();
    bindGlobalEvents();
    bindCheckoutButtons();
    bindDiscount();
  });

  // Expose API
  window.Cart = { add, remove, clear, read, open: openDrawer, close: closeDrawer };
})();