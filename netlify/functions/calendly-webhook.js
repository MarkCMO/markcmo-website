// ═══════════════════════════════════════════════════════════════
// calendly-webhook.js
//
// Receives Calendly webhook events (invitee.created / invitee.canceled)
// and creates/updates a row in mc_clients + a placeholder mc_engagements
// row in 'lead' status. Logs everything to mc_audit_log.
//
// SETUP (Calendly side):
//   curl -X POST https://api.calendly.com/webhook_subscriptions \
//     -H "Authorization: Bearer $CALENDLY_API_TOKEN" \
//     -H "Content-Type: application/json" \
//     -d '{
//       "url": "https://markcmo.com/.netlify/functions/calendly-webhook",
//       "events": ["invitee.created","invitee.canceled"],
//       "scope": "user",
//       "user": "<your_calendly_user_uri>",
//       "signing_key": "<random-secret>"
//     }'
//   → Save the signing_key as CALENDLY_SIGNING_KEY env var.
//
// Optional alt setup: Calendly UI → Integrations → Webhooks → add URL.
// ═══════════════════════════════════════════════════════════════
const crypto = require('crypto');
const { sbSelect, sbInsert, sbUpdate } = require('./_lib_supabase');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const rawBody = event.body || '';
  const signature = event.headers?.['calendly-webhook-signature'] || '';
  const signingKey = process.env.CALENDLY_SIGNING_KEY;

  // Verify signature if signing key is configured
  if (signingKey) {
    const ok = verifyCalendlySignature(rawBody, signature, signingKey);
    if (!ok) {
      console.warn('Calendly webhook signature mismatch');
      return { statusCode: 401, body: 'Invalid signature' };
    }
  }

  let payload;
  try { payload = JSON.parse(rawBody); }
  catch (e) { return { statusCode: 400, body: 'Invalid JSON' }; }

  const eventType = payload?.event || '';
  const payloadData = payload?.payload || {};

  console.log('Calendly webhook:', eventType, payloadData?.email || payloadData?.invitee?.email || '(no email)');

  try {
    if (eventType === 'invitee.created') {
      return await handleInviteeCreated(payloadData);
    }
    if (eventType === 'invitee.canceled') {
      return await handleInviteeCanceled(payloadData);
    }
    return { statusCode: 200, body: `Ignored event type: ${eventType}` };
  } catch (err) {
    console.error('Calendly webhook error:', err);
    return { statusCode: 200, body: 'Internal error logged' };
  }
};

async function handleInviteeCreated(p) {
  // Extract invitee details (Calendly v2 webhook payload shape)
  const inviteeEmail = p.email || '';
  const inviteeName  = p.name || '';
  const eventName    = p.event_type?.name || p.event_name || 'Consultation';
  const scheduledAt  = p.event?.start_time || p.scheduled_event?.start_time || null;
  const cancelUrl    = p.cancel_url || '';
  const rescheduleUrl= p.reschedule_url || '';
  const calendlyEventUri = p.event?.uri || p.scheduled_event?.uri || '';
  const calendlyInviteeUri = p.uri || '';

  // Custom questions if present (varies by Calendly setup)
  const questions = p.questions_and_answers || p.questions_and_responses || [];
  const qa = {};
  questions.forEach(q => {
    const key = (q.question || q.name || '').toLowerCase();
    qa[key] = q.answer || q.response || '';
  });
  const company = qa['company'] || qa['business'] || qa['business name'] || '';
  const phone   = qa['phone']   || qa['phone number'] || p.text_reminder_number || '';
  const website = qa['website'] || qa['url'] || qa['site'] || '';
  const notes   = qa['notes']   || qa['anything else'] || qa['what would you like to discuss?'] || '';

  if (!inviteeEmail) {
    return { statusCode: 200, body: 'No invitee email in payload, ignored' };
  }

  // Generate a slug from name or email
  const slug = generateSlug(inviteeName, company, inviteeEmail);
  const [givenName, ...rest] = inviteeName.split(' ');
  const familyName = rest.join(' ');

  // Upsert client
  let client;
  const existing = await sbSelect(`mc_clients?primary_contact_email=eq.${encodeURIComponent(inviteeEmail)}&select=*&limit=1`);
  if (existing.length) {
    client = existing[0];
    // Update with any new info from this booking
    await sbUpdate('mc_clients', `id=eq.${client.id}`, {
      primary_contact_name: client.primary_contact_name || inviteeName,
      primary_contact_phone: client.primary_contact_phone || phone || null,
      legal_name: client.legal_name || company || inviteeName,
      website: client.website || website || null,
    });
  } else {
    const inserted = await sbInsert('mc_clients', {
      slug,
      legal_name: company || inviteeName,
      primary_contact_name: inviteeName,
      primary_contact_email: inviteeEmail,
      primary_contact_phone: phone || null,
      website: website || null,
      source: 'calendly',
      source_event_id: calendlyEventUri,
      status: 'lead',
      notes: notes || null,
    });
    client = inserted[0];
  }

  // Create a placeholder engagement (status='lead')
  // We don't auto-create documents yet, that happens after consultation when
  // Mark hits "Generate Engagement Docs" in the VDR.
  const existingLeadEng = await sbSelect(
    `mc_engagements?client_id=eq.${client.id}&status=eq.lead&select=id&limit=1`
  );
  let engagement = existingLeadEng[0];
  if (!engagement) {
    const engInserted = await sbInsert('mc_engagements', {
      client_id: client.id,
      doc_prefix: 'TBD',
      name: `Initial consultation: ${eventName}`,
      description: notes ? `Calendly notes: ${notes.substring(0, 500)}` : '',
      fee_usd: 0,
      delivery_window_hrs: null,
      status: 'lead',
      metadata: {
        calendly_event_uri: calendlyEventUri,
        calendly_invitee_uri: calendlyInviteeUri,
        scheduled_at: scheduledAt,
        cancel_url: cancelUrl,
        reschedule_url: rescheduleUrl,
        questions: qa,
      },
    });
    engagement = engInserted[0];
  }

  // Audit log
  await sbInsert('mc_audit_log', {
    client_id: client.id,
    engagement_id: engagement.id,
    event: 'calendly_booking_created',
    payload: {
      invitee_email: inviteeEmail,
      invitee_name: inviteeName,
      event_name: eventName,
      scheduled_at: scheduledAt,
    },
  });

  // Notify Mark
  await notifyNewBooking({ client, engagement, eventName, scheduledAt, qa, isNew: !existing.length });

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, client_id: client.id, engagement_id: engagement.id, slug: client.slug }),
  };
}

async function handleInviteeCanceled(p) {
  const inviteeEmail = p.email || '';
  if (!inviteeEmail) return { statusCode: 200, body: 'No email, ignored' };

  const existing = await sbSelect(`mc_clients?primary_contact_email=eq.${encodeURIComponent(inviteeEmail)}&select=*&limit=1`);
  if (!existing.length) return { statusCode: 200, body: 'No matching client, ignored' };

  const client = existing[0];
  await sbInsert('mc_audit_log', {
    client_id: client.id,
    event: 'calendly_booking_canceled',
    payload: { invitee_email: inviteeEmail, name: p.name, cancel_reason: p.cancellation?.reason || null },
  });
  return { statusCode: 200, body: 'OK' };
}

async function notifyNewBooking({ client, engagement, eventName, scheduledAt, qa, isNew }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const when = scheduledAt
    ? new Date(scheduledAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/New_York' }) + ' ET'
    : 'time TBD';
  const qaRows = Object.entries(qa).filter(([, v]) => v).map(([k, v]) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#64748B;font-size:12px;text-transform:capitalize;">${esc(k)}</td><td style="padding:4px 0;color:#1E293B;font-size:13px;">${esc(String(v).substring(0, 200))}</td></tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:24px;background:#F8FAFC;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
  <div style="background:#0A1628;color:#fff;padding:20px 24px;">
    <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#3B82F6;margin-bottom:6px;">${isNew ? 'NEW LEAD' : 'RETURNING'} &middot; CALENDLY</div>
    <h1 style="font-size:20px;margin:0;font-weight:700;">${esc(client.primary_contact_name)} - ${esc(client.legal_name)}</h1>
    <div style="font-size:13px;color:#94A3B8;margin-top:4px;">${esc(eventName)} - ${esc(when)}</div>
  </div>
  <div style="padding:20px 24px;">
    <p style="font-size:14px;line-height:1.65;margin:0 0 12px;color:#1E293B;">
      <strong>${esc(client.primary_contact_name)}</strong> just booked a Calendly consultation.
    </p>
    ${qaRows ? `<table style="border-collapse:collapse;width:100%;margin:12px 0;">${qaRows}</table>` : ''}
    <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
      <a href="https://markcmo.com/admin/vdr?slug=${esc(client.slug)}" style="background:#2563EB;color:#fff;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:6px;font-size:13px;">Open case file</a>
      <a href="mailto:${esc(client.primary_contact_email)}" style="background:#fff;border:1.5px solid #E2E8F0;color:#1E293B;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:13px;">Email ${esc(client.primary_contact_email)}</a>
    </div>
  </div>
</div></body></html>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'MarkCMO <forms@markcmo.com>',
      to: ['mark@markcmo.com', 'marklgabriellijr@gmail.com'],
      subject: `${isNew ? 'New lead' : 'Returning'} booked: ${client.primary_contact_name} - ${eventName}`,
      html,
    }),
  }).catch(err => console.warn('Notify email failed:', err.message));
}

// ─── Helpers ───────────────────────────────────────────────────
function generateSlug(name, company, email) {
  const base = (company || name || email.split('@')[0])
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
  return base || 'lead-' + Date.now();
}

function verifyCalendlySignature(body, signatureHeader, signingKey) {
  // Calendly signature format: "t=<timestamp>,v1=<signature>"
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(signatureHeader.split(',').map(p => p.split('=')));
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const signed = `${t}.${body}`;
  const expected = crypto.createHmac('sha256', signingKey).update(signed).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'));
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
