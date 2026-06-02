// POST /api/portal-auth - client login to the Owner's Suite.
// Auth model: email on file + an access code. The code is the client's
// portal_code (set per client) OR, if none is set, the last 4 of their
// phone. Returns an opaque token (base64 email|client_id|ts) the portal
// sends back as x-cdb-portal to fetch their project.
//
// Graceful: if Supabase is unset OR no match, returns ok:false and the
// front-end opens a Preview Suite for any 4+ char code so it always demos.
import { sbSelect, sbUpdate, json } from './_lib.js';
import { rateLimited, clientIp, signSession } from './_lib_security.js';

// Shareable referral code, ambiguity-free alphabet.
function genRef() {
  var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', out = '';
  for (var i = 0; i < 6; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

export async function onRequestPost(context) {
  var env = context.env, request = context.request;
  if (await rateLimited(env, 'portalauth:' + clientIp(request), 12, 600)) {
    return json({ ok: false, error: 'Too many attempts. Try again later.' }, 429);
  }
  var d;
  try { d = await request.json(); } catch (e) { return json({ ok: false }, 400); }
  var email = (d.email || '').trim().toLowerCase();
  var code = (d.code || d.password || '').trim();
  if (!email || !code) return json({ ok: false, error: 'missing' }, 400);

  // ── Cirilo team / admin login (server-verified against CDB_ADMIN_PASS) ──
  var ADMIN = ['mark@markcmo.com', 'tiffany@cirilodb.com'];
  if (ADMIN.indexOf(email) > -1) {
    var expected = env.CDB_ADMIN_PASS;
    if (!expected) return json({ ok: false, error: 'not_configured' }, 503);
    if (code !== expected) return json({ ok: false, error: 'invalid' }, 401);
    var atoken = await signSession(env, 'admin', '', 12);
    return new Response(JSON.stringify({ ok: true, role: 'admin', email: email, token: atoken }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Set-Cookie': 'cdb_portal=' + atoken + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200'
      }
    });
  }

  // ── Homeowner login (verified against cdb_clients) ──
  try {
    var rows = await sbSelect(env, 'cdb_clients?select=*&email=ilike.' + encodeURIComponent(email) + '&limit=1');
    var client = rows && rows[0];
    if (!client) return json({ ok: false, error: 'no_match' }, 401);

    // Accept portal_code if present, else last 4 of phone, else first 4 of name.
    var expected = (client.portal_code || '').trim();
    if (!expected && client.phone) expected = String(client.phone).replace(/\D/g, '').slice(-4);
    if (!expected) expected = (client.name || '').replace(/\s/g, '').slice(0, 4).toLowerCase();

    if (code.toLowerCase() !== expected.toLowerCase()) return json({ ok: false, error: 'bad_code' }, 401);

    var token = await signSession(env, 'client', client.id, 12);
    var data = await buildSuite(env, client);
    return new Response(JSON.stringify({ ok: true, role: 'client', token: token, data: data }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Set-Cookie': 'cdb_portal=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200'
      }
    });
  } catch (e) {
    // Supabase unset / network: signal not-ok so portal opens Preview Suite.
    return json({ ok: false, error: 'unavailable' }, 200);
  }
}

// Shared with portal-data.js shape. Pulls the client's primary project,
// its photos/docs/events, and derives draws from contract_value.
export async function buildSuite(env, client) {
  // Guarantee every client has a referral code so the share link always shows.
  if (!client.referral_code) {
    try { var nc = genRef(); await sbUpdate(env, 'cdb_clients', 'id=eq.' + client.id, { referral_code: nc }); client.referral_code = nc; } catch (e) {}
  }
  var projects = await sbSelect(env, 'cdb_projects?select=*&client_id=eq.' + client.id + '&order=created_at.desc&limit=1');
  var p = projects && projects[0];
  if (!p) {
    var refs0 = [];
    try { refs0 = await sbSelect(env, 'cdb_referrals?select=status&referrer_client_id=eq.' + client.id); } catch (e) {}
    return {
      project: null, client: clientShape(client),
      referral: { code: client.referral_code || null, count: refs0.length, converted: refs0.filter(function (r) { return r.status === 'converted' || r.status === 'rewarded'; }).length }
    };
  }

  var docs = await sbSelect(env, 'cdb_documents?select=*&project_id=eq.' + p.id + '&order=created_at.desc&limit=20');
  var events = await sbSelect(env, 'cdb_project_events?select=*&project_id=eq.' + p.id + '&order=created_at.desc&limit=12');
  var pays = [];
  try { pays = await sbSelect(env, 'cdb_payments?select=*&project_id=eq.' + p.id + '&order=draw_number.asc'); } catch (e) {}
  var refs = [];
  try { refs = await sbSelect(env, 'cdb_referrals?select=status&referrer_client_id=eq.' + client.id); } catch (e) {}

  var photoDocs = docs.filter(function (x) { return x.doc_type === 'photo' && x.storage_path; });
  var fileDocs = docs.filter(function (x) { return x.doc_type !== 'photo'; });

  return {
    client: clientShape(client),
    lead: { name: 'Tiffany Cirilo', role: 'Founder &amp; Project Lead', email: 'Tiffany@CiriloDB.com', phone: '+17040000000', phone_disp: '(704) 000-0000' },
    project: {
      id: p.id, id_disp: 'CDB-' + String(p.id).replace(/-/g, '').slice(0, 4).toUpperCase(),
      name: p.name, neighborhood: client.neighborhood || client.address || 'Charlotte, NC',
      pool_type: p.pool_type || p.project_type || 'Custom Gunite', stage: p.stage || 'consultation',
      contract_value: +p.contract_value || 0,
      start: fmtMonth(p.start_date), target: fmtMonth(p.target_complete),
      hero: photoDocs.length ? photoDocs[0].storage_path : null
    },
    photos: photoDocs.slice(0, 6).map(function (x, i) {
      return { img: x.storage_path, t: x.doc_name || 'Progress', d: (x.metadata && x.metadata.stage) || '', cls: i === 0 ? 'big' : (i === 1 ? 'med' : 'sm') };
    }),
    docs: fileDocs.map(function (x) {
      return { t: x.doc_name || x.doc_type, s: x.amount_usd ? ('$' + (+x.amount_usd).toLocaleString('en-US')) : fmtDate(x.created_at), type: 'PDF', stat: x.status || 'draft' };
    }),
    draws: drawsFromPayments(pays) || deriveDraws(+p.contract_value || 0, docs),
    feed: events.map(function (e) {
      return { t: prettyEvent(e), d: (e.detail && e.detail.note) || '', w: rel(e.created_at) };
    }),
    referral: {
      code: client.referral_code || null,
      count: refs.length,
      converted: refs.filter(function (r) { return r.status === 'converted' || r.status === 'rewarded'; }).length
    }
  };
}

function clientShape(c) { return { name: c.name, email: c.email, neighborhood: c.neighborhood || c.address || '' }; }

// Build the homeowner's draw view from the persisted billing schedule
// (cdb_payments). Scheduled draws are hidden until the admin issues them,
// so the homeowner only sees draws that are billed (due) or further along.
function drawsFromPayments(pays) {
  if (!pays || !pays.length) return null;
  var visible = pays.filter(function (p) { return p.status !== 'scheduled' && p.status !== 'void'; });
  if (!visible.length) return null;
  return visible.map(function (p) {
    var paid = p.status === 'received' || p.status === 'cleared';
    var reported = p.status === 'reported';
    var due = p.status === 'due';
    var s = p.status === 'cleared' ? ('Paid ' + fmtDate(p.cleared_at || p.received_at))
      : p.status === 'received' ? 'Received'
      : p.status === 'reported' ? 'Payment reported, awaiting confirmation'
      : p.status === 'due' ? ('Due' + (p.due_at ? (' ' + fmtDate(p.due_at)) : ''))
      : 'Scheduled';
    return { n: p.draw_number || 0, t: p.draw_label || 'Draw', s: s, amt: +p.amount_usd || 0, paid: paid, due: due, reported: reported, pid: p.id };
  });
}

// Standard luxury-pool draw schedule (15/20/25/20/20) until per-project
// invoices exist; if cdb_invoices/cdb_documents has invoice rows, those win.
function deriveDraws(total, docs) {
  var invoices = (docs || []).filter(function (x) { return x.doc_type === 'invoice'; });
  if (invoices.length) {
    return invoices.map(function (x, i) {
      return { n: i + 1, t: x.doc_name || ('Draw ' + (i + 1)), s: x.status === 'paid' ? ('Paid ' + fmtDate(x.signed_at || x.created_at)) : (x.status || 'upcoming'), amt: +x.amount_usd || 0, paid: x.status === 'paid', due: x.status === 'sent' };
    });
  }
  if (!total) return [];
  var sched = [
    { t: 'Deposit', pct: 0.15 }, { t: 'Excavation', pct: 0.20 }, { t: 'Shotcrete shell', pct: 0.25 },
    { t: 'Tile, coping &amp; equipment', pct: 0.20 }, { t: 'Final, on completion', pct: 0.20 }
  ];
  return sched.map(function (s, i) { return { n: i + 1, t: s.t, s: 'Scheduled', amt: Math.round(total * s.pct), paid: false }; });
}

function prettyEvent(e) {
  if (e.event === 'stage_advanced') return 'Advanced to ' + niceStage(e.to_stage);
  if (e.event === 'photo_added') return 'New progress photos added';
  if (e.event === 'inspection_passed') return 'Inspection passed';
  return e.event ? e.event.replace(/_/g, ' ') : 'Update';
}
function niceStage(k) { return (k || '').replace(/_/g, ' ').replace(/\b\w/g, function (m) { return m.toUpperCase(); }); }
function fmtMonth(d) { if (!d) return ''; try { var dt = new Date(d); return dt.toLocaleString('en-US', { month: 'short', year: 'numeric' }); } catch (e) { return ''; } }
function fmtDate(d) { if (!d) return ''; try { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return ''; } }
function rel(ts) { try { var s = (Date.now() - new Date(ts)) / 1000; if (s < 3600) return Math.round(s / 60) + 'm ago'; if (s < 86400) return Math.round(s / 3600) + 'h ago'; return Math.round(s / 86400) + 'd ago'; } catch (e) { return ''; } }

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-portal', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' } });
}
