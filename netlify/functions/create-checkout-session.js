// netlify/functions/create-checkout-session.js
const Stripe = require("stripe");

const stripeSecret = process.env.STRIPE_SECRET_KEY;

if (!stripeSecret) {
  console.error("Missing STRIPE_SECRET_KEY env var");
}

const stripe = new Stripe(stripeSecret || "", {
  apiVersion: "2024-06-20",
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

// ===========================
// DISCOUNT CONFIG
// ===========================

// 🔥 SIMPLE SITE-WIDE DISCOUNT CONFIG
const ENABLE_SITE_WIDE_DISCOUNT = false;
const SITE_WIDE_PERCENT_OFF = 0;

// 🔥 SIMPLE DISCOUNT CODE CONFIG
const ENABLE_DISCOUNT_CODES = true;

const PLUS_CODE_ENABLED = true;
const PLUS_CODE = "PLUS";
const PLUS_PERCENT_OFF = 70;

const LXP_CODE_ENABLED = true;
const LXP_CODE = "LXP";

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

async function buildExpandedUnits(lineItems) {
  const units = [];
  let currency = null;

  for (const item of lineItems) {
    const priceObj = await stripe.prices.retrieve(item.price);

    const unitAmount = Number(priceObj.unit_amount || 0);
    const itemCurrency = String(priceObj.currency || "usd").toLowerCase();

    if (!currency) currency = itemCurrency;

    if (currency !== itemCurrency) {
      throw new Error("Discounts require all cart items to use the same currency.");
    }

    for (let i = 0; i < item.quantity; i += 1) {
      units.push(unitAmount);
    }
  }

  return {
    units,
    currency: currency || "usd",
  };
}

function calculateBogoEqualOrLess(units) {
  if (!Array.isArray(units) || units.length < 2) return 0;

  const sorted = [...units].sort((a, b) => b - a);

  let discountAmount = 0;

  for (let i = 1; i < sorted.length; i += 2) {
    discountAmount += sorted[i];
  }

  return discountAmount;
}

async function buildDiscounts(payload, lineItems) {
  const discounts = [];

  // Site-wide discount overrides codes. No combining.
  if (ENABLE_SITE_WIDE_DISCOUNT && SITE_WIDE_PERCENT_OFF > 0) {
    const coupon = await stripe.coupons.create({
      name: `Site-wide ${SITE_WIDE_PERCENT_OFF}% OFF`,
      percent_off: SITE_WIDE_PERCENT_OFF,
      duration: "once",
    });

    discounts.push({ coupon: coupon.id });
    return discounts;
  }

  if (!ENABLE_DISCOUNT_CODES) return discounts;

  const code = normalizeCode(payload.discountCode);

  if (!code) return discounts;

  if (PLUS_CODE_ENABLED && code === normalizeCode(PLUS_CODE)) {
    const coupon = await stripe.coupons.create({
      name: `${PLUS_CODE} ${PLUS_PERCENT_OFF}% OFF`,
      percent_off: PLUS_PERCENT_OFF,
      duration: "once",
    });

    discounts.push({ coupon: coupon.id });
    return discounts;
  }

  if (LXP_CODE_ENABLED && code === normalizeCode(LXP_CODE)) {
    const { units, currency } = await buildExpandedUnits(lineItems);
    const amountOff = calculateBogoEqualOrLess(units);

    if (amountOff > 0) {
      const coupon = await stripe.coupons.create({
        name: `${LXP_CODE} BOGO Equal or Less Value`,
        amount_off: amountOff,
        currency,
        duration: "once",
      });

      discounts.push({ coupon: coupon.id });
    }

    return discounts;
  }

  return discounts;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: CORS,
        body: "ok",
      };
    }

    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: CORS,
        body: "Method Not Allowed",
      };
    }

    if (!stripeSecret) {
      return {
        statusCode: 500,
        headers: CORS,
        body: "Server misconfigured: missing STRIPE_SECRET_KEY",
      };
    }

    const payload = JSON.parse(event.body || "{}");
    const items = Array.isArray(payload.items) ? payload.items : [];

    if (items.length === 0) {
      return {
        statusCode: 400,
        headers: CORS,
        body: "No items in cart.",
      };
    }

    const line_items = items.map((it, i) => {
      if (!it || typeof it !== "object") {
        throw new Error(`Bad item at index ${i}`);
      }

      const price = String(it.price || "").trim();
      const quantity = Math.max(1, parseInt(it.quantity, 10) || 0);

      if (!price || !price.startsWith("price_")) {
        throw new Error(`Missing/invalid price at index ${i}`);
      }

      if (quantity < 1) {
        throw new Error(`Missing/invalid quantity at index ${i}`);
      }

      return {
        price,
        quantity,
      };
    });

    const originHeader = event.headers.origin || event.headers.Origin;
    const refererHeader = event.headers.referer || event.headers.Referer;

    const baseFromHeader =
      originHeader || (refererHeader ? new URL(refererHeader).origin : null);

    const baseFromNetlify = process.env.URL || process.env.DEPLOY_PRIME_URL;
    const base = baseFromHeader || baseFromNetlify || "https://dhk-site.netlify.app";

    const successURL = payload.success_url || `${base}/success.html`;
    const cancelURL = payload.cancel_url || `${base}/cart.html`;

    const discounts = await buildDiscounts(payload, line_items);

    const sessionParams = {
      mode: "payment",
      line_items,
      success_url: successURL,
      cancel_url: cancelURL,
      shipping_address_collection: {
        allowed_countries: ["US", "CA"],
      },
      automatic_tax: {
        enabled: true,
      },
    };

    if (discounts.length > 0) {
      sessionParams.discounts = discounts;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return {
      statusCode: 200,
      headers: {
        ...CORS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: session.url,
      }),
    };
  } catch (err) {
    console.error("[create-checkout-session] Error:", err);

    return {
      statusCode: 500,
      headers: CORS,
      body: typeof err?.message === "string" ? err.message : "Server error",
    };
  }
};