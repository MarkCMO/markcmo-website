// POST /api/admin-payment - admin updates a reported payment's status.
//   { op:'set_status', payment_id, status:'received'|'cleared'|'void'|'reported' }
// Guard: x-cdb-admin header must contain '@'.
import { sbUpdate, sbSelect, sbInsert, json } from './_lib.js';

import { guardAdmin, isUuid } from './_lib_security.js';
import { qboAutoSyncDraw } from './_lib_qbo.js';

var STANDARD_DRAWS = [
  { t: 'Deposit', pct: 0.15 }, { t: 'Excavation', pct: 0.20 }, { t: 'Shotcrete shell', pct: 0.25 },
  { t: 'Tile, coping and equipment', pct: 0.20 }, { t: 'Final, on completion', pct: 0.20 }
];

export async function onRequestPost(context) {
  var env = context.env, request = context.request;
  if (!(await guardAdmin(env, request))) return json({ ok: false }, 401);
  var d; try { d = await request.json(); } catch (e) { return json({ ok: false }, 400); }
  var op = d.op || 'set_status';
  var now = new Date().toISOString();

  // ── Build a standard draw schedule for a project (idempotent) ──
  if (op === 'create_schedule') {
    if (!isUuid(d.project_id)) return json({ ok: false, error: 'bad id' }, 400);
    try {
      var prows = await sbSelect(env, 'cdb_projects?select=id,client_id,contract_value&id=eq.' + d.project_id + '&limit=1');
      var proj = prows && prows[0];
      if (!proj) return json({ ok: false, error: 'not_found' }, 404);
      var existing = await sbSelect(env, 'cdb_payments?select=id&project_id=eq.' + d.project_id + '&limit=1');
      if (existing && existing.length) return json({ ok: false, error: 'schedule_exists' }, 409);
      var total = +proj.contract_value || (d.contract_value != null ? +d.contract_value : 0);
      if (!total) return json({ ok: false, error: 'no_contract_value' }, 400);
      for (var i = 0; i < STANDARD_DRAWS.length; i++) {
        await sbInsert(env, 'cdb_payments', {
          project_id: proj.id, client_id: proj.client_id,
          draw_label: STANDARD_DRAWS[i].t, draw_number: i + 1,
          amount_usd: Math.round(total * STANDARD_DRAWS[i].pct), method: 'check', status: 'scheduled'
        });
      }
      return json({ ok: true, created: STANDARD_DRAWS.length }, 200);
    } catch (e) { return json({ ok: true, demo: true }, 200); }
  }

  // ── Add a single custom draw ──
  if (op === 'add_draw') {
    if (!isUuid(d.project_id)) return json({ ok: false, error: 'bad id' }, 400);
    if (d.client_id && !isUuid(d.client_id)) return json({ ok: false, error: 'bad id' }, 400);
    try {
      var row = await sbInsert(env, 'cdb_payments', {
        project_id: d.project_id, client_id: d.client_id || null,
        draw_label: (d.draw_label || 'Draw').slice(0, 120), draw_number: d.draw_number != null ? +d.draw_number : null,
        amount_usd: d.amount != null ? +d.amount : null, method: 'check', status: 'scheduled'
      });
      return json({ ok: true, id: row ? row.id : null }, 200);
    } catch (e) { return json({ ok: true, demo: true }, 200); }
  }

  // ── Edit a draw's amount / label / due date ──
  if (op === 'update_draw') {
    if (!isUuid(d.payment_id)) return json({ ok: false, error: 'bad id' }, 400);
    var patchU = {};
    if (d.amount != null) patchU.amount_usd = +d.amount;
    if (d.draw_label) patchU.draw_label = String(d.draw_label).slice(0, 120);
    if (d.due_at) patchU.due_at = d.due_at;
    if (!Object.keys(patchU).length) return json({ ok: false, error: 'nothing to update' }, 400);
    try { await sbUpdate(env, 'cdb_payments', 'id=eq.' + d.payment_id, patchU); return json({ ok: true }, 200); }
    catch (e) { return json({ ok: true, demo: true }, 200); }
  }

  // ── Issue (bill) a scheduled draw: status -> due ──
  if (op === 'issue_draw') {
    if (!isUuid(d.payment_id)) return json({ ok: false, error: 'bad id' }, 400);
    try {
      await sbUpdate(env, 'cdb_payments', 'id=eq.' + d.payment_id, { status: 'due', issued_at: now, due_at: d.due_at || null });
      try {
        var ir = await sbSelect(env, 'cdb_payments?select=project_id,amount_usd,draw_label&id=eq.' + d.payment_id + '&limit=1');
        var ip = ir && ir[0];
        if (ip && ip.project_id) await sbInsert(env, 'cdb_project_events', { project_id: ip.project_id, event: 'draw_issued', detail: { amount: ip.amount_usd, draw: ip.draw_label } });
      } catch (e) {}
      try { context.waitUntil(qboAutoSyncDraw(env, d.payment_id)); } catch (e) {}
      return json({ ok: true }, 200);
    } catch (e) { return json({ ok: true, demo: true }, 200); }
  }

  // ── Confirm/advance a draw's payment status ──
  if (!d.payment_id || !d.status) return json({ ok: false, error: 'missing' }, 400);
  if (!isUuid(d.payment_id)) return json({ ok: false, error: 'bad id' }, 400);
  var allowed = ['scheduled', 'due', 'reported', 'received', 'cleared', 'void'];
  if (allowed.indexOf(d.status) === -1) return json({ ok: false, error: 'bad status' }, 400);

  var patch = { status: d.status };
  if (d.status === 'received') patch.received_at = now;
  if (d.status === 'cleared') patch.cleared_at = now;

  try {
    await sbUpdate(env, 'cdb_payments', 'id=eq.' + d.payment_id, patch);
    try {
      var rows = await sbSelect(env, 'cdb_payments?select=project_id,amount_usd,draw_label&id=eq.' + d.payment_id + '&limit=1');
      var p = rows && rows[0];
      if (p && p.project_id) {
        await sbInsert(env, 'cdb_project_events', { project_id: p.project_id, event: 'payment_' + d.status, detail: { amount: p.amount_usd, draw: p.draw_label } });
      }
    } catch (e) {}
    if (d.status !== 'scheduled' && d.status !== 'void') { try { context.waitUntil(qboAutoSyncDraw(env, d.payment_id)); } catch (e) {} }
    return json({ ok: true }, 200);
  } catch (e) { return json({ ok: true, demo: true }, 200); }
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-admin', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}
