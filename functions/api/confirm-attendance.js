// /api/confirm-attendance
//
// One-click attendance confirmation endpoint. Invoked when a Calendly
// invitee clicks the "I'll be there ✓" button in the T-15min email.
//
// Flow:
//   1. Verify the HMAC-signed token (token contains inviteeUri + expiry,
//      signed with CRON_SHARED_SECRET)
//   2. Look up engagement by calendly_invitee_uri
//   3. Write attended_confirmed_at + confirmation source to
//      engagement.metadata
//   4. Audit log invitee_attendance_confirmed
//   5. Send Mark a notification email "[Name] confirmed for [time]"
//   6. Render a friendly success page back to the clicker
//
// Idempotent: clicking the button twice just updates the timestamp.
// Safe: token is HMAC-signed so only emails we sent can produce valid
// tokens, and tokens expire 4h after meeting start.

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  if (!token) return errorPage('Missing token. This link may be malformed.');

  // ─── Decode + verify token ───
  const parts = token.split('.');
  if (parts.length !== 2) return errorPage('Invalid token.');
  const [payloadB64, sigB64] = parts;

  let payload;
  try {
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    payload = JSON.parse(json);
  } catch (_) {
    return errorPage('Token could not be decoded.');
  }
  const { u: inviteeUri, e: expiryMs } = payload || {};
  if (!inviteeUri || !expiryMs) return errorPage('Token is missing required fields.');
  if (Date.now() > expiryMs) return errorPage('This confirmation link has expired (4 hours after the meeting time).');

  // Verify signature
  const secret = env.CRON_SHARED_SECRET || env.ADMIN_SECRET || 'fallback-key';
  const expectedSig = await hmacSha256Base64Url(secret, payloadB64);
  if (expectedSig !== sigB64) return errorPage('Invalid signature. This link could not be verified.');

  // ─── Look up engagement ───
  let eng = null;
  try {
    const rows = await sbSelect(env, `mc_engagements?metadata->>calendly_invitee_uri=eq.${encodeURIComponent(inviteeUri)}&select=id,client_id,metadata,name&limit=1`);
    if (rows && rows.length) eng = rows[0];
  } catch (_) {}

  if (!eng) return errorPage('Could not locate this booking. Try refreshing or replying to the email instead.');

  // ─── Record confirmation ───
  const nowIso = new Date().toISOString();
  const meta = eng.metadata || {};
  const isNewConfirm = !meta.attended_confirmed_at;
  meta.attended_confirmed_at = nowIso;
  meta.attended_confirmed_via = 'click_15min_email';

  try {
    await sbUpdate(env, 'mc_engagements', `id=eq.${encodeURIComponent(eng.id)}`, { metadata: meta });
  } catch (e) {
    // Soft-fail the metadata write but continue (the audit log is the
    // source of truth for "did the click happen")
    console.warn('Engagement metadata update failed:', e && e.message);
  }

  try {
    await sbInsert(env, 'mc_audit_log', {
      client_id: eng.client_id,
      engagement_id: eng.id,
      event: 'invitee_attendance_confirmed',
      payload: {
        invitee_uri: inviteeUri,
        confirmed_at: nowIso,
        via: 'click_15min_email',
        first_click: isNewConfirm,
      },
    });
  } catch (_) {}

  // ─── Notify Mark (first click only, to avoid duplicate alerts on refresh) ───
  if (isNewConfirm) {
    try {
      await notifyAttendanceConfirmed(env, { engagement: eng, inviteeUri });
    } catch (_) {}
  }

  // ─── Render success page ───
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Confirmed - See you soon</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#0a0f2c;color:#fff;margin:0;padding:0;display:flex;align-items:center;justify-content:center;min-height:100vh;}
  .card{background:#0F1828;border:1px solid rgba(46,186,115,0.3);border-radius:14px;padding:36px 40px;max-width:480px;width:100%;text-align:center;}
  .checkmark{width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#2EBA73,#1A9755);display:flex;align-items:center;justify-content:center;margin:0 auto 22px;}
  h1{font-size:1.7rem;margin:0 0 12px;color:#fff;}
  p{line-height:1.55;color:rgba(255,255,255,.78);margin:0 0 14px;}
</style></head><body>
<div class="card">
  <div class="checkmark"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 10 18 20 6"></polyline></svg></div>
  <h1>You're confirmed</h1>
  <p>Got it. Mark just got the heads-up that you're joining.</p>
  <p style="font-size:.88rem;color:rgba(255,255,255,.55);">If you need to reschedule, reply to the confirmation email and we'll handle it.</p>
</div>
</body></html>`;
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
}

// ───── notifyAttendanceConfirmed (alert Mark) ────────────────────
async function notifyAttendanceConfirmed(env, { engagement, inviteeUri }) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return;

  // Pull the client so we have the invitee name
  let client = null;
  try {
    const rows = await sbSelect(env, `mc_clients?id=eq.${encodeURIComponent(engagement.client_id)}&select=primary_contact_name,primary_contact_email&limit=1`);
    if (rows && rows.length) client = rows[0];
  } catch (_) {}

  const meta = engagement.metadata || {};
  const scheduledAt = meta.scheduled_at || null;
  const whenStr = scheduledAt
    ? new Date(scheduledAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/New_York' }) + ' ET'
    : '(time TBD)';
  const inviteeName = client?.primary_contact_name || 'Invitee';
  const inviteeEmail = client?.primary_contact_email || '';

  const subject = `✓ ${inviteeName} confirmed for ${whenStr}`;
  const text = `${inviteeName} just clicked "I'll be there" for the meeting at ${whenStr}.\n\nEmail: ${inviteeEmail}\nEngagement: ${engagement.id}\n\nThey're locked in.`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#F8FAFC;font-family:Arial,sans-serif;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border-top:4px solid #2EBA73;">
  <div style="padding:22px 24px;">
    <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#2EBA73;margin-bottom:6px;font-weight:700;">ATTENDANCE CONFIRMED</div>
    <h1 style="font-size:18px;margin:0 0 8px;font-weight:700;color:#0a0f2c;">${esc(inviteeName)} is joining</h1>
    <p style="font-size:14px;color:#475569;margin:0 0 10px;line-height:1.5;">Just clicked the "I'll be there" button for the meeting at <strong>${esc(whenStr)}</strong>.</p>
    <p style="font-size:13px;color:#64748B;margin:0 0 4px;">${esc(inviteeEmail)}</p>
  </div>
</div></body></html>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'MarkCMO <forms@markcmo.com>',
      to: ['mark@markcmo.com', 'marklgabriellijr@gmail.com'],
      subject,
      html,
      text,
      tags: [{ name: 'category', value: 'attendance_confirmed' }],
    }),
  }).catch(err => console.warn('Notify confirm-attendance failed:', err.message));
}

// ───── Token verification helper (matches sign side in calendly-webhook.js) ───
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

// ───── Supabase REST helpers ────────────────────────────────────
function sbHeaders(env) {
  const key = env.MARKCMO_SUPABASE_SERVICE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}
async function sbSelect(env, path) {
  const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders(env) });
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

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function errorPage(msg) {
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Confirmation Error</title>
<style>body{font-family:Arial,sans-serif;background:#0a0f2c;color:#fff;padding:40px;line-height:1.6;}.err{background:rgba(231,76,60,0.1);border-left:3px solid #e74c3c;padding:12px 16px;border-radius:4px;color:#ffb3aa;}</style>
</head><body>
<h1>Could not confirm</h1>
<div class="err">${esc(msg)}</div>
<p style="color:#aaa;margin-top:20px;">Try replying directly to the meeting email. We will still see you on the call.</p>
</body></html>`;
  return new Response(html, { status: 400, headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
}
