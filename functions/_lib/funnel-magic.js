// functions/_lib/funnel-magic.js
// ─────────────────────────────────────────────────────────────────────────────
// Stateless 6-digit magic-code auth for the client portal, mirroring the
// existing ach-request-code / ach-instructions pattern (HMAC over TOKEN_SECRET,
// no database). The code is emailed to the client and never returned to the
// browser; the token carries email + expiry + HMAC so the verify step can
// confirm the code without server-side state.
// Web Crypto (Cloudflare Workers), not node:crypto.
// ─────────────────────────────────────────────────────────────────────────────

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function makeCode() {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(100000 + (n[0] % 900000)); // 6 digits
}

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function b64url(s) {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return atob(s);
}

// Returns a token binding email+exp to the code (code stays secret in email).
export async function issueToken(secret, email, code) {
  const exp = Date.now() + CODE_TTL_MS;
  const sig = await hmacHex(secret, `${email}|${exp}|${code}`);
  return b64url(`${email}|${exp}|${sig}`);
}

// Verifies the submitted code against the token. Returns { ok, email } or { ok:false, error }.
export async function verifyToken(secret, token, code) {
  let parts;
  try { parts = unb64url(String(token || '')).split('|'); } catch (_) { return { ok: false, error: 'bad_token' }; }
  if (parts.length !== 3) return { ok: false, error: 'bad_token' };
  const [email, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!exp || Date.now() > exp) return { ok: false, error: 'expired' };
  const expect = await hmacHex(secret, `${email}|${exp}|${String(code || '').trim()}`);
  if (!timingSafeEqual(expect, sig)) return { ok: false, error: 'bad_code' };
  return { ok: true, email };
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// The remittance (wire/ACH) details, read from the same REMIT_* env vars the
// existing /ach-instructions page uses. Only surfaced to a code-authenticated
// client who has signed.
export function remitDetails(env) {
  const v = (x) => (x && String(x).trim() ? String(x).trim() : null);
  const d = {
    bank_name: v(env.REMIT_BANK_NAME),
    bank_address: v(env.REMIT_BANK_ADDRESS),
    beneficiary: v(env.REMIT_BENEFICIARY_NAME),
    ach_routing: v(env.REMIT_ACH_ROUTING),
    wire_routing: v(env.REMIT_WIRE_ROUTING),
    account_number: v(env.REMIT_ACCOUNT_NUMBER),
    account_type: v(env.REMIT_ACCOUNT_TYPE),
    swift: v(env.REMIT_SWIFT),
    memo: v(env.REMIT_MEMO_INSTRUCTIONS) || 'Include your company name and invoice number in the transfer memo.',
  };
  d.configured = !!(d.ach_routing || d.account_number || d.wire_routing);
  d.has_wire = !!d.wire_routing;
  return d;
}
