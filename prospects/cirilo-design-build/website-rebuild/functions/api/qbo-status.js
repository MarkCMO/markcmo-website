// GET /api/qbo-status - admin view of the QuickBooks connection.
// Reports configured (creds present), connected (tokens stored), mode, company.
import { json } from './_lib.js';
import { guardAdmin } from './_lib_security.js';
import { qboConfig, getConnection, freshConnection, qboApi } from './_lib_qbo.js';

export async function onRequestGet(context) {
  var env = context.env, request = context.request;
  if (!(await guardAdmin(env, request))) return json({ ok: false, error: 'unauthorized' }, 401);
  var cfg = qboConfig(env);
  var configured = !!cfg;
  var conn = configured ? await getConnection(env) : null;
  var out = {
    ok: true, configured: configured, connected: !!(conn && conn.status === 'connected' && conn.access_token),
    mode: cfg ? cfg.mode : null, realm_id: conn ? conn.realm_id : null,
    connected_at: conn ? conn.connected_at : null, token_expires_at: conn ? conn.token_expires_at : null,
    company: (conn && conn.meta && conn.meta.company) || null
  };
  // Best-effort live probe for company name (also validates the token).
  if (out.connected) {
    try {
      var fresh = await freshConnection(env, cfg, conn);
      out.token_expires_at = fresh.token_expires_at;
      var info = await qboApi(cfg, fresh, '/companyinfo/' + fresh.realm_id, 'GET');
      out.company = (info && info.CompanyInfo && info.CompanyInfo.CompanyName) || out.company;
    } catch (e) { out.token_ok = false; }
  }
  return json(out, 200);
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-admin', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}
