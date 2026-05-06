// ═══════════════════════════════════════════════════════════════
// square-webhook.js
//
// Receives Square webhook events. Currently handles:
//   - invoice.payment_made   → mark mc_invoices.paid_at, mc_engagements.paid_at,
//                              start delivery clock (delivery_due_at),
//                              email receipt + internal notification.
//   - invoice.canceled       → mark void in mc_invoices.
//   - invoice.refunded       → mark refunded in mc_invoices.
//
// All state-application logic lives in _lib_payment_apply.js so
// square-invoice-sync.js (the manual reconcile button) does the
// exact same thing when called from /admin.
//
// SETUP: register this URL in Square Dashboard:
//   https://markcmo.com/.netlify/functions/square-webhook
// Set SQUARE_WEBHOOK_SIGNATURE_KEY env var to the signature key
// from the Square webhook subscription.
// ═══════════════════════════════════════════════════════════════
const sq = require('./_lib_square');
const { applyInvoiceState } = require('./_lib_payment_apply');

const NOTIFICATION_URL = 'https://markcmo.com/.netlify/functions/square-webhook';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const rawBody = event.body || '';
  const signature = event.headers?.['x-square-hmacsha256-signature'] || event.headers?.['x-square-signature'] || '';
  const sigKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;

  if (sigKey) {
    const ok = sq.verifyWebhookSignature({ body: rawBody, signature, signatureKey: sigKey, notificationUrl: NOTIFICATION_URL });
    if (!ok) {
      console.warn('Square webhook signature mismatch');
      return { statusCode: 401, body: 'Invalid signature' };
    }
  } else {
    console.warn('SQUARE_WEBHOOK_SIGNATURE_KEY not set; skipping signature verification (NOT SAFE FOR PRODUCTION)');
  }

  let payload;
  try { payload = JSON.parse(rawBody); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const eventType = payload?.type || '';
  const sqInvoice = payload?.data?.object?.invoice || null;

  console.log('Square webhook:', eventType, 'invoice', sqInvoice?.id);

  if (!sqInvoice?.id) return { statusCode: 200, body: 'OK (ignored)' };

  try {
    const result = await applyInvoiceState({ sqInvoice, source: 'webhook' });
    console.log('webhook applyInvoiceState:', result);
    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('Square webhook handler error:', err);
    return { statusCode: 200, body: 'Internal error logged' };
  }
};
