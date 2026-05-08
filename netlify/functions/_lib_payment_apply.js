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
    // Bump client status to 'paid' as well so CRM list reflects reality
    if (client && !['delivered','closed','archived'].includes(client.status)) {
      try { await sbUpdate('mc_clients', `id=eq.${client.id}`, { status: 'paid' }); }
      catch (e) { console.warn('client status bump on paid failed:', e.message); }
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
        // Trigger the onboarding intake form post-payment (best-effort).
        // If it fails it's not fatal, Mark can re-send manually from /admin.
        try {
          await sendOnboardingIntake({ inv, eng, client });
        } catch (e) { console.warn('onboarding intake send failed:', e.message); }
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
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0A1628" style="background-color:#0A1628;border-collapse:collapse;">
    <tr>
      <td bgcolor="#0A1628" style="background-color:#0A1628;background-image:linear-gradient(135deg,#0A1628 0%,#0F2040 50%,#162A4A 100%);color:#FFFFFF;padding:24px 28px;">
        <div style="font-family:'DM Mono',Menlo,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#34D399;margin-bottom:8px;font-weight:600;">${isTest}Payment Received</div>
        <div style="font-family:'Bebas Neue',Impact,sans-serif;font-size:36px;letter-spacing:0.02em;line-height:1;color:#FFFFFF;margin:0 0 6px;">${amount} - ${esc(clientName)}</div>
        <div style="font-size:13px;color:#E2E8F0;">${esc(engName)}${deliveryDueStr ? ' &middot; delivery due ' + esc(deliveryDueStr) + ' ET' : ''}</div>
      </td>
    </tr>
  </table>
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
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0A1628" style="background-color:#0A1628;border-collapse:collapse;">
    <tr>
      <td bgcolor="#0A1628" style="background-color:#0A1628;background-image:linear-gradient(135deg,#0A1628 0%,#0F2040 50%,#162A4A 100%);color:#FFFFFF;padding:36px 32px 32px;">
        <div style="font-family:'DM Mono',Menlo,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#93C5FD;margin-bottom:10px;font-weight:600;">Payment Received</div>
        <h1 style="font-family:'Bebas Neue',Impact,sans-serif;font-size:30px;font-weight:400;letter-spacing:0.02em;line-height:1.1;color:#FFFFFF;margin:0 0 8px;">
          <span style="color:#FFFFFF;">Thank you, ${esc(greetingName)}.</span><br/>
          <span style="color:#FFFFFF;">${eng.delivery_window_hrs}-hour clock has started.</span>
        </h1>
        <p style="font-size:15px;color:#E2E8F0;margin:0;line-height:1.5;">
          ${amount} received. ${esc(eng.name)} delivery is due by ${esc(deliveryDueStr)} ET.
        </p>
      </td>
    </tr>
  </table>
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
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0A1628" style="background-color:#0A1628;border-collapse:collapse;">
    <tr>
      <td bgcolor="#0A1628" align="center" style="background-color:#0A1628;padding:18px 32px;font-size:11px;color:#94A3B8;">
        Mark Gabrielli &middot; Fractional CMO &middot; markcmo.com
      </td>
    </tr>
  </table>
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

// ─── Onboarding intake email, fires automatically on payment ───
async function sendOnboardingIntake({ inv, eng, client }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const greetingName = (client.primary_contact_name || '').split(' ')[0] || 'there';
  const cc = buildClientCcList(client);
  const intakeUrl = 'https://markcmo.com/forms/onboarding';
  const deliveryHrs = eng.delivery_window_hrs || 72;
  const deliveryDueAt = new Date(Date.now() + deliveryHrs * 60 * 60 * 1000);
  const deliveryDueStr = deliveryDueAt.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/New_York' });

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1E293B;">
<div style="max-width:680px;margin:0 auto;background:#fff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0A1628" style="background-color:#0A1628;border-collapse:collapse;">
    <tr><td bgcolor="#0A1628" style="background-color:#0A1628;background-image:linear-gradient(135deg,#0A1628 0%,#0F2040 50%,#162A4A 100%);color:#FFFFFF;padding:32px;">
      <div style="font-family:'DM Mono',Menlo,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#34D399;margin-bottom:8px;font-weight:600;">Step 1 of 1 · Intake</div>
      <h1 style="font-family:'Bebas Neue',Impact,sans-serif;font-size:28px;font-weight:400;letter-spacing:0.02em;line-height:1.1;color:#FFFFFF;margin:0 0 6px;">${esc(greetingName)}, the clock is ticking.</h1>
      <p style="font-size:14px;color:#E2E8F0;margin:0;line-height:1.5;">Fill the intake worksheet so we can hit ${esc(deliveryDueStr)} ET.</p>
    </td></tr>
  </table>
  <div style="padding:32px;">
    <p style="font-size:15px;line-height:1.65;margin:0 0 16px;">Payment confirmed, thanks. To stay on the ${deliveryHrs}-hour delivery promise for <strong>${esc(eng.name)}</strong>, I need a short intake worksheet to point the audit at the right places. It takes about 12 minutes.</p>
    <p style="font-size:15px;line-height:1.65;margin:0 0 22px;">What I need from you:</p>
    <ul style="font-size:14px;line-height:1.7;margin:0 0 22px;padding-left:1.1rem;">
      <li>Read-only access to your analytics + ad accounts (or screenshots if access is messy)</li>
      <li>Your last 3 months of revenue + spend numbers (CSV is fine)</li>
      <li>Brand assets &amp; current marketing collateral</li>
      <li>One paragraph each on: top customer, product mix, what isn't working</li>
      <li>Anything else worth knowing about the business</li>
    </ul>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      <tr><td bgcolor="#F97316" align="center" style="background-color:#F97316;border-radius:10px;">
        <a href="${intakeUrl}" style="display:block;background-color:#F97316;color:#FFFFFF;font-weight:700;font-size:15px;letter-spacing:0.02em;text-transform:uppercase;text-decoration:none;padding:18px 24px;border-radius:10px;text-align:center;">
          <span style="color:#FFFFFF;">Open Intake Worksheet &rarr;</span>
        </a>
      </td></tr>
    </table>
    <p style="font-size:13px;color:#64748B;margin:14px 0 0;line-height:1.6;">Reply to this email if anything's unclear. Looking forward to seeing the data.</p>
    <p style="font-size:14px;line-height:1.65;margin:22px 0 0;">, Mark</p>
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0A1628" style="background-color:#0A1628;border-collapse:collapse;">
    <tr><td bgcolor="#0A1628" align="center" style="background-color:#0A1628;padding:18px 32px;font-size:11px;color:#94A3B8;">Mark Gabrielli &middot; Fractional CMO &middot; markcmo.com</td></tr>
  </table>
</div></body></html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Mark Gabrielli <mark@markcmo.com>',
      to: [client.primary_contact_email],
      cc,
      reply_to: 'mark@markcmo.com',
      subject: `Intake worksheet, ${eng.name} starts now`,
      html,
      tags: [{ name: 'template', value: 'onboarding-intake' }, { name: 'client', value: client.slug }],
    }),
  });
  const data = await res.json().catch(() => ({}));

  // Audit + journey rows
  try {
    await sbInsert('mc_audit_log', {
      engagement_id: eng.id, client_id: client.id,
      event: 'onboarding_intake_sent',
      payload: { recipient: client.primary_contact_email, cc, resend_id: data?.id, intake_url: intakeUrl },
    });
    await sbInsert('mc_journey_events', {
      client_id: client.id, engagement_id: eng.id,
      category: 'email', event: 'email_sent',
      subject_or_url: `Intake worksheet, ${eng.name} starts now`,
      recipient_email: client.primary_contact_email,
      resend_email_id: data?.id || null,
      raw: { template: 'onboarding-intake', auto: true },
    });
  } catch (e) { console.warn('onboarding audit/journey insert failed:', e.message); }
}

module.exports = { applyInvoiceState, buildCcList };
