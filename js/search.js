// js/search.js
// Handles search modal, keyboard shortcuts, and product search

async function loadProducts() {
  try {
    const res = await fetch("data/products.json");
    const data = await res.json();
    return data.products;
  } catch (err) {
    console.error("Error loading products for search:", err);
    return [];
  }
}

function renderSearchResults(products, query) {
  const results = document.querySelector("#search-results");
  if (!results) return;

  if (!query.trim()) {
    results.innerHTML = "<p>Type to search products…</p>";
    return;
  }

  const filtered = products.filter((p) =>
    p.title.toLowerCase().includes(query.toLowerCase())
  );

  if (filtered.length === 0) {
    results.innerHTML = `<p>No results for "${query}"</p>`;
    return;
  }

  results.innerHTML = filtered
    .map(
      (p) => `
      <a href="${p.url}" class="product-card">
        <div class="pc__media">
          <img src="${p.thumbnail}" alt="${p.title}" loading="lazy">
        </div>
        <div class="pc__info">
          <h3 class="pc__title">${p.title}</h3>
          <div class="pc__price">$${(p.price / 100).toFixed(2)}</div>
        </div>
      </a>
    `
    )
    .join("");
}

document.addEventListener("DOMContentLoaded", async () => {
  const products = await loadProducts();

  const modal = document.getElementById("search-modal");
  const input = document.getElementById("search-input");
  const openBtns = [document.getElementById("search-open"), document.getElementById("search-open-mobile")];
  const closeBtn = document.getElementById("search-close");
  const overlay = document.querySelector(".search-modal__overlay");

  function openSearch() {
    modal.setAttribute("aria-hidden", "false");
    input.focus();
  }
  function closeSearch() {
    modal.setAttribute("aria-hidden", "true");
    input.value = "";
    document.getElementById("search-results").innerHTML = "";
  }

  openBtns.forEach((btn) => btn && btn.addEventListener("click", openSearch));
  closeBtn?.addEventListener("click", closeSearch);
  overlay?.addEventListener("click", closeSearch);

  // Keyboard shortcuts: Esc to close, / or Cmd+K to open
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSearch();
    if ((e.key === "/" && document.activeElement.tagName !== "INPUT") ||
        (e.metaKey && e.key.toLowerCase() === "k")) {
      e.preventDefault();
      openSearch();
    }
  });

  input?.addEventListener("input", (e) => {
    renderSearchResults(products, e.target.value);
  });
});

