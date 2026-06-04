// ach-instructions.js
// Step 2 of the code-gated ACH/wire reveal: client submits the signed token
// (from ach-request-code) plus the 6-digit code they received by email. We
// recompute the HMAC; if it matches and is not expired, we return the bank
// details from encrypted env (REMIT_*). Details never live in the page or repo.
'use strict';
const crypto = require('crypto');

function fromB64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString('utf8');
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

  const secret = process.env.TOKEN_SECRET;
  if (!secret) return { statusCode: 503, headers, body: JSON.stringify({ ok: false, error: 'Not configured.' }) };

  const code = (body.code || '').trim();
  let email, exp, sig;
  try { [email, exp, sig] = fromB64url(body.token || '').split('|'); }
  catch (e) { return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Invalid session. Request a new code.' }) }; }
  if (!email || !exp || !sig) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Invalid session. Request a new code.' }) };

  if (Date.now() > Number(exp)) {
    return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: 'Your code expired. Request a new one.' }) };
  }

  const expect = crypto.createHmac('sha256', secret).update(`${email}|${exp}|${code}`).digest('hex');
  let valid = false;
  try { valid = expect.length === sig.length && crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(sig)); } catch (e) { valid = false; }
  if (!valid) {
    await new Promise(r => setTimeout(r, 600));
    return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: 'That code is not correct. Check your email or request a new code.' }) };
  }

  // Treat unset OR the "REPLACE_IN_DASHBOARD" placeholder as blank, so the page
  // can cleanly hide anything not provided (e.g. wire details).
  const val = (v) => { v = (v == null ? '' : String(v)).trim(); return (v && v.toUpperCase() !== 'REPLACE_IN_DASHBOARD') ? v : ''; };
  const details = {
    bank_name: val(process.env.REMIT_BANK_NAME),
    bank_address: val(process.env.REMIT_BANK_ADDRESS),
    beneficiary: val(process.env.REMIT_BENEFICIARY_NAME),
    ach_routing: val(process.env.REMIT_ACH_ROUTING),
    wire_routing: val(process.env.REMIT_WIRE_ROUTING),
    account_number: val(process.env.REMIT_ACCOUNT_NUMBER),
    account_type: val(process.env.REMIT_ACCOUNT_TYPE),
    swift: val(process.env.REMIT_SWIFT),
    memo: val(process.env.REMIT_MEMO_INSTRUCTIONS) || 'Include the invoice number in the transfer memo.',
  };
  const has_wire = !!details.wire_routing;
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, details, has_wire }) };
};
