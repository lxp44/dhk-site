// netlify/functions/create-checkout-session.js
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { items, success_url, cancel_url } = JSON.parse(event.body || '{}');
    if (!Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, body: 'No items in cart.' };
    }

    const line_items = items.map((it) => {
      if (!it.price || !it.quantity) throw new Error('Missing price or quantity');
      return { price: it.price, quantity: it.quantity };
    });

    const origin = event.headers.origin || event.headers.referer || '';
    const successURL = success_url || `${origin}/success.html`;
    const cancelURL  = cancel_url  || `${origin}/cart.html`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      success_url: successURL,
      cancel_url: cancelURL,
      shipping_address_collection: { allowed_countries: ['US', 'CA'] },
      automatic_tax: { enabled: true }
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url })
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: err.message || 'Server error' };
  }
};