document.addEventListener('DOMContentLoaded', () => {
  const popup   = document.getElementById('storm-popup');
  const thunder = document.getElementById('storm-thunder');
  const rain    = document.getElementById('storm-rain');
  const overlay = document.getElementById('storm-overlay');

  let hasInteracted = false;

  // Bypass via URL: #bypass or ?preview=1
  const url = new URL(window.location.href);
  const bypass = url.hash.includes('bypass') || url.search.includes('preview=1');

  if (bypass) {
    localStorage.setItem('stormEntered', 'true');
  }

  function hidePopup() {
    if (!popup) return;
    popup.style.opacity = '0';
    setTimeout(() => popup.remove(), 500);
  }

  function safePlay(audioEl, vol = 0.4) {
    if (!audioEl) return Promise.resolve();
    audioEl.volume = vol;
    try {
      const p = audioEl.play();
      return p && typeof p.then === 'function' ? p.catch(() => {}) : Promise.resolve();
    } catch (_) { return Promise.resolve(); }
  }

  function startRain() {
    overlay.style.display = 'block';
    const canvas = document.getElementById('rain-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const drops = Array.from({ length: 250 }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      len: Math.random() * 20 + 10,
      speed: Math.random() * 3 + 2
    }));

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let d of drops) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x, d.y + d.len);
      }
      ctx.stroke();
      for (let d of drops) {
        d.y += d.speed;
        if (d.y > canvas.height) {
          d.y = -d.len;
          d.x = Math.random() * canvas.width;
        }
      }
      requestAnimationFrame(draw);
    }
    draw();
  }

  function flashLightning() {
    function flashOnce() {
      overlay.style.backgroundColor = 'rgba(255,255,255,0.3)';
      setTimeout(() => { overlay.style.backgroundColor = 'transparent'; }, 100);
      setTimeout(() => { if (Math.random() > 0.6) flashOnce(); }, Math.random() * 10000 + 3000);
    }
    setTimeout(flashOnce, 2000);
  }

  async function startStorm() {
    if (hasInteracted) return;
    hasInteracted = true;

    hidePopup();
    startRain();
    flashLightning();

    // Try audio, but never block UI if it fails
    await Promise.all([
      safePlay(thunder, 0.3),
      safePlay(rain, 0.35)
    ]).catch(() => { /* ignore */ });

    localStorage.setItem('stormEntered', 'true');
  }

  // If user already entered, skip popup
  if (localStorage.getItem('stormEntered') === 'true') {
    if (popup) popup.remove();
    startStorm();
    return;
  }

  // If bypass flag present, skip immediately
  if (bypass) {
    if (popup) popup.remove();
    startStorm();
    return;
  }

  // Start on first user interaction
  ['click', 'touchstart', 'keydown', 'scroll'].forEach(evt => {
    document.addEventListener(evt, () => startStorm(), { once: true, passive: true });
  });

  // Absolute fallback: auto-hide after 3s to avoid trapping users
  setTimeout(() => {
    if (!hasInteracted) {
      hidePopup();
      startStorm(); // proceed without audio if needed
    }
  }, 3000);
});
