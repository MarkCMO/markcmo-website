// POST /api/rendering-request - a real estate agent requests a free 3D backyard
// rendering for a listing. Uploads photos to the cdb-files vault and records the
// request in cdb_rendering_requests. Spam-defended. No email. Graceful demo.
import { sb, sbInsert, json, clientIp } from './_lib.js';
import { honeypotTripped, tooFast, turnstileOk, rateLimited, clean } from './_lib_security.js';

var ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/heic'];
var MAX_PHOTOS = 6;
var MAX_BYTES = 8 * 1024 * 1024;

function decode(dataUrl) {
  var m = String(dataUrl).match(/^data:([^;]+);base64,(.*)$/);
  if (!m) return null;
  var mime = m[1], b64 = m[2];
  var bin = atob(b64), len = bin.length, bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return { mime: mime, bytes: bytes };
}
function ext(mime) { return ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/heic': 'heic' })[mime] || 'bin'; }

export async function onRequestPost(context) {
  var request = context.request, env = context.env;
  var d; try { d = await request.json(); } catch (e) { return json({ ok: false, error: 'bad json' }, 400); }
  if (!d.name || !d.email) return json({ ok: false, error: 'name and email required' }, 400);

  if (honeypotTripped(d) || tooFast(d, 2500)) return json({ ok: true, id: null }, 200);
  if (await rateLimited(env, 'rendering:' + clientIp(request), 5, 600)) {
    return json({ ok: false, error: 'Too many requests. Please try again shortly.' }, 429);
  }
  if (!(await turnstileOk(env, d.cf_turnstile_token, clientIp(request)))) {
    return json({ ok: false, error: 'Verification failed. Please try again.' }, 400);
  }

  var c = sb(env);
  if (!c) return json({ ok: true, demo: true, id: null }, 200);

  try {
    var photos = Array.isArray(d.photos) ? d.photos.slice(0, MAX_PHOTOS) : [];
    var paths = [];
    var folder = 'rendering/' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
    for (var i = 0; i < photos.length; i++) {
      var dec = decode(photos[i]);
      if (!dec) continue;
      if (ALLOWED_MIME.indexOf(dec.mime) === -1) continue;
      if (dec.bytes.length > MAX_BYTES) continue;
      var path = folder + '/photo_' + (i + 1) + '.' + ext(dec.mime);
      var up = await fetch(c.url + '/storage/v1/object/cdb-files/' + encodeURI(path), {
        method: 'POST',
        headers: { apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': dec.mime, 'x-upsert': 'true' },
        body: dec.bytes
      });
      if (up.ok) paths.push('cdb-files/' + path);
    }
    var row = await sbInsert(env, 'cdb_rendering_requests', {
      agent_name: clean(d.name, 120), firm: clean(d.firm, 160) || null,
      email: clean(d.email, 160), phone: clean(d.phone, 40) || null,
      listing_address: clean(d.address, 240) || null, notes: clean(d.notes, 2000) || null,
      photo_paths: paths, status: 'new', source: clean(d.source, 120) || 'website',
      ip: clientIp(request), user_agent: (request.headers.get('user-agent') || '').slice(0, 300)
    });
    return json({ ok: true, id: row ? row.id : null, photos: paths.length }, 200);
  } catch (e) {
    return json({ ok: true, demo: true, id: null, note: String(e.message || e) }, 200);
  }
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}
