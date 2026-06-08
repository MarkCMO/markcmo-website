// /api/cron-process-gemini-recaps
//
// Cron-driven endpoint. Sweeps recently-ended Calendly meetings, finds
// the matching Gemini-generated notes doc in Mark's Drive, parses it,
// and replaces the scheduled "templated" recap email with a personalized
// version that quotes real meeting content (summary, key points, action
// items).
//
// Design:
//   - Triggered every 5 min by a small Cloudflare Worker (or any HTTP
//     cron - the endpoint is idempotent + cheap)
//   - Looks at engagements where event ended in the last 60 min and
//     hasn't been recap-personalized yet (no gemini_recap_sent audit
//     entry for that engagement)
//   - For each candidate: find Gemini doc -> parse -> DELETE the
//     scheduled templated recap on Resend -> send personalized recap
//   - If Gemini notes aren't ready yet (typical 5-10 min lag), skip and
//     try again next cron run. The templated recap is still scheduled
//     to fire at T+30min as a safety net.
//   - All wrapped in audit log writes so we know exactly which
//     engagements got the personalized treatment and which fell back
//     to the template.
//
// Auth: protected by ?key=<CRON_SHARED_SECRET> query param OR
// X-Cron-Secret header. CRON_SHARED_SECRET is already set on the Pages
// project (used by markcmo-cron worker for other endpoints).

import { findGeminiMeetingNotes, getDocPlainText, extractRecapSections } from '../_lib/google-drive.js';

const RECAP_LOOKBACK_MIN = 60;  // look at meetings ended in the last hour
const MAX_ENGAGEMENTS_PER_RUN = 10;

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Auth check
  const secret = env.CRON_SHARED_SECRET;
  const providedKey = url.searchParams.get('key') || request.headers.get('X-Cron-Secret');
  if (secret && providedKey !== secret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const run = {
    started_at: new Date().toISOString(),
    candidates_found: 0,
    processed: [],
    skipped: [],
    errors: [],
  };

  try {
    // ───── Find candidate engagements ─────
    const lookbackIso = new Date(Date.now() - RECAP_LOOKBACK_MIN * 60 * 1000).toISOString();

    // Find engagements whose meeting end_time is in the last 60 min.
    // We look at metadata->>scheduled_at as a proxy for the meeting start
    // (Calendly Q&A stores it there). The recap fires from the schedule
    // logic in calendly-webhook so we check the audit log for the
    // calendly_booking_created event (which has scheduled_at) and pair
    // it with the engagement.
    const auditQuery = `mc_audit_log?event=eq.calendly_booking_created&created_at=gte.${encodeURIComponent(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())}&order=created_at.desc&limit=200&select=engagement_id,client_id,payload`;
    const recentBookings = await sbSelect(env, auditQuery);

    // Filter to bookings whose scheduled meeting end was in the last
    // RECAP_LOOKBACK_MIN minutes (Gemini docs typically appear 5-10 min
    // after meeting end, so this is the right window to look for them)
    const now = Date.now();
    const candidates = [];
    for (const row of recentBookings) {
      const p = row.payload || {};
      const startAt = p.scheduled_at ? new Date(p.scheduled_at).getTime() : null;
      if (!startAt || isNaN(startAt)) continue;
      // Assume 30-min default duration when end_time isn't stored. Gemini
      // takes long enough that we want to look 5-65 min after the meeting
      // SHOULD HAVE ENDED.
      const assumedEndMs = startAt + 30 * 60 * 1000;
      const minutesSinceEnd = (now - assumedEndMs) / 60000;
      if (minutesSinceEnd < 5 || minutesSinceEnd > RECAP_LOOKBACK_MIN) continue;
      candidates.push({
        engagement_id: row.engagement_id,
        client_id: row.client_id,
        invitee_email: p.invitee_email,
        invitee_name: p.invitee_name,
        event_name: p.event_name,
        scheduled_at: p.scheduled_at,
        assumed_end_ms: assumedEndMs,
      });
    }
    run.candidates_found = candidates.length;

    // Skip engagements that already have a gemini_recap_sent audit entry
    const candidateIds = candidates.map(c => c.engagement_id).filter(Boolean);
    let alreadyProcessedIds = new Set();
    if (candidateIds.length) {
      const inList = candidateIds.map(id => `"${id}"`).join(',');
      const processedQuery = `mc_audit_log?event=eq.gemini_recap_sent&engagement_id=in.(${inList})&select=engagement_id`;
      try {
        const processed = await sbSelect(env, processedQuery);
        for (const r of processed) {
          if (r.engagement_id) alreadyProcessedIds.add(r.engagement_id);
        }
      } catch (_) {}
    }

    // ───── Pre-fetch engagement metadata for candidates ─────
    // We need attended_confirmed_at + resend_ids to drive no-show flow.
    const engagementsById = {};
    if (candidateIds.length) {
      const inList = candidateIds.map(id => `"${id}"`).join(',');
      try {
        const engs = await sbSelect(env, `mc_engagements?id=in.(${inList})&select=id,client_id,metadata`);
        for (const e of engs) engagementsById[e.id] = e;
      } catch (_) {}
    }

    // ───── Process each candidate ─────
    let processedCount = 0;
    for (const cand of candidates) {
      if (processedCount >= MAX_ENGAGEMENTS_PER_RUN) {
        run.skipped.push({ engagement_id: cand.engagement_id, reason: 'max_per_run_reached' });
        continue;
      }
      if (alreadyProcessedIds.has(cand.engagement_id)) {
        run.skipped.push({ engagement_id: cand.engagement_id, reason: 'already_personalized' });
        continue;
      }
      processedCount++;

      const candAudit = {
        engagement_id: cand.engagement_id,
        invitee_email: cand.invitee_email,
        invitee_name: cand.invitee_name,
        event_name: cand.event_name,
        scheduled_at: cand.scheduled_at,
        assumed_end_iso: new Date(cand.assumed_end_ms).toISOString(),
        gemini_doc_found: false,
        gemini_doc_id: null,
        gemini_doc_name: null,
        sections_extracted: null,
        old_recap_id: null,
        old_recap_cancel_status: null,
        new_recap_id: null,
        new_recap_status: null,
        step: 'init',
      };
      let event = 'gemini_recap_attempted';

      try {
        // Find the Gemini notes doc
        candAudit.step = 'searching_drive';
        const match = await findGeminiMeetingNotes(env, {
          meetingTitle: cand.event_name,
          endedAtIso: new Date(cand.assumed_end_ms).toISOString(),
          inviteeName: cand.invitee_name,
        });
        if (!match) {
          // No Gemini doc yet. Decide between "not ready, retry later"
          // vs "no-show, time to send the no-show email instead":
          //   - meeting ended < 15 min ago  -> retry next cron run
          //   - meeting ended >= 15 min ago AND attended_confirmed_at not
          //     set on engagement metadata  -> NO-SHOW flow
          const minutesSinceEnd = (Date.now() - cand.assumed_end_ms) / 60000;
          const eng = engagementsById[cand.engagement_id];
          const meta = eng?.metadata || {};
          const wasConfirmed = !!meta.attended_confirmed_at;

          if (minutesSinceEnd < 15 || wasConfirmed) {
            // Either too early to call it a no-show OR they clicked the
            // T-15min confirm button. Skip and let cron try again.
            candAudit.step = wasConfirmed
              ? 'confirmed_via_button_no_gemini_yet'
              : 'no_gemini_doc_yet';
            event = 'gemini_recap_skipped';
            run.skipped.push({ engagement_id: cand.engagement_id, reason: candAudit.step });
            continue;
          }

          // ─── NO-SHOW FLOW ───
          candAudit.step = 'no_show_detected';
          try {
            // Cancel any future scheduled recap + rebook CTA
            const cancelIds = [meta.followup_resend_id, meta.rebook_cta_resend_id].filter(Boolean);
            const cancelResults = [];
            for (const rid of cancelIds) {
              try {
                const dRes = await fetch(`https://api.resend.com/emails/${encodeURIComponent(rid)}`, {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
                });
                cancelResults.push({ id: rid, status: dRes.status });
              } catch (e) {
                cancelResults.push({ id: rid, error: (e && e.message) || String(e) });
              }
            }
            candAudit.no_show_cancelled = cancelResults;

            // Send the no-show email to the invitee + alert to Mark
            const noShowResult = await sendNoShowEmails(env, { cand });
            candAudit.no_show_invitee_resend_id = noShowResult.invitee_resend_id;
            candAudit.no_show_alert_resend_id = noShowResult.alert_resend_id;
            event = 'invitee_no_show_handled';
            run.processed.push({
              engagement_id: cand.engagement_id,
              action: 'no_show',
              invitee_email: cand.invitee_email,
            });
          } catch (err) {
            candAudit.error_message = (err && err.message) || String(err);
            event = 'invitee_no_show_crashed';
          }
          continue;
        }
        candAudit.gemini_doc_found = true;
        candAudit.gemini_doc_id = match.fileId;
        candAudit.gemini_doc_name = match.name;
        candAudit.step = 'fetching_doc';

        // Pull plain text + parse sections
        const text = await getDocPlainText(env, match.fileId);
        const sections = extractRecapSections(text);
        candAudit.sections_extracted = {
          summary_chars: (sections.summary || '').length,
          key_points: sections.keyPoints?.length || 0,
          action_items: sections.actionItems?.length || 0,
          decisions: sections.decisions?.length || 0,
        };
        candAudit.step = 'composed';

        // DELETE the scheduled templated recap so the prospect doesn't
        // receive both. Use the followup_resend_id stored on engagement
        // metadata during the original booking.
        let oldRecapId = null;
        try {
          const eng = await sbSelect(env, `mc_engagements?id=eq.${encodeURIComponent(cand.engagement_id)}&select=metadata&limit=1`);
          oldRecapId = eng[0]?.metadata?.followup_resend_id || null;
        } catch (_) {}
        if (oldRecapId) {
          candAudit.old_recap_id = oldRecapId;
          try {
            const delRes = await fetch(`https://api.resend.com/emails/${encodeURIComponent(oldRecapId)}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
            });
            candAudit.old_recap_cancel_status = delRes.status;
          } catch (e) {
            candAudit.old_recap_cancel_status = `err: ${(e && e.message) || String(e)}`;
          }
        }

        // Send the personalized recap NOW (if the templated one was
        // already scheduled to send in <30 min, sending now is fine -
        // recipient gets exactly one recap email either way).
        candAudit.step = 'sending_personalized';
        const sendResult = await sendPersonalizedRecap(env, { cand, sections });
        candAudit.new_recap_id = sendResult.resend_id;
        candAudit.new_recap_status = sendResult.status;
        candAudit.step = sendResult.ok ? 'sent' : 'send_failed';
        event = sendResult.ok ? 'gemini_recap_sent' : 'gemini_recap_failed';

        run.processed.push({ engagement_id: cand.engagement_id, doc: match.name, resend_id: sendResult.resend_id });
      } catch (err) {
        candAudit.error_message = (err && err.message) || String(err);
        candAudit.error_stack = (err && err.stack) ? String(err.stack).substring(0, 1500) : null;
        candAudit.step = (candAudit.step || 'unknown') + '_then_crashed';
        event = 'gemini_recap_crashed';
        run.errors.push({ engagement_id: cand.engagement_id, error: candAudit.error_message });
      } finally {
        try {
          await sbInsert(env, 'mc_audit_log', { engagement_id: cand.engagement_id, event, payload: candAudit });
        } catch (_) {}
      }
    }

    return new Response(JSON.stringify(run, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    run.fatal_error = (err && err.message) || String(err);
    return new Response(JSON.stringify(run, null, 2), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// ───── Send personalized recap via Resend ────────────────────────
async function sendPersonalizedRecap(env, { cand, sections }) {
  const _n = (cand.event_name || '').toLowerCase();
  const isWetyr = _n.indexOf('wetyr') >= 0;
  const firstName = (cand.invitee_name || '').split(' ')[0] || 'there';
  const fromAddr = isWetyr ? 'WETYR <info@wetyr.com>' : 'Mark Gabrielli <mark@markcmo.com>';
  const replyTo = isWetyr ? 'info@wetyr.com' : 'mark@markcmo.com';
  const subject = isWetyr ? `Following up on our WETYR meeting` : `Recap from our meeting`;

  // ─── Compose body with the actual Gemini-pulled content ───
  // Falls back gracefully if Gemini didn't produce a given section.
  const summary = sections.summary || '';
  const actionItems = sections.actionItems?.length ? sections.actionItems : [];
  const keyPoints = sections.keyPoints?.length ? sections.keyPoints : [];

  // Split action items into "Mark's" vs "theirs" - actions mentioning
  // "Mark", "I will", "follow up" lean Mark; "you", "send", "share"
  // lean prospect. Heuristic but it works on Gemini's standard output.
  const yoursWords = ['mark', 'i will', "i'll", 'follow up', 'send you', 'share with', 'review', 'put together', 'draft'];
  const theirsWords = ['you ', 'your ', 'send me', 'share', 'provide', 'forward'];
  const yoursActions = [];
  const theirsActions = [];
  for (const item of actionItems) {
    const lower = item.toLowerCase();
    const yoursScore = yoursWords.reduce((s, w) => s + (lower.includes(w) ? 1 : 0), 0);
    const theirsScore = theirsWords.reduce((s, w) => s + (lower.includes(w) ? 1 : 0), 0);
    if (theirsScore > yoursScore) theirsActions.push(item);
    else yoursActions.push(item);
  }

  // Sensible defaults if no actions were extracted
  const fallbackYours = isWetyr ? [
    'A direct cash offer or pass with reasons within 48 hours',
    'A clean term sheet if we move forward',
    'Direct line at info@wetyr.com for questions',
  ] : [
    'A follow-up note within 24 hours with the agenda we agreed on',
    'A specific proposal aligned with the outcomes you want',
    'Direct access at mark@markcmo.com for any questions',
  ];
  const fallbackTheirs = isWetyr ? [
    'The property details (address, condition, any liens)',
    'Your number and timeline',
    'Decision-maker confirmation if more than one party is involved',
  ] : [
    'The materials we discussed (slides, dashboards, ad accounts, KPIs)',
    'The 1-3 specific outcomes you want from our engagement',
    'A signoff on the proposal scope before I begin work',
  ];

  const expectFromMe = yoursActions.length ? yoursActions.slice(0, 4) : fallbackYours;
  const needFromYou = theirsActions.length ? theirsActions.slice(0, 4) : fallbackTheirs;

  // Optional opening line if Gemini produced a summary
  const opener = summary
    ? `Thanks for the time today. Quick recap of what stood out: ${summary.substring(0, 320)}`
    : `Thanks for the time today. Really enjoyed the conversation.`;

  const text = `Hi ${firstName},

${opener}

Here's what you can expect from me:
${expectFromMe.map(b => `- ${b}`).join('\n')}

Here's what I'll need from you:
${needFromYou.map(b => `- ${b}`).join('\n')}

Reply to this email with anything I missed. Looking forward to the next step.

Mark`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;padding:24px;font-size:15px;line-height:1.6;">
    <p style="margin:0 0 14px;">Hi ${esc(firstName)},</p>
    <p style="margin:0 0 14px;">${esc(opener)}</p>
    <p style="margin:0 0 8px;"><strong>Here's what you can expect from me:</strong></p>
    <ul style="margin:0 0 14px;padding-left:22px;">${expectFromMe.map(b => `<li style="margin:0 0 4px;">${esc(b)}</li>`).join('')}</ul>
    <p style="margin:0 0 8px;"><strong>Here's what I'll need from you:</strong></p>
    <ul style="margin:0 0 14px;padding-left:22px;">${needFromYou.map(b => `<li style="margin:0 0 4px;">${esc(b)}</li>`).join('')}</ul>
    <p style="margin:0 0 14px;">Reply to this email with anything I missed. Looking forward to the next step.</p>
    <p style="margin:0;">Mark</p>
  </div>
</body></html>`;

  const idempotencyKey = `cal-recap-personalized-${cand.engagement_id || cand.invitee_email}`.substring(0, 256);
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      from: fromAddr,
      to: [cand.invitee_email],
      cc: ['marklgabriellijr@gmail.com'],
      reply_to: replyTo,
      subject, html, text,
      tags: [
        { name: 'category', value: 'calendly_recap_personalized' },
        { name: 'mode', value: isWetyr ? 'wetyr' : 'markcmo' },
        { name: 'gemini', value: 'true' },
      ],
    }),
  });
  let resendId = null;
  try { const j = await r.json(); resendId = j?.id || null; } catch (_) {}
  return { ok: r.ok, status: r.status, resend_id: resendId };
}

// ───── sendNoShowEmails (to invitee + alert to Mark) ──────────────
// Fires when the cron determines a meeting was a no-show (no Gemini
// notes available 15+ min after expected end AND attendance button
// was never clicked). Sends:
//   - To invitee: "didn't see you, want to grab another time?" with
//     a soft rebook link. No template recap, no rebook CTA at T+72h.
//   - To Mark: short alert email so he knows to follow up personally.
async function sendNoShowEmails(env, { cand }) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey || !cand.invitee_email) return { invitee_resend_id: null, alert_resend_id: null };

  const firstName = (cand.invitee_name || '').split(' ')[0] || 'there';
  const _n = (cand.event_name || '').toLowerCase();
  const isWetyr = _n.indexOf('wetyr') >= 0;
  const fromAddr = isWetyr ? 'WETYR <info@wetyr.com>' : 'Mark Gabrielli <mark@markcmo.com>';
  const replyTo = isWetyr ? 'info@wetyr.com' : 'mark@markcmo.com';
  const bookingUrl = isWetyr ? 'https://wetyr.com/contact.html' : 'https://markcmo.com/book';

  // ─── Email 1: to invitee ───
  const inviteeSubject = `Sorry I missed you - want to grab another time?`;
  const inviteeText = `Hi ${firstName},

Didn't catch you on the call today - things come up. If you still want to talk, grab another slot whenever works:

${bookingUrl}

If timing isn't right or you've decided to go a different direction, no problem - just hit reply and let me know.

Mark`;
  const inviteeHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;padding:24px;font-size:15px;line-height:1.6;">
    <p style="margin:0 0 14px;">Hi ${esc(firstName)},</p>
    <p style="margin:0 0 14px;">Didn't catch you on the call today - things come up. If you still want to talk, grab another slot whenever works:</p>
    <p style="margin:0 0 18px;"><a href="${esc(bookingUrl)}" style="display:inline-block;background:#C9A84C;color:#0a0f2c;padding:11px 22px;text-decoration:none;border-radius:6px;font-weight:700;">Book another time</a></p>
    <p style="margin:0 0 14px;">If timing isn't right or you've decided to go a different direction, no problem - just hit reply and let me know.</p>
    <p style="margin:0;">Mark</p>
  </div>
</body></html>`;

  let inviteeResendId = null;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `cal-noshow-invitee-${cand.engagement_id || cand.invitee_email}`.substring(0, 256),
      },
      body: JSON.stringify({
        from: fromAddr,
        to: [cand.invitee_email],
        cc: ['marklgabriellijr@gmail.com'],
        reply_to: replyTo,
        subject: inviteeSubject,
        html: inviteeHtml,
        text: inviteeText,
        tags: [
          { name: 'category', value: 'calendly_no_show_invitee' },
          { name: 'mode', value: isWetyr ? 'wetyr' : 'markcmo' },
        ],
      }),
    });
    if (r.ok) {
      const j = await r.json().catch(() => null);
      inviteeResendId = j?.id || null;
    }
  } catch (_) {}

  // ─── Email 2: alert to Mark ───
  const alertSubject = `✗ NO-SHOW: ${cand.invitee_name || cand.invitee_email} for ${cand.event_name || 'meeting'}`;
  const alertText = `${cand.invitee_name || cand.invitee_email} did not attend the meeting that was scheduled for ${cand.scheduled_at}.\n\nWe just sent them a "didn't see you, want to grab another time?" email with the rebooking link.\n\nIf you want to follow up personally, their email is: ${cand.invitee_email}`;
  const alertHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#F8FAFC;font-family:Arial,sans-serif;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border-top:4px solid #e74c3c;">
  <div style="padding:22px 24px;">
    <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#e74c3c;margin-bottom:6px;font-weight:700;">NO-SHOW DETECTED</div>
    <h1 style="font-size:18px;margin:0 0 8px;font-weight:700;color:#0a0f2c;">${esc(cand.invitee_name || cand.invitee_email)}</h1>
    <p style="font-size:14px;color:#475569;margin:0 0 10px;line-height:1.5;">Did not attend the <strong>${esc(cand.event_name || 'meeting')}</strong> scheduled for <strong>${esc(new Date(cand.scheduled_at).toLocaleString('en-US',{dateStyle:'short',timeStyle:'short',timeZone:'America/New_York'}))} ET</strong>.</p>
    <p style="font-size:13px;color:#64748B;margin:0 0 12px;">Detection: no Gemini notes published 15+ min after meeting end, and the T-15min confirmation button was never clicked.</p>
    <p style="font-size:13px;color:#64748B;margin:0;">We sent them a "want another time?" email with the rebooking link. Reply directly here if you want to reach out personally: <a href="mailto:${esc(cand.invitee_email)}" style="color:#1a4d8c;">${esc(cand.invitee_email)}</a></p>
  </div>
</div></body></html>`;

  let alertResendId = null;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'MarkCMO <forms@markcmo.com>',
        to: ['mark@markcmo.com', 'marklgabriellijr@gmail.com'],
        subject: alertSubject,
        html: alertHtml,
        text: alertText,
        tags: [{ name: 'category', value: 'calendly_no_show_alert' }],
      }),
    });
    if (r.ok) {
      const j = await r.json().catch(() => null);
      alertResendId = j?.id || null;
    }
  } catch (_) {}

  return { invitee_resend_id: inviteeResendId, alert_resend_id: alertResendId };
}

// ───── Supabase REST helpers (duplicated from calendly-webhook to avoid cross-file imports) ───
function sbHeaders(env) {
  const key = env.MARKCMO_SUPABASE_SERVICE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}
async function sbSelect(env, path) {
  const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders(env) });
  if (!res.ok) throw new Error(`sbSelect ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
async function sbInsert(env, table, body) {
  const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...sbHeaders(env), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`sbInsert ${table} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
