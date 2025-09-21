// js/storm_shopify_style.js
(function () {
  const $ = (sel) => document.querySelector(sel);
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts || false);

  // Elements
  let popup, overlay, canvas, ctx;
  let A = {}; // audio elements
  let rafId = null;
  let hasStarted = false;

  // Stage handling
  const STAGES = /** @type const */ (["light", "med", "heavy"]);
  let currentStage = "light";
  let targetStage = "light";
  const VOLS = { light: 0.22, med: 0.35, heavy: 0.5 };  // overall loudness caps
  const thunderBias = { light: 0.25, med: 0.45, heavy: 0.7 }; // thunder relative to rain

  // URL-based routing (tweak to your filenames)
  function inferStageFromURL() {
    const p = location.pathname.toLowerCase();
    if (p.endsWith("/shop.html") || p.includes("/collections") || p.includes("/products")) return "med";
    if (p.includes("cart") || p.includes("checkout") || p.endsWith("/checkout.html")) return "heavy";
    return "light";
  }

  // Bypass helpers
  function hasBypass() {
    const url = new URL(location.href);
    return url.hash.includes("bypass") || url.search.includes("preview=1");
  }

  // Safe audio play wrapper
  async function safePlay(el) {
    if (!el) return;
    try {
      await el.play();
    } catch (_) {
      // ignored: will still clear UI even if audio blocked
    }
  }

  // Prepare audio refs
  function hookAudio() {
    A = {
      rain: {
        light: $("#rain-light"),
        med: $("#rain-med"),
        heavy: $("#rain-heavy"),
      },
      thunder: {
        light: $("#thunder-light"),
        med: $("#thunder-med"),
        heavy: $("#thunder-heavy"),
      },
    };
    // Prime volumes low
    for (const k of STAGES) {
      if (A.rain[k]) A.rain[k].volume = 0;
      if (A.thunder[k]) A.thunder[k].volume = 0;
    }
  }

  // Fade helper
  function fadeTo(el, to, ms = 600) {
    if (!el) return;
    const from = el.volume;
    if (Math.abs(from - to) < 0.01) { el.volume = to; return; }
    const start = performance.now();
    function step(t) {
      const k = Math.min(1, (t - start) / ms);
      el.volume = from + (to - from) * k;
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Switch stage by crossfading sources
  function setStage(next) {
    if (!STAGES.includes(next)) next = "light";
    targetStage = next;
    if (currentStage === next) return;
    currentStage = next;

    // Start all tracks (muted), then fade selected up & others down
    for (const k of STAGES) {
      safePlay(A.rain[k]);
      safePlay(A.thunder[k]);
    }
    const rTarget = VOLS[next];
    const tTarget = Math.min(1, rTarget * thunderBias[next]);

    for (const k of STAGES) {
      fadeTo(A.rain[k], k === next ? rTarget : 0);
      fadeTo(A.thunder[k], k === next ? tTarget : 0);
    }
  }

  // Lightning + rain visual
  function startVisuals() {
    overlay.style.display = "block";
    canvas.width = innerWidth;
    canvas.height = innerHeight;
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
      rafId = requestAnimationFrame(draw);
    }
    draw();

    // Lightning pulses
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
    setTimeout(() => popup.remove(), 450);
  }

  async function startStorm() {
    if (hasStarted) return;
    hasStarted = true;

    hidePopup();
    startVisuals();

    // Play all quietly, then set stage (so crossfades work)
    hookAudio();
    for (const k of STAGES) {
      await safePlay(A.rain[k]);
      await safePlay(A.thunder[k]);
    }
    setStage(inferStageFromURL());
    localStorage.setItem("stormEntered", "true");
  }

  // Link-based proximity boosts (hovering Checkout/Cart ramps to heavy)
  function attachProximityBoosts() {
    const boostSel = [
      'a[href*="checkout"]',
      'a[href*="cart"]',
      'a[data-loud="heavy"]', // you can add this attr to any link/button you want to get loud
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

  // Init after DOM ready
  document.addEventListener("DOMContentLoaded", () => {
    popup = $("#storm-popup");
    overlay = $("#storm-overlay");
    canvas = $("#rain-canvas");
    ctx = canvas.getContext("2d");

    const bypass = hasBypass() || localStorage.getItem("stormEntered") === "true";

    attachProximityBoosts();

    if (bypass) {
      if (popup) popup.remove();
      startStorm();
      return;
    }

    // Start on first user interaction
    ["click", "touchstart", "keydown", "scroll"].forEach((evt) =>
      on(document, evt, startStorm, { once: true, passive: true })
    );

    // Absolute fallback — avoid trapping users
    setTimeout(() => {
      if (!hasStarted) startStorm();
    }, 3000);

    // Keep canvas sized
    on(window, "resize", () => {
      if (!canvas) return;
      canvas.width = innerWidth;
      canvas.height = innerHeight;
    });
  });
})();
