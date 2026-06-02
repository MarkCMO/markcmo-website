// /api/admin-vendor - admin vendor management.
//   GET  -> vendors, assignments, open jobs, bids (joined to names)
//   POST -> { op:'add_vendor' | 'post_job' | 'assign' | 'award_bid' | 'set_vendor_status' }
// Guard: x-cdb-admin header must contain '@' (set by the console after login).
import { sbSelect, sbInsert, sbUpdate, json } from './_lib.js';

import { guardAdmin, isUuid } from './_lib_security.js';
import { qboAutoSyncVendor } from './_lib_qbo.js';

export async function onRequestGet(context) {
  var env = context.env, request = context.request;
  if (!(await guardAdmin(env, request))) return json({ ok: false, error: "unauthorized" }, 401);
  try {
    var vendors = await sbSelect(env, 'cdb_vendors?select=*&order=created_at.desc&limit=200');
    var assigns = await sbSelect(env, 'cdb_vendor_assignments?select=*&order=created_at.desc&limit=200');
    var jobs = await sbSelect(env, 'cdb_jobs?select=*&order=created_at.desc&limit=200');
    var bids = await sbSelect(env, 'cdb_bids?select=*&order=created_at.desc&limit=200');
    var projects = await sbSelect(env, 'cdb_projects?select=id,name&limit=200');
    if (!vendors.length && !jobs.length && !assigns.length) return json({ ok: true, empty: true }, 200);
    var pById = {}; projects.forEach(function (p) { pById[p.id] = p.name; });
    var vById = {}; vendors.forEach(function (v) { vById[v.id] = v.name; });
    return json({
      ok: true,
      vendors: vendors.map(function (v) { return { id: v.id, name: v.name, company: v.company || '', trade: v.trade || '', email: v.email || '', status: v.status || 'active' }; }),
      assignments: assigns.map(function (a) { return { id: a.id, project: pById[a.project_id] || '', vendor: vById[a.vendor_id] || '', stage: a.stage || '', amount: +a.amount_usd || 0, status: a.status || 'assigned', lien: !!a.lien_waiver_at, due: a.due_date || '', pay_status: a.pay_status || 'unpaid' }; }),
      jobs: jobs.map(function (j) { return { id: j.id, project: pById[j.project_id] || '', title: j.title, trade: j.trade || '', budget: +j.budget_usd || 0, status: j.status || 'open' }; }),
      bids: bids.map(function (b) { return { id: b.id, job_id: b.job_id, vendor: vById[b.vendor_id] || '', vendor_id: b.vendor_id, amount: +b.amount_usd || 0, status: b.status || 'submitted' }; })
    }, 200);
  } catch (e) { return json({ ok: true, empty: true }, 200); }
}

export async function onRequestPost(context) {
  var env = context.env, request = context.request;
  if (!(await guardAdmin(env, request))) return json({ ok: false }, 401);
  var d; try { d = await request.json(); } catch (e) { return json({ ok: false }, 400); }
  // Reject any malformed id before it reaches a PostgREST filter.
  var idFields = ['bid_id', 'job_id', 'vendor_id', 'assignment_id', 'project_id'];
  for (var fi = 0; fi < idFields.length; fi++) { var fv = d[idFields[fi]]; if (fv && !isUuid(fv)) return json({ ok: false, error: 'bad id' }, 400); }
  try {
    if (d.op === 'add_vendor') {
      var v = await sbInsert(env, 'cdb_vendors', { name: d.name, company: d.company || null, email: d.email || null, phone: d.phone || null, trade: d.trade || null, portal_code: d.portal_code || null });
      return json({ ok: true, id: v.id }, 200);
    }
    if (d.op === 'post_job') {
      var j = await sbInsert(env, 'cdb_jobs', { project_id: d.project_id || null, title: d.title, trade: d.trade || null, stage: d.stage || null, scope: d.scope || null, budget_usd: d.budget != null ? +d.budget : null, status: 'open', bid_deadline: d.bid_deadline || null });
      return json({ ok: true, id: j.id }, 200);
    }
    if (d.op === 'assign') {
      var a = await sbInsert(env, 'cdb_vendor_assignments', { project_id: d.project_id || null, vendor_id: d.vendor_id, stage: d.stage || null, scope: d.scope || null, amount_usd: d.amount != null ? +d.amount : null, status: 'assigned' });
      return json({ ok: true, id: a.id }, 200);
    }
    if (d.op === 'award_bid' && d.bid_id && d.job_id) {
      var bidRows = await sbSelect(env, 'cdb_bids?select=*&id=eq.' + d.bid_id + '&limit=1');
      var bid = bidRows && bidRows[0];
      var jobRows = await sbSelect(env, 'cdb_jobs?select=*&id=eq.' + d.job_id + '&limit=1');
      var job = jobRows && jobRows[0];
      var winner = d.vendor_id || (bid && bid.vendor_id);

      await sbUpdate(env, 'cdb_bids', 'id=eq.' + d.bid_id, { status: 'awarded' });
      // Decline the other bids on this job.
      try { await sbUpdate(env, 'cdb_bids', 'job_id=eq.' + d.job_id + '&id=neq.' + d.bid_id, { status: 'declined' }); } catch (e) {}
      await sbUpdate(env, 'cdb_jobs', 'id=eq.' + d.job_id, { status: 'awarded', awarded_vendor_id: winner || null });

      // Auto-create the vendor assignment from the awarded job + winning bid.
      var assignId = null;
      if (job && winner) {
        var a = await sbInsert(env, 'cdb_vendor_assignments', {
          project_id: job.project_id || null, vendor_id: winner,
          stage: job.stage || null, scope: job.scope || job.title || null,
          amount_usd: bid ? +bid.amount_usd : (job.budget_usd != null ? +job.budget_usd : null),
          status: 'assigned'
        });
        assignId = a ? a.id : null;
      }
      return json({ ok: true, assignment_id: assignId }, 200);
    }
    if (d.op === 'set_vendor_status' && d.vendor_id && d.status) {
      await sbUpdate(env, 'cdb_vendors', 'id=eq.' + d.vendor_id, { status: d.status });
      return json({ ok: true }, 200);
    }
    if (d.op === 'set_due' && d.assignment_id && d.due_date) {
      await sbUpdate(env, 'cdb_vendor_assignments', 'id=eq.' + d.assignment_id, { due_date: d.due_date });
      return json({ ok: true }, 200);
    }
    if (d.op === 'set_vendor_paid' && d.assignment_id) {
      await sbUpdate(env, 'cdb_vendor_assignments', 'id=eq.' + d.assignment_id, { pay_status: 'paid', paid_at: new Date().toISOString(), paid_amount: d.amount != null ? +d.amount : null });
      try { context.waitUntil(qboAutoSyncVendor(env, d.assignment_id)); } catch (e) {}
      return json({ ok: true }, 200);
    }
    return json({ ok: false, error: 'unknown op' }, 400);
  } catch (e) { return json({ ok: true, demo: true }, 200); }
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-admin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } });
}
