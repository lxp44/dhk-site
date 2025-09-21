// js/storm_shopify_style.js
(function () {
  "use strict";

  // ======= tiny helpers =======
  const $ = (sel) => document.querySelector(sel);
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts || false);
  const dbg = (...a) => { /* console.log('[storm]', ...a); */ };

  // ======= DOM refs =======
  let popup, overlay, canvas, ctx;
  let A = { rain: {}, thunder: {} };   // audio elements
  let rafId = null;
  let hasStarted = false;

  // ======= stages / volumes =======
  const STAGES = /** @type const */ (["light", "med", "heavy"]);
  let currentStage = "light";

  // master caps; we’ll keep total reasonable for mobile
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const VOLS = isMobile
    ? { light: 0.16, med: 0.25, heavy: 0.35 }
    : { light: 0.22, med: 0.35, heavy: 0.5 };

  // thunder relative to rain
  const thunderBias = { light: 0.25, med: 0.45, heavy: 0.7 };

  // ======= routing → stage =======
  function inferStageFromURL() {
    const p = location.pathname.toLowerCase();
    if (p.endsWith("/shop.html") || p.includes("/collections") || p.includes("/products")) return "med";
    if (p.includes("cart") || p.includes("checkout") || p.endsWith("/checkout.html")) return "heavy";
    return "light";
  }

  // ======= bypass helpers =======
  function hasBypass() {
    const url = new URL(location.href);
    return url.hash.includes("bypass") || url.search.includes("preview=1");
  }

  // ======= safe audio play wrapper =======
  async function safePlay(el) {
    if (!el) return;
    try {
      await el.play();
    } catch (e) {
      // browsers may block until a user gesture; that's fine, we’ll retry after interaction
      dbg("play blocked (will retry on interaction)", el.id);
    }
  }

  // ======= wire up audio elements =======
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

    // normalize initial volumes & loop flags (safety)
    for (const k of STAGES) {
      if (A.rain[k]) { A.rain[k].volume = 0; A.rain[k].loop = true; }
      if (A.thunder[k]) { A.thunder[k].volume = 0; A.thunder[k].loop = true; }
    }
  }

  // ======= volume fading =======
  function fadeTo(el, to, ms = 600) {
    if (!el) return;
    const from = el.volume ?? 0;
    if (Math.abs(from - to) < 0.01) { el.volume = to; return; }
    const start = performance.now();

    function step(t) {
      const k = Math.min(1, (t - start) / ms);
      el.volume = from + (to - from) * k;
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ======= stage switching (crossfade) =======
  function setStage(next) {
    if (!STAGES.includes(next)) next = "light";
    if (currentStage === next) return;
    currentStage = next;

    dbg("setStage →", next);

    // ensure everything is playing (muted), then fade desired pair up
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

  // ======= visuals (rain + lightning) =======
  function startVisuals() {
    if (!overlay || !canvas) return;
    overlay.style.display = "block";
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    ctx = canvas.getContext("2d");
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

    // resize handler
    on(window, "resize", () => {
      canvas.width = innerWidth;
      canvas.height = innerHeight;
    });
  }

  function hidePopup() {
    if (!popup) return;
    popup.style.opacity = "0";
    setTimeout(() => popup && popup.remove(), 450);
  }

  // ======= main start =======
  async function startStorm() {
    if (hasStarted) return;
    hasStarted = true;
    dbg("storm starting");

    hidePopup();
    startVisuals();

    hookAudio();

    // Try to start everything; if blocked, user already interacted (we're in an event), so it should work now.
    for (const k of STAGES) {
      await safePlay(A.rain[k]);
      await safePlay(A.thunder[k]);
    }

    // initial stage from URL
    setStage(inferStageFromURL());

    // remember entry so #bypass not required on next visits
    try { localStorage.setItem("stormEntered", "true"); } catch {}
  }

  // ======= hover boosts (checkout/cart) =======
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

  // ======= page visibility (pause when tab hidden) =======
  function handleVisibility() {
    if (document.hidden) {
      // fade to 0 to be polite (keeps play state intact)
      for (const k of STAGES) {
        fadeTo(A.rain[k], 0, 300);
        fadeTo(A.thunder[k], 0, 300);
      }
    } else {
      // restore current stage
      setStage(currentStage);
    }
  }

  // ======= boot =======
  document.addEventListener("DOMContentLoaded", () => {
    popup = $("#storm-popup");
    overlay = $("#storm-overlay");
    canvas = $("#rain-canvas");

    attachProximityBoosts();

    // If #bypass or already entered before, skip gate
    const bypass = hasBypass() || localStorage.getItem("stormEntered") === "true";
    if (bypass) {
      if (popup) popup.remove();
      startStorm();
    } else {
      // Start on first user interaction (satisfies autoplay policies)
      ["click", "touchstart", "keydown", "scroll"].forEach((evt) =>
        on(document, evt, startStorm, { once: true, passive: true })
      );

      // Absolute fallback so users aren’t stuck
      setTimeout(() => { if (!hasStarted) startStorm(); }, 3500);
    }

    // Lower CPU when page is backgrounded
    on(document, "visibilitychange", handleVisibility);
  });
})();
