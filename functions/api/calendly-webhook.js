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
const HANDLER_VERSION = 'v10-approval-queue-2026-06-09';

// ───── Approval queue helper (Mark's directive 2026-06-09) ──────
// "all emails need to go to me first before you send them. dont blow
// these deals for me with too much sending without approvals."
//
// Every prospect-facing email is queued in mc_pending_outbound_emails
// with status='pending'. Mark gets a single per-booking approval-request
// email with previews + Approve/Edit/Decline links for each. On approve,
// /api/approval/decide POSTs to Resend with scheduled_at preserved.
//
// Internal alerts to Mark (notifyNewBooking, error logs) STILL fire
// directly - they're not prospect-facing.

function generateApprovalToken() {
  // 32 random bytes → base64url. Cryptographically secure via Web Crypto.
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Queue an email for Mark's approval instead of firing it directly.
// Returns the row id of the queued email (or null on failure - caller
// should log and continue).
//
// emailSpec: {
//   from, to (email string), recipient_name, reply_to, cc (array),
//   subject, body_text, body_html, attachments_json, tags_json,
//   idempotency_key, scheduled_send_at (ISO or null = send-now)
// }
// context: { source, engagement_id, client_id, approval_group_id, metadata }
async function queueForApproval(env, emailSpec, context) {
  const approvalToken = generateApprovalToken();
  const row = {
    recipient_email: emailSpec.to,
    recipient_name: emailSpec.recipient_name || null,
    from_addr: emailSpec.from,
    reply_to: emailSpec.reply_to || null,
    cc: Array.isArray(emailSpec.cc) && emailSpec.cc.length > 0 ? emailSpec.cc : null,
    subject: emailSpec.subject,
    body_text: emailSpec.body_text,
    body_html: emailSpec.body_html || null,
    attachments_json: emailSpec.attachments_json || null,
    tags_json: emailSpec.tags_json || null,
    resend_idempotency_key: emailSpec.idempotency_key || null,
    scheduled_send_at: emailSpec.scheduled_send_at || null,
    source: context.source,
    engagement_id: context.engagement_id || null,
    client_id: context.client_id || null,
    approval_group_id: context.approval_group_id || null,
    metadata: context.metadata || {},
    status: 'pending',
    approval_token: approvalToken,
  };
  try {
    const inserted = await sbInsert(env, 'mc_pending_outbound_emails', row);
    return { id: inserted[0]?.id, approval_token: approvalToken, scheduled_send_at: emailSpec.scheduled_send_at };
  } catch (e) {
    // Log loudly but don't break the webhook. If the table doesn't exist
    // yet (Mark hasn't run the SQL), the error message tells us.
    try {
      await sbInsert(env, 'mc_audit_log', {
        event: 'queue_for_approval_failed',
        payload: {
          source: context.source, engagement_id: context.engagement_id,
          recipient_email: emailSpec.to, subject: emailSpec.subject,
          error_message: (e && e.message) || String(e),
          handler_version: HANDLER_VERSION,
        },
      });
    } catch (_) {}
    return null;
  }
}

// Sends Mark ONE consolidated approval-request email containing previews
// of all queued emails for a booking, with Approve / Edit / Decline links
// per email. Returns the Resend ID of the notification.
async function sendApprovalRequestEmail(env, { client, engagement, eventName, scheduledAt, intel, queuedEmails }) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey || !queuedEmails || queuedEmails.length === 0) return null;
  const baseOrigin = 'https://markcmo.com';
  const when = scheduledAt
    ? new Date(scheduledAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/New_York' }) + ' ET'
    : 'time TBD';

  // Render each queued email as a preview card with action buttons
  const previewBlocks = queuedEmails.map((q, i) => {
    if (!q || !q.approval_token) return '';
    const whenStr = q.scheduled_send_at
      ? new Date(q.scheduled_send_at).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }) + ' ET'
      : 'send now on approval';
    const approveUrl = `${baseOrigin}/api/approval/decide?token=${encodeURIComponent(q.approval_token)}&action=approve`;
    const declineUrl = `${baseOrigin}/api/approval/decide?token=${encodeURIComponent(q.approval_token)}&action=decline`;
    const editUrl = `${baseOrigin}/api/approval/edit?token=${encodeURIComponent(q.approval_token)}`;
    return `
<tr><td style="padding:24px 36px 0;">
<div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#C9A84C;font-weight:700;margin-bottom:6px;">${i + 1} of ${queuedEmails.length} · ${esc(q.label || q.source || 'email')}</div>
<div style="font-size:15px;font-weight:600;color:#fff;margin-bottom:2px;">${esc(q.subject)}</div>
<div style="font-size:12px;color:rgba(255,255,255,0.55);font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;margin-bottom:12px;">Scheduled: ${esc(whenStr)}</div>
<div style="background:#fff;color:#1E293B;padding:16px 18px;border-radius:8px;font-size:13px;line-height:1.55;white-space:pre-wrap;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${esc((q.body_text || '').substring(0, 800))}${(q.body_text || '').length > 800 ? '...' : ''}</div>
<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
<a href="${esc(approveUrl)}" style="padding:9px 18px;background:#7DB87D;color:#0a0f2c;text-decoration:none;border-radius:6px;font-weight:700;font-size:13px;">Approve send</a>
<a href="${esc(editUrl)}" style="padding:9px 18px;background:rgba(255,255,255,0.06);color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:13px;border:1px solid rgba(255,255,255,0.16);">Edit first</a>
<a href="${esc(declineUrl)}" style="padding:9px 18px;background:transparent;color:#e74c3c;text-decoration:none;border-radius:6px;font-weight:600;font-size:13px;border:1px solid rgba(231,76,60,0.4);">Decline</a>
</div>
</td></tr>`;
  }).join('');

  const tier = intel?.tier || 'cold';
  const tierConfig = {
    cold:             { label: 'cold lead',          color: '#C9A84C' },
    cold_personal:    { label: 'cold (personal email)', color: '#C9A84C' },
    warm_domain:      { label: 'warm domain · new person', color: '#E89B5F' },
    returning_person: { label: 'returning contact',  color: '#7BA7E0' },
  }[tier] || { label: 'lead', color: '#C9A84C' };

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0f2c;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Inter',Arial,sans-serif;color:#fff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f2c;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:700px;background:#0F1828;border-radius:16px;overflow:hidden;">
<tr><td style="padding:36px 36px 0;">
<div style="display:inline-block;padding:6px 14px;background:rgba(232,155,95,0.16);border-radius:9999px;margin-bottom:16px;">
<span style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#E89B5F;font-weight:700;">approval needed · ${queuedEmails.length} emails held</span>
</div>
<h1 style="margin:0;font-family:'Newsreader','Charter',Georgia,serif;font-size:28px;line-height:1.15;font-weight:500;color:#fff;">${esc(client.primary_contact_name)} - ${esc(when)}</h1>
<div style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.65);">${esc(client.primary_contact_email)} · <span style="color:${tierConfig.color};">${esc(tierConfig.label)}</span></div>
${intel?.brief ? `<div style="margin:14px 0 0;padding:12px 14px;background:rgba(255,255,255,0.04);border-left:3px solid ${tierConfig.color};border-radius:0 6px 6px 0;font-size:13px;line-height:1.55;color:rgba(255,255,255,0.85);">${esc(intel.brief)}</div>` : ''}
</td></tr>
${previewBlocks}
<tr><td style="padding:28px 36px;background:rgba(0,0,0,0.25);border-top:1px solid rgba(255,255,255,0.06);">
<div style="font-size:12px;color:rgba(255,255,255,0.55);line-height:1.5;">Click <strong style="color:#7DB87D;">Approve send</strong> to queue the email with its original timing. Click <strong style="color:#C9A84C;">Edit first</strong> to modify before sending. Click <strong style="color:#e74c3c;">Decline</strong> to permanently suppress. No action = email stays held.</div>
</td></tr>
</table></td></tr></table>
</body></html>`;

  const text = `${queuedEmails.length} prospect-facing emails to ${client.primary_contact_email} are held pending your approval.

Meeting: ${client.primary_contact_name} · ${when}
Tier: ${tierConfig.label}
${intel?.brief ? '\n' + intel.brief + '\n' : ''}

` + queuedEmails.map((q, i) => {
    if (!q || !q.approval_token) return '';
    const whenStr = q.scheduled_send_at
      ? new Date(q.scheduled_send_at).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }) + ' ET'
      : 'send now on approval';
    return `
${i + 1}. [${q.label || q.source}] ${q.subject}
   Scheduled: ${whenStr}
   Preview: ${(q.body_text || '').substring(0, 300).replace(/\n/g, ' ')}...
   APPROVE:  ${baseOrigin}/api/approval/decide?token=${q.approval_token}&action=approve
   EDIT:     ${baseOrigin}/api/approval/edit?token=${q.approval_token}
   DECLINE:  ${baseOrigin}/api/approval/decide?token=${q.approval_token}&action=decline
`;
  }).join('\n');

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'MarkCMO Approval <forms@markcmo.com>',
      to: ['mark@markcmo.com'],
      subject: `[APPROVE] ${queuedEmails.length} emails to ${client.primary_contact_email}`,
      html, text,
      tags: [
        { name: 'category', value: 'approval_request' },
        { name: 'tier', value: tier },
      ],
    }),
  });
  let resendId = null;
  try { const j = await r.json(); resendId = j?.id || null; } catch (_) {}
  return resendId;
}
// Drop-in replacement for `fetch('https://api.resend.com/emails', ...)`
// used by all 7 prospect-facing schedule functions. Builds a row in
// mc_pending_outbound_emails (status='pending') instead of hitting
// Resend. Returns a Response-LIKE object {ok, status, json(), text()}
// so the existing `if (r.ok) { respJson.id }` logic in each function
// continues to work unchanged - we just record the pending queue id
// where the Resend id used to live.
async function submitForProspectDelivery(env, sendBody, idempotencyKey, { source, engagement_id, label, approval_group_id }) {
  const approvalToken = generateApprovalToken();
  const to = Array.isArray(sendBody.to) ? sendBody.to[0] : sendBody.to;
  const row = {
    recipient_email: to,
    from_addr: sendBody.from,
    reply_to: sendBody.reply_to || null,
    cc: Array.isArray(sendBody.cc) && sendBody.cc.length > 0 ? sendBody.cc : null,
    subject: sendBody.subject,
    body_text: sendBody.text || '',
    body_html: sendBody.html || null,
    attachments_json: Array.isArray(sendBody.attachments) ? sendBody.attachments : null,
    tags_json: Array.isArray(sendBody.tags) ? sendBody.tags : null,
    resend_idempotency_key: idempotencyKey || null,
    scheduled_send_at: sendBody.scheduled_at || null,
    source,
    engagement_id: engagement_id || null,
    approval_group_id: approval_group_id || null,
    metadata: { label: label || source, handler_version: HANDLER_VERSION },
    status: 'pending',
    approval_token: approvalToken,
  };
  try {
    const inserted = await sbInsert(env, 'mc_pending_outbound_emails', row);
    const queuedId = inserted[0]?.id || null;
    return {
      ok: !!queuedId,
      status: queuedId ? 202 : 500,  // 202 Accepted = queued
      _queuedId: queuedId,
      _approvalToken: approvalToken,
      _queued: true,
      json: async () => ({ id: queuedId, approval_token: approvalToken, queued: true }),
      text: async () => queuedId ? '' : 'queue_insert_returned_no_id',
      headers: { get: () => null },
    };
  } catch (e) {
    const msg = (e && e.message) || String(e);
    console.error('submitForProspectDelivery failed:', msg);
    return {
      ok: false,
      status: 500,
      _queuedId: null,
      _approvalToken: null,
      _queued: false,
      json: async () => ({ id: null, error: msg }),
      text: async () => `queue_failed: ${msg}`,
      headers: { get: () => null },
    };
  }
}
// ───── end approval queue helper ────────────────────────────────

// ───── Booking intelligence (inlined - file deliberately self-contained) ─────
// Classifies an inbound booking by domain history to decide whether the
// auto-fire 7-email sequence is appropriate. Returns one of:
//   - cold / cold_personal: send the standard cold-template sequence
//   - returning_person: same email has booked before
//   - warm_domain: NEW person at a domain we already have contacts/emails at
//                  (e.g. Christina booking for Scott @secondlifemac.com)
// The brief is rendered into the single internal-alert email so Mark sees
// the relationship context at the moment the booking lands.

const BI_PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
  'aol.com', 'me.com', 'mac.com', 'live.com', 'msn.com', 'ymail.com',
  'protonmail.com', 'proton.me', 'pm.me', 'gmx.com', 'gmx.us',
  'comcast.net', 'verizon.net', 'att.net', 'sbcglobal.net', 'cox.net',
  'mail.com', 'mail.ru', 'qq.com', '163.com', 'inbox.com',
]);

const BI_PROSPECT_EVENTS = [
  'invitee_confirmation_sent', 'invitee_recap_sent', 'invitee_followup_sent',
  'invitee_24h_reminder_sent', 'invitee_1h_reminder_sent', 'invitee_6h_reminder_sent',
  'invitee_15min_confirm_sent', 'invitee_rebook_cta_sent', 'gemini_recap_sent',
];

const BI_RECENT_DAYS = 90;

function biDaysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString(); }

function biDomain(email) {
  if (!email) return '';
  const at = email.lastIndexOf('@');
  return at < 0 ? '' : email.slice(at + 1).trim().toLowerCase();
}

async function biSbSafe(env, path) {
  try {
    const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders(env) });
    if (!res.ok) return [];
    return await res.json();
  } catch (_) { return []; }
}

async function classifyBooking(env, { inviteeEmail, inviteeName }) {
  const emailLower = (inviteeEmail || '').toLowerCase();
  const domain = biDomain(emailLower);
  const isPersonal = BI_PERSONAL_DOMAINS.has(domain);

  if (!domain) {
    return {
      tier: 'cold', domain: '', is_personal_domain: false,
      signals: biEmptySignals(),
      recommend: 'AUTO_SEND', reason: 'no_domain_extractable',
      brief: 'No domain on invitee email. Treating as cold.',
    };
  }

  if (isPersonal) {
    const personalIntel = await biLookupSamePerson(env, emailLower);
    const tier = personalIntel.same_person_prior_bookings > 0 ? 'returning_person' : 'cold_personal';
    return {
      tier, domain, is_personal_domain: true,
      signals: { ...biEmptySignals(), ...personalIntel },
      recommend: tier === 'returning_person' && personalIntel.recent_emails_to_same_person > 3
        ? 'REQUEST_APPROVAL' : 'AUTO_SEND',
      reason: tier === 'returning_person' ? 'returning_person_personal_domain' : 'first_contact_personal_domain',
      brief: biBrief({ tier, domain, signals: personalIntel, inviteeEmail: emailLower, inviteeName }),
    };
  }

  const [domainClients, recentEmailsDomain, recentEmailsSamePerson, samePersonBookings] = await Promise.all([
    biSbSafe(env, `mc_clients?primary_contact_email=ilike.*@${encodeURIComponent(domain)}&select=id,primary_contact_email,primary_contact_name,status,created_at,legal_name&order=created_at.desc&limit=50`),
    biSbSafe(env, `mc_audit_log?event=in.(${BI_PROSPECT_EVENTS.join(',')})&payload->>invitee_email=ilike.*@${encodeURIComponent(domain)}&created_at=gte.${biDaysAgo(BI_RECENT_DAYS)}&select=created_at,event,payload&order=created_at.desc&limit=100`),
    biSbSafe(env, `mc_audit_log?event=in.(${BI_PROSPECT_EVENTS.join(',')})&payload->>invitee_email=eq.${encodeURIComponent(emailLower)}&created_at=gte.${biDaysAgo(BI_RECENT_DAYS)}&select=created_at,event&order=created_at.desc&limit=50`),
    biSbSafe(env, `mc_audit_log?event=eq.calendly_booking_created&payload->>invitee_email=eq.${encodeURIComponent(emailLower)}&select=created_at,payload&order=created_at.desc&limit=10`),
  ]);

  const samePersonClient = domainClients.find(c => (c.primary_contact_email || '').toLowerCase() === emailLower);
  const otherContacts = domainClients
    .filter(c => (c.primary_contact_email || '').toLowerCase() !== emailLower)
    .map(c => ({
      email: c.primary_contact_email,
      name: c.primary_contact_name || '',
      status: c.status || '',
      created_at: c.created_at,
      legal_name: c.legal_name || '',
    }));

  const signals = {
    same_person_prior_bookings: samePersonBookings.length,
    same_person_last_booking_at: samePersonBookings[0]?.created_at || null,
    other_contacts_in_domain: otherContacts.slice(0, 10),
    other_contacts_in_domain_count: otherContacts.length,
    recent_prospect_emails_sent: recentEmailsDomain.length,
    recent_emails_to_same_person: recentEmailsSamePerson.length,
    last_email_to_domain_at: recentEmailsDomain[0]?.created_at || null,
    last_email_to_same_person_at: recentEmailsSamePerson[0]?.created_at || null,
  };

  let tier, recommend, reason;
  if (samePersonBookings.length > 0 || samePersonClient) {
    tier = 'returning_person';
    if (signals.recent_emails_to_same_person >= 7) {
      recommend = 'REQUEST_APPROVAL';
      reason = 'returning_person_with_recent_high_email_volume';
    } else if (signals.same_person_prior_bookings >= 2) {
      recommend = 'REQUEST_APPROVAL';
      reason = 'returning_person_multiple_prior_bookings';
    } else {
      recommend = 'AUTO_SEND';
      reason = 'returning_person_single_prior_booking';
    }
  } else if (otherContacts.length > 0 || recentEmailsDomain.length > 0) {
    tier = 'warm_domain';
    recommend = 'REQUEST_APPROVAL';
    reason = otherContacts.length > 0 ? 'warm_domain_existing_contacts' : 'warm_domain_recent_outbound';
  } else {
    tier = 'cold';
    recommend = 'AUTO_SEND';
    reason = 'first_contact_from_business_domain';
  }

  return {
    tier, domain, is_personal_domain: false, signals, recommend, reason,
    brief: biBrief({ tier, domain, signals, inviteeEmail: emailLower, inviteeName }),
  };
}

async function biLookupSamePerson(env, emailLower) {
  const [sameClient, sameBookings, sameEmails] = await Promise.all([
    biSbSafe(env, `mc_clients?primary_contact_email=eq.${encodeURIComponent(emailLower)}&select=id&limit=1`),
    biSbSafe(env, `mc_audit_log?event=eq.calendly_booking_created&payload->>invitee_email=eq.${encodeURIComponent(emailLower)}&select=created_at&order=created_at.desc&limit=10`),
    biSbSafe(env, `mc_audit_log?event=in.(${BI_PROSPECT_EVENTS.join(',')})&payload->>invitee_email=eq.${encodeURIComponent(emailLower)}&created_at=gte.${biDaysAgo(BI_RECENT_DAYS)}&select=created_at&order=created_at.desc&limit=50`),
  ]);
  return {
    same_person_prior_bookings: sameBookings.length,
    same_person_last_booking_at: sameBookings[0]?.created_at || null,
    other_contacts_in_domain: [], other_contacts_in_domain_count: 0,
    recent_prospect_emails_sent: 0,
    recent_emails_to_same_person: sameEmails.length,
    last_email_to_domain_at: null,
    last_email_to_same_person_at: sameEmails[0]?.created_at || null,
  };
}

function biEmptySignals() {
  return {
    same_person_prior_bookings: 0, same_person_last_booking_at: null,
    other_contacts_in_domain: [], other_contacts_in_domain_count: 0,
    recent_prospect_emails_sent: 0, recent_emails_to_same_person: 0,
    last_email_to_domain_at: null, last_email_to_same_person_at: null,
  };
}

function biBrief({ tier, domain, signals, inviteeEmail, inviteeName }) {
  const name = inviteeName || inviteeEmail;
  const lines = [];
  if (tier === 'cold' || tier === 'cold_personal') {
    lines.push(`${name} is a first-time contact${tier === 'cold' ? ` from @${domain}` : ''}.`);
    lines.push('No prior bookings, no prior emails. Treating as cold lead.');
  } else if (tier === 'returning_person') {
    lines.push(`${name} has booked with us ${signals.same_person_prior_bookings} time(s) before.`);
    if (signals.last_email_to_same_person_at) {
      const d = Math.floor((Date.now() - new Date(signals.last_email_to_same_person_at).getTime()) / 86400000);
      lines.push(`Last email to them: ${d} day(s) ago. ${signals.recent_emails_to_same_person} email(s) in last 90 days.`);
    }
  } else if (tier === 'warm_domain') {
    lines.push(`${name} is NEW to us, but @${domain} is not.`);
    if (signals.other_contacts_in_domain.length > 0) {
      const others = signals.other_contacts_in_domain.slice(0, 3).map(c => `${c.name || c.email}`).join(', ');
      lines.push(`We have ${signals.other_contacts_in_domain_count} other contact(s) at @${domain}: ${others}${signals.other_contacts_in_domain_count > 3 ? '...' : ''}.`);
    }
    if (signals.recent_prospect_emails_sent > 0) {
      lines.push(`We sent ${signals.recent_prospect_emails_sent} email(s) to people @${domain} in the last 90 days.`);
    }
    lines.push('Sending the standard cold-template confirmation + prep email might read as robotic to a relationship we already have.');
  }
  return lines.join(' ');
}
// ───── end booking intelligence ─────────────────────────────────

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

// ───── resendPost (rate-limit-tolerant Resend POST wrapper) ──────
// Resend caps at 5 requests/second. Booking a Calendly slot fires 7-8
// scheduled emails (confirmation, 24h, 6h, 1h, 15min, recap, rebook,
// notify) back-to-back which tripped HTTP 429 rate_limit_exceeded on
// the last 2-3 emails (cost us the rebook CTA on a real test booking).
//
// This helper retries on 429 + 5xx with backoff, honoring the
// Retry-After header when present. Max 4 attempts.
async function resendPost(env, body, idempotencyKey) {
  const apiKey = env.RESEND_API_KEY;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  let lastResponse = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    lastResponse = r;

    if (r.status === 429 || r.status === 502 || r.status === 503 || r.status === 504) {
      if (attempt === 3) return r; // give up, return the last 429
      const retryAfterRaw = r.headers.get('retry-after') || '';
      const retryAfterSec = parseInt(retryAfterRaw, 10);
      const ms = !isNaN(retryAfterSec) && retryAfterSec > 0
        ? retryAfterSec * 1000
        : (attempt + 1) * 400;  // 400ms, 800ms, 1200ms
      await new Promise(resolve => setTimeout(resolve, ms));
      continue;
    }
    return r;
  }
  return lastResponse;
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

  // ───── Booking intelligence (domain history classifier) ─────
  // Determines whether this is a cold, warm-domain, or returning-person
  // booking. Result goes into notifyNewBooking's brief so Mark sees the
  // relationship context at the moment the booking lands.
  let intel = null;
  try {
    intel = await classifyBooking(env, { inviteeEmail, inviteeName });
    await sbInsert(env, 'mc_audit_log', {
      client_id: client.id,
      engagement_id: engagement.id,
      event: 'booking_intelligence_computed',
      payload: {
        invitee_email: inviteeEmail,
        tier: intel.tier,
        recommend: intel.recommend,
        reason: intel.reason,
        domain: intel.domain,
        signals: intel.signals,
      },
    });
  } catch (e) {
    try {
      await sbInsert(env, 'mc_audit_log', {
        event: 'booking_intelligence_crashed',
        payload: { invitee_email: inviteeEmail, error_message: (e && e.message) || String(e) },
      });
    } catch (_) {}
  }

  // ───── Internal notify email to Mark (wrapped) ─────
  // Now intelligence-aware. ONE email per booking with the full relationship
  // context, replacing the 7 CC'd emails we used to spam Mark with.
  try {
    await notifyNewBooking(env, { client, eventName, scheduledAt, qa, isNew: !existing.length, intel });
  } catch (e) {
    try {
      await sbInsert(env, 'mc_audit_log', {
        event: 'calendly_notify_crashed',
        payload: { invitee_email: inviteeEmail, error_message: (e && e.message) || String(e) },
      });
    } catch (_) {}
  }

  // Resend rate-limit: max 5 req/s. We fire 7 scheduled emails in this
  // sequence + the internal notify above = 8 POSTs. Add 250ms delay
  // between calls so we stay at ~4 req/s comfortably under the cap.
  // Each delay is a hot await, total adds ~1.5s to booking processing
  // time which is well within Calendly's 10s webhook timeout.
  const RATE_LIMIT_DELAY_MS = 250;
  const sleep = () => new Promise(r => setTimeout(r, RATE_LIMIT_DELAY_MS));

  // ───── Confirmation email (5 min delay, with auto-generated .ics) ─────
  try {
    await sendInviteeConfirmation(env, {
      inviteeEmail, inviteeName, eventName, scheduledAt, eventEndAt,
      meetingLink, calendlyInviteeUri,
      isNew: !existing.length, inviteeUri: calendlyInviteeUri,
      engagementId: engagement.id,
    });
  } catch (e) {
    try {
      await sbInsert(env, 'mc_audit_log', {
        event: 'invitee_confirmation_outer_crashed',
        payload: { invitee_email: inviteeEmail, error_message: (e && e.message) || String(e), error_stack: (e && e.stack) ? String(e.stack).substring(0, 1200) : null },
      });
    } catch (_) {}
  }
  await sleep();

  // ───── T-24h pre-call reminder (day before, with Meet link + .ics) ─────
  try {
    await scheduleDayBeforeReminder(env, {
      inviteeEmail, inviteeName, eventName, scheduledAt, eventEndAt,
      meetingLink, calendlyInviteeUri, engagementId: engagement.id,
    });
  } catch (e) {
    try {
      await sbInsert(env, 'mc_audit_log', {
        event: 'invitee_24h_reminder_outer_crashed',
        payload: { invitee_email: inviteeEmail, error_message: (e && e.message) || String(e), error_stack: (e && e.stack) ? String(e.stack).substring(0, 1200) : null },
      });
    } catch (_) {}
  }
  await sleep();

  // ───── T-1h pre-call reminder (one hour before, just the join link) ─────
  try {
    await scheduleHourBeforeReminder(env, {
      inviteeEmail, inviteeName, eventName, scheduledAt,
      meetingLink, calendlyInviteeUri, engagementId: engagement.id,
    });
  } catch (e) {
    try {
      await sbInsert(env, 'mc_audit_log', {
        event: 'invitee_1h_reminder_outer_crashed',
        payload: { invitee_email: inviteeEmail, error_message: (e && e.message) || String(e), error_stack: (e && e.stack) ? String(e.stack).substring(0, 1200) : null },
      });
    } catch (_) {}
  }
  await sleep();

  // ───── T-6h last-call reminder ─────
  try {
    await scheduleSixHoursBeforeReminder(env, {
      inviteeEmail, inviteeName, eventName, scheduledAt,
      meetingLink, calendlyInviteeUri, engagementId: engagement.id,
    });
  } catch (e) {
    try {
      await sbInsert(env, 'mc_audit_log', {
        event: 'invitee_6h_reminder_outer_crashed',
        payload: { invitee_email: inviteeEmail, error_message: (e && e.message) || String(e), error_stack: (e && e.stack) ? String(e.stack).substring(0, 1200) : null },
      });
    } catch (_) {}
  }
  await sleep();

  // ───── T-15min attendance-confirmation ping (with "I'll be there" button) ─────
  try {
    await scheduleAttendanceConfirmation(env, {
      inviteeEmail, inviteeName, eventName, scheduledAt,
      meetingLink, calendlyInviteeUri, engagementId: engagement.id,
    });
  } catch (e) {
    try {
      await sbInsert(env, 'mc_audit_log', {
        event: 'invitee_15min_confirm_outer_crashed',
        payload: { invitee_email: inviteeEmail, error_message: (e && e.message) || String(e), error_stack: (e && e.stack) ? String(e.stack).substring(0, 1200) : null },
      });
    } catch (_) {}
  }
  await sleep();

  // ───── Post-meeting RECAP (30 min after meeting end) ─────
  try {
    await schedulePostMeetingFollowup(env, {
      inviteeEmail, inviteeName, eventName, scheduledAt, eventEndAt, qa,
      inviteeUri: calendlyInviteeUri, engagementId: engagement.id,
    });
  } catch (e) {
    try {
      await sbInsert(env, 'mc_audit_log', {
        event: 'invitee_recap_outer_crashed',
        payload: { invitee_email: inviteeEmail, error_message: (e && e.message) || String(e), error_stack: (e && e.stack) ? String(e.stack).substring(0, 1200) : null },
      });
    } catch (_) {}
  }
  await sleep();

  // ───── T+72h rebook CTA ("worth another conversation?") ─────
  try {
    await scheduleRebookCta(env, {
      inviteeEmail, inviteeName, eventName, scheduledAt, eventEndAt,
      inviteeUri: calendlyInviteeUri, engagementId: engagement.id,
    });
  } catch (e) {
    try {
      await sbInsert(env, 'mc_audit_log', {
        event: 'invitee_rebook_cta_outer_crashed',
        payload: { invitee_email: inviteeEmail, error_message: (e && e.message) || String(e), error_stack: (e && e.stack) ? String(e.stack).substring(0, 1200) : null },
      });
    } catch (_) {}
  }

  // ───── Send Mark the consolidated approval-request email ─────
  // After all 7 schedule functions have queued their emails, query the
  // queue for this engagement and send Mark ONE email with all previews
  // + Approve/Edit/Decline links per email.
  try {
    const queued = await sbSelect(env,
      `mc_pending_outbound_emails?engagement_id=eq.${encodeURIComponent(engagement.id)}&status=eq.pending&order=scheduled_send_at.asc.nullsfirst&select=id,subject,body_text,scheduled_send_at,approval_token,source,metadata,recipient_email`);
    if (queued && queued.length > 0) {
      const queuedForEmail = queued.map(q => ({
        approval_token: q.approval_token,
        subject: q.subject,
        body_text: q.body_text,
        scheduled_send_at: q.scheduled_send_at,
        source: q.source,
        label: q.metadata?.label || q.source,
      }));
      await sendApprovalRequestEmail(env, {
        client, engagement, eventName, scheduledAt, intel, queuedEmails: queuedForEmail,
      });
    }
  } catch (e) {
    try {
      await sbInsert(env, 'mc_audit_log', {
        client_id: client.id,
        engagement_id: engagement.id,
        event: 'approval_request_email_failed',
        payload: { error_message: (e && e.message) || String(e), handler_version: HANDLER_VERSION },
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

  // Mark any pending-approval emails as 'superseded' so they don't appear
  // in the approval queue UI for a meeting that's been cancelled.
  try {
    await sbUpdate(env, 'mc_pending_outbound_emails',
      `recipient_email=eq.${encodeURIComponent(inviteeEmail)}&status=eq.pending`,
      { status: 'superseded', decision_via: 'cancel_webhook', declined_at: new Date().toISOString() });
  } catch (e) {
    console.warn('Failed to mark pending emails superseded on cancel:', e && e.message);
  }

  await sbInsert(env, 'mc_audit_log', {
    client_id: client.id,
    event: 'calendly_booking_canceled',
    payload: { invitee_email: inviteeEmail, name: p.name, cancel_reason: p.cancellation?.reason || null, invitee_uri: inviteeUri || '', handler_version: HANDLER_VERSION },
  });
  return new Response('OK', { status: 200 });
}

// ───── notifyNewBooking (internal alert email, intel-aware) ──────
async function notifyNewBooking(env, { client, eventName, scheduledAt, qa, isNew, intel }) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return;

  const when = scheduledAt
    ? new Date(scheduledAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/New_York' }) + ' ET'
    : 'time TBD';
  // WETYR design system - dark navy, gold accent, editorial serif headline
  const qaRows = Object.entries(qa).filter(([, v]) => v).map(([k, v]) =>
    `<tr>
      <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.06);width:140px;vertical-align:top;">
        <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.45);font-weight:600;">${esc(k)}</div>
      </td>
      <td style="padding:14px 0 14px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <div style="font-size:15px;line-height:1.55;color:rgba(255,255,255,0.92);">${esc(String(v).substring(0, 400))}</div>
      </td>
    </tr>`
  ).join('');

  // Intelligence eyebrow + tier color
  // Cold = gold (default), warm_domain = orange (caution),
  // returning_person = blue (already in relationship).
  const tier = intel?.tier || (isNew ? 'cold' : 'returning_person');
  const tierConfig = {
    cold:             { label: 'cold lead',          color: '#C9A84C', bg: 'rgba(201,168,76,0.14)' },
    cold_personal:    { label: 'cold (personal email)', color: '#C9A84C', bg: 'rgba(201,168,76,0.14)' },
    warm_domain:      { label: 'warm domain - new person', color: '#E89B5F', bg: 'rgba(232,155,95,0.16)' },
    returning_person: { label: 'returning contact',  color: '#7BA7E0', bg: 'rgba(123,167,224,0.14)' },
  }[tier] || { label: isNew ? 'new lead' : 'returning contact', color: '#C9A84C', bg: 'rgba(201,168,76,0.12)' };
  const eyebrow = tierConfig.label;
  const eyebrowColor = tierConfig.color;
  const eyebrowBg = tierConfig.bg;

  // Intel block - the actionable bit Mark cares about
  const recommendLabel = intel?.recommend === 'REQUEST_APPROVAL'
    ? 'Review before send'
    : intel?.recommend === 'AUTO_SEND' ? 'Auto-sending standard sequence' : '';
  const recommendColor = intel?.recommend === 'REQUEST_APPROVAL' ? '#E89B5F' : '#7DB87D';

  // Other contacts at the same domain (for warm_domain tier)
  const otherContacts = intel?.signals?.other_contacts_in_domain || [];
  const otherContactsRows = otherContacts.slice(0, 5).map(c => {
    const d = c.created_at ? Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000) : null;
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
        <div style="font-size:13px;color:rgba(255,255,255,0.85);">${esc(c.name || '(no name)')}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.45);font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;">${esc(c.email)}</div>
      </td>
      <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;vertical-align:top;">
        ${c.status ? `<span style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.5);">${esc(c.status)}</span>` : ''}
        ${d !== null ? `<div style="font-size:11px;color:rgba(255,255,255,0.4);">${d}d ago</div>` : ''}
      </td>
    </tr>`;
  }).join('');

  const intelBlock = intel ? `
  <tr><td style="padding:24px 40px 0;">
    <div style="padding:20px;background:rgba(${tier === 'warm_domain' ? '232,155,95' : tier === 'returning_person' ? '123,167,224' : '201,168,76'},0.06);border-left:3px solid ${eyebrowColor};border-radius:0 8px 8px 0;">
      <div style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${eyebrowColor};font-weight:700;margin-bottom:10px;">relationship intelligence</div>
      <div style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.88);margin-bottom:14px;">${esc(intel.brief)}</div>
      ${recommendLabel ? `<div style="display:inline-block;padding:5px 12px;background:rgba(${tier === 'warm_domain' ? '232,155,95' : '125,184,125'},0.18);border-radius:4px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:${recommendColor};font-weight:700;">${esc(recommendLabel)}</div>` : ''}
    </div>
  </td></tr>
  ${otherContactsRows ? `<tr><td style="padding:24px 40px 0;">
    <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.55);font-weight:600;margin-bottom:12px;">other contacts @ ${esc(intel.domain)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${otherContactsRows}</table>
  </td></tr>` : ''}
  ` : '';

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Booking</title></head>
<body style="margin:0;padding:0;background:#0a0f2c;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0f2c;">
<tr><td align="center" style="padding:48px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#0F1828;border-radius:16px;overflow:hidden;">

  <tr><td style="padding:40px 40px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
      <tr><td style="padding:6px 14px;background:${eyebrowBg};border-radius:9999px;">
        <span style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${eyebrowColor};font-weight:600;">${eyebrow}</span>
      </td></tr>
    </table>
    <h1 style="margin:0;font-family:'Newsreader','Charter','Iowan Old Style',Georgia,'Times New Roman',serif;font-size:32px;line-height:1.1;letter-spacing:-0.02em;font-weight:500;color:#ffffff;">${esc(client.primary_contact_name)}</h1>
    <div style="margin:8px 0 0;font-size:15px;color:rgba(255,255,255,0.72);">${esc(client.legal_name)}</div>
  </td></tr>

  <tr><td style="padding:32px 40px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:20px 0;border-top:1px solid rgba(255,255,255,0.08);border-bottom:1px solid rgba(255,255,255,0.08);">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="top" style="width:50%;padding-right:16px;">
            <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.45);font-weight:600;">when</div>
            <div style="margin-top:6px;font-family:'SF Mono',ui-monospace,'JetBrains Mono',Menlo,Consolas,monospace;font-size:18px;line-height:1.25;color:#C9A84C;font-weight:500;">${esc(when)}</div>
          </td>
          <td valign="top" style="width:50%;">
            <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.45);font-weight:600;">event type</div>
            <div style="margin-top:6px;font-size:15px;line-height:1.3;color:rgba(255,255,255,0.92);">${esc(eventName)}</div>
          </td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>

  ${intelBlock}

  ${qaRows ? `<tr><td style="padding:32px 40px 0;">
    <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#C9A84C;font-weight:600;margin-bottom:14px;">prep details</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${qaRows}</table>
  </td></tr>` : ''}

  <tr><td style="padding:32px 40px 40px;">
    <a href="https://markcmo.com/admin/bookings" style="padding:14px 28px;background:#C9A84C;color:#0a0f2c;font-weight:600;font-size:14px;letter-spacing:0.01em;text-decoration:none;border-radius:8px;">Open in admin →</a>
  </td></tr>

  <tr><td style="padding:24px 40px;background:rgba(0,0,0,0.2);border-top:1px solid rgba(255,255,255,0.06);">
    <div style="font-size:11px;letter-spacing:0.04em;color:rgba(255,255,255,0.28);font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;">${esc((client.primary_contact_email || '').toLowerCase())} &middot; tier: ${esc(tier)}</div>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  // Subject line carries the tier signal so Mark can triage from the inbox
  // without opening the email. WARM and RETURNING prefixes flag "look at
  // this before the auto-emails fire" cases.
  const subjectPrefix = tier === 'warm_domain'
    ? '⚠ WARM DOMAIN'
    : tier === 'returning_person'
      ? '↻ RETURNING'
      : isNew ? 'New lead' : 'Booking';

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'MarkCMO <forms@markcmo.com>',
      // Single recipient. Previously CC'd marklgabriellijr@gmail.com here
      // PLUS on all 7 prospect-facing scheduled emails - 8 emails per
      // booking. Now this is the ONE consolidated notification.
      to: ['mark@markcmo.com'],
      subject: `${subjectPrefix} booked: ${client.primary_contact_name} - ${eventName}`,
      html,
    }),
  });
}

// ───── sendInviteeConfirmation (personal warm email, 5 min delay) ─────
async function sendInviteeConfirmation(env, { inviteeEmail, inviteeName, eventName, scheduledAt, eventEndAt, meetingLink, calendlyInviteeUri, isNew, inviteeUri, engagementId }) {
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

    // Mark's directive: WETYR bookings get the EXACT same emails as MarkCMO.
    // Keep mode='wetyr' for audit/analytics, but use the discovery copy.
    if (mode === 'wetyr') mode = 'discovery';

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
      .map(par => `<p>${esc(par)}</p>`)
      .join('');
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body>
  <div>
    <p>Hi ${esc(firstName)},</p>
    ${htmlBodyParagraphs}
    <p>Thank you!</p>
    <p>${esc(copy.signOff)}<br><a href="${esc(copy.signOffLink.href)}" >${esc(copy.signOffLink.label)}</a></p>
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
        const organizerEmail = 'mark@markcmo.com';
        const organizerName = 'Mark Gabrielli';
        const meetingSummary = `${eventName} with Mark Gabrielli`;
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
      // CC removed 2026-06-09 per Mark's directive: "too much redundancy".
      // Mark gets ONE consolidated intel email per booking via notifyNewBooking
      // instead of being CC'd on every prospect-facing scheduled send.
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

    // Mark's directive 2026-06-09: gate ALL prospect-facing emails through
    // approval queue. Queue instead of POSTing to Resend.
    const q = await submitForProspectDelivery(env, sendBody, idempotencyKey, {
      source: 'calendly_confirmation',
      engagement_id: engagementId,
      label: 'Booking confirmation (5min after booking)',
    });
    auditPayload.queue_status = q.status;
    auditPayload.queued_id = q.queued_id;
    auditPayload.approval_token = q.approval_token;
    if (q.status === 'queued') {
      auditPayload.step = 'queued_for_approval';
      auditEvent = 'invitee_confirmation_queued_for_approval';
    } else {
      auditPayload.queue_error = q.error || null;
      auditPayload.step = 'queue_failed';
      auditEvent = 'invitee_confirmation_queue_failed';
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
async function schedulePostMeetingFollowup(env, { inviteeEmail, inviteeName, eventName, scheduledAt, eventEndAt, qa, inviteeUri, engagementId }) {
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
    const isWetyr = false; // Mark's directive - WETYR bookings use MarkCMO emails
    auditPayload.mode = (_n.indexOf('wetyr') >= 0) ? 'wetyr' : 'markcmo';

    const firstName = (inviteeName || '').split(' ')[0] || 'there';
    // Recap email - safe placeholder ONLY. Do NOT fabricate what was
    // discussed, agreed on, or what comes next. This template fires
    // at end_time+30min regardless of whether we actually have meeting
    // notes. If we DO have notes (Notetaker transcript + Workers AI
    // summary via the cron-process-gemini-recaps worker), this version
    // is CANCELLED and replaced with the personalized recap before
    // delivery. If we don't, this generic note is what goes out -
    // it must not assume any detail of the conversation.
    //
    // Mark's directive: "dont send this after the meeting if you are
    // not sure what we discussed". So we say nothing specific. Just
    // a thank-you + signal that a real follow-up is coming, leaving
    // room for Mark to send the actual specifics manually.
    const subject = `Thanks for the time today`;
    const text = `Hi ${firstName},

Thanks for the time today. I appreciated the conversation.

I'll follow up shortly with specifics from what we covered and the next step on my end. If anything came up that you'd like me to circle back on first, just reply to this email.

Mark`;
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body>
  <div>
    <p>Hi ${esc(firstName)},</p>
    <p>Thanks for the time today. I appreciated the conversation.</p>
    <p>I'll follow up shortly with specifics from what we covered and the next step on my end. If anything came up that you'd like me to circle back on first, just reply to this email.</p>
    <p>Mark</p>
  </div>
</body></html>`;
    auditPayload.step = 'composed';

    const fromAddr = 'Mark Gabrielli <mark@markcmo.com>';
    const replyTo = 'prep@markcmo.com';
    const idempotencyKey = `cal-followup-${inviteeUri || inviteeEmail || 'unknown'}`.substring(0, 256);

    auditPayload.step = 'queuing_for_approval';
    const _sendBody_followup = {
      from: fromAddr, to: [inviteeEmail], reply_to: replyTo,
      subject, html, text, scheduled_at: sendAt,
      tags: [
        { name: 'category', value: 'calendly_followup' },
        { name: 'mode', value: (_n.indexOf('wetyr') >= 0) ? 'wetyr' : 'markcmo' },
      ],
    };
    const r = await submitForProspectDelivery(env, _sendBody_followup, idempotencyKey, {
      source: 'calendly_recap_placeholder', engagement_id: engagementId,
      label: 'Post-meeting recap placeholder (T+30min)',
    });
    auditPayload.queue_status = r.status;

    if (r.ok) {
      const respJson = await r.json().catch(() => null);
      const resendId = respJson && respJson.id || null;
      auditPayload.resend_id = resendId;
      auditPayload.step = 'queued';
      auditEvent = 'invitee_recap_sent';

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

// ───── scheduleDayBeforeReminder (T-24h pre-call ping) ───────────
// Drops a short reminder 24 hours before the meeting with the join
// link + .ics. NO prep questions - we already asked those in the
// T+5min confirmation email; double-asking is friction.
// Skips if booking is less than 24 hours away (no time to schedule).
async function scheduleDayBeforeReminder(env, { inviteeEmail, inviteeName, eventName, scheduledAt, eventEndAt, meetingLink, calendlyInviteeUri, engagementId }) {
  const auditPayload = {
    invitee_email: inviteeEmail || '',
    invitee_name: inviteeName || '',
    invitee_uri: calendlyInviteeUri || '',
    event_name: eventName || '',
    scheduled_at: scheduledAt || null,
    send_at: null,
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
  let auditEvent = 'invitee_24h_reminder_attempted';

  try {
    if (!inviteeEmail || !scheduledAt) { auditPayload.step = 'no_email_or_time'; auditEvent = 'invitee_24h_reminder_skipped'; return; }
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) { auditPayload.step = 'no_resend_api_key'; auditEvent = 'invitee_24h_reminder_skipped'; return; }

    const startMs = new Date(scheduledAt).getTime();
    if (isNaN(startMs)) { auditPayload.step = 'bad_start_time'; auditEvent = 'invitee_24h_reminder_skipped'; return; }

    const sendAtMs = startMs - 24 * 60 * 60 * 1000;
    // If booking is < 24h + 5min away, skip (no time to schedule)
    if (sendAtMs < Date.now() + 5 * 60 * 1000) {
      auditPayload.step = 'too_close';
      auditEvent = 'invitee_24h_reminder_skipped';
      return;
    }
    // Resend caps scheduled_at at 30 days
    if (sendAtMs - Date.now() > 28 * 24 * 60 * 60 * 1000) {
      auditPayload.step = 'deferred_to_cron';
      auditPayload.send_at = new Date(sendAtMs).toISOString();
      auditEvent = 'invitee_24h_reminder_deferred';
      return;
    }
    const sendAt = new Date(sendAtMs).toISOString();
    auditPayload.send_at = sendAt;

    const _n = (eventName || '').toLowerCase();
    const isWetyr = false; // Mark's directive - WETYR bookings use MarkCMO emails
    auditPayload.mode = (_n.indexOf('wetyr') >= 0) ? 'wetyr' : 'markcmo';

    // Format day + time in US/Eastern
    const dt = new Date(scheduledAt);
    const whenDay = dt.toLocaleString('en-US', { weekday: 'long', timeZone: 'America/New_York' });
    const whenTime = dt.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' }) + ' ET';
    const firstName = (inviteeName || '').split(' ')[0] || 'there';

    const fromAddr = 'Mark Gabrielli <mark@markcmo.com>';
    const replyTo = 'prep@markcmo.com';
    const subject = `Tomorrow at ${whenTime} - confirm to hold your slot`;

    // Generate a signed token for the "I'll be there" button so the
    // attendance can be confirmed straight from this email instead of
    // waiting for the T-15min ping. Same token works for both emails.
    // (startMs already declared at top of function, reusing it.)
    const confirmExpiryMs = startMs + 4 * 60 * 60 * 1000;
    const confirmToken = await signAttendanceToken(env, { inviteeUri: calendlyInviteeUri, expiryMs: confirmExpiryMs });
    const baseOrigin = 'https://markcmo.com';
    const confirmUrl = `${baseOrigin}/api/confirm-attendance?token=${confirmToken}`;

    const joinLine = meetingLink ? `Join: ${meetingLink}` : 'Join link is in the Calendly invite.';
    const text = `Hi ${firstName},

Heads up - Mark's calendar is packed this week. To keep your slot at ${whenDay} ${whenTime} active, please confirm you'll be there or reply with any meeting details you'd like Mark to review beforehand.

If we don't hear back by 6 hours before the meeting, the slot will be released so someone else can book it.

Confirm here: ${confirmUrl}

${joinLine}

Mark`;
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body>
  <div>
    <p>Hi ${esc(firstName)},</p>
    <p>Heads up - Mark's calendar is packed this week. To keep your slot at <strong>${esc(whenDay)} ${esc(whenTime)}</strong> active, please confirm you'll be there or reply with any meeting details you'd like Mark to review beforehand.</p>
    <p>If we don't hear back by 6 hours before the meeting, the slot will be released so someone else can book it.</p>
    <p><a href="${esc(confirmUrl)}">I'll be there ✓</a></p>
    ${meetingLink ? `<p>Join link: <a href="${esc(meetingLink)}">${esc(meetingLink.replace(/^https?:\/\//,''))}</a></p>` : ''}
    <p>Mark</p>
  </div>
</body></html>`;

    // Build .ics for this reminder too (belt-and-suspenders)
    let icsAttachment = null;
    if (scheduledAt) {
      try {
        const organizerEmail = 'mark@markcmo.com';
        const organizerName = 'Mark Gabrielli';
        const icsBase64 = buildIcsBase64({
          uid: (calendlyInviteeUri || `${inviteeEmail}-${scheduledAt}`).replace(/[^a-z0-9-]/gi, ''),
          startUtcIso: scheduledAt,
          endUtcIso: eventEndAt,
          summary: `${eventName} with Mark Gabrielli`,
          description: meetingLink ? `Join: ${meetingLink}` : 'Calendly meeting',
          location: meetingLink || '',
          organizerEmail,
          organizerName,
          attendeeEmail: inviteeEmail,
          attendeeName: inviteeName || inviteeEmail,
        });
        icsAttachment = { filename: 'meeting-with-mark.ics', content: icsBase64, content_type: 'text/calendar' };
      } catch (_) {}
    }

    const sendBody = {
      from: fromAddr,
      to: [inviteeEmail],
      // CC removed 2026-06-09 per Mark's directive: "too much redundancy".
      // Mark gets ONE consolidated intel email per booking via notifyNewBooking
      // instead of being CC'd on every prospect-facing scheduled send.
      reply_to: replyTo,
      subject, html, text,
      scheduled_at: sendAt,
      tags: [
        { name: 'category', value: 'calendly_24h_reminder' },
        { name: 'mode', value: (_n.indexOf('wetyr') >= 0) ? 'wetyr' : 'markcmo' },
      ],
    };
    if (icsAttachment) sendBody.attachments = [icsAttachment];

    auditPayload.step = 'queuing_for_approval';
    const r = await submitForProspectDelivery(env, sendBody, `cal-24h-${calendlyInviteeUri || inviteeEmail}`.substring(0, 256), {
      source: 'calendly_t24h_reminder', engagement_id: engagementId,
      label: 'T-24h reminder (confirm to hold your slot)',
    });
    auditPayload.queue_status = r.status;

    if (r.ok) {
      const respJson = await r.json().catch(() => null);
      const resendId = respJson && respJson.id || null;
      auditPayload.resend_id = resendId;
      auditPayload.step = 'queued';
      auditEvent = 'invitee_24h_reminder_sent';

      // Store resend_id on engagement so we can cancel on invitee.canceled
      if (engagementId && resendId) {
        try {
          const eng = await sbSelect(env, `mc_engagements?id=eq.${encodeURIComponent(engagementId)}&select=metadata&limit=1`);
          const meta = (eng && eng[0] && eng[0].metadata) || {};
          meta.reminder_24h_resend_id = resendId;
          meta.reminder_24h_send_at = sendAt;
          await sbUpdate(env, 'mc_engagements', `id=eq.${encodeURIComponent(engagementId)}`, { metadata: meta });
        } catch (_) {}
      }
    } else {
      auditPayload.resend_error = (await r.text().catch(() => '')).slice(0, 600);
      auditPayload.step = 'resend_rejected';
      auditEvent = 'invitee_24h_reminder_failed';
    }
  } catch (err) {
    auditPayload.step = (auditPayload.step || 'unknown') + '_then_crashed';
    auditPayload.error_message = (err && err.message) || String(err);
    auditPayload.error_stack = (err && err.stack) ? String(err.stack).substring(0, 1500) : null;
    auditEvent = 'invitee_24h_reminder_crashed';
  } finally {
    try {
      await sbInsert(env, 'mc_audit_log', { event: auditEvent, payload: auditPayload });
    } catch (_) {}
  }
}

// ───── scheduleHourBeforeReminder (T-1h pre-call ping) ───────────
// Final reminder 1 hour before with just the join link. Short, mobile-
// friendly, no .ics attachment (they have it from earlier sends).
async function scheduleHourBeforeReminder(env, { inviteeEmail, inviteeName, eventName, scheduledAt, meetingLink, calendlyInviteeUri, engagementId }) {
  const auditPayload = {
    invitee_email: inviteeEmail || '',
    invitee_name: inviteeName || '',
    invitee_uri: calendlyInviteeUri || '',
    event_name: eventName || '',
    scheduled_at: scheduledAt || null,
    send_at: null,
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
  let auditEvent = 'invitee_1h_reminder_attempted';

  try {
    if (!inviteeEmail || !scheduledAt) { auditPayload.step = 'no_email_or_time'; auditEvent = 'invitee_1h_reminder_skipped'; return; }
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) { auditPayload.step = 'no_resend_api_key'; auditEvent = 'invitee_1h_reminder_skipped'; return; }

    const startMs = new Date(scheduledAt).getTime();
    if (isNaN(startMs)) { auditPayload.step = 'bad_start_time'; auditEvent = 'invitee_1h_reminder_skipped'; return; }

    const sendAtMs = startMs - 60 * 60 * 1000;
    if (sendAtMs < Date.now() + 5 * 60 * 1000) { auditPayload.step = 'too_close'; auditEvent = 'invitee_1h_reminder_skipped'; return; }
    if (sendAtMs - Date.now() > 28 * 24 * 60 * 60 * 1000) {
      auditPayload.step = 'deferred_to_cron';
      auditPayload.send_at = new Date(sendAtMs).toISOString();
      auditEvent = 'invitee_1h_reminder_deferred';
      return;
    }
    const sendAt = new Date(sendAtMs).toISOString();
    auditPayload.send_at = sendAt;

    const _n = (eventName || '').toLowerCase();
    const isWetyr = false; // Mark's directive - WETYR bookings use MarkCMO emails
    auditPayload.mode = (_n.indexOf('wetyr') >= 0) ? 'wetyr' : 'markcmo';

    const dt = new Date(scheduledAt);
    const whenTime = dt.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' }) + ' ET';
    const firstName = (inviteeName || '').split(' ')[0] || 'there';

    const fromAddr = 'Mark Gabrielli <mark@markcmo.com>';
    const replyTo = 'prep@markcmo.com';
    const subject = `See you in an hour`;

    const joinLine = meetingLink ? meetingLink : 'Check the Calendly invite for the join link.';
    const text = `Hi ${firstName},

See you at ${whenTime}.

${joinLine}

Mark`;
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body>
  <div>
    <p>Hi ${esc(firstName)},</p>
    <p>See you at <strong>${esc(whenTime)}</strong>.</p>
    ${meetingLink ? `<p><a href="${esc(meetingLink)}" style="background:#1a4d8c;color:#fff;padding:10px 18px;text-decoration:none;border-radius:6px;font-weight:600;">Join the meeting</a></p>` : '<p>Check the Calendly invite for the join link.</p>'}
    <p>Mark</p>
  </div>
</body></html>`;

    auditPayload.step = 'queuing_for_approval';
    const _sendBody_1h = {
      from: fromAddr, to: [inviteeEmail], reply_to: replyTo,
      subject, html, text, scheduled_at: sendAt,
      tags: [
        { name: 'category', value: 'calendly_1h_reminder' },
        { name: 'mode', value: (_n.indexOf('wetyr') >= 0) ? 'wetyr' : 'markcmo' },
      ],
    };
    const r = await submitForProspectDelivery(env, _sendBody_1h, `cal-1h-${calendlyInviteeUri || inviteeEmail}`.substring(0, 256), {
      source: 'calendly_t1h_reminder', engagement_id: engagementId,
      label: 'T-1h reminder (See you in an hour)',
    });
    auditPayload.queue_status = r.status;

    if (r.ok) {
      const respJson = await r.json().catch(() => null);
      const resendId = respJson && respJson.id || null;
      auditPayload.resend_id = resendId;
      auditPayload.step = 'queued';
      auditEvent = 'invitee_1h_reminder_sent';

      if (engagementId && resendId) {
        try {
          const eng = await sbSelect(env, `mc_engagements?id=eq.${encodeURIComponent(engagementId)}&select=metadata&limit=1`);
          const meta = (eng && eng[0] && eng[0].metadata) || {};
          meta.reminder_1h_resend_id = resendId;
          meta.reminder_1h_send_at = sendAt;
          await sbUpdate(env, 'mc_engagements', `id=eq.${encodeURIComponent(engagementId)}`, { metadata: meta });
        } catch (_) {}
      }
    } else {
      auditPayload.resend_error = (await r.text().catch(() => '')).slice(0, 600);
      auditPayload.step = 'resend_rejected';
      auditEvent = 'invitee_1h_reminder_failed';
    }
  } catch (err) {
    auditPayload.step = (auditPayload.step || 'unknown') + '_then_crashed';
    auditPayload.error_message = (err && err.message) || String(err);
    auditPayload.error_stack = (err && err.stack) ? String(err.stack).substring(0, 1500) : null;
    auditEvent = 'invitee_1h_reminder_crashed';
  } finally {
    try {
      await sbInsert(env, 'mc_audit_log', { event: auditEvent, payload: auditPayload });
    } catch (_) {}
  }
}

// ───── scheduleSixHoursBeforeReminder (final nudge BEFORE T-6h cancel) ──
// Fires 8 hours before the meeting (function name kept for backward
// compat with audit_log queries on invitee_6h_reminder_* events).
// The auto-cancel cron fires AT T-6h, so this email lands 2 hours before
// that cutoff - a final nudge window to confirm before the slot is released.
// Same one-click "I'll be there" button as the T-24h and T-15min emails.
//
// Skips if booking is < 8h + 5min away when this fires.
async function scheduleSixHoursBeforeReminder(env, { inviteeEmail, inviteeName, eventName, scheduledAt, meetingLink, calendlyInviteeUri, engagementId }) {
  const auditPayload = {
    invitee_email: inviteeEmail || '',
    invitee_name: inviteeName || '',
    invitee_uri: calendlyInviteeUri || '',
    event_name: eventName || '',
    scheduled_at: scheduledAt || null,
    send_at: null,
    confirm_url: null,
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
  let auditEvent = 'invitee_6h_reminder_attempted';

  try {
    if (!inviteeEmail || !scheduledAt) { auditPayload.step = 'no_email_or_time'; auditEvent = 'invitee_6h_reminder_skipped'; return; }
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) { auditPayload.step = 'no_resend_api_key'; auditEvent = 'invitee_6h_reminder_skipped'; return; }

    const startMs = new Date(scheduledAt).getTime();
    if (isNaN(startMs)) { auditPayload.step = 'bad_start_time'; auditEvent = 'invitee_6h_reminder_skipped'; return; }

    // Fires at T-8h (2h before the T-6h auto-cancel cutoff).
    const sendAtMs = startMs - 8 * 60 * 60 * 1000;
    if (sendAtMs < Date.now() + 5 * 60 * 1000) { auditPayload.step = 'too_close'; auditEvent = 'invitee_6h_reminder_skipped'; return; }
    if (sendAtMs - Date.now() > 28 * 24 * 60 * 60 * 1000) {
      auditPayload.step = 'deferred_to_cron';
      auditPayload.send_at = new Date(sendAtMs).toISOString();
      auditEvent = 'invitee_6h_reminder_deferred';
      return;
    }
    const sendAt = new Date(sendAtMs).toISOString();
    auditPayload.send_at = sendAt;

    const _n = (eventName || '').toLowerCase();
    const isWetyr = false; // Mark's directive - WETYR bookings use MarkCMO emails
    auditPayload.mode = (_n.indexOf('wetyr') >= 0) ? 'wetyr' : 'markcmo';

    const dt = new Date(scheduledAt);
    const whenTime = dt.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' }) + ' ET';
    const firstName = (inviteeName || '').split(' ')[0] || 'there';

    // Same signed confirm token as the T-24h and T-15min emails
    const confirmExpiryMs = startMs + 4 * 60 * 60 * 1000;
    const confirmToken = await signAttendanceToken(env, { inviteeUri: calendlyInviteeUri, expiryMs: confirmExpiryMs });
    const baseOrigin = 'https://markcmo.com';
    const confirmUrl = `${baseOrigin}/api/confirm-attendance?token=${confirmToken}`;
    auditPayload.confirm_url = confirmUrl;

    const fromAddr = 'Mark Gabrielli <mark@markcmo.com>';
    const replyTo = 'prep@markcmo.com';
    const subject = `Final nudge - confirm in the next 2 hours`;

    const text = `Hi ${firstName},

Quick final nudge on your meeting at ${whenTime}. We need a confirmation in the next 2 hours, otherwise the slot will be released 6 hours before the meeting so someone else can book it.

Confirm here: ${confirmUrl}

Or just reply with anything you'd like Mark to review beforehand.

Mark`;
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body>
  <div>
    <p>Hi ${esc(firstName)},</p>
    <p>Quick final nudge on your meeting at <strong>${esc(whenTime)}</strong>. We need a confirmation in the next 2 hours, otherwise the slot will be released 6 hours before the meeting so someone else can book it.</p>
    <p><a href="${esc(confirmUrl)}">I'll be there ✓</a></p>
    <p>Or just reply with anything you'd like Mark to review beforehand.</p>
    <p>Mark</p>
  </div>
</body></html>`;

    auditPayload.step = 'queuing_for_approval';
    const _sendBody_8h = {
      from: fromAddr, to: [inviteeEmail], reply_to: replyTo,
      subject, html, text, scheduled_at: sendAt,
      tags: [
        { name: 'category', value: 'calendly_final_nudge' },
        { name: 'mode', value: (_n.indexOf('wetyr') >= 0) ? 'wetyr' : 'markcmo' },
      ],
    };
    const r = await submitForProspectDelivery(env, _sendBody_8h, `cal-6h-${calendlyInviteeUri || inviteeEmail}`.substring(0, 256), {
      source: 'calendly_final_nudge', engagement_id: engagementId,
      label: 'T-8h final nudge (confirm in next 2 hours)',
    });
    auditPayload.queue_status = r.status;

    if (r.ok) {
      const respJson = await r.json().catch(() => null);
      const resendId = respJson && respJson.id || null;
      auditPayload.resend_id = resendId;
      auditPayload.step = 'queued';
      auditEvent = 'invitee_6h_reminder_sent';

      if (engagementId && resendId) {
        try {
          const eng = await sbSelect(env, `mc_engagements?id=eq.${encodeURIComponent(engagementId)}&select=metadata&limit=1`);
          const meta = (eng && eng[0] && eng[0].metadata) || {};
          meta.reminder_6h_resend_id = resendId;
          meta.reminder_6h_send_at = sendAt;
          await sbUpdate(env, 'mc_engagements', `id=eq.${encodeURIComponent(engagementId)}`, { metadata: meta });
        } catch (_) {}
      }
    } else {
      auditPayload.resend_error = (await r.text().catch(() => '')).slice(0, 600);
      auditPayload.step = 'resend_rejected';
      auditEvent = 'invitee_6h_reminder_failed';
    }
  } catch (err) {
    auditPayload.step = (auditPayload.step || 'unknown') + '_then_crashed';
    auditPayload.error_message = (err && err.message) || String(err);
    auditPayload.error_stack = (err && err.stack) ? String(err.stack).substring(0, 1500) : null;
    auditEvent = 'invitee_6h_reminder_crashed';
  } finally {
    try {
      await sbInsert(env, 'mc_audit_log', { event: auditEvent, payload: auditPayload });
    } catch (_) {}
  }
}

// ───── signAttendanceToken (HMAC-signed one-click confirm token) ─
// Returns a URL-safe token that the /api/confirm-attendance endpoint
// verifies before recording a confirmation. Format:
//   base64url(JSON({u, e}))  '.'  base64url(hmac)
// where u=inviteeUri (the canonical Calendly invitee URI), e=expiry ms.
// Signed with CRON_SHARED_SECRET so only our own emails can produce
// valid tokens.
async function signAttendanceToken(env, { inviteeUri, expiryMs }) {
  const secret = env.CRON_SHARED_SECRET || env.ADMIN_SECRET || 'fallback-key';
  const payload = JSON.stringify({ u: inviteeUri, e: expiryMs });
  const payloadB64 = b64urlEncode(payload);
  const sig = await hmacSha256Base64Url(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

async function hmacSha256Base64Url(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  let bin = '';
  const b = new Uint8Array(sigBytes);
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ───── scheduleAttendanceConfirmation (T-15min "I'll be there" ping) ─
// Drops a short email 15 minutes before the meeting with one prominent
// "I'll be there ✓" button. Clicking lands on /api/confirm-attendance
// which records the confirmation + emails Mark "[Name] confirmed".
//
// Why 15 min: late enough that they've already decided they're joining,
// early enough to take action if they need to send Mark anything before.
// Skips if booking is < 15 min + 5 min away when this fires.
async function scheduleAttendanceConfirmation(env, { inviteeEmail, inviteeName, eventName, scheduledAt, meetingLink, calendlyInviteeUri, engagementId }) {
  const auditPayload = {
    invitee_email: inviteeEmail || '',
    invitee_name: inviteeName || '',
    invitee_uri: calendlyInviteeUri || '',
    event_name: eventName || '',
    scheduled_at: scheduledAt || null,
    send_at: null,
    confirm_url: null,
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
  let auditEvent = 'invitee_15min_confirm_attempted';

  try {
    if (!inviteeEmail || !scheduledAt) { auditPayload.step = 'no_email_or_time'; auditEvent = 'invitee_15min_confirm_skipped'; return; }
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) { auditPayload.step = 'no_resend_api_key'; auditEvent = 'invitee_15min_confirm_skipped'; return; }

    const startMs = new Date(scheduledAt).getTime();
    if (isNaN(startMs)) { auditPayload.step = 'bad_start_time'; auditEvent = 'invitee_15min_confirm_skipped'; return; }

    const sendAtMs = startMs - 15 * 60 * 1000;
    if (sendAtMs < Date.now() + 5 * 60 * 1000) { auditPayload.step = 'too_close'; auditEvent = 'invitee_15min_confirm_skipped'; return; }
    if (sendAtMs - Date.now() > 28 * 24 * 60 * 60 * 1000) {
      auditPayload.step = 'deferred_to_cron';
      auditPayload.send_at = new Date(sendAtMs).toISOString();
      auditEvent = 'invitee_15min_confirm_deferred';
      return;
    }
    const sendAt = new Date(sendAtMs).toISOString();
    auditPayload.send_at = sendAt;

    const _n = (eventName || '').toLowerCase();
    const isWetyr = false; // Mark's directive - WETYR bookings use MarkCMO emails
    auditPayload.mode = (_n.indexOf('wetyr') >= 0) ? 'wetyr' : 'markcmo';

    const dt = new Date(scheduledAt);
    const whenTime = dt.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' }) + ' ET';
    const firstName = (inviteeName || '').split(' ')[0] || 'there';

    // Build the signed confirmation URL. Token expires 4 hours after
    // meeting start (covers meeting + buffer + slack for late clicks).
    const expiryMs = startMs + 4 * 60 * 60 * 1000;
    const token = await signAttendanceToken(env, { inviteeUri: calendlyInviteeUri, expiryMs });
    const baseOrigin = 'https://markcmo.com';
    const confirmUrl = `${baseOrigin}/api/confirm-attendance?token=${token}`;
    auditPayload.confirm_url = confirmUrl;

    const fromAddr = 'Mark Gabrielli <mark@markcmo.com>';
    const replyTo = 'prep@markcmo.com';
    const subject = `See you in 15 minutes`;

    const joinLine = meetingLink || 'Check the calendar invite for the join link.';
    const text = `Hi ${firstName},

See you in 15 min at ${whenTime}.

Quick favor - tap this to confirm you're joining so I know to wait:

${confirmUrl}

${meetingLink ? 'Join the meeting: ' + meetingLink : ''}

Mark`;

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body>
  <div>
    <p>Hi ${esc(firstName)},</p>
    <p>See you in 15 min at <strong>${esc(whenTime)}</strong>.</p>
    <p>Quick favor - tap below to confirm you're joining so I know to wait:</p>
    <p><a href="${esc(confirmUrl)}">I'll be there ✓</a></p>
    ${meetingLink ? `<p>Or join now: <a href="${esc(meetingLink)}">${esc(meetingLink.replace(/^https?:\/\//,''))}</a></p>` : ''}
    <p>Mark</p>
  </div>
</body></html>`;

    auditPayload.step = 'queuing_for_approval';
    const _sendBody_15min = {
      from: fromAddr, to: [inviteeEmail], reply_to: replyTo,
      subject, html, text, scheduled_at: sendAt,
      tags: [
        { name: 'category', value: 'calendly_15min_confirm' },
        { name: 'mode', value: (_n.indexOf('wetyr') >= 0) ? 'wetyr' : 'markcmo' },
      ],
    };
    const r = await submitForProspectDelivery(env, _sendBody_15min, `cal-15min-${calendlyInviteeUri || inviteeEmail}`.substring(0, 256), {
      source: 'calendly_t15min_confirm', engagement_id: engagementId,
      label: 'T-15min confirmation ping (See you in 15 minutes)',
    });
    auditPayload.queue_status = r.status;

    if (r.ok) {
      const respJson = await r.json().catch(() => null);
      const resendId = respJson && respJson.id || null;
      auditPayload.resend_id = resendId;
      auditPayload.step = 'queued';
      auditEvent = 'invitee_15min_confirm_sent';

      if (engagementId && resendId) {
        try {
          const eng = await sbSelect(env, `mc_engagements?id=eq.${encodeURIComponent(engagementId)}&select=metadata&limit=1`);
          const meta = (eng && eng[0] && eng[0].metadata) || {};
          meta.confirm_15min_resend_id = resendId;
          meta.confirm_15min_send_at = sendAt;
          await sbUpdate(env, 'mc_engagements', `id=eq.${encodeURIComponent(engagementId)}`, { metadata: meta });
        } catch (_) {}
      }
    } else {
      auditPayload.resend_error = (await r.text().catch(() => '')).slice(0, 600);
      auditPayload.step = 'resend_rejected';
      auditEvent = 'invitee_15min_confirm_failed';
    }
  } catch (err) {
    auditPayload.step = (auditPayload.step || 'unknown') + '_then_crashed';
    auditPayload.error_message = (err && err.message) || String(err);
    auditPayload.error_stack = (err && err.stack) ? String(err.stack).substring(0, 1500) : null;
    auditEvent = 'invitee_15min_confirm_crashed';
  } finally {
    try {
      await sbInsert(env, 'mc_audit_log', { event: auditEvent, payload: auditPayload });
    } catch (_) {}
  }
}

// ───── scheduleRebookCta (T+72h after meeting end) ───────────────
// Soft follow-up 3 days after the meeting: "worth another conversation?"
// with the same Calendly booking link. Mark's voice. No-pressure rebook
// nudge for prospects who didn't lock in a follow-up during the call.
//
// Skip logic: if invitee already has a future scheduled event with us
// at send time, the existing engagement metadata will get checked by a
// future cron worker pre-send. v1 just schedules unconditionally - the
// idempotency key on the Resend send prevents dupes across webhook
// retries, and a manual cancel works via cancelScheduledFollowup.
async function scheduleRebookCta(env, { inviteeEmail, inviteeName, eventName, scheduledAt, eventEndAt, inviteeUri, engagementId }) {
  const auditPayload = {
    invitee_email: inviteeEmail || '',
    invitee_name: inviteeName || '',
    invitee_uri: inviteeUri || '',
    event_name: eventName || '',
    scheduled_at: scheduledAt || null,
    send_at: null,
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
  let auditEvent = 'invitee_rebook_cta_attempted';

  try {
    if (!inviteeEmail) { auditPayload.step = 'no_invitee_email'; auditEvent = 'invitee_rebook_cta_skipped'; return; }
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) { auditPayload.step = 'no_resend_api_key'; auditEvent = 'invitee_rebook_cta_skipped'; return; }

    // Send 72h after meeting end (or 72h+1.5h = 73.5h after start if no end)
    let sendAtMs = null;
    if (eventEndAt) {
      const dt = new Date(eventEndAt);
      if (!isNaN(dt.getTime())) sendAtMs = dt.getTime() + 72 * 60 * 60 * 1000;
    }
    if (!sendAtMs && scheduledAt) {
      const dt = new Date(scheduledAt);
      if (!isNaN(dt.getTime())) sendAtMs = dt.getTime() + 72 * 60 * 60 * 1000 + 30 * 60 * 1000;
    }
    if (!sendAtMs) { auditPayload.step = 'no_send_time'; auditEvent = 'invitee_rebook_cta_skipped'; return; }
    const minSendAtMs = Date.now() + 30 * 60 * 1000;
    if (sendAtMs < minSendAtMs) sendAtMs = minSendAtMs;

    // Resend caps scheduled_at at 30 days
    if (sendAtMs - Date.now() > 28 * 24 * 60 * 60 * 1000) {
      auditPayload.step = 'deferred_to_cron';
      auditPayload.send_at = new Date(sendAtMs).toISOString();
      auditEvent = 'invitee_rebook_cta_deferred';
      return;
    }
    const sendAt = new Date(sendAtMs).toISOString();
    auditPayload.send_at = sendAt;

    const _n = (eventName || '').toLowerCase();
    const isWetyr = false; // Mark's directive - WETYR bookings use MarkCMO emails
    auditPayload.mode = (_n.indexOf('wetyr') >= 0) ? 'wetyr' : 'markcmo';

    const firstName = (inviteeName || '').split(' ')[0] || 'there';
    const fromAddr = 'Mark Gabrielli <mark@markcmo.com>';
    const replyTo = 'prep@markcmo.com';
    const bookingUrl = isWetyr
      ? 'https://wetyr.com/contact.html'  // WETYR doesn't have a public booking page; route to contact
      : 'https://markcmo.com/book';
    const subject = isWetyr ? `Want to keep going on the deal?` : `Worth another conversation?`;

    const text = isWetyr
      ? `Hi ${firstName},\n\nBeen a few days since we talked. If the deal still makes sense and you want to dig deeper, grab another slot here:\n\n${bookingUrl}\n\nIf you've moved on, no worries - just reply and let me know.\n\nMark`
      : `Hi ${firstName},\n\nA few days out from our call. If something we discussed is worth a deeper conversation, here is the easiest way to book another slot:\n\n${bookingUrl}\n\nIf you've decided to go a different direction, no worries - just hit reply and let me know.\n\nMark`;

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body>
  <div>
    <p>Hi ${esc(firstName)},</p>
    <p>${isWetyr
      ? `Been a few days since we talked. If the deal still makes sense and you want to dig deeper, grab another slot here:`
      : `A few days out from our call. If something we discussed is worth a deeper conversation, here is the easiest way to book another slot:`
    }</p>
    <p><a href="${esc(bookingUrl)}" style="background:#C9A84C;color:#0a0f2c;padding:11px 22px;text-decoration:none;border-radius:6px;font-weight:700;">Book another slot</a></p>
    <p>If you've ${isWetyr ? 'moved on' : 'decided to go a different direction'}, no worries - just hit reply and let me know.</p>
    <p>Mark</p>
  </div>
</body></html>`;

    auditPayload.step = 'queuing_for_approval';
    const _sendBody_rebook = {
      from: fromAddr, to: [inviteeEmail], reply_to: replyTo,
      subject, html, text, scheduled_at: sendAt,
      tags: [
        { name: 'category', value: 'calendly_rebook_cta' },
        { name: 'mode', value: (_n.indexOf('wetyr') >= 0) ? 'wetyr' : 'markcmo' },
      ],
    };
    const r = await submitForProspectDelivery(env, _sendBody_rebook, `cal-rebook-${inviteeUri || inviteeEmail}`.substring(0, 256), {
      source: 'calendly_rebook_cta', engagement_id: engagementId,
      label: 'T+72h rebook CTA (Worth another conversation?)',
    });
    auditPayload.queue_status = r.status;

    if (r.ok) {
      const respJson = await r.json().catch(() => null);
      const resendId = respJson && respJson.id || null;
      auditPayload.resend_id = resendId;
      auditPayload.step = 'queued';
      auditEvent = 'invitee_rebook_cta_sent';

      if (engagementId && resendId) {
        try {
          const eng = await sbSelect(env, `mc_engagements?id=eq.${encodeURIComponent(engagementId)}&select=metadata&limit=1`);
          const meta = (eng && eng[0] && eng[0].metadata) || {};
          meta.rebook_cta_resend_id = resendId;
          meta.rebook_cta_send_at = sendAt;
          await sbUpdate(env, 'mc_engagements', `id=eq.${encodeURIComponent(engagementId)}`, { metadata: meta });
        } catch (_) {}
      }
    } else {
      auditPayload.resend_error = (await r.text().catch(() => '')).slice(0, 600);
      auditPayload.step = 'resend_rejected';
      auditEvent = 'invitee_rebook_cta_failed';
    }
  } catch (err) {
    auditPayload.step = (auditPayload.step || 'unknown') + '_then_crashed';
    auditPayload.error_message = (err && err.message) || String(err);
    auditPayload.error_stack = (err && err.stack) ? String(err.stack).substring(0, 1500) : null;
    auditEvent = 'invitee_rebook_cta_crashed';
  } finally {
    try {
      await sbInsert(env, 'mc_audit_log', { event: auditEvent, payload: auditPayload });
    } catch (_) {}
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
    if (!eng || !eng.length || !eng[0].metadata) {
      auditPayload.step = 'no_engagement_found';
      auditEvent = 'invitee_followup_cancel_skipped';
      return;
    }

    // Cancel ALL scheduled emails for this booking - 24h reminder, 1h
    // reminder, and the post-meeting recap. Anything we already queued
    // at Resend with a scheduled_at can be DELETE'd as long as it has
    // not yet been sent.
    const meta = eng[0].metadata;
    const idsToCancel = [
      meta.reminder_24h_resend_id,
      meta.reminder_6h_resend_id,     // T-6h last call
      meta.reminder_1h_resend_id,
      meta.confirm_15min_resend_id,   // T-15min "I'll be there" confirm ping
      meta.followup_resend_id,        // the recap (legacy key name)
      meta.rebook_cta_resend_id,      // T+72h rebook CTA
    ].filter(Boolean);

    if (!idsToCancel.length) {
      auditPayload.step = 'nothing_to_cancel';
      auditEvent = 'invitee_followup_cancel_skipped';
      return;
    }

    auditPayload.resend_id = idsToCancel.join(',');
    auditPayload.step = 'deleting';
    const results = [];
    for (const resendId of idsToCancel) {
      try {
        // Resend uses POST /emails/{id}/cancel to cancel a scheduled
        // email (DELETE is not supported - returns 405 method_not_allowed).
        const r = await fetch(`https://api.resend.com/emails/${encodeURIComponent(resendId)}/cancel`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        results.push({ id: resendId, status: r.status, ok: r.ok });
      } catch (e) {
        results.push({ id: resendId, status: 0, error: (e && e.message) || String(e) });
      }
    }
    auditPayload.cancel_status = results.map(r => `${r.id}=${r.status}`).join(';');
    if (results.every(r => r.ok)) { auditPayload.step = 'cancelled'; auditEvent = 'invitee_followup_cancelled'; }
    else {
      auditPayload.cancel_error = JSON.stringify(results).slice(0, 600);
      auditPayload.step = 'partial_cancel';
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
