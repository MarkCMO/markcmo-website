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

  // Notify Mark (internal alert)
  await notifyNewBooking({ client, engagement, eventName, scheduledAt, qa, isNew: !existing.length });

  // Send personal confirmation email to the invitee asking for topic of discussion
  // so Mark can prepare a sharper agenda. From mark@markcmo.com, replies go to
  // mark@markcmo.com. Skips re-send for returning clients who already received it.
  await sendInviteeConfirmation({
    inviteeEmail,
    inviteeName,
    eventName,
    scheduledAt,
    cancelUrl,
    rescheduleUrl,
    qa,
    isNew: !existing.length,
    inviteeUri: calendlyInviteeUri,
  });

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

// ═══════════════════════════════════════════════════════════════
// sendInviteeConfirmation
// Sends a personal warm email FROM mark@markcmo.com TO the invitee
// confirming the meeting + asking for the desired topic of discussion
// so Mark can prepare a sharper agenda. Replies route back to Mark's
// real inbox. Idempotent: dedupes against Supabase mc_audit_log so
// reschedules / replays don't spam the invitee.
// ═══════════════════════════════════════════════════════════════
async function sendInviteeConfirmation({ inviteeEmail, inviteeName, eventName, scheduledAt, cancelUrl, rescheduleUrl, qa, isNew, inviteeUri }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !inviteeEmail) return;

  // Idempotency: skip if we already sent for this invitee URI
  try {
    const prior = await sbSelect(
      `mc_audit_log?event=eq.invitee_confirmation_sent&payload->>invitee_uri=eq.${encodeURIComponent(inviteeUri || '')}&select=id&limit=1`
    );
    if (prior && prior.length) {
      console.log('Invitee confirmation already sent for', inviteeUri, '- skipping');
      return;
    }
  } catch (e) {
    // Soft-fail the dedupe check; better to risk a dupe than skip a real send
    console.warn('Confirmation dedupe check failed:', e.message);
  }

  const firstName = (inviteeName || '').split(' ')[0] || 'there';
  // Day + time formatting in US/Eastern. "Tuesday" / "2:00 PM ET" /
  // combined "Tuesday at 2:00 PM ET" for the opening confirmation line.
  const _dt = scheduledAt ? new Date(scheduledAt) : null;
  const whenDay = _dt
    ? _dt.toLocaleString('en-US', { weekday: 'long', timeZone: 'America/New_York' })
    : 'our scheduled day';
  const whenTime = _dt
    ? _dt.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' }) + ' ET'
    : '';
  const whenDayTime = whenTime ? `${whenDay} at ${whenTime}` : whenDay;

  const subject = `Confirming our meeting on ${whenDayTime}`;

  // Plain text version (deliverability + clients that block HTML).
  // Length + tone match Mark's actual sent example - short, warm, not salesy.
  const text = `Hi ${firstName},

Confirming our meeting on ${whenDayTime}.

If there are any details you can provide prior to our meeting I would love to have a contextual foundation going into ${whenDay}.

Thank you!

Mark Gabrielli
MarkCMO.com`;

  // HTML version - plain readable email, looks like Mark typed it personally.
  // No designed template, no nav bars, no fancy callouts. Just text.
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;padding:24px;font-size:15px;line-height:1.6;">
    <p style="margin:0 0 14px;">Hi ${esc(firstName)},</p>
    <p style="margin:0 0 14px;">Confirming our meeting on ${esc(whenDayTime)}.</p>
    <p style="margin:0 0 14px;">If there are any details you can provide prior to our meeting I would love to have a contextual foundation going into ${esc(whenDay)}.</p>
    <p style="margin:0 0 18px;">Thank you!</p>
    <p style="margin:0;">Mark Gabrielli<br><a href="https://markcmo.com" style="color:#1a1a1a;text-decoration:none;">MarkCMO.com</a></p>
  </div>
</body></html>`;

  let sentOk = false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Mark Gabrielli <mark@markcmo.com>',
        to: [inviteeEmail],
        cc: ['marklgabriellijr@gmail.com'],
        reply_to: 'mark@markcmo.com',
        subject,
        html,
        text,
        tags: [
          { name: 'category', value: 'calendly_confirmation' },
          { name: 'isnew', value: isNew ? 'true' : 'false' },
        ],
      }),
    });
    sentOk = r.ok;
    if (!r.ok) {
      const errBody = await r.text().catch(() => '');
      console.warn('Invitee confirmation send failed', r.status, errBody.slice(0, 300));
    }
  } catch (err) {
    console.warn('Invitee confirmation send error:', err.message);
  }

  // Audit log either way so dedupe works on next webhook event for same invitee
  try {
    await sbInsert('mc_audit_log', {
      event: sentOk ? 'invitee_confirmation_sent' : 'invitee_confirmation_failed',
      payload: { invitee_email: inviteeEmail, invitee_name: inviteeName, invitee_uri: inviteeUri || '', event_name: eventName, scheduled_at: scheduledAt },
    });
  } catch (e) {
    console.warn('Audit log write failed for invitee confirmation:', e.message);
  }
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
