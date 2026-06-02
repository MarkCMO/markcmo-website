// POST /api/uptime-record - the monitor worker reports a health check result
// here; we append it to cdb_uptime. Protected by a shared secret when set.
import { sb, json } from './_lib.js';

export async function onRequestPost(context) {
  var env = context.env, request = context.request;
  var secret = env.CDB_MONITOR_SECRET;
  if (secret) {
    var auth = request.headers.get('x-cdb-monitor') || '';
    if (auth !== secret) return json({ ok: false, error: 'unauthorized' }, 401);
  }
  var d; try { d = await request.json(); } catch (e) { return json({ ok: false }, 400); }
  var c = sb(env);
  if (!c) return json({ ok: true, demo: true }, 200);
  try {
    await fetch(c.url + '/rest/v1/cdb_uptime', {
      method: 'POST',
      headers: { apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ ok: !!d.ok, mode: d.mode || null, latency_ms: d.latency_ms != null ? +d.latency_ms : null, detail: d.detail || null })
    });
    return json({ ok: true }, 200);
  } catch (e) { return json({ ok: true, demo: true }, 200); }
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-monitor', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}
