// POST /api/qbo-sync - push billing + vendor data to QuickBooks Online.
//   AR: { op:'sync_draw', payment_id } | { op:'sync_all' }
//   AP: { op:'sync_vendor_assignment', assignment_id } | { op:'sync_vendors_all' }
// Admin only. Idempotent via the qbo_* mapping columns.
import { sb, sbSelect, json } from './_lib.js';
import { guardAdmin, isUuid } from './_lib_security.js';
import { qboConfig, getConnection, freshConnection, syncDraw, syncVendorAssignment } from './_lib_qbo.js';

export async function onRequestPost(context) {
  var env = context.env, request = context.request;
  if (!(await guardAdmin(env, request))) return json({ ok: false }, 401);
  var d; try { d = await request.json(); } catch (e) { return json({ ok: false }, 400); }

  var cfg = qboConfig(env);
  if (!cfg) return json({ ok: false, error: 'not_configured' }, 200);
  if (!sb(env)) return json({ ok: true, demo: true }, 200);
  var conn = await getConnection(env);
  if (!conn || conn.status !== 'connected') return json({ ok: false, error: 'not_connected' }, 200);
  try { conn = await freshConnection(env, cfg, conn); }
  catch (e) { return json({ ok: false, error: 'token_refresh_failed' }, 200); }

  try {
    // ── AR: customer draws ──
    if (d.op === 'sync_draw') {
      if (!isUuid(d.payment_id)) return json({ ok: false, error: 'bad id' }, 400);
      var rows = await sbSelect(env, 'cdb_payments?select=*&id=eq.' + d.payment_id + '&limit=1');
      var pay = rows && rows[0];
      if (!pay) return json({ ok: false, error: 'not_found' }, 404);
      var res = await syncDraw(env, cfg, conn, pay);
      return json({ ok: res.ok, result: res }, 200);
    }
    if (d.op === 'sync_all') {
      var pays = await sbSelect(env, 'cdb_payments?select=*&status=in.(due,reported,received,cleared)&order=created_at.asc&limit=50');
      var results = [];
      for (var i = 0; i < pays.length; i++) {
        try { results.push(await syncDraw(env, cfg, conn, pays[i])); }
        catch (e) { results.push({ id: pays[i].id, ok: false, error: String(e.message || e).slice(0, 120) }); }
      }
      return json({ ok: true, synced: results.filter(function (r) { return r.ok; }).length, total: results.length, results: results }, 200);
    }

    // ── AP: vendor assignments (paid) ──
    if (d.op === 'sync_vendor_assignment') {
      if (!isUuid(d.assignment_id)) return json({ ok: false, error: 'bad id' }, 400);
      var arows = await sbSelect(env, 'cdb_vendor_assignments?select=*&id=eq.' + d.assignment_id + '&limit=1');
      var a = arows && arows[0];
      if (!a) return json({ ok: false, error: 'not_found' }, 404);
      try {
        var ares = await syncVendorAssignment(env, cfg, conn, a);
        return json({ ok: ares.ok, result: ares }, 200);
      } catch (e) {
        var msg = String(e.message || e);
        return json({ ok: false, error: msg.indexOf('needs_account_config') > -1 ? 'needs_account_config' : msg.slice(0, 150) }, 200);
      }
    }
    if (d.op === 'sync_vendors_all') {
      var assigns = await sbSelect(env, 'cdb_vendor_assignments?select=*&pay_status=eq.paid&order=created_at.asc&limit=50');
      var vresults = [], needsCfg = false;
      for (var j = 0; j < assigns.length; j++) {
        try { vresults.push(await syncVendorAssignment(env, cfg, conn, assigns[j])); }
        catch (e2) { var m = String(e2.message || e2); if (m.indexOf('needs_account_config') > -1) needsCfg = true; vresults.push({ id: assigns[j].id, ok: false, error: m.slice(0, 120) }); }
      }
      if (needsCfg && !vresults.some(function (r) { return r.ok; })) return json({ ok: false, error: 'needs_account_config' }, 200);
      return json({ ok: true, synced: vresults.filter(function (r) { return r.ok; }).length, total: vresults.length, results: vresults }, 200);
    }

    return json({ ok: false, error: 'unknown op' }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e.message || e).slice(0, 200) }, 200);
  }
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-admin', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}
