// Shared security helpers for Cirilo Pages Functions.
// Honeypot + submit-timing work with zero config. Turnstile activates when
// TURNSTILE_SECRET is set. Rate limiting activates when the CDB_RL KV
// namespace is bound; otherwise it no-ops (fails open, never blocks).

// Hidden honeypot field name the forms include. Bots fill it; humans never see it.
export const HONEYPOT_FIELD = 'company_website';

export function honeypotTripped(d) {
  return !!(d && typeof d[HONEYPOT_FIELD] === 'string' && d[HONEYPOT_FIELD].trim() !== '');
}

// Reject submissions that arrive implausibly fast (bots) when the form stamps
// a render time. d.form_started_at = ms epoch when the form was shown.
export function tooFast(d, minMs) {
  try {
    if (!d || !d.form_started_at) return false; // no stamp -> can't judge, allow
    var elapsed = Date.now() - Number(d.form_started_at);
    return elapsed >= 0 && elapsed < (minMs || 2500);
  } catch (e) { return false; }
}

// Cloudflare Turnstile verification. Returns true when not configured (so the
// site keeps working) and honeypot/timing remain the active defense.
export async function turnstileOk(env, token, ip) {
  if (!env || !env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  try {
    var body = new URLSearchParams();
    body.append('secret', env.TURNSTILE_SECRET);
    body.append('response', token);
    if (ip) body.append('remoteip', ip);
    var r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: body });
    var j = await r.json();
    return !!(j && j.success);
  } catch (e) { return false; }
}

// KV-backed fixed-window rate limiter. key e.g. 'contact:'+ip. Returns true if
// the caller is OVER the limit. No-op (false) when KV is not bound.
export async function rateLimited(env, key, limit, windowSec) {
  if (!env || !env.CDB_RL) return false;
  try {
    var k = 'rl:' + key;
    var cur = await env.CDB_RL.get(k);
    var n = cur ? parseInt(cur, 10) : 0;
    if (n >= limit) return true;
    await env.CDB_RL.put(k, String(n + 1), { expirationTtl: windowSec });
    return false;
  } catch (e) { return false; }
}

// Basic field sanitizer: strip control chars, cap length.
export function clean(v, max) {
  if (v == null) return v;
  var s = String(v).replace(/[\x00-\x1F\x7F]/g, "").trim();
  return s.slice(0, max || 2000);
}

export function clientIp(request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '0.0.0.0';
}

// Validate a value is a real UUID before interpolating it into a PostgREST
// filter (prevents operator injection via body-supplied ids).
export function isUuid(s) {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
// Slug shape used by proposals (lowercase alnum + hyphen).
export function isSlug(s) {
  return typeof s === 'string' && /^[a-z0-9-]{1,60}$/.test(s);
}

// ── HMAC-signed admin session tokens (replaces the forgeable '@' check) ──
function b64url(s) { return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function fromB64url(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return atob(s); }

async function hmacHex(secret, msg) {
  var key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  var sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  var b = new Uint8Array(sig), h = '';
  for (var i = 0; i < b.length; i++) h += b[i].toString(16).padStart(2, '0');
  return h;
}
function adminSecret(env) { return env.ADMIN_SESSION_SECRET || env.CDB_ADMIN_PASS || ''; }

export async function signAdmin(env, email, hours) {
  var secret = adminSecret(env); if (!secret) return null;
  var exp = Date.now() + (hours || 12) * 3600 * 1000;
  var payload = email + '|' + exp;
  return b64url(payload) + '.' + (await hmacHex(secret, payload));
}

// Returns the admin email if the token is valid + unexpired, else null.
export async function verifyAdmin(env, token) {
  try {
    var secret = adminSecret(env); if (!secret || !token) return null;
    var dot = token.lastIndexOf('.'); if (dot < 1) return null;
    var payload = fromB64url(token.slice(0, dot));
    var sig = token.slice(dot + 1);
    var parts = payload.split('|'); var email = parts[0], exp = +parts[1];
    if (!email || !exp || Date.now() > exp) return null;
    var expect = await hmacHex(secret, payload);
    if (expect.length !== sig.length || expect !== sig) return null;
    return email;
  } catch (e) { return null; }
}

export async function guardAdmin(env, request) {
  return !!(await verifyAdmin(env, request.headers.get('x-cdb-admin') || ''));
}

// ── Signed scoped sessions for homeowner (client) + vendor portals ──
// payload = role|id|exp  (role: client / admin / vendor / vadmin)
export async function signSession(env, role, id, hours) {
  var secret = adminSecret(env); if (!secret) return null;
  var exp = Date.now() + (hours || 12) * 3600 * 1000;
  var payload = role + '|' + (id || '') + '|' + exp;
  return b64url(payload) + '.' + (await hmacHex(secret, payload));
}

export async function verifySession(env, token) {
  try {
    var secret = adminSecret(env); if (!secret || !token) return null;
    var dot = token.lastIndexOf('.'); if (dot < 1) return null;
    var payload = fromB64url(token.slice(0, dot));
    var sig = token.slice(dot + 1);
    var p = payload.split('|'); var role = p[0], id = p[1], exp = +p[2];
    if (!role || !exp || Date.now() > exp) return null;
    var expect = await hmacHex(secret, payload);
    if (expect.length !== sig.length || expect !== sig) return null;
    return { role: role, id: id || null };
  } catch (e) { return null; }
}
