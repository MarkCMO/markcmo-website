// POST /api/vendor-apply - a trade/vendor self-signup. Inserts into cdb_vendors
// with status='pending' so it surfaces in the admin vendor panel for approval.
// Spam-defended. No email sent. Graceful demo when Supabase unset.
import { sbInsert, json, clientIp } from './_lib.js';
import { honeypotTripped, tooFast, turnstileOk, rateLimited, clean } from './_lib_security.js';

export async function onRequestPost(context) {
  var request = context.request, env = context.env;
  var d; try { d = await request.json(); } catch (e) { return json({ ok: false, error: 'bad json' }, 400); }
  if (!d.name || !d.email) return json({ ok: false, error: 'name and email required' }, 400);

  if (honeypotTripped(d) || tooFast(d, 2500)) return json({ ok: true, id: null }, 200);
  if (await rateLimited(env, 'vendor:' + clientIp(request), 5, 600)) {
    return json({ ok: false, error: 'Too many requests. Please try again shortly.' }, 429);
  }
  if (!(await turnstileOk(env, d.cf_turnstile_token, clientIp(request)))) {
    return json({ ok: false, error: 'Verification failed. Please try again.' }, 400);
  }

  // Fold extra detail into notes (cdb_vendors has no dedicated columns for these).
  var noteParts = [];
  if (d.license) noteParts.push('License/Insurance: ' + clean(d.license, 200));
  if (d.message) noteParts.push(clean(d.message, 2000));
  var notes = noteParts.join('\n') || null;

  var row = null;
  try {
    row = await sbInsert(env, 'cdb_vendors', {
      name: clean(d.name, 120), company: clean(d.company, 160) || null,
      email: clean(d.email, 160), phone: clean(d.phone, 40) || null,
      trade: clean(d.trade, 80) || null, service_area: clean(d.service_area, 200) || null,
      notes: notes, status: 'pending', applied_at: new Date().toISOString()
    });
  } catch (e) { return json({ ok: true, demo: true, id: null }, 200); }
  return json({ ok: true, id: row ? row.id : null }, 200);
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}
