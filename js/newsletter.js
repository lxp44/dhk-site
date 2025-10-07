/* === Mailchimp: Footer form submit without redirect (JSONP) — DIAGNOSTIC === */
(function () {
  console.log('[NL] script loaded');

  const MC = {
    dc: 'us17',                                    // data center
    u:  '76fa4cbd9b606697c32921c6e',               // ?u=
    id: 'ab53c93433'                               // ?id=
  };

  function $(sel, root=document){ return root.querySelector(sel); }

  const form  = $('.footer__newsletter');
  const input = $('#nl-email');
  const msg   = $('#nl-msg');

  console.log('[NL] nodes:', { formFound: !!form, inputFound: !!input, msgFound: !!msg });

  if (!form || !input || !msg) {
    console.warn('[NL] Missing required footer elements. Check the class/IDs in index.html.');
    return;
  }

  function setMsg(text, ok) {
    msg.textContent = text;
    msg.style.color = ok ? '#9ef7c2' : '#ffb4a8';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    console.log('[NL] submit handler fired');

    const email = (input.value || '').trim();
    console.log('[NL] email value:', email);

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

    script.onload = () => console.log('[NL] JSONP <script> loaded');
    script.onerror = (err) => {
      console.error('[NL] JSONP load error', err);
      setMsg('Network error. Try again in a moment.', false);
    };

    // define the global callback Mailchimp will invoke
    window.mcCallback = function (res) {
      console.log('[NL] mcCallback response:', res);
      try {
        if (res && res.result === 'success') {
          setMsg('You’re in. Welcome to the storm ⚡', true);
          form.reset();
        } else {
          const div = document.createElement('div');
          div.innerHTML = (res && res.msg) || 'Something went wrong. Please try again.';
          setMsg(div.textContent, false);
        }
      } finally {
        delete window.mcCallback;
        script.remove();
      }
    };

    document.body.appendChild(script);
    console.log('[NL] JSONP <script> appended:', script.src);
  });
})();