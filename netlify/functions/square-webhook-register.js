// ═══════════════════════════════════════════════════════════════
// square-webhook-register.js
//
// Admin-gated. One-shot bootstrap: registers the Square webhook
// subscription that fires on invoice.payment_made / .canceled /
// .refunded. Returns the signature_key Square generates so the
// admin UI can guide the user to set it as
// SQUARE_WEBHOOK_SIGNATURE_KEY in Netlify env.
//
// POST { force?: false } - if a subscription already exists with
//   our notification URL, returns its info without creating a
//   duplicate (unless force=true).
//
// Returns:
//   { ok, mode: 'created'|'existing', subscription, signature_key }
//
// Auth: x-admin-api-token header OR mcadmin_session cookie.
// Uses SQUARE_ACCESS_TOKEN env var.
// ═══════════════════════════════════════════════════════════════
const { isAdminAuthed, corsHeaders } = require('./_lib_supabase');

const NOTIFY_URL = 'https://markcmo.com/.netlify/functions/square-webhook';
const EVENTS = [
  'invoice.created',
  'invoice.published',
  'invoice.payment_made',
  'invoice.scheduled_charge_failed',
  'invoice.canceled',
  'invoice.refunded',
  'invoice.deleted',
];

exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  if (!(await isAdminAuthed(event))) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

  const tok = process.env.SQUARE_ACCESS_TOKEN;
  if (!tok) return { statusCode: 500, headers, body: JSON.stringify({ error: 'SQUARE_ACCESS_TOKEN not set' }) };

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}
  const force = !!body.force;

  const env = (process.env.SQUARE_ENV || 'production').toLowerCase();
  const baseUrl = env === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
  const sqHeaders = { Authorization: `Bearer ${tok}`, 'Square-Version': '2024-11-20', 'Content-Type': 'application/json' };

  // 1) List existing subscriptions
  let existing;
  try {
    const r = await fetch(`${baseUrl}/v2/webhooks/subscriptions`, { headers: sqHeaders });
    const data = await r.json();
    if (!r.ok) return { statusCode: 502, headers, body: JSON.stringify({ error: 'Square list failed', detail: data }) };
    existing = (data.subscriptions || []).find(s => s.notification_url === NOTIFY_URL);
  } catch (e) { return { statusCode: 502, headers, body: JSON.stringify({ error: 'Square list error: ' + e.message }) }; }

  if (existing && !force) {
    // Square only returns the signature_key once at creation. If it already
    // exists, we can't recover it via API. Hint the user to either delete +
    // re-create, or grab it from Square Dashboard manually.
    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true, mode: 'existing',
      subscription: existing,
      signature_key: null,
      next_steps: [
        'A subscription already exists with our notification URL.',
        'Square only reveals the signature key at creation time. To get a fresh key, run again with { force: true } which will delete + re-create the subscription.',
        'OR retrieve the signature key manually from Square Dashboard → Developer → Webhooks → click the subscription.',
        'Save it as SQUARE_WEBHOOK_SIGNATURE_KEY env var in Netlify.',
      ],
    }) };
  }

  // 2) If forcing, delete the existing subscription first
  if (existing && force) {
    try {
      await fetch(`${baseUrl}/v2/webhooks/subscriptions/${existing.id}`, { method: 'DELETE', headers: sqHeaders });
    } catch (e) { console.warn('delete-existing failed:', e.message); }
  }

  // 3) Create the subscription
  const idem = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'idem_' + Date.now();
  let createdSub;
  try {
    const r = await fetch(`${baseUrl}/v2/webhooks/subscriptions`, {
      method: 'POST', headers: sqHeaders,
      body: JSON.stringify({
        idempotency_key: idem,
        subscription: {
          name: 'MarkCMO Engagement Pipeline',
          event_types: EVENTS,
          notification_url: NOTIFY_URL,
          api_version: '2024-11-20',
        },
      }),
    });
    const data = await r.json();
    if (!r.ok) return { statusCode: 502, headers, body: JSON.stringify({ error: 'Square create failed', detail: data }) };
    createdSub = data.subscription;
  } catch (e) { return { statusCode: 502, headers, body: JSON.stringify({ error: 'Square create error: ' + e.message }) }; }

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      ok: true,
      mode: 'created',
      subscription: { id: createdSub.id, name: createdSub.name, notification_url: createdSub.notification_url, event_types: createdSub.event_types, enabled: createdSub.enabled !== false },
      signature_key: createdSub.signature_key,
      next_steps: [
        'Save this signature_key as SQUARE_WEBHOOK_SIGNATURE_KEY in Netlify env (all contexts).',
        'Re-deploy so the function picks it up.',
        'Test by paying a $1 invoice — the webhook should fire and flip mc_invoices.paid_at automatically.',
      ],
    }),
  };
};
