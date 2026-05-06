// ═══════════════════════════════════════════════════════════════
// square-invoice-sync.js
//
// Admin-gated. Pulls the latest state of one or more Square invoices
// and reconciles our mc_invoices + mc_engagements + mc_audit_log to
// match. This is the "fix it manually" button when Square's webhook
// didn't fire (no SQUARE_WEBHOOK_SIGNATURE_KEY yet, network blip,
// missed delivery, etc).
//
// POST body (JSON):
//   { invoiceId: "<mc_invoices.id uuid>" }   -- sync one specific row
//   OR { engagementId: "<mc_engagements.id>" } -- sync ALL invoices for that engagement
//   OR { all: true }                          -- sync every non-final invoice
//
// Auth: cookie OR x-admin-api-token header. Same as other admin endpoints.
//
// Returns { ok: true, results: [{ invoice_id, square_invoice_id, before_status,
//   square_status, applied: bool, status: 'paid'|'void'|'refunded'|'no_change',
//   notification_sent: bool }, ...] }
// ═══════════════════════════════════════════════════════════════
const { sbSelect, isAdminAuthed, corsHeaders } = require('./_lib_supabase');
const { getInvoice } = require('./_lib_square');
const { applyInvoiceState } = require('./_lib_payment_apply');

exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  }
  if (!(await isAdminAuthed(event))) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  // ─── Resolve which mc_invoices rows to sync ───────────────────
  let rows = [];
  try {
    if (body.invoiceId) {
      rows = await sbSelect(`mc_invoices?id=eq.${encodeURIComponent(body.invoiceId)}&select=id,square_invoice_id,status`);
    } else if (body.engagementId) {
      rows = await sbSelect(`mc_invoices?engagement_id=eq.${encodeURIComponent(body.engagementId)}&select=id,square_invoice_id,status`);
    } else if (body.all === true) {
      // Sync any invoice that isn't already in a final state
      rows = await sbSelect(`mc_invoices?status=in.(draft,sent)&select=id,square_invoice_id,status&limit=50`);
    } else {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Provide invoiceId, engagementId, or all=true' }) };
    }
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Lookup failed: ' + e.message }) };
  }

  if (!rows.length) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, results: [], note: 'No matching invoices' }) };
  }

  // ─── Process each row sequentially (Square API is rate-limited, this is fine) ──
  const results = [];
  for (const row of rows) {
    const result = { invoice_id: row.id, square_invoice_id: row.square_invoice_id, before_status: row.status };
    if (!row.square_invoice_id) {
      result.error = 'no_square_invoice_id';
      results.push(result);
      continue;
    }
    try {
      const sqInvoice = await getInvoice(row.square_invoice_id);
      result.square_status = sqInvoice.status;
      const apply = await applyInvoiceState({ sqInvoice, source: 'manual_sync' });
      result.applied = apply.applied;
      result.status = apply.status;
      result.reason = apply.reason || null;
      result.notification_sent = apply.notification_sent || false;
    } catch (e) {
      result.error = e.message;
    }
    results.push(result);
  }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, results }) };
};
