// /api/admin-renderings - admin view of 3D rendering requests.
//   GET  -> list of cdb_rendering_requests with short-lived signed photo URLs
//   POST -> { op:'set_status', id, status }  (new/in_progress/delivered/declined)
// Admin only (x-cdb-admin signed token).
import { sb, sbSelect, sbUpdate, json } from './_lib.js';
import { guardAdmin, isUuid } from './_lib_security.js';

var STATUSES = ['new', 'in_progress', 'delivered', 'declined'];

async function signedUrl(c, storagePath) {
  try {
    var parts = String(storagePath).split('/');
    var bucket = parts.shift();
    var path = parts.join('/');
    var r = await fetch(c.url + '/storage/v1/object/sign/' + bucket + '/' + encodeURI(path), {
      method: 'POST', headers: { apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 3600 })
    });
    if (!r.ok) return null;
    var j = await r.json();
    var sp = j.signedURL || j.signedUrl;
    return sp ? (c.url + '/storage/v1' + sp) : null;
  } catch (e) { return null; }
}

export async function onRequestGet(context) {
  var env = context.env, request = context.request;
  if (!(await guardAdmin(env, request))) return json({ ok: false, error: 'unauthorized' }, 401);
  var c = sb(env);
  if (!c) return json({ ok: true, demo: true, items: [] }, 200);
  try {
    var rows = await sbSelect(env, 'cdb_rendering_requests?select=*&order=created_at.desc&limit=200');
    var items = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var paths = Array.isArray(r.photo_paths) ? r.photo_paths : [];
      var urls = [];
      for (var p = 0; p < paths.length; p++) { var u = await signedUrl(c, paths[p]); if (u) urls.push(u); }
      items.push({
        id: r.id, name: r.agent_name, firm: r.firm || '', email: r.email || '', phone: r.phone || '',
        address: r.listing_address || '', notes: r.notes || '', photos: urls,
        status: r.status || 'new', created: r.created_at
      });
    }
    return json({ ok: true, items: items }, 200);
  } catch (e) { return json({ ok: true, demo: true, items: [] }, 200); }
}

export async function onRequestPost(context) {
  var env = context.env, request = context.request;
  if (!(await guardAdmin(env, request))) return json({ ok: false }, 401);
  var d; try { d = await request.json(); } catch (e) { return json({ ok: false }, 400); }
  if (d.op === 'set_status') {
    if (!d.id || !isUuid(d.id)) return json({ ok: false, error: 'bad id' }, 400);
    if (STATUSES.indexOf(d.status) === -1) return json({ ok: false, error: 'bad status' }, 400);
    try {
      await sbUpdate(env, 'cdb_rendering_requests', 'id=eq.' + d.id, { status: d.status });
      return json({ ok: true }, 200);
    } catch (e) { return json({ ok: true, demo: true }, 200); }
  }
  return json({ ok: false, error: 'unknown op' }, 400);
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-admin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } });
}
