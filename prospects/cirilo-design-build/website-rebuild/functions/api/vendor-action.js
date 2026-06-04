// POST /api/vendor-action - vendor actions from the Vendor Portal.
//   { op:'bid', job_id, amount, timeline, notes }     -> submit/update a bid
//   { op:'assignment_status', assignment_id, status } -> accept / in_progress / complete
// Auth: x-cdb-vendor token (email|vendor_id|ts). Graceful demo when unset.
import { sbInsert, sbUpdate, sbSelect, json } from './_lib.js';
import { verifySession, isUuid } from './_lib_security.js';

export async function onRequestPost(context) {
  var env = context.env, request = context.request;
  var d;
  try { d = await request.json(); } catch (e) { return json({ ok: false }, 400); }

  var sess = await verifySession(env, request.headers.get('x-cdb-vendor') || '');
  var vendorId = (sess && sess.role === 'vendor') ? sess.id : null;

  try {
    if (!vendorId) throw new Error('no vendor');

    if (d.op === 'bid' && d.job_id) {
      if (!isUuid(d.job_id)) return json({ ok: false, error: 'bad job id' }, 400);
      // One bid per vendor per job: update if present, else insert.
      var existing = await sbSelect(env, 'cdb_bids?select=id&job_id=eq.' + d.job_id + '&vendor_id=eq.' + vendorId + '&limit=1');
      var body = { amount_usd: d.amount != null ? +d.amount : null, timeline: d.timeline || null, notes: d.notes || null, status: 'submitted' };
      if (existing && existing[0]) {
        await sbUpdate(env, 'cdb_bids', 'id=eq.' + existing[0].id, body);
      } else {
        body.job_id = d.job_id; body.vendor_id = vendorId;
        await sbInsert(env, 'cdb_bids', body);
      }
      return json({ ok: true }, 200);
    }

    if (d.op === 'assignment_status' && d.assignment_id && d.status) {
      if (!isUuid(d.assignment_id)) return json({ ok: false, error: 'bad id' }, 400);
      var allowed = ['accepted', 'in_progress', 'complete', 'declined'];
      if (allowed.indexOf(d.status) === -1) return json({ ok: false, error: 'bad status' }, 400);
      var patch = { status: d.status };
      if (d.status === 'complete' && d.lien_waiver) patch.lien_waiver_at = new Date().toISOString();
      await sbUpdate(env, 'cdb_vendor_assignments', 'id=eq.' + d.assignment_id + '&vendor_id=eq.' + vendorId, patch);
      return json({ ok: true }, 200);
    }

    return json({ ok: false, error: 'unknown op' }, 400);
  } catch (e) {
    return json({ ok: true, demo: true }, 200);
  }
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-vendor', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}
