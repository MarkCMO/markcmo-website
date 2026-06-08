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

  // ─── Render success page (WETYR design system) ───
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Confirmed</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:wght@400;500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;background:#0a0f2c;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Inter','SF Pro Text','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;}
  .page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:48px 24px;}
  .card{max-width:560px;width:100%;}
  .eyebrow{display:inline-block;padding:6px 14px;background:rgba(46,186,115,0.12);border-radius:9999px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#5ED99A;font-weight:600;margin-bottom:24px;}
  h1{font-family:'Newsreader','Charter','Iowan Old Style',Georgia,serif;font-weight:500;font-size:56px;line-height:1.05;letter-spacing:-0.03em;margin:0 0 20px;color:#fff;}
  .subhead{font-size:17px;line-height:1.55;color:rgba(255,255,255,0.72);margin:0 0 40px;max-width:480px;}
  .stat{padding:24px 0;border-top:1px solid rgba(255,255,255,0.08);border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:32px;}
  .stat-label{font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.45);font-weight:600;margin-bottom:6px;}
  .stat-value{font-family:'SF Mono',ui-monospace,'JetBrains Mono',Menlo,Consolas,monospace;font-size:18px;color:#fff;font-weight:500;}
  .stat-when{color:#C9A84C;font-size:24px;line-height:1.1;}
  .help{font-size:13px;line-height:1.6;color:rgba(255,255,255,0.45);font-family:'SF Mono',ui-monospace,Menlo,monospace;letter-spacing:0;}
  .help a{color:#C9A84C;text-decoration:none;border-bottom:1px solid rgba(201,168,76,0.4);}
</style></head>
<body>
  <div class="page"><div class="card">
    <div class="eyebrow">✓ confirmed</div>
    <h1>You're in.</h1>
    <p class="subhead">Mark just got the signal that you're joining. He'll come prepared with the context you sent.</p>
    <div class="stat">
      <div class="stat-label">your seat</div>
      <div class="stat-value">${eng?.metadata?.scheduled_at ? `<span class="stat-when">${new Date(eng.metadata.scheduled_at).toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' }) + ' ET'}</span>` : 'reserved'}</div>
    </div>
    <p class="help">Need to reschedule? Reply to any of Mark's emails and we'll handle it. The join link stays in your calendar invite — search <em>"Consultation Discovery"</em> if you can't find it.</p>
  </div></div>
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
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Confirmation error</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:wght@500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;background:#0a0f2c;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Inter','SF Pro Text','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;}
  .page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:48px 24px;}
  .card{max-width:520px;width:100%;}
  .eyebrow{display:inline-block;padding:6px 14px;background:rgba(231,76,60,0.10);border-radius:9999px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#FF7B6E;font-weight:600;margin-bottom:24px;}
  h1{font-family:'Newsreader','Charter',Georgia,serif;font-weight:500;font-size:48px;line-height:1.05;letter-spacing:-0.03em;margin:0 0 20px;color:#fff;}
  .err{font-size:15px;line-height:1.55;color:rgba(255,255,255,0.85);margin:0 0 32px;padding:0 0 0 20px;border-left:2px solid #e74c3c;}
  .help{font-size:13px;line-height:1.65;color:rgba(255,255,255,0.45);}
  .help strong{color:rgba(255,255,255,0.72);font-weight:500;}
</style></head>
<body>
  <div class="page"><div class="card">
    <div class="eyebrow">could not confirm</div>
    <h1>Link issue.</h1>
    <div class="err">${esc(msg)}</div>
    <p class="help"><strong>What to do:</strong> Reply to any of Mark's emails and we'll mark you as confirmed manually. You'll still be on the call — this is only the in-system flag that didn't update.</p>
  </div></div>
</body></html>`;
  return new Response(html, { status: 400, headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
}
