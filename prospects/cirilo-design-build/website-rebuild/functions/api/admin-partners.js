// /api/admin-partners - admin view of partner program applications.
//   GET  -> list of cdb_partners
//   POST -> { op:'set_status', id, status }  (new/contacted/active/declined)
// Admin only (x-cdb-admin signed token).
import { sbSelect, sbUpdate, json } from './_lib.js';
import { guardAdmin, isUuid } from './_lib_security.js';

var STATUSES = ['new', 'contacted', 'active', 'declined'];

export async function onRequestGet(context) {
  var env = context.env, request = context.request;
  if (!(await guardAdmin(env, request))) return json({ ok: false, error: 'unauthorized' }, 401);
  try {
    var rows = await sbSelect(env, 'cdb_partners?select=*&order=created_at.desc&limit=300');
    if (!rows.length) return json({ ok: true, empty: true, items: [] }, 200);
    return json({
      ok: true,
      items: rows.map(function (p) {
        return {
          id: p.id, name: p.name, firm: p.firm || '', type: p.partner_type || 'other',
          email: p.email || '', phone: p.phone || '', territory: p.territory || '',
          message: p.message || '', source: p.source || '', status: p.status || 'new',
          created: p.created_at
        };
      })
    }, 200);
  } catch (e) { return json({ ok: true, empty: true, items: [] }, 200); }
}

export async function onRequestPost(context) {
  var env = context.env, request = context.request;
  if (!(await guardAdmin(env, request))) return json({ ok: false }, 401);
  var d; try { d = await request.json(); } catch (e) { return json({ ok: false }, 400); }
  if (d.op === 'set_status') {
    if (!d.id || !isUuid(d.id)) return json({ ok: false, error: 'bad id' }, 400);
    if (STATUSES.indexOf(d.status) === -1) return json({ ok: false, error: 'bad status' }, 400);
    try {
      await sbUpdate(env, 'cdb_partners', 'id=eq.' + d.id, { status: d.status });
      return json({ ok: true }, 200);
    } catch (e) { return json({ ok: true, demo: true }, 200); }
  }
  return json({ ok: false, error: 'unknown op' }, 400);
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-admin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } });
}
