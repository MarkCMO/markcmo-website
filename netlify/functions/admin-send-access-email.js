// netlify/functions/admin-send-access-email.js
// Admin-only: looks up a student's enrollments in JSONBin and emails them
// their personalized course access links (one click → Resume in academy).
//
// POST { email: "student@example.com" }
//   1. Verify admin cookie
//   2. Pull enrollments for that email from JSONBin
//   3. Build personalized HTML email listing every course with deep-link
//   4. Send via Resend (from mark@markcmo.com)
//
// Used by admin panel "Send access email" button, or one-off curl.

const COOKIE_NAME = 'mcadmin_session';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://markcmo.com',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
};

async function verifyToken(token, secret) {
  try {
    const [dataB64, sigB64] = token.split('.');
    if (!dataB64 || !sigB64) return null;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sig = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const ok = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(dataB64));
    if (!ok) return null;
    const payload = JSON.parse(atob(dataB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}

function parseCookies(h) {
  const out = {};
  (h || '').split(';').forEach(p => {
    const [k, ...v] = p.trim().split('=');
    if (k) out[k.trim()] = decodeURIComponent(v.join('='));
  });
  return out;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'POST only' }) };
  }

  // ── Auth ────────────────────────────────────────────────────────────
  const cookies = parseCookies(event.headers.cookie || event.headers.Cookie || '');
  const token = cookies[COOKIE_NAME];
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.TOKEN_SECRET || 'fallback';
  const payload = token ? await verifyToken(token, secret) : null;
  if (!payload) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Not authenticated' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const targetEmail = (body.email || '').trim().toLowerCase();
  if (!targetEmail) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'email required' }) };

  // ── Pull enrollments for this email from JSONBin ────────────────────
  const { JSONBIN_API_KEY, JSONBIN_ENROLLMENTS_BIN_ID, RESEND_API_KEY } = process.env;
  if (!JSONBIN_API_KEY || !JSONBIN_ENROLLMENTS_BIN_ID) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'JSONBin not configured' }) };
  }
  if (!RESEND_API_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'RESEND_API_KEY not set' }) };
  }

  const binRes = await fetch(
    `https://api.jsonbin.io/v3/b/${JSONBIN_ENROLLMENTS_BIN_ID}/latest`,
    { headers: { 'X-Master-Key': JSONBIN_API_KEY, 'X-Bin-Meta': 'false' } }
  );
  if (!binRes.ok) {
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'JSONBin fetch failed' }) };
  }
  const data = await binRes.json();
  const all = data.enrollments || [];
  const mine = all.filter(e => (e.email || '').toLowerCase() === targetEmail);

  if (!mine.length) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'No enrollments found for that email' }) };
  }

  const name = mine[0].name || targetEmail.split('@')[0];
  const accessToken = mine[0].accessToken;
  const viaMembership = mine.some(e => e.viaMembership);
  const membershipExpires = mine.find(e => e.membershipExpires)?.membershipExpires;
  const sortedCourses = mine
    .filter(e => e.courseId && e.courseId !== 'membership')
    .sort((a, b) => (a.courseTitle || a.courseId).localeCompare(b.courseTitle || b.courseId));

  // ── Build HTML email ────────────────────────────────────────────────
  const portalUrl = `https://academy.markcmo.com/?email=${encodeURIComponent(targetEmail)}&token=${encodeURIComponent(accessToken)}&mycourses=1`;

  const courseRowsHtml = sortedCourses.map(c => {
    const resumeUrl = `https://academy.markcmo.com/learn?course=${encodeURIComponent(c.courseId)}&email=${encodeURIComponent(targetEmail)}&token=${encodeURIComponent(accessToken)}`;
    const title = c.courseTitle || c.courseId;
    return `<tr><td style="padding:10px 14px;border-bottom:1px solid #eee;font-family:Arial,sans-serif;font-size:14px;">${title}</td><td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:right;"><a href="${resumeUrl}" style="background:#C9A84C;color:#0A1628;text-decoration:none;padding:8px 14px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.5px;border-radius:4px;display:inline-block;">START COURSE →</a></td></tr>`;
  }).join('\n');

  const membershipBlock = viaMembership ? `
    <div style="background:#0A1628;color:#C9A84C;padding:14px 20px;text-align:center;margin:24px 0;border-radius:4px;font-family:Arial,sans-serif;">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;">All-Access Membership</div>
      <div style="font-size:14px;color:#fff;margin-top:6px;">You have access to every course below + future launches.</div>
      ${membershipExpires ? `<div style="font-size:11px;color:#888;margin-top:6px;">Renews: ${new Date(membershipExpires).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div>` : ''}
    </div>
  ` : '';

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f7f7f7;">
<div style="max-width:600px;margin:0 auto;background:#fff;padding:32px 28px;font-family:Arial,sans-serif;">
  <div style="font-size:24px;font-weight:900;letter-spacing:-0.5px;color:#0A1628;margin-bottom:6px;">MarkCMO Academy</div>
  <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;font-weight:700;margin-bottom:24px;">Your Course Access</div>

  <p style="font-size:15px;line-height:1.6;color:#333;margin:0 0 16px 0;">Hi ${name.split(' ')[0]},</p>
  <p style="font-size:15px;line-height:1.6;color:#333;margin:0 0 16px 0;">Your MarkCMO Academy account is now active. You can start any course below by clicking <strong>START COURSE →</strong>. Your progress is saved automatically.</p>

  ${membershipBlock}

  <div style="font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#0A1628;margin:24px 0 12px 0;">Your Courses (${sortedCourses.length})</div>
  <table style="width:100%;border-collapse:collapse;border:1px solid #eee;">
    ${courseRowsHtml}
  </table>

  <div style="margin:32px 0 24px 0;text-align:center;">
    <a href="${portalUrl}" style="background:#0A1628;color:#fff;text-decoration:none;padding:14px 32px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;border-radius:4px;display:inline-block;">View All My Courses →</a>
  </div>

  <div style="border-top:1px solid #eee;padding-top:16px;margin-top:24px;font-size:12px;color:#888;line-height:1.6;">
    Bookmark this email — it contains your personalized access links. If you need a new login link, just reply to this email.<br><br>
    — Mark Gabrielli<br>
    <a href="mailto:mark@markcmo.com" style="color:#C9A84C;">mark@markcmo.com</a>
  </div>
</div>
</body></html>`;

  const text = `MarkCMO Academy — Your Course Access\n\n` +
    `Hi ${name.split(' ')[0]},\n\n` +
    `Your MarkCMO Academy account is now active.\n\n` +
    (viaMembership ? `You have All-Access Membership${membershipExpires ? ` (renews ${new Date(membershipExpires).toLocaleDateString()})` : ''}.\n\n` : '') +
    `Your courses (${sortedCourses.length}):\n` +
    sortedCourses.map(c => `  • ${c.courseTitle || c.courseId}\n    https://academy.markcmo.com/learn?course=${encodeURIComponent(c.courseId)}&email=${encodeURIComponent(targetEmail)}&token=${encodeURIComponent(accessToken)}`).join('\n') +
    `\n\nView all: ${portalUrl}\n\n— Mark Gabrielli\nmark@markcmo.com\n`;

  // ── Send via Resend ────────────────────────────────────────────────
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Mark Gabrielli <mark@markcmo.com>',
      to: [targetEmail],
      reply_to: 'mark@markcmo.com',
      subject: `Your MarkCMO Academy access (${sortedCourses.length} courses)`,
      html,
      text,
    }),
  });
  const resendData = await resendRes.json().catch(() => ({}));
  if (!resendRes.ok) {
    return { statusCode: resendRes.status, headers: CORS, body: JSON.stringify({ error: 'Resend send failed', detail: resendData }) };
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      ok: true,
      sent_to: targetEmail,
      course_count: sortedCourses.length,
      resend_id: resendData.id,
      preview: { name, viaMembership, membershipExpires, courses: sortedCourses.map(c => c.courseTitle || c.courseId) },
    }),
  };
};
