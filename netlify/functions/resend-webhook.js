// ═══════════════════════════════════════════════════════════════
// resend-webhook.js
//
// Receives Resend email events and writes them to mc_journey_events
// so we can surface a per-client touchpoint timeline in /admin.
//
// Events handled:
//   email.sent        - Resend accepted the message
//   email.delivered   - SMTP delivered to recipient mailserver
//   email.opened      - Tracking pixel fired (recipient opened)
//   email.clicked     - Recipient clicked a link in the email
//   email.bounced     - Hard bounce
//   email.complained  - Marked as spam
//   email.delivery_delayed
//   email.failed
//
// SETUP (Resend dashboard):
//   1. https://resend.com/webhooks → "Add Endpoint"
//   2. Endpoint URL: https://markcmo.com/.netlify/functions/resend-webhook
//   3. Subscribe to ALL email.* events
//   4. Copy the signing secret (whsec_...) and set as env var:
//        RESEND_WEBHOOK_SECRET
//   5. In Resend project settings, enable Open Tracking +
//      Click Tracking so the events actually fire.
//
// Resend signs each request with Svix-style headers:
//   svix-id, svix-timestamp, svix-signature
//   v1,<base64-hmac-sha256> of msgId.timestamp.body
// ═══════════════════════════════════════════════════════════════
const crypto = require('crypto');
const { sbSelect, sbInsert } = require('./_lib_supabase');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST only' };

  const rawBody = event.body || '';
  const headers = event.headers || {};
  const svixId = headers['svix-id'] || headers['Svix-Id'];
  const svixTs = headers['svix-timestamp'] || headers['Svix-Timestamp'];
  const svixSig = headers['svix-signature'] || headers['Svix-Signature'];
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  // Verify svix signature when secret is configured
  if (secret) {
    if (!svixId || !svixTs || !svixSig) {
      console.warn('Resend webhook missing svix headers');
      return { statusCode: 400, body: 'Missing svix headers' };
    }
    const ok = verifySvixSignature({ id: svixId, ts: svixTs, body: rawBody, sigHeader: svixSig, secret });
    if (!ok) {
      console.warn('Resend webhook signature mismatch');
      return { statusCode: 401, body: 'Invalid signature' };
    }
  } else {
    console.warn('RESEND_WEBHOOK_SECRET not set; signature check skipped');
  }

  let payload;
  try { payload = JSON.parse(rawBody); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const eventType = payload?.type || '';   // e.g. 'email.opened'
  const data = payload?.data || {};
  const resendEmailId = data.email_id || data.id || null;
  const recipients = Array.isArray(data.to) ? data.to : (data.to ? [data.to] : []);
  const subject = data.subject || null;
  const clickUrl = data.click?.link || data.link || data.url || null;
  const ip = data.click?.ipAddress || data.ip || null;
  const userAgent = data.click?.userAgent || data.user_agent || null;

  console.log('Resend webhook:', eventType, resendEmailId || '(no id)', recipients[0] || '(no to)');

  // Resolve client by recipient email (case-insensitive). One event can
  // have multiple recipients; we attribute to the first matching mc_clients row.
  let client = null;
  for (const rcpt of recipients) {
    if (!rcpt) continue;
    const norm = String(rcpt).trim().toLowerCase();
    try {
      const rows = await sbSelect(
        `mc_clients?primary_contact_email=ilike.${encodeURIComponent(norm)}&select=id,slug,legal_name&limit=1`
      );
      if (rows.length) { client = rows[0]; break; }
    } catch (e) { /* continue */ }
  }

  // If we have a recent journey row with this resendEmailId, we can
  // also pull engagement_id from there for richer attribution.
  let engagementId = null;
  if (resendEmailId) {
    try {
      const prior = await sbSelect(`mc_journey_events?resend_email_id=eq.${encodeURIComponent(resendEmailId)}&select=engagement_id,client_id&limit=1`);
      if (prior.length) {
        engagementId = prior[0].engagement_id;
        if (!client && prior[0].client_id) client = { id: prior[0].client_id };
      }
    } catch {}
  }

  // Map Resend event → our event name (kept consistent with admin UI)
  const map = {
    'email.sent':            'email_sent',
    'email.delivered':       'email_delivered',
    'email.delivery_delayed':'email_delayed',
    'email.opened':          'email_opened',
    'email.clicked':         'email_clicked',
    'email.bounced':         'email_bounced',
    'email.complained':      'email_complained',
    'email.failed':          'email_failed',
  };
  const ourEvent = map[eventType] || eventType.replace(/^email\./, 'email_');

  try {
    await sbInsert('mc_journey_events', {
      client_id: client?.id || null,
      engagement_id: engagementId || null,
      category: 'email',
      event: ourEvent,
      subject_or_url: clickUrl || subject || null,
      recipient_email: recipients[0] || null,
      resend_email_id: resendEmailId,
      ip,
      user_agent: userAgent,
      raw: payload,
    });
  } catch (e) {
    console.error('mc_journey_events insert failed:', e.message);
  }

  return { statusCode: 200, body: 'OK' };
};

// ─── Svix signature verification ────────────────────────────────
function verifySvixSignature({ id, ts, body, sigHeader, secret }) {
  // Strip "whsec_" prefix and decode base64
  const cleanSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  let key;
  try { key = Buffer.from(cleanSecret, 'base64'); }
  catch { return false; }
  const signed = `${id}.${ts}.${body}`;
  const expected = crypto.createHmac('sha256', key).update(signed).digest('base64');
  // sigHeader looks like "v1,<sig> v1,<sig2>" (space separated; multiple signatures possible)
  const sigs = sigHeader.split(' ').map(s => s.split(',')[1]).filter(Boolean);
  for (const sig of sigs) {
    try {
      const a = Buffer.from(sig, 'base64');
      const b = Buffer.from(expected, 'base64');
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
    } catch {}
  }
  return false;
}
