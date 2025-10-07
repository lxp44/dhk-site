/* === Mailchimp: Footer form submit without redirect (JSONP) === */
(function () {
  const MC = {
    dc: 'us17',                                    // ← from your Mailchimp action URL subdomain
    u:  '76fa4cbd9b606697c32921c6e',               // ← ?u=...
    id: 'ab53c93433'                               // ← ?id=...
  };

  function $(sel, root=document){ return root.querySelector(sel); }

  const form  = $('.footer__newsletter');
  const input = $('#nl-email');
  const msg   = $('#nl-msg');

  if (!form || !input || !msg) return;

  function setMsg(text, ok) {
    msg.textContent = text;
    msg.style.color = ok ? '#9ef7c2' : '#ffb4a8';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const email = (input.value || '').trim();
    if (!email || !email.includes('@')) {
      setMsg('Please enter a valid email.', false);
      input.focus();
      return;
    }
    setMsg('Submitting…', true);

    const base = `https://${MC.dc}.list-manage.com/subscribe/post-json`;
    const params = new URLSearchParams({
      u: MC.u,
      id: MC.id,
      EMAIL: email,
      c: 'mcCallback'
    });

    const script = document.createElement('script');
    script.src = `${base}?${params.toString()}`;
    script.async = true;

    window.mcCallback = function (res) {
      try {
        if (res.result === 'success') {
          setMsg('You’re in. Welcome to the storm ⚡', true);
          form.reset();
        } else {
          const div = document.createElement('div');
          div.innerHTML = res.msg || 'Something went wrong. Please try again.';
          setMsg(div.textContent, false);
        }
      } finally {
        delete window.mcCallback;
        script.remove();
      }
    };

    document.body.appendChild(script);
  });
})();