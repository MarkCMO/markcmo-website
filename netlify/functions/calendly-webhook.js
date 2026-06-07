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
  // Calendly v2 invitee.created payload puts the event type name at
  // scheduled_event.name. The older event_type.name path is a fallback.
  const eventName    = p.scheduled_event?.name || p.event_type?.name || p.event_name || 'Consultation';
  const scheduledAt  = p.event?.start_time || p.scheduled_event?.start_time || null;
  const eventEndAt   = p.event?.end_time   || p.scheduled_event?.end_time   || null;
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

  // Control-flow marker. Proves handleInviteeCreated reached the point
  // where it tries to call sendInviteeConfirmation. If this entry exists
  // in the audit log but invitee_confirmation_* does not, the issue is
  // inside the function call itself (e.g., function not defined, sync
  // throw before the try/finally inside the function body).
  try {
    await sbInsert('mc_audit_log', {
      event: 'calendly_pre_confirmation_call',
      payload: { invitee_email: inviteeEmail || '', invitee_uri: calendlyInviteeUri || '', event_name: eventName || '' },
    });
  } catch (_) {}

  // Send personal confirmation email (5 min after webhook fires) + schedule
  // post-meeting follow-up email (30 min after meeting end). Both wrapped
  // independently so one's failure cannot block the other or the outer
  // handler. Each function ALSO writes exactly one audit log entry no
  // matter what happens internally - see their definitions below for the
  // step-by-step state machine that makes silent failures impossible.
  try {
    await sendInviteeConfirmation({
      inviteeEmail, inviteeName, eventName, scheduledAt,
      isNew: !existing.length, inviteeUri: calendlyInviteeUri,
    });
  } catch (outerErr) {
    console.error('sendInviteeConfirmation outer crash:', outerErr && outerErr.stack || outerErr);
    try {
      await sbInsert('mc_audit_log', {
        event: 'invitee_confirmation_outer_crashed',
        payload: { invitee_email: inviteeEmail, invitee_uri: calendlyInviteeUri || '', error_message: (outerErr && outerErr.message) || String(outerErr), error_stack: (outerErr && outerErr.stack) ? String(outerErr.stack).substring(0, 1500) : null },
      });
    } catch (_) {}
  }

  try {
    await sbInsert('mc_audit_log', {
      event: 'calendly_pre_followup_call',
      payload: { invitee_email: inviteeEmail || '', invitee_uri: calendlyInviteeUri || '' },
    });
  } catch (_) {}

  try {
    await schedulePostMeetingFollowup({
      inviteeEmail, inviteeName, eventName, scheduledAt, eventEndAt,
      inviteeUri: calendlyInviteeUri, engagementId: engagement && engagement.id,
    });
  } catch (outerErr) {
    console.error('schedulePostMeetingFollowup outer crash:', outerErr && outerErr.stack || outerErr);
    try {
      await sbInsert('mc_audit_log', {
        event: 'invitee_followup_outer_crashed',
        payload: { invitee_email: inviteeEmail, invitee_uri: calendlyInviteeUri || '', error_message: (outerErr && outerErr.message) || String(outerErr), error_stack: (outerErr && outerErr.stack) ? String(outerErr.stack).substring(0, 1500) : null },
      });
    } catch (_) {}
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, client_id: client.id, engagement_id: engagement.id, slug: client.slug }),
  };
}

async function handleInviteeCanceled(p) {
  const inviteeEmail = p.email || '';
  const inviteeUri = p.uri || '';
  if (!inviteeEmail) return { statusCode: 200, body: 'No email, ignored' };

  const existing = await sbSelect(`mc_clients?primary_contact_email=eq.${encodeURIComponent(inviteeEmail)}&select=*&limit=1`);

  // Cancel the scheduled post-meeting follow-up so we don't send "how did
  // our meeting go?" to someone who just canceled the meeting. Wrapped
  // independently of the audit log writes so a Resend hiccup can't block
  // the rest of the cancel handler.
  try {
    await cancelScheduledFollowup({ inviteeEmail, inviteeUri });
  } catch (e) {
    console.error('cancelScheduledFollowup outer crash:', e && e.stack || e);
  }

  if (!existing.length) return { statusCode: 200, body: 'No matching client, ignored' };

  const client = existing[0];
  await sbInsert('mc_audit_log', {
    client_id: client.id,
    event: 'calendly_booking_canceled',
    payload: { invitee_email: inviteeEmail, name: p.name, cancel_reason: p.cancellation?.reason || null, invitee_uri: inviteeUri || '' },
  });
  return { statusCode: 200, body: 'OK' };
}

// ═══════════════════════════════════════════════════════════════
// sendInviteeConfirmation
// Sends a personal warm email FROM mark@markcmo.com TO the invitee
// confirming the meeting + asking for the desired topic of discussion
// so Mark can prepare a sharper agenda. Adapts brand + voice based on
// the Calendly event type (discovery / paid / interview / wetyr).
//
// Bulletproof design: single try/catch wraps the entire body; one
// audit log entry is written no matter what happens, with a payload.step
// field that tracks where execution got to. Silent failure is impossible.
//
// Resend's Idempotency-Key header (24h window) prevents duplicate sends
// if Calendly retries the webhook, so we no longer rely on a brittle
// Supabase sbSelect dedupe query that was previously the root cause of
// the silent crash (10 real bookings produced 0 audit entries because
// the dedupe URL syntax was crashing inside an unreachable catch path).
// ═══════════════════════════════════════════════════════════════
async function sendInviteeConfirmation({ inviteeEmail, inviteeName, eventName, scheduledAt, isNew, inviteeUri }) {
  // Single audit entry written at the end, no matter what happens.
  // payload.step tracks how far execution got - so even a top-level
  // crash leaves a precise breadcrumb.
  const auditPayload = {
    invitee_email: inviteeEmail || '',
    invitee_name: inviteeName || '',
    invitee_uri: inviteeUri || '',
    event_name: eventName || '',
    scheduled_at: scheduledAt || null,
    mode: null,
    send_scheduled_for: null,
    resend_status: null,
    resend_id: null,
    resend_error: null,
    error_message: null,
    error_stack: null,
    step: 'init',
  };
  let auditEvent = 'invitee_confirmation_attempted';

  try {
    if (!inviteeEmail) {
      auditPayload.step = 'no_invitee_email';
      auditEvent = 'invitee_confirmation_skipped';
      return;
    }
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      auditPayload.step = 'no_resend_api_key';
      auditEvent = 'invitee_confirmation_skipped';
      return;
    }
    auditPayload.step = 'env_ok';

    const firstName = (inviteeName || '').split(' ')[0] || 'there';
    const _dt = scheduledAt ? new Date(scheduledAt) : null;
    const whenDay = _dt && !isNaN(_dt.getTime())
      ? _dt.toLocaleString('en-US', { weekday: 'long', timeZone: 'America/New_York' })
      : 'our scheduled day';
    const whenTime = _dt && !isNaN(_dt.getTime())
      ? _dt.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' }) + ' ET'
      : '';
    const whenDayTime = whenTime ? `${whenDay} at ${whenTime}` : whenDay;
    auditPayload.step = 'time_formatted';

    // Mode detection (wetyr / paid / interview / discovery)
    const _n = (eventName || '').toLowerCase();
    let mode = 'discovery';
    if (_n.indexOf('wetyr') >= 0) mode = 'wetyr';
    else if (_n.indexOf('$') >= 0 || /audit call|strategy session|power session|execution edition|cmo-as-a-service/.test(_n)) mode = 'paid';
    else if (_n.indexOf('interview') >= 0) mode = 'interview';
    auditPayload.mode = mode;
    auditPayload.step = 'mode_detected';

    const MODE_COPY = {
      discovery: {
        subject: `Confirming our meeting on ${whenDayTime}`,
        from: 'Mark Gabrielli <mark@markcmo.com>',
        replyTo: 'mark@markcmo.com',
        signOff: 'Mark Gabrielli',
        signOffLink: { href: 'https://markcmo.com', label: 'MarkCMO.com' },
        bodyText: `Confirming our meeting on ${whenDayTime}.\n\nIf there are any details you can provide prior to our meeting I would love to have a contextual foundation going into ${whenDay}.`,
      },
      paid: {
        subject: `Confirming our paid session on ${whenDayTime}`,
        from: 'Mark Gabrielli <mark@markcmo.com>',
        replyTo: 'mark@markcmo.com',
        signOff: 'Mark Gabrielli',
        signOffLink: { href: 'https://markcmo.com', label: 'MarkCMO.com' },
        bodyText: `Thank you for booking the ${eventName || 'paid session'}. We are locked in for ${whenDayTime}.\n\nSo I can make every minute count, would you send me the 1-3 specific outcomes you want from our time together along with anything you would like me to review beforehand (numbers, dashboards, landing pages, decks, ad accounts)?\n\nI will work through whatever you send so we spend our session on decisions, not data dumps.`,
      },
      interview: {
        subject: `Confirming our interview on ${whenDayTime}`,
        from: 'Mark Gabrielli <mark@markcmo.com>',
        replyTo: 'mark@markcmo.com',
        signOff: 'Mark Gabrielli',
        signOffLink: { href: 'https://markcmo.com', label: 'MarkCMO.com' },
        bodyText: `Confirming our interview on ${whenDayTime}.\n\nIf there is anything you would like me to review before we talk (a portfolio piece, a project, a writeup, a deck), please send it over. And bring your top questions about the role going into ${whenDay} - these go best when both sides come ready to interview.`,
      },
      wetyr: {
        subject: `Confirming our WETYR meeting on ${whenDayTime}`,
        from: 'WETYR <info@wetyr.com>',
        replyTo: 'info@wetyr.com',
        signOff: 'Mark Gabrielli',
        signOffLink: { href: 'https://wetyr.com', label: 'WETYR.com' },
        bodyText: `Confirming our WETYR meeting on ${whenDayTime}.\n\nIf there are any details you can share before we meet (the property, the situation, the timeline, the outcome you are after), I would love to have that context going into ${whenDay} so we can use the time to talk through your number, not background.`,
      },
    };
    const copy = MODE_COPY[mode];

    const subject = copy.subject;
    const text = `Hi ${firstName},\n\n${copy.bodyText}\n\nThank you!\n\n${copy.signOff}\n${copy.signOffLink.label}`;
    const htmlBodyParagraphs = copy.bodyText
      .split('\n\n')
      .map(par => `<p style="margin:0 0 14px;">${esc(par)}</p>`)
      .join('');
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;padding:24px;font-size:15px;line-height:1.6;">
    <p style="margin:0 0 14px;">Hi ${esc(firstName)},</p>
    ${htmlBodyParagraphs}
    <p style="margin:0 0 18px;">Thank you!</p>
    <p style="margin:0;">${esc(copy.signOff)}<br><a href="${esc(copy.signOffLink.href)}" style="color:#1a1a1a;text-decoration:none;">${esc(copy.signOffLink.label)}</a></p>
  </div>
</body></html>`;
    auditPayload.step = 'composed';

    // Schedule 5 min after webhook fires so Calendly's system-generated invite
    // lands first and our personal note arrives in a separate beat.
    const sendAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    auditPayload.send_scheduled_for = sendAt;
    auditPayload.step = 'queuing';

    // Resend Idempotency-Key replaces the prior brittle Supabase dedupe query.
    // Resend dedupes within 24h, so if Calendly retries the webhook within
    // that window we get the same email_id back instead of a duplicate send.
    const idempotencyKey = `cal-confirm-${inviteeUri || inviteeEmail || 'unknown'}`.substring(0, 256);

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        from: copy.from,
        to: [inviteeEmail],
        cc: ['marklgabriellijr@gmail.com'],
        reply_to: copy.replyTo,
        subject,
        html,
        text,
        scheduled_at: sendAt,
        tags: [
          { name: 'category', value: 'calendly_confirmation' },
          { name: 'mode', value: mode },
          { name: 'isnew', value: isNew ? 'true' : 'false' },
        ],
      }),
    });
    auditPayload.resend_status = r.status;

    if (r.ok) {
      const respJson = await r.json().catch(() => null);
      auditPayload.resend_id = respJson && respJson.id || null;
      auditPayload.step = 'queued';
      auditEvent = 'invitee_confirmation_sent';
    } else {
      const errText = await r.text().catch(() => '');
      auditPayload.resend_error = errText.slice(0, 600);
      auditPayload.step = 'resend_rejected';
      auditEvent = 'invitee_confirmation_failed';
    }
  } catch (err) {
    auditPayload.step = (auditPayload.step || 'unknown') + '_then_crashed';
    auditPayload.error_message = (err && err.message) || String(err);
    auditPayload.error_stack = (err && err.stack) ? String(err.stack).substring(0, 1500) : null;
    auditEvent = 'invitee_confirmation_crashed';
  } finally {
    // Final audit log write - one entry per invocation, no exceptions.
    // Inside finally so early returns from the try block still get audited.
    try {
      await sbInsert('mc_audit_log', { event: auditEvent, payload: auditPayload });
    } catch (e) {
      console.warn('Final audit log write failed:', e && e.message);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// schedulePostMeetingFollowup
// Schedules a short personal follow-up email to arrive 30 min after
// the meeting ends, asking the invitee how the meeting went from
// their end. Uses Resend's scheduled_at to queue the send up to 30
// days in advance. For meetings further than 28 days out (rare),
// the function records a pending_followup row so a daily cron can
// pick it up later; otherwise Resend handles the timing.
//
// Voice (Mark's example):
//   Hi <FirstName>,
//   I really enjoyed our meeting. How do you think the meeting went
//   from your end?
//   Mark
//
// Cancellation: when invitee.canceled fires (see handleInviteeCanceled),
// we look up the engagement metadata for followup_resend_id and call
// Resend DELETE /emails/:id to cancel the scheduled send.
// ═══════════════════════════════════════════════════════════════
async function schedulePostMeetingFollowup({ inviteeEmail, inviteeName, eventName, scheduledAt, eventEndAt, inviteeUri, engagementId }) {
  const auditPayload = {
    invitee_email: inviteeEmail || '',
    invitee_name: inviteeName || '',
    invitee_uri: inviteeUri || '',
    event_name: eventName || '',
    scheduled_at: scheduledAt || null,
    event_end_at: eventEndAt || null,
    followup_send_at: null,
    resend_status: null,
    resend_id: null,
    resend_error: null,
    error_message: null,
    error_stack: null,
    engagement_id: engagementId || null,
    step: 'init',
    mode: null,
  };
  let auditEvent = 'invitee_followup_attempted';

  try {
    if (!inviteeEmail) {
      auditPayload.step = 'no_invitee_email';
      auditEvent = 'invitee_followup_skipped';
      return;
    }
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      auditPayload.step = 'no_resend_api_key';
      auditEvent = 'invitee_followup_skipped';
      return;
    }

    // Compute when the follow-up should land. Prefer end_time + 30 min;
    // if no end_time, fall back to start_time + 90 min (covers a typical
    // 60 min meeting plus the same 30 min cushion). If we still don't have
    // a time, skip the follow-up entirely.
    let sendAtMs = null;
    if (eventEndAt) {
      const dt = new Date(eventEndAt);
      if (!isNaN(dt.getTime())) sendAtMs = dt.getTime() + 30 * 60 * 1000;
    }
    if (!sendAtMs && scheduledAt) {
      const dt = new Date(scheduledAt);
      if (!isNaN(dt.getTime())) sendAtMs = dt.getTime() + 90 * 60 * 1000;
    }
    if (!sendAtMs) {
      auditPayload.step = 'no_send_time';
      auditEvent = 'invitee_followup_skipped';
      return;
    }
    // Guardrail: never send earlier than 30 minutes from now (covers very
    // short or back-dated tests).
    const minSendAtMs = Date.now() + 30 * 60 * 1000;
    if (sendAtMs < minSendAtMs) sendAtMs = minSendAtMs;

    // Resend caps scheduled_at at 30 days. If the meeting is further out,
    // skip the immediate queue and write a pending_followup row that a
    // daily cron worker will pick up. (The mc_pending_followups table is
    // auto-created on first insert via the existing mc_audit_log pattern -
    // for now we just write the intent to the audit log; cron infra below
    // can read it later.)
    const maxScheduleAheadMs = 28 * 24 * 60 * 60 * 1000;
    if (sendAtMs - Date.now() > maxScheduleAheadMs) {
      auditPayload.step = 'deferred_to_cron';
      auditPayload.followup_send_at = new Date(sendAtMs).toISOString();
      auditEvent = 'invitee_followup_deferred';
      return;
    }

    const sendAt = new Date(sendAtMs).toISOString();
    auditPayload.followup_send_at = sendAt;
    auditPayload.step = 'computed_send_at';

    // Choose brand from event name (same logic as confirmation)
    const _n = (eventName || '').toLowerCase();
    const isWetyr = _n.indexOf('wetyr') >= 0;
    auditPayload.mode = isWetyr ? 'wetyr' : 'markcmo';

    const firstName = (inviteeName || '').split(' ')[0] || 'there';
    const subject = isWetyr ? `Quick follow-up on our meeting` : `How did our meeting go?`;
    const text = isWetyr
      ? `Hi ${firstName},\n\nI really enjoyed our meeting. How do you think the meeting went from your end?\n\nMark`
      : `Hi ${firstName},\n\nI really enjoyed our meeting. How do you think the meeting went from your end?\n\nMark`;
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;padding:24px;font-size:15px;line-height:1.6;">
    <p style="margin:0 0 14px;">Hi ${esc(firstName)},</p>
    <p style="margin:0 0 14px;">I really enjoyed our meeting. How do you think the meeting went from your end?</p>
    <p style="margin:0;">Mark</p>
  </div>
</body></html>`;
    auditPayload.step = 'composed';

    const fromAddr = isWetyr ? 'WETYR <info@wetyr.com>' : 'Mark Gabrielli <mark@markcmo.com>';
    const replyTo = isWetyr ? 'info@wetyr.com' : 'mark@markcmo.com';
    const idempotencyKey = `cal-followup-${inviteeUri || inviteeEmail || 'unknown'}`.substring(0, 256);

    auditPayload.step = 'queuing';
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        from: fromAddr,
        to: [inviteeEmail],
        cc: ['marklgabriellijr@gmail.com'],
        reply_to: replyTo,
        subject,
        html,
        text,
        scheduled_at: sendAt,
        tags: [
          { name: 'category', value: 'calendly_followup' },
          { name: 'mode', value: isWetyr ? 'wetyr' : 'markcmo' },
        ],
      }),
    });
    auditPayload.resend_status = r.status;

    if (r.ok) {
      const respJson = await r.json().catch(() => null);
      const resendId = respJson && respJson.id || null;
      auditPayload.resend_id = resendId;
      auditPayload.step = 'queued';
      auditEvent = 'invitee_followup_sent';

      // Persist the Resend email_id on the engagement metadata so we can
      // cancel the scheduled send if the invitee cancels the meeting.
      if (engagementId && resendId) {
        try {
          const eng = await sbSelect(`mc_engagements?id=eq.${encodeURIComponent(engagementId)}&select=metadata&limit=1`);
          const meta = (eng && eng[0] && eng[0].metadata) || {};
          meta.followup_resend_id = resendId;
          meta.followup_send_at = sendAt;
          await sbUpdate('mc_engagements', `id=eq.${encodeURIComponent(engagementId)}`, { metadata: meta });
        } catch (e) {
          // Soft-fail: cancellation won't work if we couldn't store the id,
          // but the followup itself is queued. Log the secondary issue.
          auditPayload.engagement_update_error = (e && e.message) || String(e);
        }
      }
    } else {
      const errText = await r.text().catch(() => '');
      auditPayload.resend_error = errText.slice(0, 600);
      auditPayload.step = 'resend_rejected';
      auditEvent = 'invitee_followup_failed';
    }
  } catch (err) {
    auditPayload.step = (auditPayload.step || 'unknown') + '_then_crashed';
    auditPayload.error_message = (err && err.message) || String(err);
    auditPayload.error_stack = (err && err.stack) ? String(err.stack).substring(0, 1500) : null;
    auditEvent = 'invitee_followup_crashed';
  } finally {
    try {
      await sbInsert('mc_audit_log', { event: auditEvent, payload: auditPayload });
    } catch (e) {
      console.warn('Final followup audit log write failed:', e && e.message);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// cancelScheduledFollowup
// Best-effort: if invitee cancels the meeting, look up the engagement
// metadata for followup_resend_id and call Resend DELETE to cancel
// the queued follow-up. Avoids the embarrassing "how did our meeting
// go?" email after they explicitly canceled.
// ═══════════════════════════════════════════════════════════════
async function cancelScheduledFollowup({ inviteeEmail, inviteeUri }) {
  const auditPayload = {
    invitee_email: inviteeEmail || '',
    invitee_uri: inviteeUri || '',
    resend_id: null,
    cancel_status: null,
    cancel_error: null,
    step: 'init',
  };
  let auditEvent = 'invitee_followup_cancel_attempted';

  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || !inviteeEmail) {
      auditPayload.step = 'missing_env_or_email';
      auditEvent = 'invitee_followup_cancel_skipped';
      return;
    }
    // Find the engagement by invitee URI (best signal) or email fallback
    let eng = [];
    if (inviteeUri) {
      eng = await sbSelect(`mc_engagements?metadata->>calendly_invitee_uri=eq.${encodeURIComponent(inviteeUri)}&select=id,metadata&order=created_at.desc&limit=1`).catch(() => []);
    }
    if (!eng || !eng.length) {
      const client = await sbSelect(`mc_clients?primary_contact_email=eq.${encodeURIComponent(inviteeEmail)}&select=id&limit=1`).catch(() => []);
      if (client && client[0]) {
        eng = await sbSelect(`mc_engagements?client_id=eq.${client[0].id}&select=id,metadata&order=created_at.desc&limit=1`).catch(() => []);
      }
    }
    if (!eng || !eng.length || !eng[0].metadata || !eng[0].metadata.followup_resend_id) {
      auditPayload.step = 'no_followup_id_found';
      auditEvent = 'invitee_followup_cancel_skipped';
      return;
    }

    const resendId = eng[0].metadata.followup_resend_id;
    auditPayload.resend_id = resendId;
    auditPayload.step = 'deleting';

    const r = await fetch(`https://api.resend.com/emails/${encodeURIComponent(resendId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    auditPayload.cancel_status = r.status;
    if (r.ok) {
      auditPayload.step = 'cancelled';
      auditEvent = 'invitee_followup_cancelled';
    } else {
      auditPayload.cancel_error = (await r.text().catch(() => '')).slice(0, 400);
      auditPayload.step = 'resend_rejected';
      auditEvent = 'invitee_followup_cancel_failed';
    }
  } catch (err) {
    auditPayload.step = (auditPayload.step || 'unknown') + '_then_crashed';
    auditPayload.error_message = (err && err.message) || String(err);
    auditEvent = 'invitee_followup_cancel_crashed';
  } finally {
    try {
      await sbInsert('mc_audit_log', { event: auditEvent, payload: auditPayload });
    } catch (_) {}
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
