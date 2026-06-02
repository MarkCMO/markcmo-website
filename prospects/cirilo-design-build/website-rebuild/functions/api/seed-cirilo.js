// POST /api/seed-cirilo - one-time showcase seed for go-live testing.
// Admin-guarded (x-cdb-admin contains '@') and requires { confirm:"SEED" }.
// Idempotent: re-running will not duplicate rows. Requires the schema to be
// applied and MARKCMO_SUPABASE_SERVICE_KEY to be set.
import { sb, sbSelect, sbInsert, json } from './_lib.js';

import { guardAdmin } from './_lib_security.js';

export async function onRequestPost(context) {
  var env = context.env, request = context.request;
  if (!(await guardAdmin(env, request))) return json({ ok: false, error: 'unauthorized' }, 401);
  var d = {}; try { d = await request.json(); } catch (e) {}
  if (d.confirm !== 'SEED') return json({ ok: false, error: 'pass {confirm:"SEED"} to proceed' }, 400);

  var c = sb(env);
  if (!c) return json({ ok: false, error: 'Supabase not connected (set MARKCMO_SUPABASE_SERVICE_KEY)' }, 200);

  var created = {};
  try {
    // Client (idempotent by email).
    var email = 'james@harrington.example';
    var rows = await sbSelect(env, 'cdb_clients?select=*&email=ilike.' + encodeURIComponent(email) + '&limit=1');
    var client = rows && rows[0];
    if (!client) {
      client = await sbInsert(env, 'cdb_clients', { name: 'The Harrington Residence', email: email, phone: '7045550000', neighborhood: 'Myers Park, Charlotte', portal_code: 'HARRY1', referral_code: 'HARR4821', status: 'active' });
      created.client = true;
    }

    // Project.
    var projs = await sbSelect(env, 'cdb_projects?select=id&client_id=eq.' + client.id + '&limit=1');
    var proj = projs && projs[0];
    if (!proj) {
      proj = await sbInsert(env, 'cdb_projects', { client_id: client.id, name: 'Myers Park Vanishing Edge', project_type: 'Custom Pool', pool_type: 'Vanishing-Edge Gunite', contract_value: 312000, stage: 'shotcrete', stage_index: 8, start_date: '2026-04-15', target_complete: '2026-08-15' });
      created.project = true;
      await sbInsert(env, 'cdb_project_events', { project_id: proj.id, event: 'stage_advanced', from_stage: 'inspections', to_stage: 'shotcrete', detail: { note: 'Shotcrete shell applied' } });
      await sbInsert(env, 'cdb_documents', { project_id: proj.id, client_id: client.id, doc_type: 'contract', doc_name: 'Construction Agreement', status: 'executed', signed_at: new Date().toISOString(), amount_usd: 312000 });
    }

    // Vendors.
    var defs = [['Apex Gunite Co.', 'Gunite', 'ops@apexgunite.example', 'APEX01'], ['Carolina Tile & Stone', 'Tile & Coping', 'hello@cltile.example', 'TILE01']];
    var vendorIds = [];
    for (var i = 0; i < defs.length; i++) {
      var v = defs[i];
      var vr = await sbSelect(env, 'cdb_vendors?select=id&email=ilike.' + encodeURIComponent(v[2]) + '&limit=1');
      var vendor = vr && vr[0];
      if (!vendor) { vendor = await sbInsert(env, 'cdb_vendors', { name: v[0], company: v[0], trade: v[1], email: v[2], portal_code: v[3], status: 'active' }); created['vendor_' + i] = true; }
      vendorIds.push(vendor.id);
    }

    // Assignment (gunite vendor on this project).
    var asg = await sbSelect(env, 'cdb_vendor_assignments?select=id&project_id=eq.' + proj.id + '&vendor_id=eq.' + vendorIds[0] + '&limit=1');
    if (!(asg && asg[0])) {
      await sbInsert(env, 'cdb_vendor_assignments', { project_id: proj.id, vendor_id: vendorIds[0], stage: 'shotcrete', scope: 'Gunite shell incl. vanishing-edge wall', amount_usd: 54000, status: 'in_progress', due_date: '2026-06-18', pay_status: 'unpaid' });
      created.assignment = true;
    }

    // Open job + a bid from the tile vendor.
    var jr = await sbSelect(env, 'cdb_jobs?select=id&project_id=eq.' + proj.id + '&limit=1');
    var job = jr && jr[0];
    if (!job) {
      job = await sbInsert(env, 'cdb_jobs', { project_id: proj.id, title: 'Decking & hardscape', trade: 'Decking', stage: 'decking', scope: 'Travertine deck, approx 900 sq ft', budget_usd: 38000, status: 'open', bid_deadline: '2026-06-30' });
      await sbInsert(env, 'cdb_bids', { job_id: job.id, vendor_id: vendorIds[1], amount_usd: 36500, timeline: '8 working days', status: 'submitted' });
      created.job = true;
    }

    return json({ ok: true, created: created, client_id: client.id, project_id: proj.id, owner_login: email + ' / HARRY1', referral_code: 'HARR4821' }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 200);
  }
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-admin', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}
