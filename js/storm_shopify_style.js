// js/storm_shopify_style.js
(function () {
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts || false);

  // Elements (assigned after DOMContentLoaded)
  let popup, overlay, canvas, ctx;
  // Audio
  let A = {};
  const STAGES = ["light", "med", "heavy"];
  let hasStarted = false;

  // loudness
  const VOLS = { light: 0.35, med: 0.5, heavy: 0.7 };
  const thunderBias = { light: 0.35, med: 0.6, heavy: 0.85 };

  function inferStageFromURL() {
    const p = location.pathname.toLowerCase();
    if (p.endsWith("/shop.html") || p.includes("/collections") || p.includes("/products")) return "med";
    if (p.includes("cart") || p.includes("checkout") || p.endsWith("/checkout.html")) return "heavy";
    return "light";
  }

  function safePlay(el) {
    if (!el) return Promise.resolve();
    try {
      el.muted = false;
      if (!Number.isFinite(el.volume)) el.volume = 0;
      return el.play().catch(() => {});
    } catch {
      return Promise.resolve();
    }
  }

  function hookAudio() {
    A = {
      rain: {
        light: document.querySelector("#rain-light"),
        med: document.querySelector("#rain-med"),
        heavy: document.querySelector("#rain-heavy"),
      },
      thunder: {
        light: document.querySelector("#thunder-light"),
        med: document.querySelector("#thunder-med"),
        heavy: document.querySelector("#thunder-heavy"),
      },
    };
    for (const k of STAGES) {
      const r = A.rain[k], t = A.thunder[k];
      if (r) { r.muted = true; r.volume = 0; }
      if (t) { t.muted = true; t.volume = 0; }
    }
  }

  // Clamp helper
  const clamp01 = (v) => Math.max(0, Math.min(1, v || 0));

  function fadeTo(el, to, ms = 450) {
    if (!el) return;
    const from = clamp01(el.volume);
    to = clamp01(to);
    if (Math.abs(from - to) < 0.01) { el.volume = to; return; }
    const start = performance.now();
    function step(t) {
      const k = Math.min(1, (t - start) / ms);
      const v = clamp01(from + (to - from) * k);
      el.volume = v;
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function setStage(next) {
    if (!STAGES.includes(next)) next = "light";

    // ensure all playing & unmuted
    for (const k of STAGES) {
      safePlay(A.rain[k]);
      safePlay(A.thunder[k]);
      if (A.rain[k]) A.rain[k].muted = false;
      if (A.thunder[k]) A.thunder[k].muted = false;
    }

    const rTarget = clamp01(VOLS[next]);
    const tTarget = clamp01(rTarget * thunderBias[next]);

    for (const k of STAGES) {
      fadeTo(A.rain[k], k === next ? rTarget : 0);
      fadeTo(A.thunder[k], k === next ? tTarget : 0);
    }
  }

  function startVisuals() {
    if (!overlay || !canvas) return;
    overlay.style.display = "block";
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    if (!ctx) ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drops = Array.from({ length: 260 }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      len: Math.random() * 22 + 10,
      speed: Math.random() * 3 + 2.4,
    }));

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of drops) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x, d.y + d.len);
      }
      ctx.stroke();
      for (const d of drops) {
        d.y += d.speed;
        if (d.y > canvas.height) {
          d.y = -d.len;
          d.x = Math.random() * canvas.width;
        }
      }
      requestAnimationFrame(draw);
    }
    draw();

    function flashOnce() {
      overlay.style.backgroundColor = "rgba(255,255,255,0.28)";
      setTimeout(() => (overlay.style.backgroundColor = "transparent"), 100);
      setTimeout(() => { if (Math.random() > 0.55) flashOnce(); }, Math.random() * 8000 + 2500);
    }
    setTimeout(flashOnce, 1800);
  }

  function hidePopup() {
    if (!popup) return;
    popup.style.opacity = "0";
    setTimeout(() => popup && popup.remove(), 350);
  }

  async function unlockAudioAll() {
    for (const k of STAGES) {
      await safePlay(A.rain[k]);
      await safePlay(A.thunder[k]);
      if (A.rain[k]) A.rain[k].muted = false;
      if (A.thunder[k]) A.thunder[k].muted = false;
    }
  }

  async function startStorm() {
    if (hasStarted) return;
    hasStarted = true;

    hidePopup();
    startVisuals();

    hookAudio();
    await unlockAudioAll();
    setStage(inferStageFromURL());

    // remember entry
    localStorage.setItem("stormEntered", "1");
  }

  function attachProximityBoosts() {
    const boostSel = [
      'a[href*="checkout"]',
      'a[href*="cart"]',
      'a[data-loud="heavy"]',
      '.button--checkout',
      '.button--cart',
    ].join(",");
    document.querySelectorAll(boostSel).forEach((el) => {
      on(el, "mouseenter", () => setStage("heavy"));
      on(el, "focus", () => setStage("heavy"));
      on(el, "mouseleave", () => setStage(inferStageFromURL()));
      on(el, "blur", () => setStage(inferStageFromURL()));
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    // IMPORTANT: assign to outer variables (don’t shadow)
    popup   = document.getElementById("storm-popup");
    overlay = document.getElementById("storm-overlay");
    canvas  = document.getElementById("rain-canvas");
    ctx     = canvas ? canvas.getContext("2d") : null;

    const html = document.documentElement;

    const hasBypass = () => {
      if (window.STORM_BYPASS === true) return true;
      if (localStorage.getItem("stormEntered") === "1") return true;
      const p = new URLSearchParams(location.search);
      return p.has("skipStorm") && p.get("skipStorm") !== "0";
    };

    if (html.classList.contains("storm-skipped")) {
      popup?.remove();
      overlay?.remove();
      document.querySelector(".lightning-flash")?.remove();
      return;
    }

    if (hasBypass()) {
      popup?.remove();
      // comment out next line if you want a true no-storm bypass
      startStorm();
      return;
    }

    attachProximityBoosts();

    const onFirstGesture = () => startStorm();
    ["click", "touchstart", "keydown", "scroll"].forEach((evt) =>
      document.addEventListener(evt, onFirstGesture, { once: true, passive: true })
    );
    popup && popup.addEventListener("click", onFirstGesture, { once: true, passive: true });

    window.addEventListener("resize", () => {
      if (!canvas) return;
      canvas.width = innerWidth;
      canvas.height = innerHeight;
    });
  });
})();
