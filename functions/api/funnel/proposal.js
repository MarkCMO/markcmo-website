// /api/funnel/proposal?t=<resume_token>   (GET)
// ─────────────────────────────────────────────────────────────────────────────
// Renders the prospect's latest proposal as a hosted, themed HTML page. Reads
// the 8-section model the engine produced and paints it with either the client's
// extracted brand (custom mode) or the chosen palette (productized). Their logo
// rides the header on custom. No placeholder text - empty blocks are omitted.
// ─────────────────────────────────────────────────────────────────────────────
import { THEMES, DEFAULT_THEME, themeFromBrandKit } from '../../_lib/funnel-themes.js';
import { sbSelect, sbPatch, sbInsert, logEvent, safeAudit, clientMeta } from '../../_lib/funnel-db.js';

export async function onRequest(context) {
  const { request, env } = context;
  const token = new URL(request.url).searchParams.get('t') || new URL(request.url).searchParams.get('token') || '';
  if (!token) return html('Link incomplete', '<p>This proposal link is missing its token.</p>', neutralTheme());

  const prospect = await getByToken(env, token);
  if (!prospect) return html('Not found', '<p>We could not find this proposal.</p>', neutralTheme());

  const props = await sbSelect(env, 'mcf_proposals', `select=*&prospect_id=eq.${prospect.id}&order=created_at.desc&limit=1`).catch(() => []);
  const proposal = props?.[0];
  if (!proposal || !proposal.model) return html('Proposal pending', `<p>Your proposal for ${esc(prospect.company || prospect.full_name || '')} is being finalized. We will be in touch shortly.</p>`, themeFor(prospect, null));

  // Acceptance bridge (Phase 4 entry). Client clicks Accept on the proposal:
  // record acceptance, open the three agreements, advance the deal, and notify
  // Mark to start the engagement (e-sign + first invoice). Charging/contract
  // automation reuses the existing engagement + Square systems downstream.
  if (new URL(request.url).searchParams.get('accept') === '1') {
    return acceptProposal(env, request, prospect, proposal);
  }

  const theme = themeFor(prospect, proposal);
  const body = renderProposal(proposal.model, proposal, prospect, theme);

  // best-effort: mark viewed
  sbPatch(env, 'mcf_proposals', `id=eq.${proposal.id}`, { status: proposal.status === 'draft' ? 'draft' : 'viewed' }).catch(() => {});
  logEvent(env, prospect.id, 'proposal_viewed', { proposal_id: proposal.id });

  return html(`Proposal - ${prospect.company || prospect.full_name || 'MarkCMO'}`, body, theme, theme.logo);
}

// ── Acceptance bridge ────────────────────────────────────────────────────────
async function acceptProposal(env, request, prospect, proposal) {
  const theme = themeFor(prospect, proposal);
  // Idempotent: if already accepted, just show the confirmation again.
  if (proposal.status !== 'accepted') {
    const meta = clientMeta(request);
    await sbPatch(env, 'mcf_proposals', `id=eq.${proposal.id}`, { status: 'accepted' }).catch((e) => safeAudit(env, 'funnel_accept_patch_failed', { error: String(e), proposal_id: proposal.id }));
    await sbPatch(env, 'mcf_prospects', `id=eq.${prospect.id}`, { stage: 'accepted', updated_at: new Date().toISOString() }).catch(() => {});
    // Open the three agreements for signature (status sent).
    try {
      await sbInsert(env, 'mcf_agreements', ['nda', 'engagement_letter', 'msa'].map((type) => ({ prospect_id: prospect.id, type, status: 'sent', signer_ip: meta.ip })));
    } catch (e) { await safeAudit(env, 'funnel_accept_agreements_failed', { error: String(e), prospect_id: prospect.id }); }
    // Bridge into the existing engagement pipeline (mc_clients + mc_engagements).
    // This is how the funnel hands off to the proven e-sign + Square invoice
    // flow instead of charging cards itself. Fully guarded - acceptance still
    // succeeds even if the bridge fails.
    let bridge = null;
    try { bridge = await bridgeToEngagement(env, prospect, proposal); }
    catch (e) { await safeAudit(env, 'funnel_engagement_bridge_failed', { error: String(e), prospect_id: prospect.id }); }
    await logEvent(env, prospect.id, 'proposal_accepted', { proposal_id: proposal.id, tier: proposal.tier, engagement_id: bridge?.engagementId, client_id: bridge?.clientId }, 'prospect');
    await notifyAccepted(env, { prospect, proposal, bridge });
  }
  const signUrl = `https://markcmo.com/sign?t=${encodeURIComponent(prospect.resume_token)}`;
  const inner = `
    <header class="phero">
      <div class="pkick">Accepted</div>
      <h1>You're in.</h1>
      <p class="ptag">Welcome to the partnership, ${esc((prospect.full_name || '').split(' ')[0] || prospect.company || '')}.</p>
      <p class="pengine">One step to make it official: sign the three agreements. Takes a few minutes.</p>
    </header>
    <section class="ps"><div class="kick">Next</div><h2>From here to kickoff</h2>
      <ol class="path">
        <li><span class="n">1</span>Sign the mutual NDA, engagement letter and MSA below.</li>
        <li><span class="n">2</span>First invoice for the engagement is issued.</li>
        <li><span class="n">3</span>We build your onboarding doc from everything you told us, so your CMO starts with full context.</li>
        <li><span class="n">4</span>Kickoff call is scheduled and the engine starts.</li>
      </ol>
      <a class="cta" href="${signUrl}">Review and sign your agreements</a>
      <div class="exp">Or email mark@markcmo.com with any questions.</div>
    </section>`;
  return html(`Accepted - ${prospect.company || prospect.full_name || 'MarkCMO'}`, inner, theme);
}

// Find-or-create the mc_clients row (deduped by email) and a 'lead'
// mc_engagement, mirroring the known-good shape used by calendly-sync-history.
// The accepted funnel deal then appears in the existing engagement admin, ready
// for generate-engagement-docs -> e-sign -> Square invoice. No card is charged
// here; the existing admin-gated pipeline owns the money step.
async function bridgeToEngagement(env, prospect, proposal) {
  if (!prospect.email) return null;
  const monthly = Number(proposal.monthly_total) || 0;

  // Client (dedupe by primary_contact_email)
  let clientId = null, slug = null;
  const found = await sbSelect(env, 'mc_clients', `select=id,slug&primary_contact_email=eq.${encodeURIComponent(prospect.email)}&limit=1`).catch(() => []);
  if (found?.[0]) { clientId = found[0].id; slug = found[0].slug; }
  else {
    slug = slugify(prospect.full_name, prospect.company, prospect.email);
    const ins = await sbInsert(env, 'mc_clients', {
      slug,
      legal_name: prospect.company || prospect.full_name || prospect.email,
      primary_contact_name: prospect.full_name || null,
      primary_contact_email: prospect.email,
      primary_contact_phone: prospect.phone || null,
      website: prospect.website || null,
      source: 'funnel',
      status: 'lead',
    });
    clientId = ins?.[0]?.id || null;
    slug = ins?.[0]?.slug || slug;
  }
  if (!clientId) return null;

  const engName = `${prospect.company || prospect.full_name || 'Client'} - Growth Partnership (${proposal.tier || ''})`.trim();
  const desc = `Accepted via funnel. ${proposal.engagement_type === 'STRATEGY_PLUS_EXECUTION' ? 'Strategy + Execution (VIP).' : 'Strategy partner.'} Mode: ${proposal.mode || 'productized'}.`;
  const metadata = { funnel_prospect_id: prospect.id, funnel_proposal_id: proposal.id, theme: proposal.theme, monthly_total: monthly, onetime_total: proposal.onetime_total || 0, growth_stage: prospect.growth_stage, segment: prospect.segment };

  // Upgrade an existing 'lead' engagement (e.g. one Calendly already created) or insert fresh.
  let engagementId = null;
  const leads = await sbSelect(env, 'mc_engagements', `select=id&client_id=eq.${clientId}&status=eq.lead&limit=1`).catch(() => []);
  if (leads?.[0]) {
    engagementId = leads[0].id;
    await sbPatch(env, 'mc_engagements', `id=eq.${engagementId}`, { name: engName, description: desc, fee_usd: monthly, metadata }).catch(() => {});
  } else {
    const ins = await sbInsert(env, 'mc_engagements', { client_id: clientId, doc_prefix: 'TBD', name: engName, description: desc, fee_usd: monthly, delivery_window_hrs: null, status: 'lead', metadata });
    engagementId = ins?.[0]?.id || null;
  }
  return { clientId, slug, engagementId };
}

function slugify(name, company, email) {
  const base = (company || name || (email || '').split('@')[0] || 'client').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'client';
  const suffix = ((email || '').split('@')[0] || Math.random().toString(36).slice(2, 6)).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 6);
  return `${base}-${suffix}`;
}

async function notifyAccepted(env, { prospect, proposal, bridge }) {
  if (!env.RESEND_API_KEY) return;
  const engLine = bridge?.engagementId
    ? `In your engagement pipeline as a lead (client <b>${esc(bridge.slug || '')}</b>). Generate docs, e-sign, and send the invoice from the engagement admin.`
    : `Three agreements opened (NDA, engagement letter, MSA). Start the engagement: generate docs + e-sign + first invoice.`;
  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;background:#f6f7f8;margin:0;padding:24px;">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;">
  <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#1a7f37;font-weight:800;">Proposal accepted</div>
  <h1 style="font-size:21px;color:#111;margin:6px 0 10px;">${esc(prospect.company || prospect.full_name)} said yes</h1>
  <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 12px;">Tier <b>${esc(proposal.tier || '')}</b>${proposal.monthly_total ? ` &middot; $${Number(proposal.monthly_total).toLocaleString()}/mo` : ''}. ${engLine}</p>
  <a href="https://markcmo.com/admin" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:800;font-size:14px;padding:11px 20px;border-radius:9px;">Open engagement admin</a>
  <div style="margin-top:12px;font-size:11px;color:#9aa0a6;">Prospect #${esc(prospect.id)} &middot; proposal #${esc(proposal.id)}${bridge?.engagementId ? ' &middot; engagement #' + esc(bridge.engagementId) : ''}</div>
</div></body></html>`;
  try {
    await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'MarkCMO Funnel <leads@markcmo.com>', to: ['mark@markcmo.com'], reply_to: prospect.email, subject: `ACCEPTED: ${prospect.company || prospect.full_name} - start engagement`, html, tags: [{ name: 'category', value: 'funnel_accepted' }] }) });
  } catch (_) {}
}

// Exported pure renderer (used by onRequest; also importable for tests/preview).
export function proposalPageHTML({ prospect, proposal, theme, title }) {
  const inner = renderProposal(proposal.model, proposal, prospect, theme);
  return htmlDoc(title || `Proposal - ${prospect.company || prospect.full_name || 'MarkCMO'}`, inner, theme);
}

function themeFor(prospect, proposal) {
  const mode = (proposal && proposal.mode) || prospect.proposal_mode;
  if (mode === 'custom') {
    const kit = (proposal && proposal.brand_kit) || prospect.brand_kit || {};
    const t = themeFromBrandKit(kit);
    return { ...t, logo: kit.logo || null };
  }
  const key = (proposal && proposal.theme) || prospect.theme || DEFAULT_THEME;
  const t = THEMES[key] || THEMES[DEFAULT_THEME];
  return { vars: t.vars, fonts: t.fonts, googleFonts: t.googleFonts, logo: null };
}
function neutralTheme() { const t = THEMES[DEFAULT_THEME]; return { vars: t.vars, fonts: t.fonts, googleFonts: t.googleFonts, logo: null }; }

function renderProposal(m, proposal, prospect, theme) {
  const meta = m.meta || {};
  const company = meta.company || prospect.company || '';
  const name = meta.prospect_name || prospect.full_name || '';

  const sec = (id, kicker, title, inner) => inner ? `<section class="ps"><div class="kick">${esc(kicker)}</div><h2>${esc(title)}</h2>${inner}</section>` : '';

  // P1 Situation
  const s = m.p1_situation || {};
  const p1 = sec('p1', 'Where you are', 'The situation', `<p>${esc(company || 'You')} is a ${esc(SEG[s.segment] || 'business')}${s.growth_stage ? `, currently ${esc(STAGE[s.growth_stage] || '')}` : ''}.${s.constraint ? ` The real constraint right now is ${esc(s.constraint)}.` : ''}${s.trajectory ? ` Trajectory: ${esc(TRAJ[s.trajectory] || s.trajectory)}.` : ''}</p>`);

  // P2 Stakes
  const stakes = (m.p2_stakes || {}).primary;
  const p2 = stakes ? sec('p2', 'The cost of waiting', 'What is at stake', `<p>Leave this another twelve months and the real cost is <b>${esc(stakes.toLowerCase())}</b>. Every month the engine is not running is revenue you do not get back.</p>`) : '';

  // P3 Outcome
  const o = m.p3_outcome || {};
  const outParts = [GOAL6[o.goal_6mo] && `In six months: ${GOAL6[o.goal_6mo]}.`, GOAL1[o.goal_1yr] && `In a year: ${GOAL1[o.goal_1yr]}.`, ENDGAME[o.endgame] && `The end game you named: ${ENDGAME[o.endgame]}.`].filter(Boolean);
  const p3 = outParts.length ? sec('p3', 'Where you go', 'The outcome', `<p>${outParts.map(esc).join(' ')}</p>`) : '';

  // P4 Approach
  const a = m.p4_approach || {};
  const modules = (a.modules || []).map((x) => `<li>${esc(x)}</li>`).join('');
  const wt = a.wetyr_track || {};
  const p4 = sec('p4', 'The plan', 'The approach', `
    ${a.headline ? `<p class="lead">${esc(a.headline)}</p>` : ''}
    ${a.engagement_note ? `<p>${esc(a.engagement_note)}</p>` : ''}
    ${modules ? `<ul class="mods">${modules}</ul>` : ''}
    ${wt.label ? `<div class="track"><span class="tlbl">${esc(wt.brand)} track &middot; ${esc(wt.label)}</span><span class="tfocus">${esc(wt.focus || '')}</span></div>` : ''}`);

  // P5 Package - tier ladder
  const pkg = m.p5_package || {};
  const tiers = (pkg.tiers || []).map((t) => `
    <div class="tier${t.recommended ? ' rec' : ''}">
      ${t.recommended ? '<div class="rec-badge">Recommended</div>' : ''}
      <div class="tier-name">${esc(t.label)}</div>
      <div class="tier-price">${t.monthly ? '$' + Number(t.monthly).toLocaleString() + '<span>/mo</span>' : 'Custom'}</div>
      ${t.annual ? `<div class="tier-annual">or $${Number(t.annual).toLocaleString()}/yr (1 month free)</div>` : ''}
    </div>`).join('');
  const items = (pkg.line_items || []).map((li) => `<li><span>${esc(li.label)}</span><b>${priceLabel(li)}</b></li>`).join('');
  const p5 = sec('p5', 'The package', 'What you get', `
    <div class="tiers">${tiers}</div>
    ${items ? `<ul class="items">${items}</ul>` : ''}`);

  // P6 Proof
  const proof = m.p6_proof || {};
  const p6 = proof.stat ? sec('p6', 'Proof', 'This is not theory', `<div class="proof"><div class="proof-stat">${esc(proof.stat)}</div><div class="proof-detail">${esc(proof.detail || '')}</div></div>`) : '';

  // P7 Objection
  const obj = m.p7_objection || {};
  const objText = OBJ[obj.objection];
  const p7 = objText ? sec('p7', 'Straight talk', 'The honest part', `<p>${esc(objText)}</p>`) : '';

  // P8 Path
  const path = m.p8_path || {};
  const steps = (path.steps || []).map((st, i) => `<li><span class="n">${i + 1}</span>${esc(st)}</li>`).join('');
  const accept = `https://markcmo.com/api/funnel/proposal?t=${encodeURIComponent(prospect.resume_token)}&accept=1`;
  const p8 = sec('p8', 'Next', 'The path', `
    ${steps ? `<ol class="path">${steps}</ol>` : ''}
    <a class="cta" href="${accept}">${esc(path.cta || 'Accept and start')}</a>
    ${meta.expires_days ? `<div class="exp">This proposal is good for ${meta.expires_days} days.</div>` : ''}`);

  const pos = m.positioning || {};
  const hero = `
    <header class="phero">
      ${theme.logo ? `<img class="plogo" src="${esc(theme.logo)}" alt="${esc(company)} logo"/>` : ''}
      <div class="pkick">Growth partnership proposal</div>
      <h1>${esc(company || name)}</h1>
      ${pos.one_liner ? `<p class="ptag">${esc(pos.one_liner)}</p>` : ''}
      ${pos.not_an_agency ? `<p class="pengine">${esc(pos.not_an_agency)}</p>` : ''}
    </header>`;

  return hero + p1 + p2 + p3 + p4 + p5 + p6 + p7 + p8;
}

function priceLabel(li) {
  if (li.recurrence === 'monthly') return li.amount ? '$' + Number(li.amount).toLocaleString() + '/mo' : 'included';
  if (li.recurrence === 'one_time') return li.amount ? '$' + Number(li.amount).toLocaleString() : 'scoped';
  if (li.recurrence === 'annual') return li.amount ? '$' + Number(li.amount).toLocaleString() + '/yr' : 'annual';
  if (li.recurrence === 'quote' || li.recurrence === 'scoped') return 'scoped';
  return li.amount ? '$' + Number(li.amount).toLocaleString() : '';
}

function html(title, inner, theme) {
  return new Response(htmlDoc(title, inner, theme), { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export function htmlDoc(title, inner, theme) {
  const vars = Object.entries(theme.vars).map(([k, v]) => `${k}:${v};`).join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)}</title><meta name="robots" content="noindex,nofollow"/>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${esc(theme.googleFonts)}">
<style>
:root{${vars}--fh:${theme.fonts.heading};--fb:${theme.fonts.body};}
*{box-sizing:border-box;}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--fb);line-height:1.65;}
.wrap{max-width:760px;margin:0 auto;padding:3rem 6vw 5rem;}
.phero{text-align:center;padding:2rem 0 2.5rem;border-bottom:1px solid var(--border);margin-bottom:2.5rem;}
.plogo{max-height:64px;max-width:240px;margin-bottom:1.4rem;}
.pkick{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);font-weight:800;margin-bottom:.7rem;}
.phero h1{font-family:var(--fh);font-size:clamp(2rem,6vw,3.2rem);font-weight:800;letter-spacing:-.03em;margin:0 0 .8rem;color:var(--text);}
.ptag{font-size:1.15rem;color:var(--accent);font-weight:600;margin:0 0 1rem;}
.pengine{font-size:.98rem;color:var(--text2);max-width:560px;margin:0 auto;font-style:italic;line-height:1.7;}
.ps{margin:0 0 2.6rem;}
.kick{font-family:var(--fh);font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);font-weight:700;margin-bottom:.4rem;}
.ps h2{font-family:var(--fh);font-size:clamp(1.5rem,4vw,2rem);font-weight:700;letter-spacing:-.02em;margin:0 0 .9rem;color:var(--text);}
.ps p{font-size:1.05rem;color:var(--text2);margin:0 0 1rem;}
.ps p.lead{font-size:1.18rem;color:var(--text);font-weight:600;}
.mods{list-style:none;padding:0;margin:1rem 0;display:grid;gap:.55rem;}
.mods li{padding:.7rem 1rem;background:var(--bg3);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:.97rem;}
.track{margin-top:1.2rem;padding:1rem 1.2rem;border-left:3px solid var(--accent);background:var(--bg3);border-radius:0 10px 10px 0;}
.track .tlbl{display:block;font-weight:700;color:var(--accent);font-size:.95rem;margin-bottom:.2rem;}
.track .tfocus{display:block;color:var(--text2);font-size:.92rem;}
.tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:.8rem;margin:1.2rem 0;}
.tier{position:relative;background:var(--bg3);border:1.5px solid var(--border);border-radius:14px;padding:1.4rem 1rem;text-align:center;}
.tier.rec{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent);}
.rec-badge{position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:var(--accent);color:var(--on-accent);font-size:.62rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:.2rem .7rem;border-radius:20px;white-space:nowrap;}
.tier-name{font-family:var(--fh);font-weight:700;font-size:1.05rem;color:var(--text);margin-bottom:.4rem;}
.tier-price{font-family:var(--fh);font-size:1.5rem;font-weight:800;color:var(--accent);}
.tier-price span{font-size:.8rem;color:var(--text3);font-weight:500;}
.tier-annual{font-size:.74rem;color:var(--text3);margin-top:.3rem;}
.items{list-style:none;padding:0;margin:1.2rem 0 0;}
.items li{display:flex;justify-content:space-between;gap:1rem;padding:.7rem 0;border-bottom:1px solid var(--border);font-size:.97rem;color:var(--text2);}
.items li b{color:var(--text);white-space:nowrap;}
.proof{text-align:center;padding:1.6rem;background:var(--bg3);border:1px solid var(--border);border-radius:14px;}
.proof-stat{font-family:var(--fh);font-size:2rem;font-weight:800;color:var(--accent);}
.proof-detail{color:var(--text2);font-size:.97rem;margin-top:.3rem;}
.path{list-style:none;padding:0;margin:0 0 1.6rem;counter-reset:s;}
.path li{display:flex;align-items:center;gap:.8rem;padding:.6rem 0;font-size:1.02rem;color:var(--text);}
.path .n{flex-shrink:0;width:28px;height:28px;border-radius:50%;background:var(--accent);color:var(--on-accent);font-weight:800;font-size:.85rem;display:flex;align-items:center;justify-content:center;}
.cta{display:inline-block;background:var(--accent);color:var(--on-accent);font-family:var(--fh);font-weight:800;font-size:1.1rem;padding:1rem 2.4rem;border-radius:12px;text-decoration:none;}
.exp{font-size:.8rem;color:var(--text3);margin-top:1rem;}
@media(max-width:600px){.tiers{grid-template-columns:1fr;}}
</style></head>
<body><div class="wrap">${inner}</div></body></html>`;
}

async function getByToken(env, token) {
  try { const r = await sbSelect(env, 'mcf_prospects', `select=*&resume_token=eq.${encodeURIComponent(token)}&limit=1`); return r?.[0] || null; }
  catch (_) { return null; }
}

// label maps for enum codes used in the model
const SEG = { HIGH_TICKET_SERVICE: 'high-ticket service business', DTC_CONSUMER: 'consumer brand', ENTERPRISE_B2B: 'enterprise B2B company', GROWTH_SAAS: 'B2B SaaS company', UNDETERMINED: 'business' };
const STAGE = { GROWING: 'focused on growing', SUCCESSION: 'planning succession (exit or raise)', ACQUIRING: 'buying more businesses', UNDETERMINED: '' };
const TRAJ = { declining: 'declining', flat: 'flat / plateaued', grow_25: 'growing under 25%', grow_25_100: 'growing 25-100%', grow_100: 'growing 100%+' };
const GOAL6 = { stabilize: 'stop the bleeding and stabilize', lead_flow: 'a predictable lead flow', rev_25_50: 'revenue up 25-50%', rev_50_100: 'revenue up 50-100%', more_than_double: 'more than double revenue' };
const GOAL1 = { steady: 'steady, profitable growth', engine: 'a built growth engine', aggressive: 'aggressive scale', exit_or_raise: 'ready for a raise or sale' };
const ENDGAME = { scale_hold: 'scale and hold', acquire: 'acquire other businesses', sell: 'be acquired / sell', raise: 'raise capital', lifestyle: 'lifestyle and cashflow' };
const OBJ = {
  past_burn: 'You have been burned by an agency before. Fair. The difference is simple: an agency sells you activity, we own a number. If the engine is not moving revenue, that is our problem to fix, not yours to manage.',
  cost: 'You are weighing cost against return. So are we. Everything here is built to pay for itself in revenue, and we report against that, not against hours.',
  control: 'You do not want to hand over control. You are not. You stay the owner of the vehicle and the direction. We are the engine, not the driver.',
  time: 'You do not have time to manage another vendor. Good, because this is built so you do not have to. We run it; you get the outcomes and the dashboard.',
  none: '',
};

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
