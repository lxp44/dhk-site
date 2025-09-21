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

  // Loudness caps (slightly higher so we can hear it clearly)
  const VOLS = { light: 0.35, med: 0.5, heavy: 0.7 };
  const thunderBias = { light: 0.35, med: 0.6, heavy: 0.85 };

  // --- Helpers ---------------------------------------------------------------

  function inferStageFromURL() {
    const p = location.pathname.toLowerCase();
    if (p.endsWith("/shop.html") || p.includes("/collections") || p.includes("/products")) return "med";
    if (p.includes("cart") || p.includes("checkout") || p.endsWith("/checkout.html")) return "heavy";
    return "light";
  }

  function hasBypass() {
    const url = new URL(location.href);
    return url.hash.includes("bypass") || url.search.includes("preview=1");
  }

  async function safePlay(el) {
    if (!el) return;
    try {
      el.muted = false;
      el.volume = Math.min(el.volume || 0, 1);
      await el.play();
    } catch (_) {
      // ignored, will try again on next interaction
    }
  }

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
    for (const k of STAGES) {
      const r = A.rain[k], t = A.thunder[k];
      if (r) { r.muted = true; r.volume = 0; }
      if (t) { t.muted = true; t.volume = 0; }
    }
  }

  function fadeTo(el, to, ms = 450) {
    if (!el) return;
    const from = el.volume || 0;
    if (Math.abs(from - to) < 0.01) { el.volume = to; return; }
    const start = performance.now();
    function step(t) {
      const k = Math.min(1, (t - start) / ms);
      el.volume = from + (to - from) * k;
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function setStage(next) {
    if (!STAGES.includes(next)) next = "light";
    targetStage = next;
    if (currentStage !== next) currentStage = next;

    // Start all (unmuted) then crossfade to targets
    for (const k of STAGES) {
      safePlay(A.rain[k]);
      safePlay(A.thunder[k]);
      if (A.rain[k]) A.rain[k].muted = false;
      if (A.thunder[k]) A.thunder[k].muted = false;
    }

    const rTarget = VOLS[next];
    const tTarget = Math.min(1, rTarget * thunderBias[next]);

    for (const k of STAGES) {
      fadeTo(A.rain[k], k === next ? rTarget : 0);
      fadeTo(A.thunder[k], k === next ? tTarget : 0);
    }
  }

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
    setTimeout(() => popup.remove(), 350);
  }

  async function unlockAudioAll() {
    // Force-unlock and play every track immediately after interaction
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
    await unlockAudioAll();            // <— ensure audio is unlocked and playing now
    setStage(inferStageFromURL());     // <— and immediately fade to the right loudness

    // Remember that user entered (but don’t auto-skip popup unless #bypass)
    localStorage.setItem("stormEntered", "true");
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

  // --- Init ------------------------------------------------------------------

  document.addEventListener("DOMContentLoaded", () => {
    popup = $("#storm-popup");
    overlay = $("#storm-overlay");
    canvas = $("#rain-canvas");
    ctx = canvas && canvas.getContext("2d");

    attachProximityBoosts();

    const bypass = hasBypass();
    if (bypass) {
      // Developer shortcut — skip popup, start immediately
      if (popup) popup.remove();
      startStorm();
      return;
    }

    // Do NOT auto-dismiss popup anymore; require interaction
    // Start storm on first user gesture (including clicking the popup text)
    ["click", "touchstart", "keydown", "scroll"].forEach((evt) =>
      on(document, evt, startStorm, { once: true, passive: true })
    );

    if (popup) on(popup, "click", startStorm, { once: true, passive: true });

    // Keep canvas sized
    on(window, "resize", () => {
      if (!canvas) return;
      canvas.width = innerWidth;
      canvas.height = innerHeight;
    });
  });
})();
