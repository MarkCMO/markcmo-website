// POST /api/seed-demo - creates the demo sandbox accounts for auditing.
// Admin-guarded + requires { confirm:"DEMO" }. Idempotent (keyed by email).
// Demo client (Owner Suite) and demo vendor (Vendor Portal) both log in with
//   email: demo@cirilodb.com   code: demo123
import { sb, sbSelect, sbInsert, json } from './_lib.js';
import { guardAdmin } from './_lib_security.js';

var IMG = [
  'https://images.unsplash.com/photo-1572331165267-854da2b10ccc?w=1200&q=70',
  'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=1200&q=70',
  'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=1200&q=70'
];

export async function onRequestPost(context) {
  var env = context.env, request = context.request;
  if (!(await guardAdmin(env, request))) return json({ ok: false, error: 'unauthorized' }, 401);
  var d = {}; try { d = await request.json(); } catch (e) {}
  if (d.confirm !== 'DEMO') return json({ ok: false, error: 'pass {confirm:"DEMO"} to proceed' }, 400);
  if (!sb(env)) return json({ ok: false, error: 'Supabase not connected' }, 200);

  var made = {};
  try {
    var EMAIL = 'demo@cirilodb.com', CODE = 'demo123';

    // ── Demo client ──
    var rows = await sbSelect(env, 'cdb_clients?select=*&email=ilike.' + encodeURIComponent(EMAIL) + '&limit=1');
    var client = rows && rows[0];
    if (!client) {
      client = await sbInsert(env, 'cdb_clients', { name: 'Demo Owner (Sandbox)', email: EMAIL, phone: '7045550123', neighborhood: 'SouthPark, Charlotte', portal_code: CODE, referral_code: 'DEMO2026', status: 'active' });
      made.client = true;
    }

    // ── Demo project ──
    var projs = await sbSelect(env, 'cdb_projects?select=*&client_id=eq.' + client.id + '&limit=1');
    var proj = projs && projs[0];
    if (!proj) {
      proj = await sbInsert(env, 'cdb_projects', { client_id: client.id, name: 'SouthPark Infinity Pool (Demo)', project_type: 'Custom Pool', pool_type: 'Infinity-Edge Gunite', contract_value: 285000, stage: 'tile_coping', stage_index: 9, start_date: '2026-03-01', target_complete: '2026-07-30' });
      made.project = true;
    }

    // ── Timeline events ──
    var evCount = (await sbSelect(env, 'cdb_project_events?select=id&project_id=eq.' + proj.id + '&limit=1')) || [];
    if (!evCount.length) {
      await sbInsert(env, 'cdb_project_events', { project_id: proj.id, event: 'stage_advanced', from_stage: 'shotcrete', to_stage: 'tile_coping', detail: { note: 'Tile and coping underway' } });
      await sbInsert(env, 'cdb_project_events', { project_id: proj.id, event: 'inspection_passed', detail: { note: 'Plumbing pressure test passed' } });
      await sbInsert(env, 'cdb_project_events', { project_id: proj.id, event: 'photo_added', detail: { note: 'Weekly progress photos posted' } });
      made.events = true;
    }

    // ── Photos + a doc (Owner Suite gallery + vault) ──
    var docCount = (await sbSelect(env, 'cdb_documents?select=id&project_id=eq.' + proj.id + '&limit=1')) || [];
    if (!docCount.length) {
      await sbInsert(env, 'cdb_documents', { project_id: proj.id, client_id: client.id, doc_type: 'photo', doc_name: 'Shotcrete shell', storage_path: IMG[0], metadata: { stage: 'Shotcrete' } });
      await sbInsert(env, 'cdb_documents', { project_id: proj.id, client_id: client.id, doc_type: 'photo', doc_name: 'Tile detail', storage_path: IMG[1], metadata: { stage: 'Tile & coping' } });
      await sbInsert(env, 'cdb_documents', { project_id: proj.id, client_id: client.id, doc_type: 'photo', doc_name: 'Vanishing edge', storage_path: IMG[2], metadata: { stage: 'Finish' } });
      await sbInsert(env, 'cdb_documents', { project_id: proj.id, client_id: client.id, doc_type: 'contract', doc_name: 'Construction Agreement', status: 'executed', signed_at: new Date().toISOString(), amount_usd: 285000 });
      made.docs = true;
    }

    // ── Draw schedule (cdb_payments) - mix of paid / due / scheduled ──
    var payCount = (await sbSelect(env, 'cdb_payments?select=id&project_id=eq.' + proj.id + '&limit=1')) || [];
    if (!payCount.length) {
      var draws = [
        { draw_number: 1, draw_label: 'Deposit', amount_usd: 42750, status: 'cleared', method: 'ach', cleared_at: '2026-03-02T00:00:00Z' },
        { draw_number: 2, draw_label: 'Excavation', amount_usd: 57000, status: 'cleared', method: 'ach', cleared_at: '2026-04-10T00:00:00Z' },
        { draw_number: 3, draw_label: 'Shotcrete shell', amount_usd: 71250, status: 'due', method: 'ach', due_at: '2026-06-15T00:00:00Z' },
        { draw_number: 4, draw_label: 'Tile, coping & equipment', amount_usd: 57000, status: 'scheduled', method: 'ach' },
        { draw_number: 5, draw_label: 'Final, on completion', amount_usd: 57000, status: 'scheduled', method: 'ach' }
      ];
      for (var i = 0; i < draws.length; i++) {
        var row = draws[i]; row.project_id = proj.id; row.client_id = client.id;
        try { await sbInsert(env, 'cdb_payments', row); } catch (e) {}
      }
      made.draws = true;
    }

    // ── Demo vendor ──
    var vr = await sbSelect(env, 'cdb_vendors?select=*&email=ilike.' + encodeURIComponent(EMAIL) + '&limit=1');
    var vendor = vr && vr[0];
    if (!vendor) {
      vendor = await sbInsert(env, 'cdb_vendors', { name: 'Demo Vendor (Sandbox)', company: 'Demo Gunite Co.', trade: 'Gunite', email: EMAIL, portal_code: CODE, status: 'active' });
      made.vendor = true;
    }

    // ── Vendor assignment on the demo project ──
    var asg = await sbSelect(env, 'cdb_vendor_assignments?select=id&project_id=eq.' + proj.id + '&vendor_id=eq.' + vendor.id + '&limit=1');
    if (!(asg && asg[0])) {
      await sbInsert(env, 'cdb_vendor_assignments', { project_id: proj.id, vendor_id: vendor.id, stage: 'shotcrete', scope: 'Gunite shell incl. infinity-edge wall', amount_usd: 52000, status: 'in_progress', due_date: '2026-06-12', pay_status: 'unpaid' });
      made.assignment = true;
    }

    // ── Open job + a bid from the demo vendor ──
    var jr = await sbSelect(env, 'cdb_jobs?select=id&project_id=eq.' + proj.id + '&limit=1');
    var job = jr && jr[0];
    if (!job) {
      job = await sbInsert(env, 'cdb_jobs', { project_id: proj.id, title: 'Decking & travertine surround', trade: 'Decking', stage: 'decking', scope: 'Travertine deck approx 800 sq ft', budget_usd: 34000, status: 'open', bid_deadline: '2026-06-28' });
      try { await sbInsert(env, 'cdb_bids', { job_id: job.id, vendor_id: vendor.id, amount_usd: 33200, timeline: '7 working days', status: 'submitted' }); } catch (e) {}
      made.job = true;
    }

    return json({ ok: true, created: made, login: { email: EMAIL, code: CODE }, client_id: client.id, project_id: proj.id, vendor_id: vendor.id }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 200);
  }
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-admin', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}
