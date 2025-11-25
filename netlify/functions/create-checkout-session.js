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
    const base = baseFromHeader || baseFromNetlify || 'https://dhk-site.netlify.app';

    const successURL = payload.success_url || `${base}/success.html`;
    const cancelURL = payload.cancel_url || `${base}/cart.html`;

    // Optional discounts array
    let discounts;
    if (discountCode === 'PLUS') {
      try {
        const coupon = await stripe.coupons.create({
          name: 'PLUS 25% OFF',
          percent_off: 25,
          duration: 'once',
        });
        discounts = [{ coupon: coupon.id }];
      } catch (e) {
        console.error('Failed to create coupon for PLUS:', e);
        // If coupon creation fails, continue without a discount
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

    if (discounts && discounts.length > 0) {
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