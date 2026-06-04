// POST /api/partner-apply - capture a partner program application into
// cdb_partners. Spam-defended (honeypot, timing, rate limit, optional Turnstile).
// No email is sent (consent-gated elsewhere). Graceful demo when Supabase unset.
import { sbInsert, json, clientIp } from './_lib.js';
import { honeypotTripped, tooFast, turnstileOk, rateLimited, clean } from './_lib_security.js';

var TYPES = ['real_estate', 'builder', 'designer', 'club', 'brand', 'other'];

export async function onRequestPost(context) {
  var request = context.request, env = context.env;
  var d; try { d = await request.json(); } catch (e) { return json({ ok: false, error: 'bad json' }, 400); }
  if (!d.name || !d.email) return json({ ok: false, error: 'name and email required' }, 400);

  // Spam + abuse defenses (silently accept honeypot/too-fast so bots get no signal).
  if (honeypotTripped(d) || tooFast(d, 2500)) return json({ ok: true, id: null }, 200);
  if (await rateLimited(env, 'partner:' + clientIp(request), 5, 600)) {
    return json({ ok: false, error: 'Too many requests. Please try again shortly.' }, 429);
  }
  if (!(await turnstileOk(env, d.cf_turnstile_token, clientIp(request)))) {
    return json({ ok: false, error: 'Verification failed. Please try again.' }, 400);
  }

  var type = TYPES.indexOf(d.partner_type) > -1 ? d.partner_type : 'other';
  var row = null;
  try {
    row = await sbInsert(env, 'cdb_partners', {
      name: clean(d.name, 120), firm: clean(d.firm, 160) || null,
      partner_type: type, email: clean(d.email, 160), phone: clean(d.phone, 40) || null,
      territory: clean(d.territory, 200) || null, message: clean(d.message, 2000) || null,
      source: clean(d.source, 120) || 'website', status: 'new',
      ip: clientIp(request), user_agent: (request.headers.get('user-agent') || '').slice(0, 300)
    });
  } catch (e) { return json({ ok: true, demo: true, id: null }, 200); }
  return json({ ok: true, id: row ? row.id : null }, 200);
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}
