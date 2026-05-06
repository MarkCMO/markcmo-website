// ═══════════════════════════════════════════════════════════════
// square-invoice-action.js
// Single auth-gated endpoint for the three Square invoice actions
// the engagement pipeline needs:
//
//   POST { action: 'create-draft', engagementId, isTest? }
//     → Creates Square customer (or finds), order, and DRAFT invoice.
//       Inserts/updates mc_invoices row. Does NOT publish.
//       Used internally by execute-engagement-doc.js on countersign,
//       and via the VDR "Prepare Invoice" button.
//
//   POST { action: 'publish', invoiceId }    (mc_invoices.id)
//     → Publishes the draft → Square emails the client + activates
//       the payment link. Updates mc_invoices.status = 'sent'.
//       Used by the VDR "Send Payment Request" button.
//
//   POST { action: 'cancel', invoiceId }
//     → Voids the Square invoice. Updates mc_invoices.status = 'void'.
//       Used to clean up test invoices or aborted sends.
//
// Auth: mcadmin_session cookie OR x-admin-api-token header.
// ═══════════════════════════════════════════════════════════════
const crypto = require('crypto');
const { sbSelect, sbUpdate, sbInsert, isAdminAuthed, corsHeaders } = require('./_lib_supabase');
const sq = require('./_lib_square');

const TEST_AMOUNT_CENTS = 100;     // $1.00 for smoke tests

exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  if (!(await isAdminAuthed(event))) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { action } = body;

  try {
    if (action === 'create-draft') {
      return await handleCreateDraft(body, headers, event);
    }
    if (action === 'publish') {
      return await handlePublish(body, headers, event);
    }
    if (action === 'cancel') {
      return await handleCancel(body, headers, event);
    }
    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) };
  } catch (err) {
    console.error('square-invoice-action error:', err.message, err.squareErrors || '');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: err.message,
        squareErrors: err.squareErrors,
      }),
    };
  }
};

// ─── create-draft ──────────────────────────────────────────────
async function handleCreateDraft(body, headers, event) {
  const { engagementId, isTest } = body;
  if (!engagementId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing engagementId' }) };
  }

  // Look up engagement + client
  const engs = await sbSelect(
    `mc_engagements?id=eq.${engagementId}&select=*,mc_clients(*)`
  );
  if (!engs.length) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Engagement not found' }) };
  }
  const eng = engs[0];
  const client = eng.mc_clients;
  if (!client?.primary_contact_email) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Client has no primary_contact_email' }) };
  }

  // Check for existing non-void invoice on this engagement
  const existing = await sbSelect(`mc_invoices?engagement_id=eq.${engagementId}&status=neq.void&select=*&limit=1`);
  if (existing.length) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Invoice already exists for this engagement',
        invoice: existing[0],
        skipped: true,
      }),
    };
  }

  // Compute amount
  const amountUsd = isTest ? 1.00 : Number(eng.fee_usd);
  const amountCents = Math.round(amountUsd * 100);

  // 1) Find or create Square customer
  const [givenName, ...rest] = (client.primary_contact_name || 'Client').split(' ');
  const familyName = rest.join(' ');
  const cust = await sq.findOrCreateCustomer({
    email: client.primary_contact_email,
    givenName,
    familyName,
    companyName: client.legal_name,
    phone: client.primary_contact_phone,
  });

  // Cache customer id on the client record (if not already set)
  if (!client.square_customer_id || client.square_customer_id !== cust.id) {
    await sbUpdate('mc_clients', `id=eq.${client.id}`, { square_customer_id: cust.id });
  }

  // 2) Create order
  const order = await sq.createOrder({
    customerId: cust.id,
    amountCents,
    name: isTest ? `[TEST $1] ${eng.name}` : eng.name,
    note: `${eng.name} — ${client.legal_name}${isTest ? ' (TEST)' : ''}`,
  });

  // 3) Create draft invoice
  const inv = await sq.createDraftInvoice({
    orderId: order.id,
    customerId: cust.id,
    recipientEmail: client.primary_contact_email,
    title: isTest ? `[TEST] ${eng.name}` : eng.name,
    description: `${eng.name} for ${client.legal_name}. Fixed-fee engagement. ${eng.delivery_window_hrs}-hour delivery starts when payment clears.`,
    dueDays: 14,
  });

  // 4) Insert mc_invoices row
  const insertedRows = await sbInsert('mc_invoices', {
    engagement_id: eng.id,
    amount_usd: amountUsd,
    status: 'draft',
    is_test: !!isTest,
    square_customer_id: cust.id,
    square_order_id: order.id,
    square_invoice_id: inv.id,
    square_invoice_url: inv.public_url || null,
    draft_at: new Date().toISOString(),
    raw_payload: { square_invoice: { id: inv.id, version: inv.version, status: inv.status } },
  });
  const inserted = insertedRows[0];

  // 5) Audit log
  await sbInsert('mc_audit_log', {
    engagement_id: eng.id,
    client_id: client.id,
    event: 'invoice_drafted',
    payload: {
      invoice_id: inserted.id,
      square_invoice_id: inv.id,
      amount_usd: amountUsd,
      is_test: !!isTest,
    },
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      action: 'create-draft',
      invoice: inserted,
      square: { id: inv.id, version: inv.version, status: inv.status, public_url: inv.public_url },
    }),
  };
}

// ─── publish (Send Payment Request) ────────────────────────────
async function handlePublish(body, headers, event) {
  const { invoiceId } = body;
  if (!invoiceId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing invoiceId' }) };
  }

  const invs = await sbSelect(
    `mc_invoices?id=eq.${invoiceId}&select=*,mc_engagements(*,mc_clients(*))`
  );
  if (!invs.length) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Invoice not found' }) };
  }
  const inv = invs[0];
  if (inv.status !== 'draft') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: `Invoice status is '${inv.status}', expected 'draft'` }) };
  }

  // Refresh from Square to get current version
  const sqInv = await sq.getInvoice(inv.square_invoice_id);
  const published = await sq.publishInvoice({ invoiceId: inv.square_invoice_id, version: sqInv.version });

  // Update mc_invoices
  const now = new Date().toISOString();
  const updated = await sbUpdate('mc_invoices', `id=eq.${inv.id}`, {
    status: 'sent',
    sent_at: now,
    square_invoice_url: published.public_url || sqInv.public_url || inv.square_invoice_url,
    raw_payload: { ...(inv.raw_payload || {}), published: { status: published.status, version: published.version } },
  });

  // Audit log
  await sbInsert('mc_audit_log', {
    engagement_id: inv.engagement_id,
    client_id: inv.mc_engagements?.client_id,
    event: 'invoice_sent',
    payload: {
      invoice_id: inv.id,
      square_invoice_id: inv.square_invoice_id,
      amount_usd: inv.amount_usd,
      is_test: inv.is_test,
      public_url: published.public_url,
    },
  });

  // Auto-advance pipeline: → invoiced (only on live invoices)
  // Don't overwrite later statuses (paid, delivering, delivered, closed).
  if (!inv.is_test && inv.engagement_id) {
    try {
      const ENG_TERMINAL = ['paid','delivering','delivered','closed'];
      const engRow = inv.mc_engagements;
      if (engRow && !ENG_TERMINAL.includes(engRow.status)) {
        await sbUpdate('mc_engagements', `id=eq.${inv.engagement_id}`, { status: 'invoiced' });
      }
      if (engRow?.client_id && !['paid','delivering','delivered','closed'].includes(engRow?.mc_clients?.status)) {
        await sbUpdate('mc_clients', `id=eq.${engRow.client_id}`, { status: 'invoiced' });
      }
    } catch (e) { console.warn('auto-advance after publish failed:', e.message); }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      action: 'publish',
      invoice: updated[0],
      payment_url: published.public_url,
    }),
  };
}

// ─── cancel/void ───────────────────────────────────────────────
async function handleCancel(body, headers, event) {
  const { invoiceId } = body;
  if (!invoiceId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing invoiceId' }) };
  }

  const invs = await sbSelect(`mc_invoices?id=eq.${invoiceId}&select=*`);
  if (!invs.length) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Invoice not found' }) };
  }
  const inv = invs[0];
  if (inv.status === 'paid') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cannot cancel a paid invoice' }) };
  }

  let cancelResult = null;
  try {
    const sqInv = await sq.getInvoice(inv.square_invoice_id);
    cancelResult = await sq.cancelInvoice({ invoiceId: inv.square_invoice_id, version: sqInv.version });
  } catch (e) {
    console.warn('Square cancel error (continuing to mark void in DB):', e.message);
  }

  const now = new Date().toISOString();
  const updated = await sbUpdate('mc_invoices', `id=eq.${inv.id}`, {
    status: 'void',
    void_at: now,
  });

  await sbInsert('mc_audit_log', {
    engagement_id: inv.engagement_id,
    event: 'invoice_voided',
    payload: { invoice_id: inv.id, square_invoice_id: inv.square_invoice_id, square_result: cancelResult?.status },
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, action: 'cancel', invoice: updated[0] }),
  };
}
