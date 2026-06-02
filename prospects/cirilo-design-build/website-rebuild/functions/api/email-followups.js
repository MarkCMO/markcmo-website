// /api/email-followups - compute the follow-ups that are DUE across the
// journey and (optionally) log them. DRY-RUN BY DEFAULT.
//
// IMPORTANT (project RULE #0): this endpoint never sends email on its own.
// The actual Resend send is intentionally NOT wired here. It logs what it
// WOULD send to cdb_email_log with status 'dry_run' so Tiffany/Mark can
// review the queue. Turning on real sends requires explicit sign-off and
// wiring the send call behind EMAIL_SEND_ENABLED + per-recipient consent.
import { sbSelect, sbInsert, json } from './_lib.js';

// Follow-up rules. Keep windows conservative.
async function computeDue(env) {
  var out = [];
  var now = Date.now();

  // 1) Consultation follow-ups: open leads that have gone quiet.
  var leads = await sbSelect(env, 'cdb_leads?select=*&order=created_at.desc&limit=300');
  leads.forEach(function (l) {
    var ageH = (now - new Date(l.created_at)) / 3.6e6;
    var open = ['new', 'contacted', 'consult_requested'].indexOf(l.status) > -1;
    if (open && ageH >= 24 && ageH <= 24 * 21 && l.email) {
      out.push({ to: l.email, name: l.name, template: 'consult_followup', lead_id: l.id, reason: 'No conversion ' + Math.round(ageH) + 'h after inquiry' });
    }
  });

  // 2) Payment reminders: reported draws not yet confirmed after 72h.
  var pays = await sbSelect(env, 'cdb_payments?select=*&order=created_at.desc&limit=300');
  pays.forEach(function (p) {
    if (p.status === 'reported') {
      var ageH = (now - new Date(p.reported_at || p.created_at)) / 3.6e6;
      if (ageH >= 72) {
        out.push({ to: null, template: 'payment_reminder', payment_id: p.id, reason: 'Draw reported but unconfirmed ' + Math.round(ageH) + 'h', draw: p.draw_label });
      }
    }
  });

  return out;
}

export async function onRequestGet(context) { return run(context, false); }
export async function onRequestPost(context) {
  var d = {}; try { d = await context.request.json(); } catch (e) {}
  return run(context, d.send === true);
}

async function run(context, wantSend) {
  var env = context.env;
  try {
    var due = await computeDue(env);

    // Sending is GATED OFF by default. Even when the flag is on, the actual
    // Resend call is intentionally omitted pending explicit consent.
    var sendEnabled = wantSend && env.EMAIL_SEND_ENABLED === 'true' && !!env.RESEND_API_KEY;

    for (var i = 0; i < due.length; i++) {
      var item = due[i];
      try {
        await sbInsert(env, 'cdb_email_log', {
          to_email: item.to || null, template_key: item.template,
          lead_id: item.lead_id || null,
          status: 'dry_run', // never 'sent' from this endpoint
          scheduled_for: new Date().toISOString(),
          meta: { reason: item.reason, send_requested: !!wantSend, send_enabled: sendEnabled }
        });
      } catch (e) {}
    }

    return json({
      ok: true,
      mode: 'dry_run',
      note: sendEnabled
        ? 'Send flag is on, but the Resend call is intentionally not wired. No emails were sent.'
        : 'Dry run only. No emails were sent.',
      due_count: due.length,
      due: due
    }, 200);
  } catch (e) {
    return json({ ok: true, demo: true, mode: 'dry_run', due_count: 0, due: [], note: 'Supabase not connected.' }, 200);
  }
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-admin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } });
}
