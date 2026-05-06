// ═══════════════════════════════════════════════════════════════
// engagement-payment-followups.js
//
// Scheduled function (cron). Finds mc_invoices with status='sent'
// that have aged past 24h / 48h / 72h since their last reminder
// and sends progressive follow-ups. After 72h with no payment,
// flips escalated_at and emails Mark for manual outreach.
//
// Schedule (Netlify config in netlify.toml):
//   [functions."engagement-payment-followups"]
//     schedule = "0 */6 * * *"   # every 6 hours
//
// Trigger manually for testing:
//   curl -X POST https://markcmo.com/.netlify/functions/engagement-payment-followups \
//     -H "x-admin-api-token: $TOK"
// ═══════════════════════════════════════════════════════════════
const { sbSelect, sbUpdate, sbInsert, isAdminAuthed, corsHeaders } = require('./_lib_supabase');

const HOURS = (n) => n * 60 * 60 * 1000;

// Reminder cadence: 24h, 48h, 72h after sent_at (or last_reminder_at if newer)
const REMINDERS = [
  { afterHours: 24, key: 'reminder_1', tone: 'friendly' },
  { afterHours: 48, key: 'reminder_2', tone: 'firm' },
  { afterHours: 72, key: 'reminder_3', tone: 'final' },
];

exports.handler = async (event) => {
  // Allow manual trigger via admin token (handy for testing). Cron just calls without auth.
  const isManual = event.httpMethod === 'POST';
  if (isManual && !(await isAdminAuthed(event))) {
    return { statusCode: 401, headers: corsHeaders(event), body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    // Fetch all invoices currently in 'sent' status with their engagement + client
    const sentInvoices = await sbSelect(
      `mc_invoices?status=eq.sent&select=*,mc_engagements(*,mc_clients(*))`
    );

    const now = Date.now();
    const results = { checked: sentInvoices.length, reminders_sent: 0, escalated: 0, errors: [] };

    for (const inv of sentInvoices) {
      try {
        const sentAt = inv.sent_at ? new Date(inv.sent_at).getTime() : 0;
        const lastReminderAt = inv.last_reminder_at ? new Date(inv.last_reminder_at).getTime() : 0;
        const baseTime = Math.max(sentAt, lastReminderAt);
        const ageHours = (now - sentAt) / (60 * 60 * 1000);
        const sinceLastHours = (now - baseTime) / (60 * 60 * 1000);
        const reminderCount = inv.reminder_count || 0;

        // Done sending reminders? Check if we should escalate.
        if (reminderCount >= REMINDERS.length) {
          if (!inv.escalated_at && ageHours >= 96) {  // 96h = 4 days, manual outreach time
            await escalate(inv);
            results.escalated++;
          }
          continue;
        }

        // Time for next reminder?
        const nextReminder = REMINDERS[reminderCount];
        if (ageHours >= nextReminder.afterHours && sinceLastHours >= 12) {  // wait at least 12h between reminders
          await sendReminder(inv, nextReminder);
          results.reminders_sent++;
        }
      } catch (e) {
        console.error(`Reminder error for invoice ${inv.id}:`, e.message);
        results.errors.push({ invoice_id: inv.id, error: e.message });
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders(event),
      body: JSON.stringify(results),
    };
  } catch (err) {
    console.error('engagement-payment-followups error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: err.message }),
    };
  }
};

async function sendReminder(inv, reminderSpec) {
  const eng = inv.mc_engagements;
  const client = eng?.mc_clients;
  if (!client?.primary_contact_email) return;
  if (inv.is_test) return;  // never send reminders for $1 test invoices

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');

  const amount = '$' + Number(inv.amount_usd).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const greetingName = (client.primary_contact_name || '').split(' ')[0] || 'there';
  const paymentUrl = inv.square_invoice_url || '';

  const subjects = {
    friendly: `Quick check-in on the ${eng.name} invoice`,
    firm:     `Following up: ${eng.name} - ${amount} invoice`,
    final:    `Last reminder before manual follow-up: ${eng.name} - ${amount}`,
  };

  const intros = {
    friendly: `Just a friendly nudge - the ${eng.name} invoice for ${amount} is sitting in your inbox waiting for payment. Once it clears we'll start the ${eng.delivery_window_hrs}-hour delivery clock.`,
    firm:     `Following up on the ${eng.name} invoice for ${amount}. It went out 48 hours ago and is still unpaid. Let me know if there's anything blocking the payment - happy to talk it through.`,
    final:    `This is the third (and last automatic) reminder on the ${eng.name} invoice for ${amount}. If there's an issue or the timing has shifted, please reply and let me know - otherwise I'll reach out personally next.`,
  };

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1E293B;">
<div style="max-width:680px;margin:0 auto;background:#fff;">
  <div style="padding:32px;">
    <p style="font-size:16px;line-height:1.65;margin:0 0 16px;">${esc(greetingName)},</p>
    <p style="font-size:15px;line-height:1.65;margin:0 0 20px;">${esc(intros[reminderSpec.tone])}</p>
    ${paymentUrl ? `
    <div style="text-align:center;margin:24px 0;">
      <a href="${esc(paymentUrl)}" style="display:inline-block;background:#F97316;color:#fff;font-weight:700;font-size:15px;letter-spacing:.02em;text-transform:uppercase;text-decoration:none;padding:16px 32px;border-radius:10px;box-shadow:0 4px 14px rgba(249,115,22,0.3);">Pay ${amount} via Square</a>
    </div>
    ` : ''}
    <p style="font-size:14px;line-height:1.65;margin:20px 0 0;color:#64748B;">
      Mark Gabrielli<br/>
      <a href="mailto:mark@markcmo.com" style="color:#2563EB;">mark@markcmo.com</a>
    </p>
  </div>
</div></body></html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Mark Gabrielli <mark@markcmo.com>',
      to: [client.primary_contact_email],
      cc: ['marklgabriellijr@gmail.com'],
      reply_to: 'mark@markcmo.com',
      subject: subjects[reminderSpec.tone],
      html,
    }),
  });
  const data = await res.json().catch(() => ({}));

  // Update invoice
  const newCount = (inv.reminder_count || 0) + 1;
  const now = new Date().toISOString();
  await sbUpdate('mc_invoices', `id=eq.${inv.id}`, {
    reminder_count: newCount,
    last_reminder_at: now,
    raw_payload: { ...(inv.raw_payload || {}), [reminderSpec.key]: { sent_at: now, resend_id: data.id } },
  });

  await sbInsert('mc_audit_log', {
    engagement_id: inv.engagement_id,
    client_id: client.id,
    event: `invoice_reminder_${newCount}_sent`,
    payload: { invoice_id: inv.id, tone: reminderSpec.tone, resend_id: data.id, amount_usd: inv.amount_usd },
  });
}

async function escalate(inv) {
  const eng = inv.mc_engagements;
  const client = eng?.mc_clients;
  if (!client) return;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const amount = '$' + Number(inv.amount_usd).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const ageDays = Math.round((Date.now() - new Date(inv.sent_at).getTime()) / (24 * 60 * 60 * 1000));

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:24px;background:#F8FAFC;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
  <div style="background:#0A1628;color:#fff;padding:20px 24px;border-top:4px solid #F97316;">
    <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#FB923C;margin-bottom:6px;">Manual Outreach Needed</div>
    <h1 style="font-size:20px;margin:0;font-weight:700;">${amount} unpaid for ${ageDays} days</h1>
  </div>
  <div style="padding:20px 24px;font-size:14px;line-height:1.65;color:#1E293B;">
    <p><strong>Client:</strong> ${esc(client.primary_contact_name)} - ${esc(client.legal_name)}</p>
    <p><strong>Email:</strong> <a href="mailto:${esc(client.primary_contact_email)}">${esc(client.primary_contact_email)}</a></p>
    <p><strong>Engagement:</strong> ${esc(eng.name)}</p>
    <p>3 automatic reminders have been sent (24h, 48h, 72h). No payment received. Time to reach out personally - call, text, or send a custom email.</p>
    <p><a href="https://markcmo.com/admin/vdr?slug=${esc(client.slug)}" style="color:#2563EB;">Open case file in VDR -></a></p>
  </div>
</div></body></html>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'MarkCMO <forms@markcmo.com>',
      to: ['mark@markcmo.com', 'marklgabriellijr@gmail.com'],
      subject: `[ESCALATE] ${amount} unpaid - ${client.legal_name} - manual outreach needed`,
      html,
    }),
  });

  await sbUpdate('mc_invoices', `id=eq.${inv.id}`, {
    escalated_at: new Date().toISOString(),
  });

  await sbInsert('mc_audit_log', {
    engagement_id: inv.engagement_id,
    client_id: client.id,
    event: 'invoice_escalated',
    payload: { invoice_id: inv.id, age_days: ageDays, amount_usd: inv.amount_usd },
  });
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
