// GET /api/vendor-data - resume a vendor session from the x-cdb-vendor token
// (email|vendor_id|ts). Rebuilds assignments, open jobs, and bids.
import { sbSelect, json } from './_lib.js';
import { verifySession } from './_lib_security.js';
import { buildVendor } from './vendor-auth.js';

export async function onRequestGet(context) {
  var env = context.env, request = context.request;
  var sess = await verifySession(env, request.headers.get('x-cdb-vendor') || '');
  if (!sess || sess.role !== 'vendor' || !sess.id) return json({ ok: false }, 200);
  var vendorId = sess.id;
  try {
    var rows = await sbSelect(env, 'cdb_vendors?select=*&id=eq.' + vendorId + '&limit=1');
    var vendor = rows && rows[0];
    if (!vendor) return json({ ok: false }, 200);
    return json({ ok: true, data: await buildVendor(env, vendor) }, 200);
  } catch (e) { return json({ ok: false }, 200); }
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-vendor', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}
