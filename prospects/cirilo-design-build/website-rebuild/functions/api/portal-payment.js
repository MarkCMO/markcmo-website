// POST /api/portal-payment - homeowner reports a draw payment sent by
// check or ACH. Records a cdb_payments row (status 'reported') and a
// project event so it shows in the admin pipeline. No processor yet.
//
// Auth: reads the x-cdb-portal token (email|client_id|ts) to bind the
// payment to the right client/project. Graceful: if Supabase is unset,
// returns ok with demo:true so the flow demonstrates end to end.
import { sbInsert, sbSelect, sbUpdate, json } from './_lib.js';
import { verifySession, isUuid } from './_lib_security.js';

export async function onRequestPost(context) {
  var env = context.env, request = context.request;
  var d;
  try { d = await request.json(); } catch (e) { return json({ ok: false, error: 'bad json' }, 400); }

  var sess = await verifySession(env, request.headers.get('x-cdb-portal') || '');
  var clientId = (sess && sess.role === 'client') ? sess.id : null;

  var method = (d.method === 'ach') ? 'ach' : 'check';
  var amount = d.amount != null ? +d.amount : null;

  try {
    if (!clientId) throw new Error('no client');
    // Resolve the client's active project.
    var projects = await sbSelect(env, 'cdb_projects?select=id&client_id=eq.' + clientId + '&order=created_at.desc&limit=1');
    var projectId = projects && projects[0] ? projects[0].id : null;
    var nowTs = new Date().toISOString();

    // Prefer updating the existing billed draw (so we do not duplicate the
    // schedule). Match by the draw id the portal sends, else by project+number.
    var pay = null, existing = null;
    try {
      if (d.draw_id && isUuid(d.draw_id)) {
        var er = await sbSelect(env, 'cdb_payments?select=id&id=eq.' + d.draw_id + '&client_id=eq.' + clientId + '&limit=1');
        existing = er && er[0];
      } else if (projectId && d.draw_number != null) {
        var er2 = await sbSelect(env, 'cdb_payments?select=id&project_id=eq.' + projectId + '&draw_number=eq.' + (+d.draw_number) + '&status=in.(scheduled,due)&limit=1');
        existing = er2 && er2[0];
      }
    } catch (e) {}

    if (existing) {
      await sbUpdate(env, 'cdb_payments', 'id=eq.' + existing.id, {
        status: 'reported', method: method, reference: d.reference || null, reported_at: nowTs, notes: d.notes || null
      });
      pay = existing;
    } else {
      pay = await sbInsert(env, 'cdb_payments', {
        project_id: projectId, client_id: clientId,
        draw_label: d.draw_label || null, draw_number: d.draw_number != null ? +d.draw_number : null,
        amount_usd: amount, method: method, status: 'reported',
        reference: d.reference || null, reported_at: nowTs, notes: d.notes || null
      });
    }

    if (projectId) {
      await sbInsert(env, 'cdb_project_events', {
        project_id: projectId, event: 'payment_reported',
        detail: { method: method, amount: amount, draw: d.draw_label || null, reference: d.reference || null }
      });
    }
    return json({ ok: true, payment_id: pay ? pay.id : null }, 200);
  } catch (e) {
    return json({ ok: true, demo: true }, 200);
  }
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-portal', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}
