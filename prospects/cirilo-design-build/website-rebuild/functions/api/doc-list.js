// GET /api/doc-list - list documents the requester can see, with short-lived
// signed download URLs. Homeowner sees their docs; vendor sees theirs; admin
// sees all (optionally filtered by ?project_id= or ?client_id=).
import { sb, sbSelect, json } from './_lib.js';
import { guardAdmin, verifySession } from './_lib_security.js';

function whoFrom(portalSess, vendorSess, isAdmin) {
  if (portalSess && portalSess.role === 'client' && portalSess.id) return { scope: 'client', id: portalSess.id };
  if (vendorSess && vendorSess.role === 'vendor' && vendorSess.id) return { scope: 'vendor', id: vendorSess.id };
  if (isAdmin || (portalSess && portalSess.role === 'admin') || (vendorSess && vendorSess.role === 'vadmin')) return { scope: 'admin', id: null };
  return null;
}

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
  var portalSess = await verifySession(env, request.headers.get('x-cdb-portal') || '');
  var vendorSess = await verifySession(env, request.headers.get('x-cdb-vendor') || '');
  var who = whoFrom(portalSess, vendorSess, await guardAdmin(env, request));
  if (!who) return json({ ok: false }, 401);
  var c = sb(env);
  if (!c) return json({ ok: true, demo: true, items: [] }, 200);

  try {
    var filter = '';
    if (who.scope === 'client') filter = 'client_id=eq.' + who.id;
    else if (who.scope === 'vendor') filter = 'vendor_id=eq.' + who.id;
    else {
      var url = new URL(request.url);
      var pid = url.searchParams.get('project_id'), cid = url.searchParams.get('client_id');
      filter = pid ? ('project_id=eq.' + pid) : (cid ? ('client_id=eq.' + cid) : '');
    }
    var q = 'cdb_documents?select=*&order=created_at.desc&limit=100' + (filter ? ('&' + filter) : '');
    var docs = await sbSelect(env, q);
    var items = [];
    for (var i = 0; i < docs.length; i++) {
      var dd = docs[i];
      var u = dd.storage_path ? await signedUrl(c, dd.storage_path) : null;
      items.push({ id: dd.id, name: dd.doc_name || dd.doc_type, type: dd.doc_type, by: dd.uploaded_by || '', status: dd.status || '', url: u, when: dd.created_at });
    }
    return json({ ok: true, items: items }, 200);
  } catch (e) { return json({ ok: true, demo: true, items: [] }, 200); }
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-portal, x-cdb-vendor, x-cdb-admin', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}
