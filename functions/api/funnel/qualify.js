// /api/funnel/qualify   (POST)
// ─────────────────────────────────────────────────────────────────────────────
// Stage 1 pre-call qualifier submission. Scores the prospect, classifies
// segment + growth stage + marketing capacity, decides disposition, stores the
// prospect + per-question answers + event, notifies Mark, and returns the next
// step (book the call, soft-nurture, or free resources).
//
// Deterministic decisioning lives in funnel-engine.js. This handler is just
// transport + persistence + notification.
// ─────────────────────────────────────────────────────────────────────────────
import { scorePreQualifier } from '../../_lib/funnel-engine.js';
import { sbInsert, sbPatch, logEvent, safeAudit, parseBody, json, cors, clientMeta, makeToken, validEmail } from '../../_lib/funnel-db.js';

const HANDLER_VERSION = 'funnel-qualify-v1-2026-06-24';

const SCORED_KEYS = [
  'pre_business_type', 'pre_revenue', 'pre_growth_stage', 'pre_marketing_dept',
  'pre_primary_need', 'pre_budget_band', 'pre_urgency', 'pre_role', 'pre_authority',
];

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return cors();
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const payload = await parseBody(request);
  if (!payload) return json(400, { error: 'invalid_body' });

  // Honeypot
  if (payload['bot-field'] && String(payload['bot-field']).trim()) {
    return json(200, { ok: true, spam: true });
  }

  // Contact (not scored)
  const full_name = String(payload.full_name || payload.name || '').trim().slice(0, 200);
  const email = String(payload.email || payload.work_email || '').trim().toLowerCase().slice(0, 200);
  const company = String(payload.company || '').trim().slice(0, 200);
  const phone = String(payload.phone || '').trim().slice(0, 60);
  const website = String(payload.website || '').trim().slice(0, 300);

  if (!validEmail(email)) return json(400, { error: 'invalid_email' });

  // Score (pure)
  const result = scorePreQualifier(payload);
  const meta = clientMeta(request);
  const resume_token = makeToken();

  // Persist prospect
  let prospect = null;
  try {
    const rows = await sbInsert(env, 'mcf_prospects', {
      resume_token,
      source: String(payload.source || meta.referer || 'start_page').slice(0, 120),
      stage: result.disposition === 'DISQUALIFIED' ? 'disqualified' : 'qualified',
      full_name: full_name || null,
      email,
      company: company || null,
      phone: phone || null,
      website: website || null,
      role: String(payload.pre_role || '').slice(0, 80) || null,
      pre_score: result.pre_score,
      disposition: result.disposition,
      segment: result.segment_tag,
      growth_stage: result.growth_stage,
      marketing_capacity: result.marketing_capacity,
      budget_band: result.budget_band,
      flags: result.flags,
      disqualify_reason: result.disposition === 'DISQUALIFIED' ? result.route.reason : null,
      ip: meta.ip,
      user_agent: meta.user_agent,
      raw_pre: payload,
    });
    prospect = rows?.[0] || null;
  } catch (e) {
    await safeAudit(env, 'funnel_qualify_insert_failed', { error: String(e) });
  }

  // Append per-question answers (best effort)
  if (prospect?.id) {
    try {
      const answerRows = SCORED_KEYS.filter((k) => payload[k] != null && payload[k] !== '')
        .map((k) => ({ prospect_id: prospect.id, stage: 'pre', question_key: k, value: payload[k] }));
      if (answerRows.length) await sbInsert(env, 'mcf_answers', answerRows);
    } catch (_) {}
    await logEvent(env, prospect.id, 'stage1_qualified', {
      pre_score: result.pre_score, disposition: result.disposition,
      segment: result.segment_tag, growth_stage: result.growth_stage,
      marketing_capacity: result.marketing_capacity,
    });
  }

  // Notify Mark (inbound, not through approval queue)
  await notifyMark(env, { prospect, result, full_name, email, company, phone, website });

  // Response - drive the front-end's next step
  return json(200, {
    ok: true,
    prospect_id: prospect?.id || null,
    disposition: result.disposition,
    pre_score: result.pre_score,
    segment: result.segment_tag,
    growth_stage: result.growth_stage,
    marketing_capacity: result.marketing_capacity,
    route: result.route,
    handler_version: HANDLER_VERSION,
  });
}

async function notifyMark(env, { prospect, result, full_name, email, company, phone, website }) {
  if (!env.RESEND_API_KEY) return;
  const dispEmoji = { HOT: 'HOT', WARM: 'WARM', COOL: 'COOL', DISQUALIFIED: 'NOT YET' }[result.disposition] || result.disposition;
  const subject = `[${dispEmoji}] Qualifier: ${full_name || email}${company ? ` (${company})` : ''} - ${result.pre_score} pts`;
  const rows = [
    ['Name', full_name], ['Email', email], ['Company', company], ['Phone', phone], ['Website', website],
    ['Disposition', `${result.disposition} (${result.pre_score} pts)`],
    ['Segment', result.segment_tag],
    ['Growth stage', result.growth_stage],
    ['Marketing dept', result.marketing_capacity],
    ['Budget band', result.budget_band],
    ['Flags', (result.flags || []).join(', ') || 'none'],
    ['Next step', result.route.action],
  ];
  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;background:#f6f7f8;margin:0;padding:24px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:24px;">
<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#C9A84C;font-weight:700;">Pre-call qualifier</div>
<h1 style="font-size:20px;color:#111;margin:6px 0 16px;">${esc(full_name || email)}</h1>
<table style="border-collapse:collapse;width:100%;">${rows.map(([l, v]) => v ? `<tr><td style="padding:5px 16px 5px 0;color:#9aa0a6;font-size:13px;white-space:nowrap;vertical-align:top;">${esc(l)}</td><td style="padding:5px 0;color:#111;font-size:14px;">${esc(v)}</td></tr>` : '').join('')}</table>
</div></body></html>`;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'MarkCMO Funnel <leads@markcmo.com>',
        to: ['mark@markcmo.com'],
        reply_to: email,
        subject,
        html,
        tags: [{ name: 'category', value: 'funnel_qualifier' }, { name: 'disposition', value: result.disposition }],
      }),
    });
    if (prospect?.id) {
      try { await sbPatch(env, 'mcf_prospects', `id=eq.${prospect.id}`, { updated_at: new Date().toISOString() }); } catch (_) {}
    }
  } catch (e) {
    await safeAudit(env, 'funnel_qualify_notify_failed', { error: String(e), prospect_id: prospect?.id });
  }
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
