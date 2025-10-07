<script>
/* === Mailchimp: Submit footer form without redirect (JSONP) === */
(function () {
  const MC = {
    dc: 'us17',                                    // from your action URL subdomain
    u:  '76fa4cbd9b606697c32921c6e',               // from ?u=...
    id: 'ab53c93433'                               // from ?id=...
  };

  const form  = document.querySelector('.footer__newsletter');
  const input = document.getElementById('nl-email');
  const msg   = document.getElementById('nl-msg');

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

    // Build Mailchimp JSONP URL
    const base = `https://${MC.dc}.list-manage.com/subscribe/post-json`;
    const params = new URLSearchParams({
      u: MC.u,
      id: MC.id,
      EMAIL: email,
      c: 'mcCallback' // JSONP callback name
    });

    // Create a JSONP <script> tag
    const script = document.createElement('script');
    script.src = `${base}?${params.toString()}`;
    script.async = true;

    // Define a one-shot global callback
    window.mcCallback = function (res) {
      try {
        if (res.result === 'success') {
          setMsg('You’re in. Welcome to the storm ⚡', true);
          form.reset();
        } else {
          // Mailchimp returns a string with HTML sometimes—strip tags for display
          const div = document.createElement('div');
          div.innerHTML = res.msg || 'Something went wrong. Please try again.';
          setMsg(div.textContent, false);
        }
      } finally {
        // cleanup
        delete window.mcCallback;
        script.remove();
      }
    };

    // Inject the script
    document.body.appendChild(script);
  });
})();
</script>