// /api/funnel/portal   (POST { token, code })
// Step 2 of the magic-code client portal: verify the code, then return the
// client's dashboard - their plan, agreement status, payment instructions
// (wire/ACH, revealed only once signed), and what happens next. The portal
// login IS the code gate, so the bank details need no second code.
import { verifyToken, remitDetails } from '../../_lib/funnel-magic.js';
import { themeCss, DEFAULT_THEME } from '../../_lib/funnel-themes.js';
import { sbSelect, logEvent, parseBody, json, cors } from '../../_lib/funnel-db.js';

const SITE = 'https://markcmo.com';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return cors();
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!env.TOKEN_SECRET) return json(503, { error: 'not_configured' });

  const payload = await parseBody(request);
  const token = String(payload?.token || '');
  const code = String(payload?.code || '');
  const v = await verifyToken(env.TOKEN_SECRET, token, code);
  if (!v.ok) return json(401, { error: v.error || 'invalid' });

  const prospect = await getByEmail(env, v.email);
  if (!prospect) return json(404, { error: 'not_found' });

  const proposal = (await sbSelect(env, 'mcf_proposals', `select=*&prospect_id=eq.${prospect.id}&order=created_at.desc&limit=1`).catch(() => []))?.[0] || null;
  const agreementsRows = await sbSelect(env, 'mcf_agreements', `select=type,status,signed_at&prospect_id=eq.${prospect.id}`).catch(() => []);
  const order = ['nda', 'engagement_letter', 'msa'];
  const agreements = order.map((t) => {
    const a = (agreementsRows || []).find((x) => x.type === t);
    return { type: t, label: LABELS[t], status: a?.status || 'pending', signed_at: a?.signed_at || null };
  });
  const allSigned = agreements.every((a) => a.status === 'signed');
  const tok = encodeURIComponent(prospect.resume_token);

  // Payment (wire/ACH) - only revealed once all agreements are signed.
  const remit = remitDetails(env);
  const monthly = Number(proposal?.monthly_total) || 0;
  const onetime = Number(proposal?.onetime_total) || 0;
  const firstAmount = monthly + onetime;
  const payment = allSigned
    ? {
        unlocked: true,
        amount: firstAmount || null,
        amount_label: firstAmount ? '$' + firstAmount.toLocaleString('en-US') : 'per your engagement letter',
        breakdown: { monthly, onetime },
        memo: `${prospect.company || prospect.full_name || 'Engagement'} - first invoice`,
        method: 'wire_ach',
        remit: remit.configured ? remit : null,
        contact: 'mark@markcmo.com',
      }
    : { unlocked: false, reason: 'Sign your agreements first to unlock payment instructions.' };

  const themeKey = prospect.theme && prospect.theme !== 'client_brand' ? prospect.theme : DEFAULT_THEME;
  const stage = prospect.stage;
  const next = nextStep(stage, allSigned, prospect.stage === 'paid');

  await logEvent(env, prospect.id, 'portal_viewed', { stage }, 'prospect');

  return json(200, {
    ok: true,
    theme_css: themeCss(themeKey),
    client: { full_name: prospect.full_name, company: prospect.company, email: prospect.email },
    plan: proposal ? {
      tier: prettyTier(proposal.tier),
      engagement: proposal.engagement_type === 'STRATEGY_PLUS_EXECUTION' ? 'Strategy + Execution (VIP)' : 'Strategy Partnership',
      monthly_label: monthly ? '$' + monthly.toLocaleString('en-US') + '/mo' : 'as quoted',
      onetime_label: onetime ? '$' + onetime.toLocaleString('en-US') : null,
      proposal_url: `${SITE}/api/funnel/proposal?t=${tok}`,
    } : null,
    agreements,
    all_signed: allSigned,
    sign_url: allSigned ? null : `${SITE}/sign?t=${tok}`,
    payment,
    next,
    stage,
  });
}

function nextStep(stage, allSigned, paid) {
  if (paid || stage === 'onboarding' || stage === 'won') return { headline: 'You are onboarded', body: 'Your kickoff is being scheduled. We are building your onboarding doc from your intake so your CMO starts with full context.' };
  if (allSigned) return { headline: 'Send your first payment', body: 'Your agreements are signed. Pay the first invoice by wire or ACH below to engage the work, then we schedule kickoff.' };
  return { headline: 'Sign your agreements', body: 'Review and sign the three documents to make the engagement official, then payment instructions unlock here.' };
}

async function getByEmail(env, email) {
  try { const r = await sbSelect(env, 'mcf_prospects', `select=*&email=eq.${encodeURIComponent(String(email).toLowerCase())}&order=created_at.desc&limit=1`); return r?.[0] || null; }
  catch (_) { return null; }
}
const LABELS = { nda: 'Mutual NDA', engagement_letter: 'Engagement Letter', msa: 'Master Services Agreement' };
function prettyTier(t) { return { FOUNDATION: 'Foundation', MOMENTUM: 'Momentum', EMPIRE: 'Empire', CUSTOM: 'Custom' }[t] || t || ''; }
