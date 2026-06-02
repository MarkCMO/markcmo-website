// GET /api/health - lightweight health probe for uptime monitors and the
// admin status indicator. Reports which subsystems are connected without
// leaking secrets. Always returns 200 so a monitor can read the JSON body;
// overall.ok reflects whether the core (Supabase) is reachable.
import { sb, json } from './_lib.js';
import { qboConfig, getConnection } from './_lib_qbo.js';

export async function onRequestGet(context) {
  var env = context.env;
  var checks = {
    supabase: false,
    storage: !!sb(env),       // configured (bucket reachability not probed here)
    rate_limit_kv: !!env.CDB_RL,
    email_configured: !!env.RESEND_API_KEY,
    turnstile_configured: !!env.TURNSTILE_SECRET,
    quickbooks_configured: !!qboConfig(env),
    quickbooks_connected: false
  };
  try { var qc = qboConfig(env) ? await getConnection(env) : null; checks.quickbooks_connected = !!(qc && qc.status === 'connected' && qc.access_token); } catch (e) {}

  var c = sb(env);
  if (c) {
    try {
      // Cheap reachability check against PostgREST.
      var r = await fetch(c.url + '/rest/v1/cdb_clients?select=id&limit=1', {
        headers: { apikey: c.key, Authorization: 'Bearer ' + c.key }
      });
      checks.supabase = r.ok;
    } catch (e) { checks.supabase = false; }
  }

  var ok = checks.supabase || !c; // ok if DB reachable, or intentionally in demo mode
  return json({ ok: ok, mode: c ? 'live' : 'demo', checks: checks, ts: new Date().toISOString() }, 200);
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}
