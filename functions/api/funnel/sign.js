// /api/funnel/sign   (GET to load, POST to sign)
// ─────────────────────────────────────────────────────────────────────────────
//   GET ?token=<resume_token>
//     Returns the prospect, the theme CSS, the three agreements with their
//     status, and the merged document HTML for each (NDA, engagement letter,
//     MSA). Creates the three agreement rows if acceptance happened but they
//     are missing.
//
//   POST { token, type, signerName, signerTitle, consent, signatureType,
//          signatureData }
//     Records a signature on one document. When all three are signed, advances
//     the prospect to "signed", notifies Mark, and reports all_signed so the
//     page can move to the payment step.
// ─────────────────────────────────────────────────────────────────────────────
import { renderDoc, DOC_ORDER, DOC_LABELS } from '../../_lib/funnel-docs.js';
import { themeCss, DEFAULT_THEME } from '../../_lib/funnel-themes.js';
import { sbSelect, sbInsert, sbPatch, logEvent, safeAudit, parseBody, json, cors, clientMeta } from '../../_lib/funnel-db.js';

const HANDLER_VERSION = 'funnel-sign-v1-2026-06-25';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return cors();
  if (request.method === 'GET') return handleGet(context);
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const payload = await parseBody(request);
  if (!payload) return json(400, { error: 'invalid_body' });
  const token = String(payload.token || '').trim();
  const type = String(payload.type || '').trim();
  if (!token || !DOC_ORDER.includes(type)) return json(400, { error: 'bad_request' });

  const prospect = await getByToken(env, token);
  if (!prospect) return json(404, { error: 'not_found' });

  const signerName = String(payload.signerName || '').trim().slice(0, 200);
  const signerTitle = String(payload.signerTitle || '').trim().slice(0, 200);
  if (signerName.length < 2) return json(400, { error: 'signer_name_required' });
  if (payload.consent !== true && payload.consent !== 'true') return json(400, { error: 'consent_required' });

  const meta = clientMeta(request);
  const agreements = await loadAgreements(env, prospect);
  const target = agreements.find((a) => a.type === type);
  if (!target) return json(404, { error: 'agreement_not_found' });
  if (target.status === 'signed') {
    return json(200, { ok: true, type, status: 'signed', already: true, all_signed: agreements.every((a) => a.status === 'signed') });
  }

  // Record the signature.
  try {
    await sbPatch(env, 'mcf_agreements', `id=eq.${target.id}`, {
      status: 'signed',
      signed_at: new Date().toISOString(),
      signer_ip: meta.ip,
      signer_name: signerName,
      signer_title: signerTitle || null,
      signer_email: prospect.email || null,
      signature_type: payload.signatureType === 'draw' ? 'draw' : 'type',
      signature_data: payload.signatureType === 'draw' ? String(payload.signatureData || '').slice(0, 2000000) : signerName,
      user_agent: meta.user_agent,
    });
    target.status = 'signed';
  } catch (e) {
    await safeAudit(env, 'funnel_sign_patch_failed', { error: String(e), prospect_id: prospect.id, type });
    return json(500, { error: 'sign_failed' });
  }
  await logEvent(env, prospect.id, 'agreement_signed', { type, signer: signerName }, 'prospect');

  const allSigned = agreements.every((a) => a.status === 'signed');
  if (allSigned) {
    await sbPatch(env, 'mcf_prospects', `id=eq.${prospect.id}`, { stage: 'signed', updated_at: new Date().toISOString() }).catch(() => {});
    await logEvent(env, prospect.id, 'all_agreements_signed', { count: agreements.length }, 'prospect');
    await notifyAllSigned(env, prospect, agreements);
    await emailClientPortal(env, prospect).catch(() => {});
  }

  return json(200, {
    ok: true,
    type,
    status: 'signed',
    all_signed: allSigned,
    remaining: agreements.filter((a) => a.status !== 'signed').map((a) => a.type),
    handler_version: HANDLER_VERSION,
  });
}

// ── GET: load docs + status ─────────────────────────────────────────────────
async function handleGet(context) {
  const { request, env } = context;
  const token = new URL(request.url).searchParams.get('token') || new URL(request.url).searchParams.get('t') || '';
  if (!token) return json(400, { error: 'missing_token' });
  const prospect = await getByToken(env, token);
  if (!prospect) return json(404, { error: 'not_found' });

  const proposal = (await sbSelect(env, 'mcf_proposals', `select=*&prospect_id=eq.${prospect.id}&order=created_at.desc&limit=1`).catch(() => []))?.[0] || null;
  if (!proposal) return json(409, { error: 'no_proposal', message: 'Accept the proposal first.' });

  const agreements = await loadAgreements(env, prospect, proposal);

  // Merge context for the documents.
  const ctx = {
    clientName: prospect.company || prospect.full_name,
    contactName: prospect.full_name,
    contactTitle: prettyRole(prospect.role),
    tier: prettyTier(proposal.tier),
    monthlyFee: proposal.monthly_total,
    onetimeFee: proposal.onetime_total,
    termMonths: proposal.term_months,
    engagementType: proposal.engagement_type,
    cadence: cadenceFor(proposal.tier),
    modules: proposal.model?.p4_approach?.modules || [],
    now: new Date().toISOString(),
  };

  const docs = {};
  for (const t of DOC_ORDER) docs[t] = renderDoc(t, ctx);

  const themeKey = prospect.theme && prospect.theme !== 'client_brand' ? prospect.theme : DEFAULT_THEME;
  return json(200, {
    ok: true,
    prospect: { full_name: prospect.full_name, company: prospect.company, email: prospect.email, stage: prospect.stage },
    theme: themeKey,
    theme_css: themeCss(themeKey),
    order: DOC_ORDER,
    labels: DOC_LABELS,
    agreements: agreements.map((a) => ({ type: a.type, status: a.status, signer_name: a.signer_name, signed_at: a.signed_at })),
    docs,
    all_signed: agreements.every((a) => a.status === 'signed'),
    handler_version: HANDLER_VERSION,
  });
}

// Load the three agreements; create any that are missing (post-accept safety).
async function loadAgreements(env, prospect, proposal) {
  let rows = await sbSelect(env, 'mcf_agreements', `select=*&prospect_id=eq.${prospect.id}`).catch(() => []);
  const have = new Set((rows || []).map((r) => r.type));
  const missing = DOC_ORDER.filter((t) => !have.has(t));
  if (missing.length && (proposal || prospect.stage === 'accepted' || prospect.stage === 'signed')) {
    try {
      const ins = await sbInsert(env, 'mcf_agreements', missing.map((type) => ({ prospect_id: prospect.id, type, status: 'sent' })));
      rows = rows.concat(ins || []);
    } catch (_) {}
  }
  // stable order
  return DOC_ORDER.map((t) => rows.find((r) => r.type === t)).filter(Boolean);
}

async function notifyAllSigned(env, prospect, agreements) {
  if (!env.RESEND_API_KEY) return;
  const rows = agreements.map((a) => `<tr><td style="padding:4px 14px 4px 0;color:#9aa0a6;font-size:13px;">${esc(DOC_LABELS[a.type] || a.type)}</td><td style="color:#111;font-size:13px;">signed by ${esc(a.signer_name || prospect.full_name || '')}</td></tr>`).join('');
  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;background:#f6f7f8;margin:0;padding:24px;">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;">
  <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#1a7f37;font-weight:800;">All agreements signed</div>
  <h1 style="font-size:21px;color:#111;margin:6px 0 10px;">${esc(prospect.company || prospect.full_name)} signed</h1>
  <table style="border-collapse:collapse;width:100%;margin-bottom:12px;">${rows}</table>
  <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 12px;">NDA, engagement letter and MSA are executed. Send the first invoice to start the engagement.</p>
  <a href="https://markcmo.com/admin" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:800;font-size:14px;padding:11px 20px;border-radius:9px;">Open engagement admin</a>
  <div style="margin-top:12px;font-size:11px;color:#9aa0a6;">Prospect #${esc(prospect.id)}</div>
</div></body></html>`;
  try {
    await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'MarkCMO Funnel <leads@markcmo.com>', to: ['mark@markcmo.com'], reply_to: prospect.email, subject: `SIGNED: ${prospect.company || prospect.full_name} - all 3 agreements executed`, html, tags: [{ name: 'category', value: 'funnel_signed' }] }) });
  } catch (_) {}
}

// Email the client (Mark's voice, bare) their portal link to pay + see everything.
async function emailClientPortal(env, prospect) {
  if (!env.RESEND_API_KEY || !prospect.email) return;
  const first = (prospect.full_name || '').trim().split(/\s+/)[0] || 'there';
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
<p>Hi ${esc(first)},</p>
<p>Everything's signed - thank you. Last step to engage the work is the first invoice.</p>
<p>Your client portal has your plan, your signed agreements, and the wire/ACH payment instructions in one place: <a href="https://markcmo.com/portal">https://markcmo.com/portal</a></p>
<p>Sign in with this email and the one-time code it sends you. Reply here once payment is sent and we'll schedule kickoff.</p>
<p>- Mark</p>
</body></html>`;
  try {
    await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'Mark Gabrielli <mark@markcmo.com>', to: [prospect.email], reply_to: 'mark@markcmo.com', subject: `${prospect.company ? prospect.company + ': ' : ''}signed - your portal and payment`, html, tags: [{ name: 'category', value: 'funnel_signed_client' }] }) });
  } catch (_) {}
}

async function getByToken(env, token) {
  try { const r = await sbSelect(env, 'mcf_prospects', `select=*&resume_token=eq.${encodeURIComponent(token)}&limit=1`); return r?.[0] || null; }
  catch (_) { return null; }
}
function prettyTier(t) { return { FOUNDATION: 'Foundation', MOMENTUM: 'Momentum', EMPIRE: 'Empire', CUSTOM: 'Custom' }[t] || t || ''; }
function prettyRole(r) { return { founder: 'Founder / CEO', c_suite: 'Executive', vp_director: 'VP / Director', manager: 'Manager' }[r] || ''; }
function cadenceFor(t) { return { FOUNDATION: 'Monthly', MOMENTUM: 'Biweekly', EMPIRE: 'Weekly', CUSTOM: 'Custom' }[t] || 'Biweekly'; }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
