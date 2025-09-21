// js/announce.js
document.addEventListener("DOMContentLoaded", () => {
  const bar = document.querySelector(".utility-bar");
  if (!bar) return;

  let lastScroll = 0;
  window.addEventListener("scroll", () => {
    const current = window.scrollY;

    if (current > lastScroll && current > 80) {
      bar.classList.add("hide");
    } else {
      bar.classList.remove("hide");
    }

    lastScroll = current;
  });
});

