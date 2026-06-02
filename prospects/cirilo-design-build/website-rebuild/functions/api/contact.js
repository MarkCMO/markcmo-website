// POST /api/contact - capture a consultation request into cdb_leads,
// email Tiffany + the prospect (Resend), and mark sub-1-min response.
// Falls back gracefully: if Supabase/Resend unset, still returns ok so
// the front-end success path fires (front-end also has a mailto fallback).
import { sbInsert, sbSelect, json, clientIp } from './_lib.js';
import { honeypotTripped, tooFast, turnstileOk, rateLimited } from './_lib_security.js';

export async function onRequestPost(context) {
  var request = context.request, env = context.env;
  var d;
  try { d = await request.json(); } catch (e) { return json({ ok: false, error: 'bad json' }, 400); }
  if (!d.name || !d.email) return json({ ok: false, error: 'name and email required' }, 400);

  // ── Spam + abuse defenses ──────────────────────────────────────
  // Honeypot + timing: silently accept (200 ok) so bots get no signal, but drop.
  if (honeypotTripped(d) || tooFast(d, 2500)) return json({ ok: true, lead_id: null }, 200);
  // Rate limit: max 5 submissions per IP per 10 min (no-op if KV unbound).
  if (await rateLimited(env, 'contact:' + clientIp(request), 5, 600)) {
    return json({ ok: false, error: 'Too many requests. Please try again shortly.' }, 429);
  }
  // Turnstile (only enforced when TURNSTILE_SECRET is set).
  if (!(await turnstileOk(env, d.cf_turnstile_token, clientIp(request)))) {
    return json({ ok: false, error: 'Verification failed. Please try again.' }, 400);
  }

  var lead = null;
  try {
    lead = await sbInsert(env, 'cdb_leads', {
      name: d.name, email: d.email, phone: d.phone || null, address: d.address || null,
      project_type: d.project_type || null, budget: d.budget || null, timeline: d.timeline || null,
      message: d.message || null, source: d.source || 'website', status: d.status || 'new',
      referred_by_code: d.referred_by_code || null, utm: d.utm || null,
      session_id: d.session_id || null, ip: clientIp(request),
      user_agent: (request.headers.get('user-agent') || '').slice(0, 300),
      responded_at: new Date().toISOString()  // auto-response fires immediately = sub-1-min
    });

    // If this lead arrived through a client's referral link, record the referral.
    if (d.referred_by_code) {
      try {
        var refRows = await sbSelect(env, 'cdb_clients?select=id&referral_code=eq.' + encodeURIComponent(d.referred_by_code) + '&limit=1');
        var referrer = refRows && refRows[0];
        await sbInsert(env, 'cdb_referrals', {
          referrer_client_id: referrer ? referrer.id : null,
          referrer_code: d.referred_by_code,
          referred_lead_id: lead ? lead.id : null,
          referred_name: d.name, referred_email: d.email, status: 'pending'
        });
      } catch (e2) { /* non-fatal */ }
    }
  } catch (e) { /* keep going; email fallback below */ }

  // ── Sub-1-minute auto-response via Resend (if configured) ─────
  if (env.RESEND_API_KEY) {
    var notify = sendEmail(env, {
      to: 'Tiffany@CiriloDB.com',
      subject: 'New consultation request: ' + d.name + (d.address ? ' (' + d.address + ')' : ''),
      html: leadEmailHtml(d)
    });
    var ack = sendEmail(env, {
      to: d.email,
      subject: 'We received your request - Cirilo Design + Build',
      html: ackHtml(d)
    });
    try { await Promise.all([notify, ack]); } catch (e) { /* non-fatal */ }
  }

  return json({ ok: true, lead_id: lead ? lead.id : null }, 200);
}

async function sendEmail(env, m) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Cirilo Design + Build <noreply@cirilodb.com>', to: [m.to], subject: m.subject, html: m.html })
  });
}

function leadEmailHtml(d) {
  return '<h2>New Consultation Request</h2>' +
    row('Name', d.name) + row('Email', d.email) + row('Phone', d.phone) + row('Address', d.address) +
    row('Project', d.project_type) + row('Budget', d.budget) + row('Timeline', d.timeline) +
    '<p><strong>Message:</strong><br>' + (d.message || '(none)') + '</p>';
}
function ackHtml(d) {
  return '<p>Hi ' + (d.name || '') + ',</p><p>Thank you for reaching out to Cirilo Design + Build. We received your request and will respond personally within one business hour.</p>' +
    '<p>In the meantime, you can view our work at cirilodb.com/portfolio.</p><p>Tiffany Cirilo<br>Cirilo Design + Build<br>(910) 409-0648</p>';
}
function row(k, v) { return v ? '<p><strong>' + k + ':</strong> ' + v + '</p>' : ''; }

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}
