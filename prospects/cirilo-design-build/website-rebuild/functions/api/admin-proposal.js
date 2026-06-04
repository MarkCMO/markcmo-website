// /api/admin-proposal - admin proposal builder.
//   GET  -> list proposals
//   POST -> create a proposal, returns { slug, url } to send the prospect
// Guard: x-cdb-admin header must contain '@'.
import { sbSelect, sbInsert, json } from './_lib.js';

import { guardAdmin } from './_lib_security.js';
function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); }
function rnd() { var ch = 'abcdefghijkmnpqrstuvwxyz23456789', o = ''; for (var i = 0; i < 4; i++) o += ch.charAt(Math.floor(Math.random() * ch.length)); return o; }

var DEFAULT_INCLUSIONS = [
  'Engineered gunite shell, 10-year structural warranty',
  'Waterline tile and natural stone coping',
  'Interior finish (plaster, pebble, or quartz)',
  'Equipment set, plumbing, and electrical',
  'Automation and LED lighting package',
  'Permits, inspections, and engineering',
  'Surrounding deck and hardscape',
  'Full startup and water chemistry balance'
];

function defaultDraws(total) {
  if (!total) return [];
  var sched = [['Deposit', 0.15], ['Excavation', 0.20], ['Shotcrete shell', 0.25], ['Tile, coping & equipment', 0.20], ['Final, on completion', 0.20]];
  return sched.map(function (s) { return { label: s[0], amount: Math.round(total * s[1]) }; });
}

export async function onRequestGet(context) {
  var env = context.env, request = context.request;
  if (!(await guardAdmin(env, request))) return json({ ok: false }, 401);
  try {
    var rows = await sbSelect(env, 'cdb_proposals?select=*&order=created_at.desc&limit=100');
    if (!rows.length) return json({ ok: true, empty: true }, 200);
    return json({ ok: true, items: rows.map(function (p) { return { slug: p.slug, client_name: p.client_name || '', title: p.title || '', value: +p.contract_value || 0, status: p.status || 'sent', when: p.created_at }; }) }, 200);
  } catch (e) { return json({ ok: true, empty: true }, 200); }
}

export async function onRequestPost(context) {
  var env = context.env, request = context.request;
  if (!(await guardAdmin(env, request))) return json({ ok: false }, 401);
  var d; try { d = await request.json(); } catch (e) { return json({ ok: false }, 400); }
  if (!d.client_name || !d.title) return json({ ok: false, error: 'client_name and title required' }, 400);

  var slug = (slugify(d.client_name) || 'proposal') + '-' + rnd();
  var total = d.contract_value != null ? +d.contract_value : null;
  var inclusions = (d.inclusions && d.inclusions.length) ? d.inclusions : DEFAULT_INCLUSIONS;
  var draws = (d.draws && d.draws.length) ? d.draws : defaultDraws(total);

  try {
    await sbInsert(env, 'cdb_proposals', {
      slug: slug, client_name: d.client_name, client_email: d.client_email || null,
      neighborhood: d.neighborhood || null, title: d.title, project_type: d.project_type || 'Custom Pool',
      pool_type: d.pool_type || null, contract_value: total, vision: d.vision || null,
      inclusions: inclusions, draws: draws, status: 'sent', sent_at: new Date().toISOString(), lead_id: d.lead_id || null
    });
    return json({ ok: true, slug: slug, url: '/proposal?c=' + slug }, 200);
  } catch (e) {
    return json({ ok: true, demo: true, slug: slug, url: '/proposal?c=' + slug, note: String(e.message || e) }, 200);
  }
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-admin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } });
}
