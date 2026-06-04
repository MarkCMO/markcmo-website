// POST /api/track - log a journey event to cdb_events.
// Never blocks the page; always returns 200 even if Supabase is unset.
import { sbInsert, json, clientIp } from './_lib.js';

export async function onRequestPost(context) {
  var request = context.request, env = context.env;
  var body;
  try { body = await request.json(); } catch (e) { return json({ ok: false }, 200); }

  try {
    await sbInsert(env, 'cdb_events', {
      type: ({ click: 'click', view: 'view', error: 'error' }[body.t] || 'view'),
      page: (body.page || '').slice(0, 80),
      detail: {
        service: body.service || null,
        area: body.area || null,
        title: body.title || null,
        action: body.action || (body.detail && body.detail.action) || null,
        method: (body.detail && body.detail.method) || null,
        ref: body.ref || null,
        utm: body.utm || null
      },
      session_id: (body.session_id || '').slice(0, 64),
      url: (body.url || '').slice(0, 300),
      referrer: (body.referrer || '').slice(0, 300),
      ip: clientIp(request),
      user_agent: (request.headers.get('user-agent') || '').slice(0, 300)
    });
  } catch (e) { /* swallow - analytics must never break the page */ }

  return json({ ok: true }, 200);
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}
