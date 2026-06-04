// POST /api/qbo-disconnect - admin disconnects QuickBooks. Best-effort token
// revoke at Intuit, then removes the stored connection.
import { json } from './_lib.js';
import { guardAdmin } from './_lib_security.js';
import { qboConfig, getConnection, deleteConnection } from './_lib_qbo.js';

export async function onRequestPost(context) {
  var env = context.env, request = context.request;
  if (!(await guardAdmin(env, request))) return json({ ok: false }, 401);
  var cfg = qboConfig(env);
  var conn = cfg ? await getConnection(env) : null;
  if (cfg && conn && conn.refresh_token) {
    try {
      var basic = btoa(cfg.clientId + ':' + cfg.clientSecret);
      await fetch(cfg.revokeUrl, {
        method: 'POST',
        headers: { Authorization: 'Basic ' + basic, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ token: conn.refresh_token })
      });
    } catch (e) {}
  }
  await deleteConnection(env);
  return json({ ok: true }, 200);
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-admin', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}
