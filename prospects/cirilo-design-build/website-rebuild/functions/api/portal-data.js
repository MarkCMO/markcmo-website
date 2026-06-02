// GET /api/portal-data - re-fetch the signed-in client's suite for the
// auto-resume path. Reads the x-cdb-portal token (base64 email|client_id|ts),
// looks the client up, and rebuilds the same shape portal-auth returns.
//
// Graceful: any failure returns ok:false 200 so the portal opens its
// Preview Suite rather than erroring.
import { sbSelect, json } from './_lib.js';
import { verifySession } from './_lib_security.js';
import { buildSuite } from './portal-auth.js';

export async function onRequestGet(context) {
  var env = context.env, request = context.request;
  var token = request.headers.get('x-cdb-portal') || cookie(request, 'cdb_portal') || '';
  if (!token || token === 'preview') return json({ ok: false }, 200);

  var sess = await verifySession(env, token);
  if (!sess || sess.role !== 'client' || !sess.id) return json({ ok: false }, 200);
  var clientId = sess.id;

  try {
    var rows = await sbSelect(env, 'cdb_clients?select=*&id=eq.' + clientId + '&limit=1');
    var client = rows && rows[0];
    if (!client) return json({ ok: false }, 200);
    var data = await buildSuite(env, client);
    return json({ ok: true, data: data }, 200);
  } catch (e) {
    return json({ ok: false }, 200);
  }
}

function cookie(request, name) {
  var c = request.headers.get('cookie') || '';
  var m = c.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-portal', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}
