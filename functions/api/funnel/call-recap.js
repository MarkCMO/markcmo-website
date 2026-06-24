// /api/funnel/call-recap   (POST)
// ─────────────────────────────────────────────────────────────────────────────
// After a strategy call, send Mark an INTERNAL decision email - a control panel,
// not an auto-send to the client. It recaps the call (from the Calendly booking
// data + AI notes + the Stage-1 answers we already captured) and gives Mark
// buttons:
//
//   [ Build a CUSTOM proposal ]   -> brand-matched, pulls their logo + site CSS.
//                                    Use for big clients that need bespoke work.
//   [ Productized - <theme> ] x N -> sends the client the themed intake + a
//                                    themed hosted proposal. One button per
//                                    palette so Mark tailors the look per client
//                                    (warm/feminine, bold/masculine, etc).
//
// Nothing goes to the client until Mark clicks. The suggested theme is
// pre-highlighted from a light heuristic; Mark always has the final pick.
//
// Trigger: call this from the Calendly post-meeting automation with
//   { email | prospect_id | token, calendly:{...}, } or hit it manually.
// ─────────────────────────────────────────────────────────────────────────────
import { suggestTheme, themeButtons, THEMES } from '../../_lib/funnel-themes.js';
import { sbSelect, sbPatch, logEvent, safeAudit, parseBody, json, cors } from '../../_lib/funnel-db.js';

const HANDLER_VERSION = 'funnel-call-recap-v1-2026-06-24';
const SITE = 'https://markcmo.com';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return cors();
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const payload = await parseBody(request);
  if (!payload) return json(400, { error: 'invalid_body' });

  const result = await dispatchCallRecap(env, payload);
  if (!result.ok) return json(result.status || 404, { error: result.reason });
  return json(200, { ok: true, prospect_id: result.prospect_id, suggested_theme: result.suggested_theme, handler_version: HANDLER_VERSION });
}

// Reusable core: find the prospect, build + send Mark the decision email,
// advance stage. Importable so the Calendly post-meeting cron can fire it once
// per call without re-implementing anything. Always resolves (never throws) so
// a caller in a fragile cron can await it safely. `idempotent` guards against
// double-sends when the cron re-runs over the same meeting.
export async function dispatchCallRecap(env, payload = {}) {
  const prospect = await findProspect(env, payload);
  if (!prospect) return { ok: false, reason: 'prospect_not_found', status: 404 };
  if (!prospect.resume_token) return { ok: false, reason: 'no_resume_token', status: 409 };

  // Don't send twice for the same prospect once a recap already went out.
  if (payload.idempotent && (prospect.stage === 'call_done' || prospect.call_recap)) {
    return { ok: false, reason: 'already_sent', status: 200, skipped: true, prospect_id: prospect.id };
  }

  const calendly = (payload.calendly && typeof payload.calendly === 'object') ? payload.calendly : {};
  const recap = buildRecap({ prospect, calendly });
  const firstName = (prospect.full_name || '').trim().split(/\s+/)[0] || '';
  const suggested = suggestTheme({ firstName, segment: prospect.segment, growth_stage: prospect.growth_stage });

  let aiSummary = null;
  if (env.ANTHROPIC_API_KEY && (calendly.notes || calendly.ai_summary || calendly.transcript)) {
    aiSummary = await summarize(env, { prospect, calendly }).catch(() => null);
  }

  await sendRecap(env, { prospect, recap, aiSummary, suggested });
  await sbPatch(env, 'mcf_prospects', `id=eq.${prospect.id}`, { stage: 'call_done', call_recap: { ...recap, ai_summary: aiSummary, suggested_theme: suggested }, updated_at: new Date().toISOString() }).catch(() => {});
  await logEvent(env, prospect.id, 'call_recap_sent', { suggested_theme: suggested });

  return { ok: true, prospect_id: prospect.id, suggested_theme: suggested };
}

async function findProspect(env, p) {
  try {
    if (p.prospect_id) {
      const r = await sbSelect(env, 'mcf_prospects', `select=*&id=eq.${encodeURIComponent(p.prospect_id)}&limit=1`);
      if (r?.[0]) return r[0];
    }
    if (p.token) {
      const r = await sbSelect(env, 'mcf_prospects', `select=*&resume_token=eq.${encodeURIComponent(p.token)}&limit=1`);
      if (r?.[0]) return r[0];
    }
    if (p.email) {
      const r = await sbSelect(env, 'mcf_prospects', `select=*&email=eq.${encodeURIComponent(String(p.email).toLowerCase())}&order=created_at.desc&limit=1`);
      if (r?.[0]) return r[0];
    }
  } catch (_) {}
  return null;
}

function buildRecap({ prospect, calendly }) {
  const bullets = [];
  const seg = { HIGH_TICKET_SERVICE: 'High-ticket service', DTC_CONSUMER: 'DTC / consumer', ENTERPRISE_B2B: 'Enterprise B2B', GROWTH_SAAS: 'Growth SaaS', UNDETERMINED: 'Undetermined' }[prospect.segment] || prospect.segment;
  const stage = { GROWING: 'Growing', SUCCESSION: 'Succession planning (exit/raise)', ACQUIRING: 'Buying more businesses', UNDETERMINED: 'Stage unclear' }[prospect.growth_stage] || prospect.growth_stage;
  const cap = { NONE: 'No marketing team', SOLO: 'One marketer', LEAN: 'Lean team (2-3)', ROBUST: 'Robust team (4+)', AGENCY: 'External agency' }[prospect.marketing_capacity] || prospect.marketing_capacity;
  bullets.push(['Segment', seg]);
  bullets.push(['Stage', stage]);
  bullets.push(['Marketing dept', cap]);
  bullets.push(['Budget band', prettyBand(prospect.budget_band)]);
  bullets.push(['Pre-call score', `${prospect.pre_score ?? '-'} (${prospect.disposition || '-'})`]);
  if (calendly.event_name) bullets.push(['Call', calendly.event_name]);
  if (calendly.start_time) bullets.push(['When', calendly.start_time]);
  // Calendly booking Q&A
  const qa = Array.isArray(calendly.answers) ? calendly.answers : [];
  return { bullets, qa, notes: calendly.notes || calendly.ai_summary || null };
}

async function summarize(env, { prospect, calendly }) {
  const src = [calendly.ai_summary, calendly.notes, calendly.transcript].filter(Boolean).join('\n\n').slice(0, 6000);
  const prompt = `Write a 3-4 sentence internal recap of a strategy call for ${prospect.company || prospect.full_name}. Segment: ${prospect.segment}. Stage: ${prospect.growth_stage}. Marketing: ${prospect.marketing_capacity}. Use the notes below. Be direct, tie to revenue, no fluff, no dashes.\n\nNOTES:\n${src}`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 320, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  return (j?.content?.[0]?.text || '').trim() || null;
}

async function sendRecap(env, { prospect, recap, aiSummary, suggested }) {
  if (!env.RESEND_API_KEY) return;
  const tok = encodeURIComponent(prospect.resume_token);
  const customUrl = `${SITE}/api/funnel/dispatch?p=${tok}&path=custom`;
  const themeBtns = themeButtons().map((t) => {
    const url = `${SITE}/api/funnel/dispatch?p=${tok}&path=productized&theme=${t.key}`;
    const isSug = t.key === suggested;
    return `<a href="${url}" style="display:block;margin:8px 0;text-decoration:none;border-radius:10px;overflow:hidden;border:1.5px solid ${isSug ? '#C9A84C' : '#e5e7eb'};">
      <span style="display:block;padding:11px 16px;background:${esc(t.bg)};color:#fff;font-weight:700;font-size:14px;">
        ${isSug ? '&#9733; ' : ''}Productized &middot; ${esc(t.label)}
        <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${esc(t.accent)};vertical-align:middle;margin-left:8px;border:1px solid rgba(255,255,255,.4);"></span>
      </span>
      <span style="display:block;padding:7px 16px;background:#fafafa;color:#6b7280;font-size:11px;">${esc(t.note)}</span>
    </a>`;
  }).join('');

  const rows = recap.bullets.map(([l, v]) => v ? `<tr><td style="padding:5px 16px 5px 0;color:#9aa0a6;font-size:13px;white-space:nowrap;vertical-align:top;">${esc(l)}</td><td style="padding:5px 0;color:#111;font-size:14px;">${esc(v)}</td></tr>` : '').join('');
  const qaRows = (recap.qa || []).map((a) => `<div style="margin:6px 0;font-size:13px;color:#374151;"><b>${esc(a.question || a.q || '')}</b> ${esc(a.answer || a.a || '')}</div>`).join('');
  const summaryBlock = aiSummary
    ? `<div style="background:#fbf8f0;border:1px solid #ecdfc0;border-radius:8px;padding:14px 16px;margin:16px 0;color:#3a3320;font-size:14px;line-height:1.6;">${esc(aiSummary)}</div>`
    : (recap.notes ? `<div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin:16px 0;color:#374151;font-size:13px;line-height:1.6;white-space:pre-wrap;">${esc(recap.notes)}</div>` : '');

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;background:#f6f7f8;margin:0;padding:24px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:26px;">
  <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#C9A84C;font-weight:700;">Call recap &middot; pick the path</div>
  <h1 style="font-size:21px;color:#111;margin:6px 0 4px;">${esc(prospect.full_name || prospect.email)}${prospect.company ? ' &middot; ' + esc(prospect.company) : ''}</h1>
  <div style="font-size:12px;color:#9aa0a6;margin-bottom:14px;">${prospect.website ? esc(prospect.website) : ''}</div>
  ${summaryBlock}
  <table style="border-collapse:collapse;width:100%;margin-bottom:6px;">${rows}</table>
  ${qaRows ? `<div style="margin:10px 0 4px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#9aa0a6;">From the booking</div>${qaRows}` : ''}

  <div style="border-top:1px solid #e5e7eb;margin:20px 0 14px;"></div>

  <div style="font-size:12px;font-weight:700;color:#111;margin-bottom:8px;">CUSTOM (bespoke, brand-matched)</div>
  <a href="${customUrl}" style="display:block;text-align:center;background:#111;color:#fff;text-decoration:none;font-weight:800;font-size:15px;padding:14px;border-radius:10px;margin-bottom:6px;">Build a custom proposal &rarr;</a>
  <div style="font-size:11px;color:#9aa0a6;margin-bottom:18px;">Pulls ${esc(prospect.company || 'their')} logo + site colors/fonts. Use for clients that need bespoke work, not the productized track.</div>

  <div style="font-size:12px;font-weight:700;color:#111;margin-bottom:4px;">PRODUCTIZED (themed, auto-builds the proposal)</div>
  <div style="font-size:11px;color:#9aa0a6;margin-bottom:8px;">&#9733; = suggested for this client. Click one to send them the themed intake + proposal.</div>
  ${themeBtns}

  <div style="margin-top:18px;border-top:1px solid #e5e7eb;padding-top:12px;font-size:11px;color:#9aa0a6;">Nothing reaches the client until you click. Prospect #${esc(prospect.id)}</div>
</div></body></html>`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'MarkCMO Funnel <leads@markcmo.com>',
        to: ['mark@markcmo.com'],
        subject: `Call recap - pick path: ${prospect.full_name || prospect.email}${prospect.company ? ' (' + prospect.company + ')' : ''}`,
        html,
        tags: [{ name: 'category', value: 'funnel_call_recap' }],
      }),
    });
  } catch (e) {
    await safeAudit(env, 'funnel_call_recap_notify_failed', { error: String(e), prospect_id: prospect.id });
  }
}

function prettyBand(b) {
  return { UNDER_5K: 'Under $5k', B5_8K: '$5-8k', B8_12K: '$8-12k', B12_20K: '$12-20k', OVER_20K: '$20k+' }[b] || b || '-';
}
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
