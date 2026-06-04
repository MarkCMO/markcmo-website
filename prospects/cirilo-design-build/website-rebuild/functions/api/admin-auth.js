// POST /api/admin-auth - gate the admin console.
// Verifies email is on the allowlist and password matches CDB_ADMIN_PASS
// (set as a CF Pages secret). Returns a short-lived signed token cookie.
import { json } from './_lib.js';
import { rateLimited, clientIp, signAdmin } from './_lib_security.js';

var ALLOW = ['tiffany@cirilodb.com', 'mark@markcmo.com', 'demo@cirilodb.com'];

export async function onRequestPost(context) {
  var env = context.env;
  // Brute-force guard: max 12 attempts per IP per 10 min (no-op if KV unbound).
  if (await rateLimited(env, 'adminauth:' + clientIp(context.request), 12, 600)) {
    return json({ ok: false, error: 'Too many attempts. Try again later.' }, 429);
  }
  var d;
  try { d = await context.request.json(); } catch (e) { return json({ ok: false }, 400); }
  var email = (d.email || '').trim().toLowerCase();
  if (email === 'demo') email = 'demo@cirilodb.com';
  var pass = d.password || '';

  // Demo admin uses a fixed sandbox password, independent of CDB_ADMIN_PASS.
  if (email === 'demo@cirilodb.com') {
    if (pass !== 'demo123') return json({ ok: false, error: 'invalid' }, 401);
  } else {
    var expected = env.CDB_ADMIN_PASS;
    if (!expected) return json({ ok: false, error: 'auth not configured' }, 503);
    if (ALLOW.indexOf(email) === -1 || pass !== expected) {
      return json({ ok: false, error: 'invalid' }, 401);
    }
  }

  var token = await signAdmin(env, email, 12);
  return new Response(JSON.stringify({ ok: true, email: email, token: token }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'cdb_admin=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200'
    }
  });
}
