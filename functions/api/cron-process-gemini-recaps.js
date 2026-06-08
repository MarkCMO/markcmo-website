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
          candAudit.step = 'no_gemini_doc_yet';
          event = 'gemini_recap_skipped';
          run.skipped.push({ engagement_id: cand.engagement_id, reason: 'gemini_doc_not_ready' });
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
