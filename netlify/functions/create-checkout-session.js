// netlify/functions/create-checkout-session.js
const Stripe = require('stripe');

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  console.error('Missing STRIPE_SECRET_KEY env var');
}

const stripe = new Stripe(stripeSecret || '', { apiVersion: '2024-06-20' });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

// 🔥 CONFIG: adjust these when your promos change
const SITE_WIDE_PERCENT_OFF = 40;   // Black Friday 40% off
const PLUS_EXTRA_PERCENT_OFF = 25;  // PLUS code = extra 25% off sale price

exports.handler = async (event) => {
  try {
    // Preflight
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: CORS, body: 'ok' };
    }

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };
    }

    if (!stripeSecret) {
      return {
        statusCode: 500,
        headers: CORS,
        body: 'Server misconfigured: missing STRIPE_SECRET_KEY',
      };
    }

    const payload = JSON.parse(event.body || '{}');
    const items = Array.isArray(payload.items) ? payload.items : [];
    const discountCodeRaw = payload.discountCode || null;
    const discountCode = discountCodeRaw
      ? String(discountCodeRaw).trim().toUpperCase()
      : null;

    if (items.length === 0) {
      return { statusCode: 400, headers: CORS, body: 'No items in cart.' };
    }

    // Expect: { price: 'price_XXX', quantity: number >= 1 }
    const line_items = items.map((it, i) => {
      if (!it || typeof it !== 'object') {
        throw new Error(`Bad item at index ${i}`);
      }
      const price = String(it.price || '').trim();
      const qty = Math.max(1, parseInt(it.quantity, 10) || 0);
      if (!price || !price.startsWith('price_')) {
        throw new Error(`Missing/invalid price at index ${i}`);
      }
      if (qty < 1) {
        throw new Error(`Missing/invalid quantity at index ${i}`);
      }
      return { price, quantity: qty };
    });

    // Base URL for redirects
    const originHeader = event.headers.origin || event.headers.Origin;
    const refererHeader = event.headers.referer || event.headers.Referer;
    const baseFromHeader =
      originHeader ||
      (refererHeader ? new URL(refererHeader).origin : null);
    const baseFromNetlify =
      process.env.URL || process.env.DEPLOY_PRIME_URL;
    const base =
      baseFromHeader || baseFromNetlify || 'https://dhk-site.netlify.app';

    const successURL = payload.success_url || `${base}/success.html`;
    const cancelURL = payload.cancel_url || `${base}/cart.html`;

    // =========================
    //   DISCOUNT LOGIC
    // =========================

    let discounts = [];

    // If you ever want to kill the site-wide sale, set SITE_WIDE_PERCENT_OFF to 0
    if (SITE_WIDE_PERCENT_OFF > 0) {
      // Start with just the site-wide sale
      let effectivePercentOff = SITE_WIDE_PERCENT_OFF;
      let couponName = `Black Friday ${SITE_WIDE_PERCENT_OFF}% OFF`;

      // If code PLUS is present, stack it:
      // 40% off, then 25% off the new price = 55% total off original.
      if (discountCode === 'PLUS') {
        const base = SITE_WIDE_PERCENT_OFF / 100;      // 0.40
        const extra = PLUS_EXTRA_PERCENT_OFF / 100;    // 0.25

        const combined =
          1 - (1 - base) * (1 - extra);                // 0.55
        effectivePercentOff = Math.round(combined * 100); // 55

        couponName = `BF ${SITE_WIDE_PERCENT_OFF}% + PLUS ${PLUS_EXTRA_PERCENT_OFF}% OFF`;
      }

      try {
        const coupon = await stripe.coupons.create({
          name: couponName,
          percent_off: effectivePercentOff,
          duration: 'once',
        });
        discounts.push({ coupon: coupon.id });
      } catch (e) {
        console.error('Failed to create coupon for sale:', e);
        // Continue without coupon if Stripe errors (fails closed)
      }
    } else if (discountCode === 'PLUS') {
      // Fallback: if you ever turn off site-wide sale but still want PLUS alone
      try {
        const coupon = await stripe.coupons.create({
          name: `PLUS ${PLUS_EXTRA_PERCENT_OFF}% OFF`,
          percent_off: PLUS_EXTRA_PERCENT_OFF,
          duration: 'once',
        });
        discounts.push({ coupon: coupon.id });
      } catch (e) {
        console.error('Failed to create coupon for PLUS:', e);
      }
    }

    const sessionParams = {
      mode: 'payment',
      line_items,
      success_url: successURL,
      cancel_url: cancelURL,
      shipping_address_collection: { allowed_countries: ['US', 'CA'] },
      automatic_tax: { enabled: true },
    };

    if (discounts.length > 0) {
      sessionParams.discounts = discounts;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error('[create-checkout-session] Error:', err);
    const msg =
      typeof err?.message === 'string' ? err.message : 'Server error';
    return { statusCode: 500, headers: CORS, body: msg };
  }
};