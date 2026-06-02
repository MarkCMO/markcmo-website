// POST /api/doc-upload - upload a file to the document vault.
// Accepts JSON { filename, content_base64, mime, doc_type, doc_name, project_id? }.
// Auth via whichever portal token is present (homeowner / vendor / admin).
// Stores the object in Supabase Storage bucket 'cdb-files' and records
// metadata in cdb_documents. Graceful demo when Storage is unconfigured.
import { sb, sbInsert, json } from './_lib.js';
import { guardAdmin, verifySession } from './_lib_security.js';

var ALLOWED_MIME = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic'];

function decodeBase64(b64) {
  var clean = String(b64).replace(/^data:[^;]+;base64,/, '');
  var bin = atob(clean), len = bin.length, bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function whoFrom(portalSess, vendorSess, isAdmin) {
  if (portalSess && portalSess.role === 'client' && portalSess.id) return { scope: 'client', id: portalSess.id, by: 'client' };
  if (vendorSess && vendorSess.role === 'vendor' && vendorSess.id) return { scope: 'vendor', id: vendorSess.id, by: 'vendor' };
  if (isAdmin || (portalSess && portalSess.role === 'admin') || (vendorSess && vendorSess.role === 'vadmin')) return { scope: 'admin', id: null, by: 'admin' };
  return null;
}

export async function onRequestPost(context) {
  var env = context.env, request = context.request;
  var portalSess = await verifySession(env, request.headers.get('x-cdb-portal') || '');
  var vendorSess = await verifySession(env, request.headers.get('x-cdb-vendor') || '');
  var who = whoFrom(portalSess, vendorSess, await guardAdmin(env, request));
  if (!who) return json({ ok: false, error: 'unauthorized' }, 401);
  var d; try { d = await request.json(); } catch (e) { return json({ ok: false }, 400); }
  if (!d.filename || !d.content_base64) return json({ ok: false, error: 'missing file' }, 400);
  if (d.mime && ALLOWED_MIME.indexOf(d.mime) === -1) return json({ ok: false, error: 'file type not allowed' }, 400);

  var c = sb(env);
  if (!c) return json({ ok: true, demo: true, note: 'Storage not connected' }, 200);

  try {
    var bucket = 'cdb-files';
    var clean = String(d.filename).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    var folder = who.scope === 'client' ? ('client/' + who.id) : (who.scope === 'vendor' ? ('vendor/' + who.id) : 'admin');
    var path = folder + '/' + Date.now() + '_' + clean;
    var bytes = decodeBase64(d.content_base64);
    if (bytes.length > 10 * 1024 * 1024) return json({ ok: false, error: 'file too large (10MB max)' }, 400);

    var up = await fetch(c.url + '/storage/v1/object/' + bucket + '/' + encodeURI(path), {
      method: 'POST',
      headers: { apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': d.mime || 'application/octet-stream', 'x-upsert': 'true' },
      body: bytes
    });
    if (!up.ok) throw new Error('storage ' + up.status);

    var meta = {
      doc_type: d.doc_type || 'upload', doc_name: d.doc_name || d.filename,
      storage_path: bucket + '/' + path, status: 'uploaded',
      uploaded_by: who.by, size_bytes: bytes.length, mime: d.mime || null
    };
    if (who.scope === 'client') meta.client_id = who.id;
    if (who.scope === 'vendor') meta.vendor_id = who.id;
    if (d.project_id) meta.project_id = d.project_id;
    if (d.client_id && who.scope === 'admin') meta.client_id = d.client_id;

    var row = await sbInsert(env, 'cdb_documents', meta);
    return json({ ok: true, id: row ? row.id : null, name: meta.doc_name }, 200);
  } catch (e) {
    return json({ ok: true, demo: true, note: String(e.message || e) }, 200);
  }
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-portal, x-cdb-vendor, x-cdb-admin', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}
