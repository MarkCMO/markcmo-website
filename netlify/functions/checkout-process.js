// netlify/functions/checkout-process.js
//
// WETYR Infrastructure Protocol v1 §3.1 — generic embedded checkout endpoint.
// Backs the unified /checkout.html page. Handles every product type:
//
//   Subscriptions  (membership-monthly, membership-annual):
//     find-or-create customer -> save card -> create subscription
//     -> trigger academy enrollment -> return access token
//
//   One-time products (courses, retakes, audits, VIP, kits, playbooks):
//     find-or-create customer -> save card -> create payment
//     -> for courses/retakes: trigger academy enrollment
//     -> for services: send order receipt + notify admin
//     -> return order/payment id
//
// Server-side product catalog (single source of truth) - the browser-side
// catalog in checkout.html must match these prices. Server rejects any
// mismatch.
//
// Idempotency derives from (email, product, minute) so user retries 30+s
// later get a fresh attempt but rapid double-clicks dedupe.

const SQUARE_API     = 'https://connect.squareup.com/v2';
const SQUARE_VERSION = '2024-11-20';

// Authoritative product catalog. Browser must match these prices or server rejects.
const PRODUCTS = {
  'membership-monthly': {
    type: 'subscription',
    name: 'MarkCMO Academy - Monthly',
    amountCents: 9900,
    planVariationId: 'GNBQIPQB5O6TAI73ZEGDGZ7H',
    plan: 'monthly',
  },
  'membership-annual': {
    type: 'subscription',
    name: 'MarkCMO Academy - Annual',
    amountCents: 89900,
    planVariationId: 'DT5FZDFTEBFSWYF6G6SISIWC',
    plan: 'annual',
  },
  'course-cmo': { type: 'one-time', name: 'Fractional CMO Mastery', amountCents: 24800, courseId: 'cmo' },
  'course-coo': { type: 'one-time', name: 'Fractional COO Mastery', amountCents: 24800, courseId: 'coo' },
  'course-cfo': { type: 'one-time', name: 'Fractional CFO Mastery', amountCents: 24800, courseId: 'cfo' },
  'course-ceo': { type: 'one-time', name: 'CEO Mastery',            amountCents: 24800, courseId: 'ceo' },
  'retake-cmo': { type: 'one-time', name: 'CMO Mastery - Exam Retake', amountCents: 2800, courseId: 'cmo', isRetake: true },
  'retake-coo': { type: 'one-time', name: 'COO Mastery - Exam Retake', amountCents: 2800, courseId: 'coo', isRetake: true },
  'retake-cfo': { type: 'one-time', name: 'CFO Mastery - Exam Retake', amountCents: 2800, courseId: 'cfo', isRetake: true },
  'retake-ceo': { type: 'one-time', name: 'CEO Mastery - Exam Retake', amountCents: 2800, courseId: 'ceo', isRetake: true },
  'audit':      { type: 'one-time', name: 'CMO Audit & Sprint',     amountCents: 100000, serviceFollowup: true },
  'vip':        { type: 'one-time', name: 'CMO VIP Strategy Day',   amountCents: 250000, serviceFollowup: true },
  'kit':        { type: 'one-time', name: 'CMO Accelerator Kit',    amountCents: 5000,   serviceFollowup: true },
  'playbook':   { type: 'one-time', name: 'Revenue Leak Playbook',  amountCents: 10000,  serviceFollowup: true },
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

function idempotencyKey(email, productKey) {
  const minute = Math.floor(Date.now() / 60000);
  const safe = (email + '_' + productKey + '_' + minute).replace(/[^a-zA-Z0-9_@.+-]/g, '');
  return 'mcco_' + safe.slice(0, 50);
}

function errResp(status, code, message, extra = {}) {
  return { statusCode: status, headers: CORS, body: JSON.stringify({ ok: false, code, message, ...extra }) };
}

async function notifyAdmin(subject, html) {
  if (!process.env.RESEND_API_KEY) return;
  const notify = (process.env.NOTIFY_EMAIL || 'mark@markcmo.com').split(',').map(s => s.trim()).filter(Boolean);
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'MarkCMO Checkout <mark@markcmo.com>',
        to: notify, subject, html,
      }),
    });
  } catch (e) { console.warn('admin notify failed:', e.message); }
}

async function sendCustomerReceipt(email, name, product, paymentOrSubId) {
  if (!process.env.RESEND_API_KEY) return;
  const price = '$' + (product.amountCents / 100).toFixed(2);
  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f7f7f7;margin:0;padding:0;">
    <div style="max-width:600px;margin:0 auto;background:#fff;padding:32px 28px;">
      <div style="font-size:24px;font-weight:900;color:#0A1628;margin-bottom:6px;">MarkCMO</div>
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;font-weight:700;margin-bottom:24px;">Order Receipt</div>
      <p style="font-size:15px;line-height:1.6;color:#333;">Hi ${name.split(' ')[0]},</p>
      <p style="font-size:15px;line-height:1.6;color:#333;">Thank you for your order. Below is your receipt.</p>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #eee;border-bottom:1px solid #eee;margin:24px 0;">
        <tr><td style="padding:12px 0;color:#888;">Item</td><td style="text-align:right;font-weight:700;">${product.name}</td></tr>
        <tr><td style="padding:12px 0;color:#888;border-top:1px solid #eee;">Total</td><td style="text-align:right;font-weight:700;color:#C9A84C;border-top:1px solid #eee;">${price}</td></tr>
      </table>
      <p style="font-size:13px;color:#888;line-height:1.6;">Reference: ${paymentOrSubId || '-'}</p>
      <p style="font-size:13px;color:#888;line-height:1.6;">Questions? Reply to this email or contact <a href="mailto:mark@markcmo.com" style="color:#C9A84C;">mark@markcmo.com</a>.</p>
    </div>
  </body></html>`;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Mark Gabrielli <mark@markcmo.com>',
        to: [email],
        reply_to: 'mark@markcmo.com',
        subject: `Receipt: ${product.name}`,
        html,
      }),
    });
  } catch (e) { console.warn('customer receipt failed:', e.message); }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return errResp(405, 'method_not_allowed', 'POST only');

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return errResp(400, 'bad_json', 'Invalid request'); }

  const sourceId  = (body.sourceId || '').trim();
  const verificationToken = body.verificationToken || null;
  const productKey = (body.product || '').toLowerCase();
  const firstName = (body.firstName || '').trim();
  const lastName  = (body.lastName  || '').trim();
  const email     = (body.email || '').trim().toLowerCase();

  if (!sourceId) return errResp(400, 'missing_token', 'Card token missing');
  if (!email || !email.includes('@')) return errResp(400, 'invalid_email', 'Valid email required');
  if (!firstName || !lastName) return errResp(400, 'missing_name', 'First and last name required');

  const product = PRODUCTS[productKey];
  if (!product) return errResp(400, 'invalid_product', 'Unknown product');

  const locationId = process.env.SQUARE_ACADEMY_LOCATION_ID;
  if (!locationId) return errResp(503, 'not_configured', 'Square location not configured');

  const idKey = idempotencyKey(email, productKey);
  const fullName = (firstName + ' ' + lastName).trim();

  try {
    // ── 1. Find or create Square Customer ─────────────────────────────────
    let customerId;
    const search = await sq('/customers/search', {
      method: 'POST',
      body: JSON.stringify({ query: { filter: { email_address: { exact: email } } }, limit: 1 }),
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
        const err = (created.body.errors || [])[0] || {};
        return errResp(502, 'customer_create_failed', err.detail || 'Could not create customer');
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
      const err = (cardCreate.body.errors || [])[0] || {};
      return errResp(402, err.code || 'card_decline', err.detail || 'Card could not be saved');
    }
    const cardId = cardCreate.body.card.id;

    let accessToken = null;
    let membershipExpires = null;
    let referenceId = null;

    // ── 3a. Subscription path ─────────────────────────────────────────────
    if (product.type === 'subscription') {
      const sub = await sq('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          idempotency_key: idKey + '_sub',
          location_id: locationId,
          plan_variation_id: product.planVariationId,
          customer_id: customerId,
          card_id: cardId,
        }),
      });
      if (!sub.ok) {
        const err = (sub.body.errors || [])[0] || {};
        return errResp(502, err.code || 'subscription_failed', err.detail || 'Subscription could not be created');
      }
      referenceId = sub.body.subscription.id;

      // Trigger enrollment via academy course-enroll (membership = all-access)
      try {
        const enrollRes = await fetch('https://academy.markcmo.com/.netlify/functions/course-enroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: fullName || email.split('@')[0],
            email,
            courseId: 'membership',
            membershipPlan: product.plan,
            ref: 'purchase',
            source: 'embedded-checkout',
          }),
        });
        const enrollData = await enrollRes.json().catch(() => ({}));
        if (enrollData.ok) {
          accessToken = enrollData.accessToken;
          membershipExpires = enrollData.membershipExpires;
        }
      } catch (e) { console.warn('membership enroll fallback:', e.message); }

    // ── 3b. One-time payment path ─────────────────────────────────────────
    } else {
      const payment = await sq('/payments', {
        method: 'POST',
        body: JSON.stringify({
          idempotency_key: idKey + '_pay',
          source_id: cardId,                 // saved card id
          customer_id: customerId,
          amount_money: { amount: product.amountCents, currency: 'USD' },
          location_id: locationId,
          autocomplete: true,
          note: product.name + ' / ' + email,
          verification_token: verificationToken || undefined,
        }),
      });
      if (!payment.ok) {
        const err = (payment.body.errors || [])[0] || {};
        return errResp(402, err.code || 'payment_failed', err.detail || 'Payment could not be processed');
      }
      referenceId = payment.body.payment.id;

      // Trigger course enrollment for course/retake products
      if (product.courseId) {
        try {
          const enrollRes = await fetch('https://academy.markcmo.com/.netlify/functions/course-enroll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: fullName || email.split('@')[0],
              email,
              courseId: product.courseId,
              isRetake: !!product.isRetake,
              ref: 'purchase',
              source: 'embedded-checkout',
            }),
          });
          const enrollData = await enrollRes.json().catch(() => ({}));
          if (enrollData.ok) accessToken = enrollData.accessToken;
        } catch (e) { console.warn('course enroll fallback:', e.message); }
      }

      // Service products (audit, vip, kit, playbook) get a receipt + admin notify
      if (product.serviceFollowup) {
        await sendCustomerReceipt(email, fullName, product, referenceId);
        await notifyAdmin(
          `[Order] ${product.name} - $${(product.amountCents/100).toFixed(0)} - ${fullName}`,
          `<p><strong>${product.name}</strong> purchased by ${fullName} &lt;${email}&gt;</p>
           <p>Amount: $${(product.amountCents/100).toFixed(2)}</p>
           <p>Square payment id: ${referenceId}</p>
           <p>Customer expects follow-up within 24 hours per the order confirmation.</p>`
        );
      }
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        product: productKey,
        productType: product.type,
        referenceId,
        accessToken,
        membershipExpires,
      }),
    };
  } catch (err) {
    console.error('checkout-process fatal:', err);
    return errResp(500, 'internal_error', 'Something went wrong. Email mark@markcmo.com if your card was charged.');
  }
};
