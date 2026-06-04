// GET /api/admin-activity - unified activity feed across the whole operation:
// new leads, payments, bids, referrals, and project/stage events. Guarded by
// the x-cdb-admin header. Returns a merged, time-sorted timeline.
import { sbSelect, json } from './_lib.js';

import { guardAdmin } from './_lib_security.js';
function rel(ts) { try { var s = (Date.now() - new Date(ts)) / 1000; if (s < 3600) return Math.round(s / 60) + 'm ago'; if (s < 86400) return Math.round(s / 3600) + 'h ago'; return Math.round(s / 86400) + 'd ago'; } catch (e) { return ''; } }
function usd(n) { return '$' + (+n || 0).toLocaleString('en-US'); }

export async function onRequestGet(context) {
  var env = context.env, request = context.request;
  if (!(await guardAdmin(env, request))) return json({ ok: false, error: 'unauthorized' }, 401);
  try {
    var leads = await sbSelect(env, 'cdb_leads?select=name,status,created_at,source&order=created_at.desc&limit=25');
    var pays = await sbSelect(env, 'cdb_payments?select=draw_label,amount_usd,status,created_at&order=created_at.desc&limit=25');
    var bids = await sbSelect(env, 'cdb_bids?select=amount_usd,status,created_at&order=created_at.desc&limit=25');
    var refs = await sbSelect(env, 'cdb_referrals?select=referred_name,status,created_at&order=created_at.desc&limit=25');
    var pe = await sbSelect(env, 'cdb_project_events?select=event,detail,created_at&order=created_at.desc&limit=40');
    var errs = [];
    try { errs = await sbSelect(env, 'cdb_events?select=detail,page,created_at&type=eq.error&order=created_at.desc&limit=15'); } catch (e) {}

    if (!leads.length && !pe.length && !pays.length && !bids.length && !errs.length) return json({ ok: true, empty: true }, 200);

    var items = [];
    leads.forEach(function (l) { items.push({ type: 'lead', title: 'New lead: ' + l.name, sub: (l.source || 'website') + ' / ' + (l.status || 'new'), ts: l.created_at }); });
    pays.forEach(function (p) { items.push({ type: 'payment', title: 'Payment ' + (p.status || 'reported') + ': ' + (p.draw_label || 'draw'), sub: usd(p.amount_usd), ts: p.created_at }); });
    bids.forEach(function (b) { items.push({ type: 'bid', title: 'Bid ' + (b.status || 'submitted'), sub: usd(b.amount_usd), ts: b.created_at }); });
    refs.forEach(function (r) { items.push({ type: 'referral', title: 'Referral: ' + (r.referred_name || ''), sub: r.status || 'pending', ts: r.created_at }); });
    pe.forEach(function (e) { items.push({ type: 'event', title: String(e.event || '').replace(/_/g, ' '), sub: (e.detail && (e.detail.note || e.detail.draw)) || '', ts: e.created_at }); });
    errs.forEach(function (e) { items.push({ type: 'error', title: 'Site error: ' + ((e.detail && e.detail.msg) || 'JS error'), sub: (e.page || '') + ((e.detail && e.detail.line) ? (':' + e.detail.line) : ''), ts: e.created_at }); });

    items.sort(function (a, b) { return a.ts < b.ts ? 1 : -1; });
    items = items.slice(0, 50).map(function (i) { return { type: i.type, title: i.title, sub: i.sub, when: rel(i.ts) }; });
    return json({ ok: true, items: items, count: items.length }, 200);
  } catch (e) { return json({ ok: true, empty: true }, 200); }
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-admin', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}
