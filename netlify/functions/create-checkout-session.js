// netlify/functions/create-checkout-session.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Map your storefront product ids/variants -> Stripe Price IDs
// Put your real Price ID(s) below:
const PRICE_LOOKUP = {
  // examples:
  // 'storm-tee': 'price_123abcYOURPRICEID',       // simple (no variant)
  // 'storm-tee__XL': 'price_456defANOTHERPRICE',  // if you price by size
  // add more lines for each product/variant you sell
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { items } = JSON.parse(event.body || '{}');
    if (!Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, body: 'No items' };
    }

    // Convert cart items (id, variant, qty) -> Stripe line_items using server-side lookup
    const line_items = items.map(({ id, variant, qty }) => {
      const key = id + (variant ? `__${variant}` : '');
      const price = PRICE_LOOKUP[key] || PRICE_LOOKUP[id];
      if (!price) {
        throw new Error(`No Stripe price configured for "${key}"`);
      }
      return {
        price,
        quantity: Math.max(1, Number(qty) || 1),
      };
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      // Nice-to-haves (you can tweak/trim)
      automatic_tax: { enabled: true },
      shipping_address_collection: { allowed_countries: ['US', 'CA'] },
      // Where to send people
      success_url: `${process.env.SITE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/cart.html`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ id: session.id, url: session.url }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
