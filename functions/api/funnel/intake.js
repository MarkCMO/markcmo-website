// /api/funnel/intake   (GET to resume, POST to submit)
// ─────────────────────────────────────────────────────────────────────────────
// Stage 2 post-call deep intake.
//
//   GET  ?token=<resume_token>
//        Returns the prospect basics + any saved answers so the front-end can
//        resume a partially-completed intake.
//
//   POST { token, answers, partial? }
//        partial=true  -> just save progress (no scoring, no proposal).
//        partial=false -> full score, lock segment / growth stage / engagement
//                         type, recommend the package, build the proposal model,
//                         store a draft proposal, route the deal, advance stage,
//                         notify Mark + the assigned consultant.
//
// Decisioning is in funnel-engine.js; this handler is transport + persistence.
// ─────────────────────────────────────────────────────────────────────────────
import { scoreIntake, buildProposalModel, routeAssignment, DEFAULT_PRICING } from '../../_lib/funnel-engine.js';
import { themeCss, DEFAULT_THEME } from '../../_lib/funnel-themes.js';
import { sbInsert, sbPatch, sbSelect, logEvent, safeAudit, parseBody, json, cors, clientMeta } from '../../_lib/funnel-db.js';

const HANDLER_VERSION = 'funnel-intake-v1-2026-06-24';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return cors();
  if (request.method === 'GET') return handleResume(context);
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const payload = await parseBody(request);
  if (!payload) return json(400, { error: 'invalid_body' });
  const token = String(payload.token || '').trim();
  if (!token) return json(400, { error: 'missing_token' });

  const prospect = await getByToken(env, token);
  if (!prospect) return json(404, { error: 'not_found' });

  const answers = (payload.answers && typeof payload.answers === 'object') ? payload.answers : {};

  // Persist each answer (append-only) + mark intake started.
  try {
    const rows = Object.entries(answers)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => ({ prospect_id: prospect.id, stage: 'full', question_key: k, value: v }));
    if (rows.length) await sbInsert(env, 'mcf_answers', rows);
  } catch (e) {
    await safeAudit(env, 'funnel_intake_answers_failed', { error: String(e), prospect_id: prospect.id });
  }

  if (payload.partial) {
    await sbPatch(env, 'mcf_prospects', `id=eq.${prospect.id}`, { stage: 'intake_started', raw_intake: answers, updated_at: new Date().toISOString() }).catch(() => {});
    await logEvent(env, prospect.id, 'stage2_progress', { keys: Object.keys(answers).length }, 'prospect');
    return json(200, { ok: true, saved: true, handler_version: HANDLER_VERSION });
  }

  // ---- Full scoring + package + proposal model ----
  const pre = {
    pre_score: prospect.pre_score,
    segment_tag: prospect.segment,
    growth_stage: prospect.growth_stage,
    marketing_capacity: prospect.marketing_capacity,
  };
  const intake = scoreIntake({ pre, answers });
  const proposalModel = buildProposalModel({ prospect, intake, answers, pricing: DEFAULT_PRICING });

  // Monthly + one-time totals from line items.
  const monthly_total = sum(intake.line_items, (li) => li.recurrence === 'monthly' ? num(li.amount) : 0);
  const onetime_total = sum(intake.line_items, (li) => li.recurrence === 'one_time' ? num(li.amount) : 0);

  // Update prospect with full classification.
  await sbPatch(env, 'mcf_prospects', `id=eq.${prospect.id}`, {
    stage: 'intake_done',
    full_score: intake.full_score,
    segment: intake.segment,
    growth_stage: intake.growth_stage,
    marketing_capacity: intake.marketing_capacity,
    engagement_type: intake.engagement_type,
    budget_band: intake.budget_band,
    recommended_tier: intake.recommended_tier,
    recommended_package: intake.recommended_package,
    wetyr_track: intake.wetyr_track,
    tags: intake.tags,
    flags: intake.flags,
    raw_intake: answers,
    updated_at: new Date().toISOString(),
  }).catch((e) => safeAudit(env, 'funnel_intake_patch_failed', { error: String(e), prospect_id: prospect.id }));

  // Route the deal.
  let routing = { assigned: null, queue: 'waitlist', reason: 'unrouted', approval: true };
  try {
    const consultants = await sbSelect(env, 'mcf_consultants', 'select=*&active=eq.true');
    const budgetMonthly = bandToMonthly(intake.budget_band);
    const complianceTags = arr(answers.f_compliance).filter((t) => String(t).startsWith('compliance_'));
    routing = routeAssignment({ intake, consultants, budgetMonthly, complianceTags });
    await sbPatch(env, 'mcf_prospects', `id=eq.${prospect.id}`, {
      assigned_to: routing.assigned?.id || null,
      assignment_queue: routing.queue,
    }).catch(() => {});
  } catch (e) {
    await safeAudit(env, 'funnel_intake_route_failed', { error: String(e), prospect_id: prospect.id });
  }

  // Store the draft proposal.
  let proposalId = null;
  try {
    const expires = new Date(Date.now() + 14 * 864e5).toISOString();
    const rows = await sbInsert(env, 'mcf_proposals', {
      prospect_id: prospect.id,
      tier: intake.recommended_tier,
      engagement_type: intake.engagement_type,
      line_items: intake.line_items,
      model: proposalModel,
      monthly_total,
      onetime_total,
      term_months: 12,
      mode: prospect.proposal_mode || 'productized',
      theme: prospect.theme || DEFAULT_THEME,
      brand_kit: prospect.brand_kit || null,
      status: 'draft',
      expires_at: expires,
    });
    proposalId = rows?.[0]?.id || null;
  } catch (e) {
    await safeAudit(env, 'funnel_intake_proposal_failed', { error: String(e), prospect_id: prospect.id });
  }

  await logEvent(env, prospect.id, 'stage2_completed', {
    full_score: intake.full_score, segment: intake.segment, growth_stage: intake.growth_stage,
    engagement_type: intake.engagement_type, tier: intake.recommended_tier,
    queue: routing.queue, approval: routing.approval, proposal_id: proposalId,
  }, 'prospect');

  await notifyTeam(env, { prospect, intake, routing, proposalId, monthly_total, onetime_total });

  return json(200, {
    ok: true,
    prospect_id: prospect.id,
    proposal_id: proposalId,
    full_score: intake.full_score,
    segment: intake.segment,
    growth_stage: intake.growth_stage,
    engagement_type: intake.engagement_type,
    recommended_tier: intake.recommended_tier,
    recommended_package: intake.recommended_package,
    needs_approval: routing.approval,
    handler_version: HANDLER_VERSION,
  });
}

// ---- GET resume ----
async function handleResume(context) {
  const { request, env } = context;
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return json(400, { error: 'missing_token' });
  const prospect = await getByToken(env, token);
  if (!prospect) return json(404, { error: 'not_found' });

  let saved = {};
  try {
    const rows = await sbSelect(env, 'mcf_answers', `select=question_key,value&prospect_id=eq.${prospect.id}&stage=eq.full&order=answered_at.asc`);
    for (const r of rows) saved[r.question_key] = r.value; // later answers overwrite earlier
  } catch (_) {}

  const themeKey = prospect.theme && prospect.theme !== 'client_brand' ? prospect.theme : DEFAULT_THEME;
  return json(200, {
    ok: true,
    prospect: {
      id: prospect.id,
      full_name: prospect.full_name,
      company: prospect.company,
      email: prospect.email,
      segment: prospect.segment,
      growth_stage: prospect.growth_stage,
      marketing_capacity: prospect.marketing_capacity,
      stage: prospect.stage,
    },
    answers: saved,
    theme: themeKey,
    theme_css: themeCss(themeKey),
    handler_version: HANDLER_VERSION,
  });
}

async function getByToken(env, token) {
  try {
    const rows = await sbSelect(env, 'mcf_prospects', `select=*&resume_token=eq.${encodeURIComponent(token)}&limit=1`);
    return rows?.[0] || null;
  } catch (_) {
    return null;
  }
}

async function notifyTeam(env, { prospect, intake, routing, proposalId, monthly_total, onetime_total }) {
  if (!env.RESEND_API_KEY) return;
  const to = ['mark@markcmo.com'];
  if (routing.assigned?.email && !to.includes(routing.assigned.email)) to.push(routing.assigned.email);
  const queueLabel = { mark_direct: 'Mark direct', mark_approval: 'Mark approval queue', fractional: 'Fractional CMO', specialist: 'Specialist', waitlist: 'WAITLIST - no capacity' }[routing.queue] || routing.queue;
  const rows = [
    ['Name', prospect.full_name || prospect.email], ['Company', prospect.company],
    ['Full score', String(intake.full_score)],
    ['Segment', intake.segment], ['Growth stage', intake.growth_stage],
    ['Engagement', intake.engagement_type], ['Recommended', intake.recommended_package],
    ['Monthly', monthly_total ? `$${monthly_total.toLocaleString()}` : 'quote'],
    ['One-time', onetime_total ? `$${onetime_total.toLocaleString()}` : '-'],
    ['Routing', `${queueLabel}${routing.assigned ? ' -> ' + routing.assigned.name : ''}`],
    ['Needs approval', routing.approval ? 'YES' : 'no'],
  ];
  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;background:#f6f7f8;margin:0;padding:24px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:24px;">
<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#C9A84C;font-weight:700;">Deep intake complete - proposal drafted</div>
<h1 style="font-size:20px;color:#111;margin:6px 0 16px;">${esc(prospect.full_name || prospect.email)}</h1>
<table style="border-collapse:collapse;width:100%;">${rows.map(([l, v]) => v ? `<tr><td style="padding:5px 16px 5px 0;color:#9aa0a6;font-size:13px;white-space:nowrap;vertical-align:top;">${esc(l)}</td><td style="padding:5px 0;color:#111;font-size:14px;">${esc(v)}</td></tr>` : '').join('')}</table>
<div style="margin-top:16px;font-size:12px;color:#6b7280;">Proposal #${proposalId || '?'} drafted. ${routing.approval ? 'Awaiting your approval before send.' : 'Cleared for send.'}</div>
</div></body></html>`;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'MarkCMO Funnel <leads@markcmo.com>',
        to,
        subject: `[Intake done] ${prospect.full_name || prospect.email} - ${intake.recommended_package} (${intake.full_score} pts)`,
        html,
        tags: [{ name: 'category', value: 'funnel_intake' }, { name: 'tier', value: intake.recommended_tier }],
      }),
    });
  } catch (e) {
    await safeAudit(env, 'funnel_intake_notify_failed', { error: String(e), prospect_id: prospect.id });
  }
}

function bandToMonthly(band) {
  return { UNDER_5K: 4000, B5_8K: 6500, B8_12K: 10000, B12_20K: 16000, OVER_20K: 22000 }[band] || 0;
}
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function sum(arrItems, fn) { return (arrItems || []).reduce((a, x) => a + (fn(x) || 0), 0); }
function arr(v) { return Array.isArray(v) ? v : v == null || v === '' ? [] : [v]; }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
