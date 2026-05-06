// ═══════════════════════════════════════════════════════════════
// _lib_square.js
// Shared helpers for Square Invoice API + Supabase mc_* tables.
// Used by: square-create-invoice.js, square-send-payment.js,
//          square-webhook.js, engagement-payment-followups.js,
//          execute-engagement-doc.js (auto-draft on countersign)
//
// Square production API: https://connect.squareup.com/v2/...
// Square sandbox API:    https://connect.squareupsandbox.com/v2/...
// SQUARE_ENV env var picks which.
// ═══════════════════════════════════════════════════════════════
const crypto = require('crypto');

const SQUARE_VERSION = '2024-11-20';

function sqBaseUrl() {
  const env = (process.env.SQUARE_ENV || 'production').toLowerCase();
  return env === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
}

function sqHeaders() {
  const tok = process.env.SQUARE_ACCESS_TOKEN;
  if (!tok) throw new Error('SQUARE_ACCESS_TOKEN not set');
  return {
    'Authorization': `Bearer ${tok}`,
    'Square-Version': SQUARE_VERSION,
    'Content-Type': 'application/json',
  };
}

async function sqCall(method, path, body) {
  const res = await fetch(`${sqBaseUrl()}/v2${path}`, {
    method,
    headers: sqHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg = data.errors?.map(e => `${e.code}: ${e.detail}`).join('; ') || `HTTP ${res.status}`;
    const err = new Error(`Square ${method} ${path} failed: ${errMsg}`);
    err.statusCode = res.status;
    err.squareErrors = data.errors;
    throw err;
  }
  return data;
}

// ─── Customer: find by email or create ─────────────────────────
async function findOrCreateCustomer({ email, givenName, familyName, companyName, phone }) {
  // Try search first
  try {
    const search = await sqCall('POST', '/customers/search', {
      query: { filter: { email_address: { exact: email } } },
      limit: 1,
    });
    if (search.customers?.length) return search.customers[0];
  } catch (e) { /* fall through to create */ }

  const created = await sqCall('POST', '/customers', {
    idempotency_key: crypto.randomUUID(),
    given_name: givenName || '',
    family_name: familyName || '',
    company_name: companyName || '',
    email_address: email,
    ...(phone ? { phone_number: phone } : {}),
  });
  return created.customer;
}

// ─── Order: create for the engagement amount ───────────────────
async function createOrder({ customerId, amountCents, currency = 'USD', name, note }) {
  const order = await sqCall('POST', '/orders', {
    idempotency_key: crypto.randomUUID(),
    order: {
      location_id: process.env.SQUARE_LOCATION_ID,
      customer_id: customerId,
      line_items: [
        {
          name: name || 'Professional Services',
          quantity: '1',
          base_price_money: { amount: amountCents, currency },
        },
      ],
      ...(note ? { metadata: { note: note.substring(0, 200) } } : {}),
    },
  });
  return order.order;
}

// ─── Invoice: create DRAFT ─────────────────────────────────────
// Returns the Square invoice object. Status will be 'DRAFT'.
async function createDraftInvoice({ orderId, customerId, recipientEmail, title, description, dueDays = 14 }) {
  const due = new Date();
  due.setDate(due.getDate() + dueDays);
  const dueIso = due.toISOString().slice(0, 10); // YYYY-MM-DD

  const inv = await sqCall('POST', '/invoices', {
    idempotency_key: crypto.randomUUID(),
    invoice: {
      location_id: process.env.SQUARE_LOCATION_ID,
      order_id: orderId,
      primary_recipient: { customer_id: customerId },
      payment_requests: [
        {
          request_type: 'BALANCE',
          due_date: dueIso,
          // Net 14-day terms; client gets the link, pays whenever.
          tipping_enabled: false,
          automatic_payment_source: 'NONE',
        },
      ],
      delivery_method: 'EMAIL',
      title: title || 'Invoice',
      description: description || '',
      accepted_payment_methods: {
        card: true,
        square_gift_card: false,
        bank_account: true,
        buy_now_pay_later: false,
        cash_app_pay: true,
      },
    },
  });
  return inv.invoice;
}

// ─── Invoice: publish (sends Square's branded email + activates payment link) ──
async function publishInvoice({ invoiceId, version }) {
  const result = await sqCall('POST', `/invoices/${invoiceId}/publish`, {
    version,
    idempotency_key: crypto.randomUUID(),
  });
  return result.invoice;
}

// ─── Invoice: cancel/void ─────────────────────────────────────
async function cancelInvoice({ invoiceId, version }) {
  const result = await sqCall('POST', `/invoices/${invoiceId}/cancel`, {
    version,
  });
  return result.invoice;
}

// ─── Invoice: get (for refresh) ───────────────────────────────
async function getInvoice(invoiceId) {
  const result = await sqCall('GET', `/invoices/${invoiceId}`);
  return result.invoice;
}

// ─── Webhook signature verification ───────────────────────────
function verifyWebhookSignature({ body, signature, signatureKey, notificationUrl }) {
  if (!signatureKey) return false;
  const str = notificationUrl + body;
  const hash = crypto.createHmac('sha256', signatureKey).update(str).digest('base64');
  return hash === signature;
}

module.exports = {
  sqCall,
  findOrCreateCustomer,
  createOrder,
  createDraftInvoice,
  publishInvoice,
  cancelInvoice,
  getInvoice,
  verifyWebhookSignature,
  sqBaseUrl,
};
