// js/search.js
(() => {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts || false);

  // DOM
  const modal   = $('#search-modal');
  const overlay = $('#search-modal .search-modal__overlay');
  const dlg     = $('#search-modal .search-modal__dialog');
  const openBtn = $('#search-open');
  const openBtnMobile = $('#search-open-mobile');
  const closeBtn = $('#search-close');
  const input   = $('#search-input');
  const results = $('#search-results');

  // State
  let products = [];
  let isOpen = false;
  let lastActive = null;
  let loaded = false;

  // Utils
  const fmtPrice = (cents) => {
    if (typeof cents !== 'number') return '';
    return `$${(cents / 100).toFixed(2)}`;
  };

  const debounce = (fn, ms = 150) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  // Load products.json (expects array; safely handles {products:[...]})
  async function loadProducts() {
    if (loaded) return;
    try {
      const res = await fetch('data/products.json', { cache: 'no-store' });
      const data = await res.json();
      products = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);
      loaded = true;
    } catch (err) {
      console.error('Error loading products for search:', err);
      products = [];
    }
  }

  // Search + render
  function renderResults(list) {
    if (!results) return;
    results.innerHTML = '';

    if (!list.length) {
      results.innerHTML = `<p class="search-empty">No results. Try another term.</p>`;
      return;
    }

    const frag = document.createDocumentFragment();

    list.forEach(p => {
      const a = document.createElement('a');
      a.className = 'search-result';
      a.href = p.url || `product.html?handle=${encodeURIComponent(p.id)}`;
      a.setAttribute('role', 'link');

      a.innerHTML = `
        <div class="sr__thumb">
          <img src="${p.thumbnail || (p.images && p.images[0]) || ''}" alt="${p.title || ''}">
        </div>
        <div class="sr__meta">
          <div class="sr__title">${p.title || ''}</div>
          <div class="sr__price">${fmtPrice(p.price)}</div>
        </div>
      `;
      frag.appendChild(a);
    });

    results.appendChild(frag);
  }

  const doSearch = debounce((q) => {
    const term = (q || '').trim().toLowerCase();
    if (!term) {
      // show a few featured/top items by default
      renderResults(products.slice(0, 6));
      return;
    }
    const hits = products.filter(p => {
      const hay = `${p.title || ''} ${p.description || ''}`.toLowerCase();
      return hay.includes(term);
    });
    renderResults(hits.slice(0, 20));
  }, 120);

  // Modal controls
  async function openModal() {
    if (isOpen || !modal) return;
    lastActive = document.activeElement;

    // Ensure product data is ready
    await loadProducts();

    modal.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('search-open');
    document.body.style.overflow = 'hidden';
    isOpen = true;

    // Prime results and focus
    renderResults(products.slice(0, 6));
    setTimeout(() => input && input.focus(), 0);
  }

  function closeModal() {
    if (!isOpen || !modal) return;
    modal.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('search-open');
    document.body.style.overflow = '';
    isOpen = false;

    if (input) input.value = '';
    if (results) results.innerHTML = '';
    if (lastActive && typeof lastActive.focus === 'function') {
      lastActive.focus();
    }
  }

  // Wire UI events
  on(openBtn, 'click', (e) => { e.preventDefault(); openModal(); });
  on(openBtnMobile, 'click', (e) => { e.preventDefault(); openModal(); });
  on(closeBtn, 'click', (e) => { e.preventDefault(); closeModal(); });
  on(overlay, 'click', () => closeModal());

  // Esc to close
  on(document, 'keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      closeModal();
    }
  });

  // Keyboard shortcuts to open
  on(document, 'keydown', (e) => {
    // Ignore when typing in inputs/textareas
    const tag = (e.target?.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag)) return;

    // '/' opens search
    if (e.key === '/') {
      e.preventDefault();
      openModal();
    }

    // Cmd/Ctrl + K opens search
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      openModal();
    }
  });

  // Search input
  on(input, 'input', (e) => {
    doSearch(e.target.value);
  });

  // Optional: preload products after DOM ready to feel snappier later
  document.addEventListener('DOMContentLoaded', () => {
    // Fire and forget
    loadProducts();
  });
})();
