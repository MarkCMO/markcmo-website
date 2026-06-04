// POST /api/vendor-auth - vendor / subcontractor login to the Vendor Portal.
// Auth: email + access code (cdb_vendors.portal_code, else last4 phone).
// Cirilo team (mark/tiffany + CDB_ADMIN_PASS) gets an admin preview that
// loads sample vendor data. Returns assignments, open jobs, and the
// vendor's bids. Graceful: ok:false when Supabase unset (no bypass).
import { sbSelect, json } from './_lib.js';
import { rateLimited, clientIp, signSession } from './_lib_security.js';

export async function onRequestPost(context) {
  var env = context.env;
  if (await rateLimited(env, 'vendorauth:' + clientIp(context.request), 12, 600)) {
    return json({ ok: false, error: 'Too many attempts. Try again later.' }, 429);
  }
  var d;
  try { d = await context.request.json(); } catch (e) { return json({ ok: false }, 400); }
  var email = (d.email || '').trim().toLowerCase();
  if (email === 'demo') email = 'demo@cirilodb.com';
  var code = (d.code || d.password || '').trim();
  if (!email || !code) return json({ ok: false, error: 'missing' }, 400);

  // Cirilo team preview.
  var ADMIN = ['mark@markcmo.com', 'tiffany@cirilodb.com'];
  if (ADMIN.indexOf(email) > -1) {
    var expected = env.CDB_ADMIN_PASS;
    if (!expected) return json({ ok: false, error: 'not_configured' }, 503);
    if (code !== expected) return json({ ok: false, error: 'invalid' }, 401);
    var atoken = await signSession(env, 'vadmin', '', 12);
    return json({ ok: true, role: 'admin', email: email, token: atoken }, 200);
  }

  try {
    var rows = await sbSelect(env, 'cdb_vendors?select=*&email=ilike.' + encodeURIComponent(email) + '&limit=1');
    var vendor = rows && rows[0];
    if (!vendor) return json({ ok: false, error: 'no_match' }, 401);
    var exp = (vendor.portal_code || '').trim();
    if (!exp && vendor.phone) exp = String(vendor.phone).replace(/\D/g, '').slice(-4);
    if (!exp) exp = (vendor.name || '').replace(/\s/g, '').slice(0, 4).toLowerCase();
    if (code.toLowerCase() !== exp.toLowerCase()) return json({ ok: false, error: 'bad_code' }, 401);

    var token = await signSession(env, 'vendor', vendor.id, 12);
    var data = await buildVendor(env, vendor);
    return json({ ok: true, role: 'vendor', token: token, data: data }, 200);
  } catch (e) {
    return json({ ok: false, error: 'unavailable' }, 200);
  }
}

export async function buildVendor(env, vendor) {
  var assigns = await sbSelect(env, 'cdb_vendor_assignments?select=*&vendor_id=eq.' + vendor.id + '&order=created_at.desc&limit=50');
  var bids = await sbSelect(env, 'cdb_bids?select=*&vendor_id=eq.' + vendor.id + '&order=created_at.desc&limit=50');
  // Open jobs, optionally matching the vendor's trade.
  var jobs = await sbSelect(env, 'cdb_jobs?select=*&status=eq.open&order=created_at.desc&limit=50');
  var projects = await sbSelect(env, 'cdb_projects?select=id,name&limit=200');
  var pById = {}; projects.forEach(function (p) { pById[p.id] = p.name; });
  var bidJobIds = {}; bids.forEach(function (b) { bidJobIds[b.job_id] = b; });

  return {
    vendor: { name: vendor.name, company: vendor.company || '', trade: vendor.trade || '', email: vendor.email },
    assignments: assigns.map(function (a) {
      return { id: a.id, project: pById[a.project_id] || '', stage: a.stage || '', scope: a.scope || '', amount: +a.amount_usd || 0, status: a.status || 'assigned', due: a.due_date || '', pay_status: a.pay_status || 'unpaid' };
    }),
    jobs: jobs.map(function (j) {
      return { id: j.id, project: pById[j.project_id] || '', title: j.title, trade: j.trade || '', stage: j.stage || '', scope: j.scope || '', budget: +j.budget_usd || 0, deadline: j.bid_deadline || '', my_bid: bidJobIds[j.id] ? (+bidJobIds[j.id].amount_usd || 0) : null };
    }),
    bids: bids.map(function (b) {
      return { id: b.id, job_id: b.job_id, amount: +b.amount_usd || 0, timeline: b.timeline || '', status: b.status || 'submitted' };
    })
  };
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-vendor', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' } });
}
