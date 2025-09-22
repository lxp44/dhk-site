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

