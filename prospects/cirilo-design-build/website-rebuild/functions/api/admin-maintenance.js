// POST /api/admin-maintenance - admin-only housekeeping.
//   { op:'purge_events', days }  delete raw analytics events older than N days
//                                (default 180) for data-retention hygiene.
//   { op:'stats' }               counts of rows in the high-churn tables.
// Admin only. Graceful demo when Supabase is unset.
import { sb, json } from './_lib.js';
import { guardAdmin } from './_lib_security.js';

async function countRows(c, table) {
  try {
    var r = await fetch(c.url + '/rest/v1/' + table + '?select=id', {
      method: 'HEAD', headers: { apikey: c.key, Authorization: 'Bearer ' + c.key, Prefer: 'count=exact', Range: '0-0' }
    });
    var cr = r.headers.get('content-range') || '';
    var n = cr.split('/')[1];
    return n && n !== '*' ? +n : null;
  } catch (e) { return null; }
}

export async function onRequestPost(context) {
  var env = context.env, request = context.request;
  if (!(await guardAdmin(env, request))) return json({ ok: false, error: 'unauthorized' }, 401);
  var d; try { d = await request.json(); } catch (e) { return json({ ok: false }, 400); }

  var c = sb(env);
  if (!c) return json({ ok: true, demo: true, note: 'Supabase not connected' }, 200);

  if (d.op === 'purge_events') {
    var days = parseInt(d.days, 10);
    if (!(days >= 30 && days <= 3650)) days = 180; // sane floor of 30d, default 180d
    var cutoff = new Date(Date.now() - days * 864e5).toISOString();
    try {
      var del = await fetch(c.url + '/rest/v1/cdb_events?created_at=lt.' + encodeURIComponent(cutoff), {
        method: 'DELETE', headers: { apikey: c.key, Authorization: 'Bearer ' + c.key, Prefer: 'return=representation' }
      });
      if (!del.ok) throw new Error('purge ' + del.status);
      var removed = await del.json();
      return json({ ok: true, removed: Array.isArray(removed) ? removed.length : 0, days: days, cutoff: cutoff }, 200);
    } catch (e) { return json({ ok: false, error: String(e.message || e) }, 200); }
  }

  if (d.op === 'stats') {
    var stats = {};
    stats.events = await countRows(c, 'cdb_events');
    stats.leads = await countRows(c, 'cdb_leads');
    stats.email_log = await countRows(c, 'cdb_email_log');
    stats.documents = await countRows(c, 'cdb_documents');
    return json({ ok: true, stats: stats }, 200);
  }

  return json({ ok: false, error: 'unknown op' }, 400);
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-admin', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}
