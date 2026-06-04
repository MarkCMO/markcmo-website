// ach-request-code.js
// Step 1 of the code-gated ACH/wire reveal: the client enters their email,
// we generate a 6-digit code, email it to them, and return a stateless signed
// token (HMAC of email|exp|code with TOKEN_SECRET). The code itself is NEVER
// returned to the browser; only the email recipient sees it. Verified in
// ach-instructions.js. No database needed.
'use strict';
const crypto = require('crypto');

function b64url(str) {
  return Buffer.from(str, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'bad request' }) }; }

  const email = (body.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Please enter a valid email address.' }) };
  }

  const secret = process.env.TOKEN_SECRET;
  if (!secret) return { statusCode: 503, headers, body: JSON.stringify({ ok: false, error: 'Not configured.' }) };

  // Optional allowlist: if REMIT_ALLOWED_EMAILS is set, only those emails may request.
  const allow = (process.env.REMIT_ALLOWED_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (allow.length && !allow.includes(email)) {
    return { statusCode: 403, headers, body: JSON.stringify({ ok: false, error: 'This email is not authorized for these instructions. Contact mark@markcmo.com.' }) };
  }

  // 6-digit code + 10-minute stateless signed token.
  const code = String(100000 + (crypto.randomBytes(4).readUInt32BE(0) % 900000));
  const exp = Date.now() + 10 * 60 * 1000;
  const sig = crypto.createHmac('sha256', secret).update(`${email}|${exp}|${code}`).digest('hex');
  const token = b64url(`${email}|${exp}|${sig}`);

  // Email the code via Resend.
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'WETYR Corporation <invoices@markcmo.com>',
        to: [email],
        subject: 'Your WETYR payment instructions access code',
        text: `Your access code is ${code}\n\nIt expires in 10 minutes. Enter it on the payment instructions page to view the ACH and wire transfer details.\n\nIf you did not request this, you can ignore this email.`,
        html: `<div style="font-family:Arial,sans-serif;color:#1E293B;"><p>Your access code is:</p><p style="font-size:30px;font-weight:800;letter-spacing:6px;color:#0A1628;">${code}</p><p>It expires in 10 minutes. Enter it on the payment instructions page to view the ACH and wire transfer details.</p><p style="color:#94A3B8;font-size:12px;">If you did not request this, you can ignore this email.</p></div>`,
      }),
    });
    if (!r.ok) {
      return { statusCode: 502, headers, body: JSON.stringify({ ok: false, error: 'Could not send the code email. Please try again.' }) };
    }
  } catch (e) {
    return { statusCode: 502, headers, body: JSON.stringify({ ok: false, error: 'Email delivery failed. Please try again.' }) };
  }

  const masked = email.replace(/^(.).*(@.*)$/, '$1***$2');
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, token, masked }) };
};
