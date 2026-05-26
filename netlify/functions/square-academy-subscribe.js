// netlify/functions/square-academy-subscribe.js
//
// WETYR Infrastructure Protocol v1 - Section 3.1 compliance.
// Server-side endpoint that completes the embedded Square Web Payments SDK
// checkout. The browser tokenizes the card via the SDK then POSTs the
// nonce here; we never see the raw card number.
//
// Flow:
//   1. Validate input { sourceId (token), plan, firstName, lastName, email }
//   2. Find-or-create Square Customer for the email
//   3. Save card to customer (createCard with sourceId)
//   4. Create Subscription against the plan variation
//   5. Trigger enrollment via academy course-enroll (creates JSONBin
//      enrollment + sends welcome email)
//   6. Return { ok, accessToken, membershipExpires } to the browser
//
// Idempotency: Square requires a unique idempotency_key per attempt.
//              We derive it from email + plan + minute so retries within
//              the same minute are deduped, but a genuine user retry
//              30 seconds later gets a fresh attempt.
//
// Error surface: returns { ok: false, code, message } the page can
// display directly. Any Square error code is preserved.

const SQUARE_API     = 'https://connect.squareup.com/v2';
const SQUARE_VERSION = '2024-11-20';

// Academy plan variation IDs (matches academy-enrollment-reconcile.js)
const PLAN_VARIATIONS = {
  monthly: 'GNBQIPQB5O6TAI73ZEGDGZ7H',
  annual:  'DT5FZDFTEBFSWYF6G6SISIWC',
};

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://markcmo.com',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function sq(path, init = {}) {
  const token = process.env.SQUARE_ACADEMY_ACCESS_TOKEN || process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error('No Square access token configured');
  const r = await fetch(SQUARE_API + path, {
    ...init,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Square-Version': SQUARE_VERSION,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body };
}

// Stable idempotency key per (email, plan, minute). Lets the user retry
// after typing the wrong CVV without Square refusing as duplicate.
function idempotencyKey(email, plan) {
  const minute = Math.floor(Date.now() / 60000);
  const safe = (email + '_' + plan + '_' + minute).replace(/[^a-zA-Z0-9_@.+-]/g, '');
  return 'mca_sub_' + safe.slice(0, 40);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ ok: false, error: 'POST only' }) };
  }

  // ── Validate input ─────────────────────────────────────────────────────
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, code: 'bad_json', message: 'Invalid request' }) }; }

  const sourceId  = (body.sourceId || '').trim();
  const plan      = (body.plan || '').toLowerCase();
  const firstName = (body.firstName || '').trim();
  const lastName  = (body.lastName  || '').trim();
  const email     = (body.email || '').trim().toLowerCase();
  const verificationToken = body.verificationToken || null;

  if (!sourceId)  return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, code: 'missing_token', message: 'Card token missing' }) };
  if (!email || !email.includes('@')) return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, code: 'invalid_email', message: 'Valid email required' }) };
  if (!firstName || !lastName) return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, code: 'missing_name', message: 'First and last name required' }) };

  const planVariationId = PLAN_VARIATIONS[plan];
  if (!planVariationId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, code: 'invalid_plan', message: 'Plan must be monthly or annual' }) };

  const locationId = process.env.SQUARE_ACADEMY_LOCATION_ID;
  if (!locationId) return { statusCode: 503, headers: CORS, body: JSON.stringify({ ok: false, code: 'not_configured', message: 'Square location not configured' }) };

  const idKey = idempotencyKey(email, plan);

  try {
    // ── 1. Find or create Square Customer ─────────────────────────────────
    let customerId;
    const search = await sq('/customers/search', {
      method: 'POST',
      body: JSON.stringify({
        query: { filter: { email_address: { exact: email } } },
        limit: 1,
      }),
    });
    if (search.ok && search.body.customers && search.body.customers.length) {
      customerId = search.body.customers[0].id;
    } else {
      const created = await sq('/customers', {
        method: 'POST',
        body: JSON.stringify({
          idempotency_key: idKey + '_c',
          given_name: firstName,
          family_name: lastName,
          email_address: email,
        }),
      });
      if (!created.ok) {
        return { statusCode: 502, headers: CORS, body: JSON.stringify({
          ok: false, code: 'customer_create_failed',
          message: ((created.body.errors||[])[0]||{}).detail || 'Could not create customer in Square',
        }) };
      }
      customerId = created.body.customer.id;
    }

    // ── 2. Save card to customer ──────────────────────────────────────────
    const cardCreate = await sq('/cards', {
      method: 'POST',
      body: JSON.stringify({
        idempotency_key: idKey + '_card',
        source_id: sourceId,
        verification_token: verificationToken || undefined,
        card: { customer_id: customerId },
      }),
    });
    if (!cardCreate.ok) {
      const err = (cardCreate.body.errors||[])[0] || {};
      return { statusCode: 402, headers: CORS, body: JSON.stringify({
        ok: false, code: err.code || 'card_decline',
        message: err.detail || 'Card could not be saved. Check details and try again.',
      }) };
    }
    const cardId = cardCreate.body.card.id;

    // ── 3. Create Subscription ────────────────────────────────────────────
    const sub = await sq('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        idempotency_key: idKey + '_sub',
        location_id: locationId,
        plan_variation_id: planVariationId,
        customer_id: customerId,
        card_id: cardId,
      }),
    });
    if (!sub.ok) {
      const err = (sub.body.errors||[])[0] || {};
      return { statusCode: 502, headers: CORS, body: JSON.stringify({
        ok: false, code: err.code || 'subscription_failed',
        message: err.detail || 'Subscription could not be created.',
      }) };
    }
    const subscriptionId = sub.body.subscription.id;

    // ── 4. Trigger enrollment (creates JSONBin record + welcome email) ────
    let accessToken = null;
    let membershipExpires = null;
    try {
      const enrollRes = await fetch('https://academy.markcmo.com/.netlify/functions/course-enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: (firstName + ' ' + lastName).trim() || email.split('@')[0],
          email,
          courseId: 'membership',
          membershipPlan: plan,
          ref: 'purchase',
          source: 'embedded-square-checkout',
        }),
      });
      const enrollData = await enrollRes.json().catch(() => ({}));
      if (enrollData.ok) {
        accessToken = enrollData.accessToken;
        membershipExpires = enrollData.membershipExpires;
      }
    } catch (e) {
      // Enrollment fallback: webhook + hourly reconcile cron will catch it
      console.warn('Inline enrollment call failed, falling back to webhook:', e.message);
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        plan,
        subscriptionId,
        customerId,
        accessToken,
        membershipExpires,
      }),
    };
  } catch (err) {
    console.error('square-academy-subscribe fatal:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({
      ok: false, code: 'internal_error',
      message: 'Something went wrong. Email mark@markcmo.com if your card was charged.',
    }) };
  }
};
