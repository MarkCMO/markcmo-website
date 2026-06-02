// GET /api/qbo-connect - admin starts the QuickBooks OAuth flow.
// Returns { ok, url } with the Intuit authorize URL (state = signed admin token).
// The admin console redirects the browser to that URL.
import { json } from './_lib.js';
import { guardAdmin, signAdmin } from './_lib_security.js';
import { qboConfig, qboRedirectUri } from './_lib_qbo.js';

export async function onRequestGet(context) {
  var env = context.env, request = context.request;
  if (!(await guardAdmin(env, request))) return json({ ok: false, error: 'unauthorized' }, 401);
  var cfg = qboConfig(env);
  if (!cfg) return json({ ok: false, error: 'not_configured', note: 'Set CDB_QBO_CLIENT_ID and CDB_QBO_CLIENT_SECRET.' }, 200);
  var redirectUri = qboRedirectUri(env, request);
  if (!redirectUri) return json({ ok: false, error: 'no_redirect_uri' }, 200);

  var state = await signAdmin(env, 'qbo-oauth', 1); // 1h signed state, verified on callback
  var url = cfg.authUrl +
    '?client_id=' + encodeURIComponent(cfg.clientId) +
    '&response_type=code' +
    '&scope=' + encodeURIComponent(cfg.scope) +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&state=' + encodeURIComponent(state);
  return json({ ok: true, url: url }, 200);
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-admin', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}
