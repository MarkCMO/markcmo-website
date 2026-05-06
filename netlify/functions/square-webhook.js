// ═══════════════════════════════════════════════════════════════
// square-webhook.js
//
// Receives Square webhook events. Currently handles:
//   - invoice.payment_made   → mark mc_invoices.paid_at, mc_engagements.paid_at,
//                              start delivery clock (delivery_due_at), email receipt.
//   - invoice.canceled       → mark void in mc_invoices.
//   - invoice.refunded       → mark refunded in mc_invoices.
//
// SETUP: register this URL in Square Dashboard:
//   https://markcmo.com/.netlify/functions/square-webhook
// Set SQUARE_WEBHOOK_SIGNATURE_KEY env var to the signature key
// from the Square webhook subscription.
// ═══════════════════════════════════════════════════════════════
const { sbSelect, sbUpdate, sbInsert } = require('./_lib_supabase');
const sq = require('./_lib_square');

const NOTIFICATION_URL = 'https://markcmo.com/.netlify/functions/square-webhook';

exports.handler = async (event) => {
  // Square sends POST. Anything else, 405.
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const rawBody = event.body || '';
  const signature = event.headers?.['x-square-hmacsha256-signature'] || event.headers?.['x-square-signature'] || '';
  const sigKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;

  // Verify signature (strongly recommended)
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
  catch (e) { return { statusCode: 400, body: 'Invalid JSON' }; }

  const eventType = payload?.type || '';
  const sqInvoice = payload?.data?.object?.invoice || null;
  const sqInvoiceId = sqInvoice?.id;

  console.log('Square webhook:', eventType, 'invoice', sqInvoiceId);

  if (!sqInvoiceId) {
    return { statusCode: 200, body: 'OK (ignored)' };
  }

  try {
    // Look up our mc_invoices row by Square invoice id
    const ours = await sbSelect(
      `mc_invoices?square_invoice_id=eq.${encodeURIComponent(sqInvoiceId)}&select=*,mc_engagements(*,mc_clients(*))`
    );
    if (!ours.length) {
      console.warn('No matching mc_invoices row for square_invoice_id', sqInvoiceId);
      return { statusCode: 200, body: 'OK (no match)' };
    }
    const inv = ours[0];
    const eng = inv.mc_engagements;
    const client = eng?.mc_clients;

    const now = new Date().toISOString();

    // Persist webhook payload regardless of event type
    await sbUpdate('mc_invoices', `id=eq.${inv.id}`, {
      last_webhook_at: now,
      raw_payload: { ...(inv.raw_payload || {}), [`webhook_${eventType.replace(/\./g,'_')}`]: { at: now, status: sqInvoice.status } },
    });

    // ─── invoice.payment_made (or invoice.paid) ─────────────────
    if (eventType === 'invoice.payment_made' || eventType === 'invoice.paid' || sqInvoice.status === 'PAID') {
      if (inv.status !== 'paid') {
        // Update invoice to paid
        await sbUpdate('mc_invoices', `id=eq.${inv.id}`, {
          status: 'paid',
          paid_at: now,
          square_payment_id: sqInvoice.next_payment_request_id || sqInvoice.payment_requests?.[0]?.uid || null,
        });

        // Update engagement: paid + start delivery clock
        if (eng) {
          const deliveryDueAt = new Date(Date.now() + (eng.delivery_window_hrs || 72) * 60 * 60 * 1000).toISOString();
          await sbUpdate('mc_engagements', `id=eq.${eng.id}`, {
            status: 'paid',
            paid_at: now,
            started_at: now,
            delivery_due_at: deliveryDueAt,
          });
        }

        // Audit
        await sbInsert('mc_audit_log', {
          engagement_id: inv.engagement_id,
          client_id: client?.id || null,
          event: 'invoice_paid',
          payload: {
            invoice_id: inv.id,
            square_invoice_id: sqInvoiceId,
            amount_usd: inv.amount_usd,
            is_test: inv.is_test,
            delivery_due_at: eng ? new Date(Date.now() + (eng.delivery_window_hrs || 72) * 60 * 60 * 1000).toISOString() : null,
          },
        });

        // Send receipt + kickoff email to both parties
        if (!inv.is_test && client && eng) {
          await sendPaymentReceiptEmails({ inv, eng, client });
        }
      }
    }

    // ─── invoice.canceled ──────────────────────────────────────
    if (eventType === 'invoice.canceled') {
      await sbUpdate('mc_invoices', `id=eq.${inv.id}`, { status: 'void', void_at: now });
      await sbInsert('mc_audit_log', {
        engagement_id: inv.engagement_id,
        event: 'invoice_voided_via_webhook',
        payload: { invoice_id: inv.id, square_invoice_id: sqInvoiceId },
      });
    }

    // ─── invoice.refunded ──────────────────────────────────────
    if (eventType === 'invoice.refunded') {
      await sbUpdate('mc_invoices', `id=eq.${inv.id}`, { status: 'refunded' });
      await sbInsert('mc_audit_log', {
        engagement_id: inv.engagement_id,
        event: 'invoice_refunded',
        payload: { invoice_id: inv.id, square_invoice_id: sqInvoiceId },
      });
    }

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('Square webhook handler error:', err);
    // Return 200 so Square doesn't keep retrying on a bug; we logged it.
    return { statusCode: 200, body: 'Internal error logged' };
  }
};

// ─── Receipt + kickoff emails on payment ───────────────────────
async function sendPaymentReceiptEmails({ inv, eng, client }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.warn('RESEND_API_KEY not set; skipping receipt emails'); return; }

  const amount = '$' + Number(inv.amount_usd).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const deliveryDueAt = new Date(Date.now() + (eng.delivery_window_hrs || 72) * 60 * 60 * 1000);
  const deliveryDueStr = deliveryDueAt.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/New_York' });
  const greetingName = (client.primary_contact_name || '').split(' ')[0] || 'there';

  const clientHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1E293B;">
<div style="max-width:680px;margin:0 auto;background:#fff;">
  <div style="background:linear-gradient(135deg,#0A1628 0%,#0F2040 50%,#162A4A 100%);color:#fff;padding:36px 32px 32px;">
    <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#3B82F6;margin-bottom:10px;">Payment Received</div>
    <h1 style="font-family:'Bebas Neue',Impact,sans-serif;font-size:30px;font-weight:400;letter-spacing:0.02em;line-height:1.1;color:#fff;margin:0 0 8px;">
      Thank you, ${esc(greetingName)}.<br/>${eng.delivery_window_hrs}-hour clock has started.
    </h1>
    <p style="font-size:15px;color:rgba(248,250,252,0.78);margin:0;line-height:1.5;">
      ${amount} received. ${esc(eng.name)} delivery is due by ${esc(deliveryDueStr)} ET.
    </p>
  </div>
  <div style="padding:32px;">
    <p style="font-size:16px;line-height:1.65;margin:0 0 16px;">${esc(greetingName)},</p>
    <p style="font-size:15px;line-height:1.65;margin:0 0 16px;">
      Payment confirmed. The ${eng.delivery_window_hrs}-hour delivery clock starts now. You'll receive the intake worksheet within the next hour to kick things off.
    </p>
    <div style="background:#EFF6FF;border:1px solid rgba(37,99,235,0.25);border-radius:12px;padding:20px 24px;margin:20px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="vertical-align:top;padding:0;">
            <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#2563EB;margin-bottom:4px;font-weight:600;">Amount Paid</div>
            <div style="font-family:'Bebas Neue',Impact,sans-serif;font-size:28px;color:#0A1628;letter-spacing:0.02em;line-height:1;">${amount}</div>
          </td>
          <td style="vertical-align:top;padding:0;text-align:right;">
            <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#2563EB;margin-bottom:4px;font-weight:600;">Delivery Due</div>
            <div style="font-family:'Bebas Neue',Impact,sans-serif;font-size:18px;color:#0A1628;letter-spacing:0.02em;line-height:1.2;">${esc(deliveryDueStr.split(' at ')[0])}</div>
            <div style="font-size:12px;color:#64748B;margin-top:4px;">${esc(deliveryDueStr.split(' at ')[1] || '')} ET</div>
          </td>
        </tr>
      </table>
    </div>
    <p style="font-size:14px;line-height:1.65;margin:0;color:#64748B;">
      Questions or anything that needs to change? Reply to this email or reach Mark directly at <a href="mailto:mark@markcmo.com" style="color:#2563EB;">mark@markcmo.com</a>.
    </p>
  </div>
  <div style="background:#0A1628;padding:18px 32px;font-size:11px;color:rgba(255,255,255,0.5);text-align:center;">
    Mark Gabrielli &middot; Fractional CMO &middot; markcmo.com
  </div>
</div></body></html>`;

  const markHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:24px;background:#F8FAFC;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
  <div style="background:#0A1628;color:#fff;padding:20px 24px;">
    <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#10B981;margin-bottom:6px;">PAID</div>
    <h1 style="font-size:20px;margin:0;font-weight:700;">${amount} - ${esc(client.legal_name)}</h1>
    <div style="font-size:13px;color:#94A3B8;margin-top:4px;">${esc(eng.name)} - delivery due ${esc(deliveryDueStr)} ET</div>
  </div>
  <div style="padding:20px 24px;font-size:14px;line-height:1.65;color:#1E293B;">
    <p style="margin:0 0 10px;"><strong>${esc(client.primary_contact_name)}</strong> (${esc(client.primary_contact_email)}) just paid the ${esc(eng.name)} invoice.</p>
    <p style="margin:0 0 10px;">The 72-hour delivery clock started. Send intake worksheet now.</p>
    <p style="margin:0;font-size:12px;color:#64748B;">Square invoice: ${esc(inv.square_invoice_id)}</p>
  </div>
</div></body></html>`;

  await Promise.allSettled([
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Mark Gabrielli <mark@markcmo.com>',
        to: [client.primary_contact_email],
        cc: ['marklgabriellijr@gmail.com'],
        reply_to: 'mark@markcmo.com',
        subject: `Payment received - ${eng.name} delivery clock started`,
        html: clientHtml,
      }),
    }),
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'MarkCMO <forms@markcmo.com>',
        to: ['mark@markcmo.com', 'marklgabriellijr@gmail.com'],
        subject: `PAID: ${amount} - ${client.legal_name} - ${eng.name}`,
        html: markHtml,
      }),
    }),
  ]);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
