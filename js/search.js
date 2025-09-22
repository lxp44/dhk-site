/* =========================================================
   Simple search modal (no backend) — DHK clone
   - Opens via "Search" buttons, "/" or Cmd/Ctrl+K
   - Closes via ESC, overlay click, or Close button
   - Filters the on-page .product-card items as a demo
   ========================================================= */

(function () {
  const modal = document.getElementById('search-modal');
  const overlay = modal ? modal.querySelector('[data-close-search]') : null;
  const closeBtn = document.getElementById('search-close');
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  const openBtns = [
    document.getElementById('search-open'),
    document.getElementById('search-open-mobile')
  ].filter(Boolean);

  if (!modal || !overlay || !closeBtn || !input || !results) return;

  let lastActiveEl = null;

  // Build a tiny, client-side product index from the page (placeholders for now)
  const pageCards = Array.from(document.querySelectorAll('.product-card'));
  const productIndex = pageCards.map((card, i) => {
    const titleEl = card.querySelector('.pc__title');
    const priceEl = card.querySelector('.pc__price');
    const imgEl = card.querySelector('img');
    return {
      title: (titleEl?.textContent || `Product ${i + 1}`).trim(),
      price: (priceEl?.textContent || '').trim(),
      href: card.getAttribute('href') || '#',
      image: imgEl?.getAttribute('src') || ''
    };
  });

  /* ---------- Open / Close ---------- */
  function openSearch() {
    if (modal.getAttribute('aria-hidden') === 'false') return;
    lastActiveEl = document.activeElement;
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('open');
    document.body.classList.add('drawer-open'); // reuse scroll lock
    // prefill with nothing & focus
    input.value = '';
    renderResults(productIndex); // show all (or comment out to show empty state)
    setTimeout(() => input.focus(), 0);
  }

  function closeSearch() {
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('open');
    document.body.classList.remove('drawer-open');
    results.innerHTML = '';
    if (lastActiveEl && typeof lastActiveEl.focus === 'function') {
      lastActiveEl.focus();
    }
  }

  openBtns.forEach(btn => btn.addEventListener('click', openSearch));
  overlay.addEventListener('click', closeSearch);
  closeBtn.addEventListener('click', closeSearch);

  // ESC closes
  window.addEventListener('keydown', (e) => {
    if (modal.getAttribute('aria-hidden') === 'false' && e.key === 'Escape') {
      e.preventDefault();
      closeSearch();
    }
  });

  // Keyboard shortcuts to open: "/" or Cmd/Ctrl+K
  window.addEventListener('keydown', (e) => {
    if (modal.getAttribute('aria-hidden') === 'false') return;
    const activeTag = document.activeElement?.tagName?.toLowerCase();
    const isTyping = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || document.activeElement?.isContentEditable;

    // "/" opens when not typing
    if (e.key === '/' && !isTyping) {
      e.preventDefault();
      openSearch();
      return;
    }
    // Cmd/Ctrl + K opens
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openSearch();
    }
  });

  /* ---------- Focus trap (basic) ---------- */
  modal.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const f = Array.from(focusables).filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  /* ---------- Search logic (client-side demo) ---------- */
  let debounceTimer = null;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const q = input.value.trim().toLowerCase();
      if (!q) {
        renderResults(productIndex); // show all on empty; change to [] for empty state
        return;
      }
      const filtered = productIndex.filter(p => p.title.toLowerCase().includes(q));
      renderResults(filtered, q);
    }, 120);
  });

  function renderResults(items, q = '') {
    if (!items.length) {
      results.innerHTML = `
        <div class="search-results__empty">
          <p>No results for <strong>${escapeHTML(q)}</strong>.</p>
          <p class="hint">Tip: this is a static demo — results come from the product cards on this page.</p>
        </div>`;
      return;
    }

    results.innerHTML = `
      <ul class="search-results__list" role="list">
        ${items.map(item => `
          <li class="search-results__item">
            <a class="search-results__link" href="${escapeAttr(item.href)}">
              ${item.image ? `<img class="search-results__thumb" src="${escapeAttr(item.image)}" alt="">` : ''}
              <span class="search-results__meta">
                <span class="search-results__title">${highlight(item.title, q)}</span>
                ${item.price ? `<span class="search-results__price">${escapeHTML(item.price)}</span>` : ''}
              </span>
            </a>
          </li>
        `).join('')}
      </ul>
    `;
  }

  /* ---------- Tiny helpers ---------- */
  function escapeHTML(s = '') {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function escapeAttr(s = '') {
    return escapeHTML(String(s));
  }
  function highlight(text, q) {
    if (!q) return escapeHTML(text);
    const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
    return escapeHTML(text).replace(re, '<mark>$1</mark>');
  }
})();

