// /api/funnel/portal-code   (POST { email })
// Step 1 of the magic-code client portal: look up the prospect by email, email
// them a 6-digit code, and return a stateless signed token. The code is never
// returned to the browser. Verified in /api/funnel/portal.
import { makeCode, issueToken } from '../../_lib/funnel-magic.js';
import { sbSelect, safeAudit, parseBody, json, cors, validEmail } from '../../_lib/funnel-db.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return cors();
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!env.TOKEN_SECRET) return json(503, { error: 'not_configured' });

  const payload = await parseBody(request);
  const email = String(payload?.email || '').trim().toLowerCase();
  if (!validEmail(email)) return json(400, { error: 'invalid_email' });

  // Only issue a code if this email belongs to a known prospect. Respond the
  // same either way so we do not leak who is in the funnel.
  let prospect = null;
  try {
    const rows = await sbSelect(env, 'mcf_prospects', `select=id,full_name&email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=1`);
    prospect = rows?.[0] || null;
  } catch (_) {}

  if (prospect && env.RESEND_API_KEY) {
    const code = makeCode();
    const token = await issueToken(env.TOKEN_SECRET, email, code);
    await emailCode(env, email, prospect.full_name, code).catch((e) => safeAudit(env, 'portal_code_email_failed', { error: String(e) }));
    return json(200, { ok: true, token, sent: true });
  }

  // Unknown email: return ok with no token so the UI shows the same "check your
  // email" message without revealing membership.
  return json(200, { ok: true, sent: false });
}

async function emailCode(env, email, name, code) {
  const first = (name || '').trim().split(/\s+/)[0] || 'there';
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
<p>Hi ${esc(first)},</p>
<p>Your client portal code is <strong style="font-size:20px;letter-spacing:3px;">${esc(code)}</strong></p>
<p>Enter it on the page to see your plan, your agreements, and your payment instructions. It expires in 10 minutes.</p>
<p>- Mark</p>
</body></html>`;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Mark Gabrielli <mark@markcmo.com>', to: [email], reply_to: 'mark@markcmo.com', subject: `Your MarkCMO portal code: ${code}`, html, tags: [{ name: 'category', value: 'funnel_portal_code' }] }),
  });
}

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
