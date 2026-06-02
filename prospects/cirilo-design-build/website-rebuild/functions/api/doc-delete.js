// POST /api/doc-delete - admin removes a document from the vault.
//   { id }  (cdb_documents uuid). Deletes the storage object (best effort)
// then the metadata row. Admin only. Graceful demo when Supabase is unset.
import { sb, sbSelect, json } from './_lib.js';
import { guardAdmin, isUuid } from './_lib_security.js';

export async function onRequestPost(context) {
  var env = context.env, request = context.request;
  if (!(await guardAdmin(env, request))) return json({ ok: false, error: 'unauthorized' }, 401);
  var d; try { d = await request.json(); } catch (e) { return json({ ok: false }, 400); }
  if (!d.id || !isUuid(d.id)) return json({ ok: false, error: 'bad id' }, 400);

  var c = sb(env);
  if (!c) return json({ ok: true, demo: true }, 200);

  try {
    var rows = await sbSelect(env, 'cdb_documents?select=id,storage_path&id=eq.' + d.id + '&limit=1');
    var doc = rows && rows[0];
    if (!doc) return json({ ok: false, error: 'not_found' }, 404);

    // Remove the underlying storage object first (best effort).
    if (doc.storage_path) {
      try {
        var parts = String(doc.storage_path).split('/');
        var bucket = parts.shift();
        var path = parts.join('/');
        await fetch(c.url + '/storage/v1/object/' + bucket + '/' + encodeURI(path), {
          method: 'DELETE', headers: { apikey: c.key, Authorization: 'Bearer ' + c.key }
        });
      } catch (e) {}
    }

    // Delete the metadata row.
    var del = await fetch(c.url + '/rest/v1/cdb_documents?id=eq.' + d.id, {
      method: 'DELETE', headers: { apikey: c.key, Authorization: 'Bearer ' + c.key, Prefer: 'return=minimal' }
    });
    if (!del.ok) throw new Error('delete ' + del.status);
    return json({ ok: true }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 200);
  }
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-admin', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}
