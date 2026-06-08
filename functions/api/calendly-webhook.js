// ═══════════════════════════════════════════════════════════════
// /api/calendly-webhook (Cloudflare Pages Function, INLINE)
//
// This file used to be a 4-line shim importing from netlify/functions/
// calendly-webhook.js via dispatchSingle(). The bundler was hashing this
// shim and skipping rebuilds when only the imported file changed, so live
// production was running a months-old function bundle while every commit
// since lunchtime on 2026-06-08 showed "deploy success" in CI. Confirmed
// via a handler_version sentinel that never appeared in the audit log.
//
// Now self-contained: signature verification (Web Crypto), Supabase REST
// calls (fetch + Authorization), Resend send (fetch), full state machine
// for confirmation + post-meeting follow-up + cancellation cleanup. No
// external imports = no opportunity for the bundler to cache stale.
//
// HANDLER_VERSION below is a sentinel I bump on every deploy so we can
// verify in the audit log that the function bundle is fresh.
// ═══════════════════════════════════════════════════════════════
const HANDLER_VERSION = 'v4-inline-ics-2026-06-08';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const rawBody = await request.text().catch(() => '');
  const signature = request.headers.get('calendly-webhook-signature') || '';
  const signingKey = env.CALENDLY_SIGNING_KEY;

  // Verify signature if signing key is configured
  if (signingKey) {
    const ok = await verifyCalendlySignature(rawBody, signature, signingKey);
    if (!ok) {
      console.warn('Calendly webhook signature mismatch');
      return new Response('Invalid signature', { status: 401 });
    }
  }

  let payload;
  try { payload = JSON.parse(rawBody); }
  catch (e) { return new Response('Invalid JSON', { status: 400 }); }

  const eventType = payload?.event || '';
  const payloadData = payload?.payload || {};

  console.log('Calendly webhook:', eventType, payloadData?.email || '(no email)');

  try {
    if (eventType === 'invitee.created') {
      return await handleInviteeCreated(payloadData, env);
    }
    if (eventType === 'invitee.canceled') {
      return await handleInviteeCanceled(payloadData, env);
    }
    return new Response(`Ignored event type: ${eventType}`, { status: 200 });
  } catch (err) {
    console.error('Calendly webhook error:', err && err.stack || err);
    // Even on outer crash, try to log it
    try {
      await sbInsert(env, 'mc_audit_log', {
        event: 'calendly_outer_crash',
        payload: { error_message: (err && err.message) || String(err), error_stack: (err && err.stack) ? String(err.stack).substring(0, 1500) : null },
      });
    } catch (_) {}
    return new Response('Internal error logged', { status: 200 });
  }
}

// ───── Calendly signature verification (Web Crypto) ──────────────
async function verifyCalendlySignature(body, signatureHeader, signingKey) {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(signatureHeader.split(',').map(p => p.split('=')));
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const signed = `${t}.${body}`;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(signingKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed));
    const expectedHex = Array.from(new Uint8Array(sigBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    // Timing-safe-ish compare (constant length, char-by-char)
    if (expectedHex.length !== v1.length) return false;
    let diff = 0;
    for (let i = 0; i < expectedHex.length; i++) diff |= expectedHex.charCodeAt(i) ^ v1.charCodeAt(i);
    return diff === 0;
  } catch (err) {
    console.warn('Signature verify error:', err.message);
    return false;
  }
}

// ───── Supabase REST helpers ─────────────────────────────────────
function sbHeaders(env) {
  const key = env.MARKCMO_SUPABASE_SERVICE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function sbSelect(env, path) {
  const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/${path}`, {
    headers: sbHeaders(env),
  });
  if (!res.ok) throw new Error(`sbSelect ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function sbInsert(env, table, body) {
  const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...sbHeaders(env), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`sbInsert ${table} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function sbUpdate(env, table, filter, body) {
  const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(env), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`sbUpdate ${table} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// ───── HTML escape ───────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ───── Slug generator ────────────────────────────────────────────
function generateSlug(name, company, email) {
  const base = (company || name || email.split('@')[0])
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
  return base + '-' + Math.random().toString(36).substring(2, 8);
}

// ───── ICS calendar invite builder (RFC 5545) ────────────────────
// Generates a valid .ics file as a base64 string, ready to attach to
// a Resend email. Always send this with the confirmation so prospects
// can add the meeting to their calendar in one click - even if
// Calendly's own auto-invite ends up in their spam folder.
//
// Tested with Apple Calendar, Outlook (web + desktop), Google Calendar.
// METHOD:REQUEST + ORGANIZER + ATTENDEE makes it behave as a real
// invitation. SEQUENCE:0 means original send (not an update).
function buildIcsBase64({ uid, startUtcIso, endUtcIso, summary, description, location, organizerEmail, organizerName, attendeeEmail, attendeeName }) {
  const fmt = (iso) => String(iso).replace(/[-:]/g, '').replace(/\.\d{3,6}/, '').replace(/Z$/, 'Z');
  const start = fmt(startUtcIso);
  const end = fmt(endUtcIso || new Date(new Date(startUtcIso).getTime() + 30 * 60 * 1000).toISOString());
  const stamp = fmt(new Date().toISOString());
  // Escape newlines and commas per RFC 5545 (long values are folded
  // automatically by most clients but we keep them short).
  const escIcs = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MarkCMO//Calendar Invite v2//EN',
    'METHOD:REQUEST',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${escIcs(uid)}@markcmo.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escIcs(summary)}`,
    `DESCRIPTION:${escIcs(description)}`,
    location ? `LOCATION:${escIcs(location)}` : '',
    `ORGANIZER;CN=${escIcs(organizerName)}:mailto:${organizerEmail}`,
    `ATTENDEE;CN=${escIcs(attendeeName || attendeeEmail)};RSVP=TRUE:mailto:${attendeeEmail}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].filter(Boolean).join('\r\n');
  // base64 encode (works in CF Workers via btoa + TextEncoder)
  const bytes = new TextEncoder().encode(lines);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// ───── Main: invitee.created handler ─────────────────────────────
async function handleInviteeCreated(p, env) {
  const inviteeEmail = p.email || '';
  const inviteeName = p.name || '';
  // Calendly v2 invitee.created puts the event type name at scheduled_event.name.
  const eventName = p.scheduled_event?.name || p.event_type?.name || p.event_name || 'Consultation';
  const scheduledAt = p.event?.start_time || p.scheduled_event?.start_time || null;
  const eventEndAt = p.event?.end_time || p.scheduled_event?.end_time || null;
  const cancelUrl = p.cancel_url || '';
  const rescheduleUrl = p.reschedule_url || '';
  const calendlyEventUri = p.event?.uri || p.scheduled_event?.uri || '';
  const calendlyInviteeUri = p.uri || '';
  // Conference join URL (Google Meet / Zoom / etc) - lives at
  // p.scheduled_event.location.join_url for Calendly v2 invitee.created.
  const meetingLink = p.scheduled_event?.location?.join_url
    || p.event?.location?.join_url
    || p.scheduled_event?.location?.location  // some Calendly setups
    || '';

  // Extract custom-question answers if present
  const questions = p.questions_and_answers || p.questions_and_responses || [];
  const qa = {};
  questions.forEach(q => {
    const key = (q.question || q.name || '').toLowerCase();
    qa[key] = q.answer || q.response || '';
  });
  const company = qa['company'] || qa['business'] || qa['business name'] || '';
  const phone = qa['phone'] || qa['phone number'] || p.text_reminder_number || '';
  const website = qa['website'] || qa['url'] || qa['site'] || '';
  const notes = qa['notes'] || qa['anything else'] || qa['what would you like to discuss?'] || '';

  if (!inviteeEmail) {
    return new Response('No invitee email in payload, ignored', { status: 200 });
  }

  const slug = generateSlug(inviteeName, company, inviteeEmail);
  const [givenName, ...rest] = inviteeName.split(' ');
  const familyName = rest.join(' ');

  // ───── Find or create mc_clients ─────
  let client;
  const existing = await sbSelect(env, `mc_clients?primary_contact_email=eq.${encodeURIComponent(inviteeEmail)}&select=*&limit=1`);
  if (existing.length) {
    client = existing[0];
    // Update last-touch metadata
    try {
      await sbUpdate(env, 'mc_clients', `id=eq.${encodeURIComponent(client.id)}`, {
        primary_contact_name: inviteeName || client.primary_contact_name,
        primary_contact_phone: phone || client.primary_contact_phone,
        legal_name: company || client.legal_name,
        website: website || client.website,
      });
    } catch (_) {}
  } else {
    const inserted = await sbInsert(env, 'mc_clients', {
      slug,
      legal_name: company || inviteeName || inviteeEmail.split('@')[0],
      primary_contact_name: inviteeName,
      primary_contact_email: inviteeEmail,
      primary_contact_phone: phone,
      website,
      status: 'lead',
      source: 'calendly',
      cc_emails: [],
    });
    client = inserted[0];
  }

  // ───── Find or create mc_engagements (lead-stage) ─────
  let engagement;
  const existingEng = await sbSelect(env, `mc_engagements?client_id=eq.${encodeURIComponent(client.id)}&status=eq.lead&select=id&limit=1`);
  if (existingEng.length) {
    engagement = existingEng[0];
  } else {
    const engInserted = await sbInsert(env, 'mc_engagements', {
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

  // ───── Audit log: calendly_booking_created (with HANDLER_VERSION sentinel) ─────
  await sbInsert(env, 'mc_audit_log', {
    client_id: client.id,
    engagement_id: engagement.id,
    event: 'calendly_booking_created',
    payload: {
      invitee_email: inviteeEmail,
      invitee_name: inviteeName,
      event_name: eventName,
      scheduled_at: scheduledAt,
      handler_version: HANDLER_VERSION,
    },
  });

  // ───── Internal notify email to Mark (wrapped) ─────
  try {
    await notifyNewBooking(env, { client, eventName, scheduledAt, qa, isNew: !existing.length });
  } catch (e) {
    try {
      await sbInsert(env, 'mc_audit_log', {
        event: 'calendly_notify_crashed',
        payload: { invitee_email: inviteeEmail, error_message: (e && e.message) || String(e) },
      });
    } catch (_) {}
  }

  // ───── Confirmation email (5 min delay, with auto-generated .ics) ─────
  try {
    await sendInviteeConfirmation(env, {
      inviteeEmail, inviteeName, eventName, scheduledAt, eventEndAt,
      meetingLink, calendlyInviteeUri,
      isNew: !existing.length, inviteeUri: calendlyInviteeUri,
    });
  } catch (e) {
    try {
      await sbInsert(env, 'mc_audit_log', {
        event: 'invitee_confirmation_outer_crashed',
        payload: { invitee_email: inviteeEmail, error_message: (e && e.message) || String(e), error_stack: (e && e.stack) ? String(e.stack).substring(0, 1200) : null },
      });
    } catch (_) {}
  }

  // ───── Post-meeting follow-up scheduler (30 min after meeting end) ─────
  try {
    await schedulePostMeetingFollowup(env, {
      inviteeEmail, inviteeName, eventName, scheduledAt, eventEndAt,
      inviteeUri: calendlyInviteeUri, engagementId: engagement.id,
    });
  } catch (e) {
    try {
      await sbInsert(env, 'mc_audit_log', {
        event: 'invitee_followup_outer_crashed',
        payload: { invitee_email: inviteeEmail, error_message: (e && e.message) || String(e), error_stack: (e && e.stack) ? String(e.stack).substring(0, 1200) : null },
      });
    } catch (_) {}
  }

  return new Response(JSON.stringify({ success: true, client_id: client.id, engagement_id: engagement.id, slug: client.slug, handler_version: HANDLER_VERSION }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ───── invitee.canceled handler ──────────────────────────────────
async function handleInviteeCanceled(p, env) {
  const inviteeEmail = p.email || '';
  const inviteeUri = p.uri || '';
  if (!inviteeEmail) return new Response('No email, ignored', { status: 200 });

  // Cancel the scheduled follow-up if any
  try {
    await cancelScheduledFollowup(env, { inviteeEmail, inviteeUri });
  } catch (e) {
    console.error('cancelScheduledFollowup crash:', e && e.stack || e);
  }

  const existing = await sbSelect(env, `mc_clients?primary_contact_email=eq.${encodeURIComponent(inviteeEmail)}&select=*&limit=1`);
  if (!existing.length) return new Response('No matching client, ignored', { status: 200 });

  const client = existing[0];
  await sbInsert(env, 'mc_audit_log', {
    client_id: client.id,
    event: 'calendly_booking_canceled',
    payload: { invitee_email: inviteeEmail, name: p.name, cancel_reason: p.cancellation?.reason || null, invitee_uri: inviteeUri || '', handler_version: HANDLER_VERSION },
  });
  return new Response('OK', { status: 200 });
}

// ───── notifyNewBooking (internal alert email) ───────────────────
async function notifyNewBooking(env, { client, eventName, scheduledAt, qa, isNew }) {
  const apiKey = env.RESEND_API_KEY;
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
  });
}

// ───── sendInviteeConfirmation (personal warm email, 5 min delay) ─────
async function sendInviteeConfirmation(env, { inviteeEmail, inviteeName, eventName, scheduledAt, eventEndAt, meetingLink, calendlyInviteeUri, isNew, inviteeUri }) {
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
    handler_version: HANDLER_VERSION,
  };
  let auditEvent = 'invitee_confirmation_attempted';

  try {
    if (!inviteeEmail) { auditPayload.step = 'no_invitee_email'; auditEvent = 'invitee_confirmation_skipped'; return; }
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) { auditPayload.step = 'no_resend_api_key'; auditEvent = 'invitee_confirmation_skipped'; return; }
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

    // Mode detection
    const _n = (eventName || '').toLowerCase();
    let mode = 'discovery';
    if (_n.indexOf('wetyr') >= 0) mode = 'wetyr';
    else if (_n.indexOf('$') >= 0 || /audit call|strategy session|power session|execution edition|cmo-as-a-service/.test(_n)) mode = 'paid';
    else if (_n.indexOf('interview') >= 0) mode = 'interview';
    auditPayload.mode = mode;
    auditPayload.step = 'mode_detected';

    const COPY = {
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
    const copy = COPY[mode];

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

    // ─── Build .ics attachment ───────────────────────────────────────
    // Always attach so prospects can add the meeting to their calendar
    // even if Calendly's own auto-invite goes to spam. Christina-style
    // misses ("I'm not seeing a calendar invite") are now impossible.
    let icsAttachment = null;
    if (scheduledAt) {
      try {
        const organizerEmail = mode === 'wetyr' ? 'info@wetyr.com' : 'mark@markcmo.com';
        const organizerName = mode === 'wetyr' ? 'WETYR' : 'Mark Gabrielli';
        const meetingSummary = mode === 'wetyr'
          ? `WETYR meeting with Mark Gabrielli`
          : `${eventName} with Mark Gabrielli`;
        const meetingDescription = meetingLink
          ? `Looking forward to our conversation!\\n\\nJoin: ${meetingLink}`
          : `Looking forward to our conversation!`;
        const icsBase64 = buildIcsBase64({
          uid: (calendlyInviteeUri || `${inviteeEmail}-${scheduledAt}`).replace(/[^a-z0-9-]/gi, ''),
          startUtcIso: scheduledAt,
          endUtcIso: eventEndAt,
          summary: meetingSummary,
          description: meetingDescription,
          location: meetingLink || '',
          organizerEmail,
          organizerName,
          attendeeEmail: inviteeEmail,
          attendeeName: inviteeName || inviteeEmail,
        });
        icsAttachment = {
          filename: 'meeting-with-mark.ics',
          content: icsBase64,
          content_type: 'text/calendar',
        };
        auditPayload.ics_attached = true;
      } catch (icsErr) {
        // Soft-fail: send the email without the .ics rather than block
        auditPayload.ics_error = (icsErr && icsErr.message) || String(icsErr);
      }
    }

    // Schedule 5 min after webhook fires
    const sendAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    auditPayload.send_scheduled_for = sendAt;
    auditPayload.step = 'queuing';

    const idempotencyKey = `cal-confirm-${inviteeUri || inviteeEmail || 'unknown'}`.substring(0, 256);

    const sendBody = {
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
    };
    if (icsAttachment) sendBody.attachments = [icsAttachment];

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(sendBody),
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
    try {
      await sbInsert(env, 'mc_audit_log', { event: auditEvent, payload: auditPayload });
    } catch (e) {
      console.warn('Final confirmation audit write failed:', e && e.message);
    }
  }
}

// ───── schedulePostMeetingFollowup (30 min after meeting end) ────
async function schedulePostMeetingFollowup(env, { inviteeEmail, inviteeName, eventName, scheduledAt, eventEndAt, inviteeUri, engagementId }) {
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
    handler_version: HANDLER_VERSION,
  };
  let auditEvent = 'invitee_followup_attempted';

  try {
    if (!inviteeEmail) { auditPayload.step = 'no_invitee_email'; auditEvent = 'invitee_followup_skipped'; return; }
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) { auditPayload.step = 'no_resend_api_key'; auditEvent = 'invitee_followup_skipped'; return; }

    // Compute when follow-up should land: end_time + 30 min, or start + 90 min if no end
    let sendAtMs = null;
    if (eventEndAt) {
      const dt = new Date(eventEndAt);
      if (!isNaN(dt.getTime())) sendAtMs = dt.getTime() + 30 * 60 * 1000;
    }
    if (!sendAtMs && scheduledAt) {
      const dt = new Date(scheduledAt);
      if (!isNaN(dt.getTime())) sendAtMs = dt.getTime() + 90 * 60 * 1000;
    }
    if (!sendAtMs) { auditPayload.step = 'no_send_time'; auditEvent = 'invitee_followup_skipped'; return; }
    const minSendAtMs = Date.now() + 30 * 60 * 1000;
    if (sendAtMs < minSendAtMs) sendAtMs = minSendAtMs;

    // Resend caps scheduled_at at 30 days
    const maxAheadMs = 28 * 24 * 60 * 60 * 1000;
    if (sendAtMs - Date.now() > maxAheadMs) {
      auditPayload.step = 'deferred_to_cron';
      auditPayload.followup_send_at = new Date(sendAtMs).toISOString();
      auditEvent = 'invitee_followup_deferred';
      return;
    }

    const sendAt = new Date(sendAtMs).toISOString();
    auditPayload.followup_send_at = sendAt;
    auditPayload.step = 'computed_send_at';

    const _n = (eventName || '').toLowerCase();
    const isWetyr = _n.indexOf('wetyr') >= 0;
    auditPayload.mode = isWetyr ? 'wetyr' : 'markcmo';

    const firstName = (inviteeName || '').split(' ')[0] || 'there';
    const subject = isWetyr ? `Quick follow-up on our meeting` : `How did our meeting go?`;
    const text = `Hi ${firstName},\n\nI really enjoyed our meeting. How do you think the meeting went from your end?\n\nMark`;
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

      // Persist the Resend email_id on the engagement metadata
      if (engagementId && resendId) {
        try {
          const eng = await sbSelect(env, `mc_engagements?id=eq.${encodeURIComponent(engagementId)}&select=metadata&limit=1`);
          const meta = (eng && eng[0] && eng[0].metadata) || {};
          meta.followup_resend_id = resendId;
          meta.followup_send_at = sendAt;
          await sbUpdate(env, 'mc_engagements', `id=eq.${encodeURIComponent(engagementId)}`, { metadata: meta });
        } catch (_) {}
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
      await sbInsert(env, 'mc_audit_log', { event: auditEvent, payload: auditPayload });
    } catch (e) {
      console.warn('Final followup audit write failed:', e && e.message);
    }
  }
}

// ───── cancelScheduledFollowup (on invitee.canceled) ─────────────
async function cancelScheduledFollowup(env, { inviteeEmail, inviteeUri }) {
  const auditPayload = {
    invitee_email: inviteeEmail || '',
    invitee_uri: inviteeUri || '',
    resend_id: null,
    cancel_status: null,
    cancel_error: null,
    step: 'init',
    handler_version: HANDLER_VERSION,
  };
  let auditEvent = 'invitee_followup_cancel_attempted';

  try {
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey || !inviteeEmail) { auditPayload.step = 'missing_env_or_email'; auditEvent = 'invitee_followup_cancel_skipped'; return; }

    let eng = [];
    if (inviteeUri) {
      eng = await sbSelect(env, `mc_engagements?metadata->>calendly_invitee_uri=eq.${encodeURIComponent(inviteeUri)}&select=id,metadata&order=created_at.desc&limit=1`).catch(() => []);
    }
    if (!eng || !eng.length) {
      const client = await sbSelect(env, `mc_clients?primary_contact_email=eq.${encodeURIComponent(inviteeEmail)}&select=id&limit=1`).catch(() => []);
      if (client && client[0]) {
        eng = await sbSelect(env, `mc_engagements?client_id=eq.${client[0].id}&select=id,metadata&order=created_at.desc&limit=1`).catch(() => []);
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
    if (r.ok) { auditPayload.step = 'cancelled'; auditEvent = 'invitee_followup_cancelled'; }
    else {
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
      await sbInsert(env, 'mc_audit_log', { event: auditEvent, payload: auditPayload });
    } catch (_) {}
  }
}
