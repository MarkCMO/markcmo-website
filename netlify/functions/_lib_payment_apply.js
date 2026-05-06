// ═══════════════════════════════════════════════════════════════
// _lib_payment_apply.js
//
// Shared "invoice was paid / voided / refunded" handler used by:
//   - square-webhook.js          (real-time, signature-verified)
//   - square-invoice-sync.js     (manual reconcile from /admin)
//
// Responsibilities when an invoice transitions to PAID:
//   1. mc_invoices.status='paid', paid_at=now, last_webhook_at=now
//   2. mc_engagements.status='paid', paid_at=now, started_at=now,
//      delivery_due_at=now+delivery_window_hrs (if not already paid)
//   3. mc_audit_log row event='invoice_paid' with payload incl. amount + is_test
//   4. Receipt email to client (skipped on test invoices)
//   5. Internal notification email to mark@markcmo.com (ALWAYS sent so
//      the live timeline lights up even on test runs)
//
// Returns { applied: bool, status: 'paid'|'void'|'refunded'|'no_change',
//           audit_id, notification_sent }
// ═══════════════════════════════════════════════════════════════
const { sbSelect, sbUpdate, sbInsert, buildClientCcList } = require('./_lib_supabase');

async function applyInvoiceState({ sqInvoice, source = 'webhook' }) {
  if (!sqInvoice?.id) return { applied: false, status: 'no_change', reason: 'no_square_id' };

  const ours = await sbSelect(
    `mc_invoices?square_invoice_id=eq.${encodeURIComponent(sqInvoice.id)}&select=*,mc_engagements(*,mc_clients(*))`
  );
  if (!ours.length) return { applied: false, status: 'no_change', reason: 'no_local_invoice' };

  const inv = ours[0];
  const eng = inv.mc_engagements;
  const client = eng?.mc_clients;
  const now = new Date().toISOString();
  const sqStatus = (sqInvoice.status || '').toUpperCase();

  // Always touch last_webhook_at + raw_payload trail
  await sbUpdate('mc_invoices', `id=eq.${inv.id}`, {
    last_webhook_at: now,
    raw_payload: {
      ...(inv.raw_payload || {}),
      [`apply_${source}_${sqStatus.toLowerCase()}_${now}`]: { sq_status: sqStatus, sq_version: sqInvoice.version },
    },
  });

  // ─── PAID ───────────────────────────────────────────────────
  if (sqStatus === 'PAID' || sqStatus === 'PARTIALLY_PAID') {
    if (inv.status === 'paid') {
      return { applied: false, status: 'no_change', reason: 'already_paid' };
    }

    await sbUpdate('mc_invoices', `id=eq.${inv.id}`, {
      status: 'paid',
      paid_at: now,
      square_payment_id: sqInvoice.payment_requests?.[0]?.uid || null,
    });

    if (eng) {
      const deliveryDueAt = new Date(Date.now() + (eng.delivery_window_hrs || 72) * 60 * 60 * 1000).toISOString();
      await sbUpdate('mc_engagements', `id=eq.${eng.id}`, {
        status: 'paid',
        paid_at: now,
        started_at: now,
        delivery_due_at: deliveryDueAt,
      });
    }

    const audit = await sbInsert('mc_audit_log', {
      engagement_id: inv.engagement_id,
      client_id: client?.id || null,
      event: 'invoice_paid',
      payload: {
        invoice_id: inv.id,
        square_invoice_id: sqInvoice.id,
        amount_usd: inv.amount_usd,
        is_test: inv.is_test,
        source,
        delivery_due_at: eng ? new Date(Date.now() + (eng.delivery_window_hrs || 72) * 60 * 60 * 1000).toISOString() : null,
      },
    });

    let notificationSent = false;
    try {
      // Internal notification ALWAYS goes out (test or live) so Mark sees the trigger
      await sendInternalPaymentNotification({ inv, eng, client });
      notificationSent = true;

      // Client-facing receipt only on real invoices
      if (!inv.is_test && client && eng) {
        await sendClientReceipt({ inv, eng, client });
      }
    } catch (e) {
      console.error('payment notification email failed:', e);
    }

    return { applied: true, status: 'paid', audit_id: audit?.[0]?.id || null, notification_sent: notificationSent };
  }

  // ─── VOID / CANCELED ────────────────────────────────────────
  if (sqStatus === 'CANCELED') {
    if (inv.status !== 'void') {
      await sbUpdate('mc_invoices', `id=eq.${inv.id}`, { status: 'void', void_at: now });
      await sbInsert('mc_audit_log', {
        engagement_id: inv.engagement_id,
        client_id: client?.id || null,
        event: 'invoice_voided_via_' + source,
        payload: { invoice_id: inv.id, square_invoice_id: sqInvoice.id, source },
      });
      return { applied: true, status: 'void' };
    }
    return { applied: false, status: 'no_change', reason: 'already_void' };
  }

  // ─── REFUNDED ───────────────────────────────────────────────
  if (sqStatus === 'REFUNDED' || sqStatus === 'PARTIALLY_REFUNDED') {
    if (inv.status !== 'refunded') {
      await sbUpdate('mc_invoices', `id=eq.${inv.id}`, { status: 'refunded' });
      await sbInsert('mc_audit_log', {
        engagement_id: inv.engagement_id,
        client_id: client?.id || null,
        event: 'invoice_refunded',
        payload: { invoice_id: inv.id, square_invoice_id: sqInvoice.id, source },
      });
      return { applied: true, status: 'refunded' };
    }
    return { applied: false, status: 'no_change', reason: 'already_refunded' };
  }

  return { applied: false, status: 'no_change', reason: `sq_status_${sqStatus.toLowerCase()}` };
}

// ─── CC list helper (delegates to _lib_supabase.buildClientCcList) ──
function buildCcList(client) { return buildClientCcList(client); }

// ─── Internal "you got paid" email to Mark ─────────────────────
async function sendInternalPaymentNotification({ inv, eng, client }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.warn('RESEND_API_KEY not set'); return; }

  const amount = '$' + Number(inv.amount_usd).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const isTest = inv.is_test ? '[TEST] ' : '';
  const clientName = client?.legal_name || 'Unknown client';
  const engName = eng?.name || 'Engagement';
  const deliveryDueStr = eng ? new Date(Date.now() + (eng.delivery_window_hrs || 72) * 60 * 60 * 1000)
    .toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/New_York' }) : null;

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:24px;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1E293B;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 24px 48px rgba(10,22,40,0.12);">
  <div style="background:linear-gradient(135deg,#0A1628 0%,#0F2040 50%,#162A4A 100%);color:#fff;padding:24px 28px;">
    <div style="font-family:'DM Mono',Menlo,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#10B981;margin-bottom:8px;font-weight:600;">${isTest}Payment Received</div>
    <div style="font-family:'Bebas Neue',Impact,sans-serif;font-size:36px;letter-spacing:0.02em;line-height:1;color:#fff;margin:0 0 6px;">${amount} - ${esc(clientName)}</div>
    <div style="font-size:13px;color:rgba(248,250,252,0.78);">${esc(engName)}${deliveryDueStr ? ' &middot; delivery due ' + esc(deliveryDueStr) + ' ET' : ''}</div>
  </div>
  <div style="padding:24px 28px;font-size:14px;line-height:1.65;">
    ${client ? `<p style="margin:0 0 12px;"><strong>${esc(client.primary_contact_name || '')}</strong> (${esc(client.primary_contact_email || '')}) just paid the ${esc(engName)} invoice.</p>` : ''}
    ${inv.is_test ? `
      <div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:10px;padding:14px 16px;margin:0 0 14px;font-size:13px;color:#92400E;">
        <strong>This is a TEST invoice</strong> (is_test=true). The 72-hour delivery clock and reminder cron will NOT auto-fire because of the test flag in the audit log. The receipt email to the client was suppressed.
      </div>
    ` : `
      <p style="margin:0 0 12px;">The ${eng?.delivery_window_hrs || 72}-hour delivery clock started. Send the intake worksheet now.</p>
    `}
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px 18px;margin:14px 0;font-family:'DM Mono',Menlo,monospace;font-size:11px;color:#475569;line-height:1.7;">
      <div>square_invoice_id: <span style="color:#0A1628;">${esc(inv.square_invoice_id || '')}</span></div>
      <div>mc_invoices.id: <span style="color:#0A1628;">${esc(inv.id)}</span></div>
      <div>amount: <span style="color:#0A1628;">${amount}</span></div>
      <div>is_test: <span style="color:#0A1628;">${inv.is_test ? 'true' : 'false'}</span></div>
    </div>
    <p style="margin:0;font-size:13px;color:#64748B;">View in admin: <a href="https://markcmo.com/admin#case-files" style="color:#2563EB;">markcmo.com/admin#case-files</a></p>
  </div>
</div></body></html>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'MarkCMO Pipeline <pipeline@markcmo.com>',
      to: ['mark@markcmo.com', 'marklgabriellijr@gmail.com'],
      subject: `${isTest}PAID: ${amount} - ${clientName} - ${engName}`,
      html,
    }),
  });
}

// ─── Client-facing receipt + delivery-clock-started email ──────
async function sendClientReceipt({ inv, eng, client }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const amount = '$' + Number(inv.amount_usd).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const deliveryDueAt = new Date(Date.now() + (eng.delivery_window_hrs || 72) * 60 * 60 * 1000);
  const deliveryDueStr = deliveryDueAt.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/New_York' });
  const greetingName = (client.primary_contact_name || '').split(' ')[0] || 'there';
  const cc = buildCcList(client);

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1E293B;">
<div style="max-width:680px;margin:0 auto;background:#fff;">
  <div style="background:linear-gradient(135deg,#0A1628 0%,#0F2040 50%,#162A4A 100%);color:#fff;padding:36px 32px 32px;">
    <div style="font-family:'DM Mono',Menlo,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#3B82F6;margin-bottom:10px;font-weight:600;">Payment Received</div>
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
            <div style="font-family:'DM Mono',Menlo,monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#2563EB;margin-bottom:4px;font-weight:600;">Amount Paid</div>
            <div style="font-family:'Bebas Neue',Impact,sans-serif;font-size:28px;color:#0A1628;letter-spacing:0.02em;line-height:1;">${amount}</div>
          </td>
          <td style="vertical-align:top;padding:0;text-align:right;">
            <div style="font-family:'DM Mono',Menlo,monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#2563EB;margin-bottom:4px;font-weight:600;">Delivery Due</div>
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

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Mark Gabrielli <mark@markcmo.com>',
      to: [client.primary_contact_email],
      cc,
      reply_to: 'mark@markcmo.com',
      subject: `Payment received - ${eng.name} delivery clock started`,
      html,
    }),
  });
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

module.exports = { applyInvoiceState, buildCcList };
