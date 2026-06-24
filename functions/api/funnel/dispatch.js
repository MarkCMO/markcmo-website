// /api/funnel/dispatch   (GET - clicked from the recap email)
// ─────────────────────────────────────────────────────────────────────────────
//   ?p=<resume_token>&path=custom
//        Bespoke route. Extracts the client's brand (logo + colors + fonts) from
//        their website, builds a brand-matched proposal draft, and emails MARK
//        the editable hosted proposal link. Nothing goes to the client.
//
//   ?p=<resume_token>&path=productized&theme=<key>
//        Productized route. Stores the chosen theme, then emails the CLIENT the
//        themed intake link. Their proposal auto-builds in that palette when
//        they finish the intake.
//
// Returns a small HTML confirmation page (this is a browser GET from an email
// button), styled in MarkCMO colors.
// ─────────────────────────────────────────────────────────────────────────────
import { scoreIntake, buildProposalModel, DEFAULT_PRICING } from '../../_lib/funnel-engine.js';
import { THEMES, DEFAULT_THEME, themeFromBrandKit } from '../../_lib/funnel-themes.js';
import { extractBrand } from '../../_lib/brand-extract.js';
import { sbSelect, sbInsert, sbPatch, logEvent, safeAudit } from '../../_lib/funnel-db.js';

const SITE = 'https://markcmo.com';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get('p') || url.searchParams.get('token') || '';
  const path = (url.searchParams.get('path') || '').toLowerCase();
  const theme = url.searchParams.get('theme') || '';

  if (!token) return page('Missing link token', 'This dispatch link is incomplete.');
  const prospect = await getByToken(env, token);
  if (!prospect) return page('Not found', 'We could not find that prospect. The link may be stale.');

  if (path === 'custom') return doCustom(env, prospect);
  if (path === 'productized') return doProductized(env, prospect, theme);
  return page('Pick a path', 'Use the buttons in the recap email (Custom or a Productized theme).');
}

// ── CUSTOM: extract brand, build branded proposal draft, notify Mark ─────────
async function doCustom(env, prospect) {
  let kit = {};
  if (prospect.website) {
    kit = await extractBrand(prospect.website).catch((e) => ({ source: 'error', error: String(e) }));
  }
  const answers = prospect.raw_intake || {};
  const pre = { pre_score: prospect.pre_score, segment_tag: prospect.segment, growth_stage: prospect.growth_stage, marketing_capacity: prospect.marketing_capacity };
  const intake = scoreIntake({ pre, answers });
  const model = buildProposalModel({ prospect, intake, answers, pricing: DEFAULT_PRICING });

  await sbPatch(env, 'mcf_prospects', `id=eq.${prospect.id}`, {
    proposal_mode: 'custom', theme: 'client_brand', brand_kit: kit, stage: 'proposal_sent', updated_at: new Date().toISOString(),
  }).catch(() => {});

  let proposalId = null;
  try {
    const rows = await sbInsert(env, 'mcf_proposals', {
      prospect_id: prospect.id, mode: 'custom', tier: intake.recommended_tier, engagement_type: intake.engagement_type,
      theme: 'client_brand', brand_kit: kit, line_items: intake.line_items, model,
      status: 'draft', expires_at: new Date(Date.now() + 14 * 864e5).toISOString(),
    });
    proposalId = rows?.[0]?.id || null;
  } catch (e) { await safeAudit(env, 'dispatch_custom_proposal_failed', { error: String(e), prospect_id: prospect.id }); }

  await logEvent(env, prospect.id, 'dispatch_custom', { brand_source: kit.source, proposal_id: proposalId });
  await notifyMarkCustom(env, { prospect, kit, proposalId });

  const preview = `${SITE}/api/funnel/proposal?t=${encodeURIComponent(prospect.resume_token)}`;
  return page(
    'Custom proposal started',
    `Pulled ${esc(prospect.company || 'their')} brand${kit.accent ? ` (accent ${esc(kit.accent)})` : ''} and drafted a brand-matched proposal. Review and finish it:`,
    [{ label: 'Open the branded proposal', url: preview }],
    kit
  );
}

// ── PRODUCTIZED: set theme, email the client the themed intake ───────────────
async function doProductized(env, prospect, themeKey) {
  const key = THEMES[themeKey] ? themeKey : DEFAULT_THEME;
  await sbPatch(env, 'mcf_prospects', `id=eq.${prospect.id}`, {
    proposal_mode: 'productized', theme: key, stage: 'intake_sent', updated_at: new Date().toISOString(),
  }).catch(() => {});
  await logEvent(env, prospect.id, 'dispatch_productized', { theme: key });

  const sent = await emailClientIntake(env, { prospect, themeKey: key });

  return page(
    'Productized flow sent',
    `${sent ? 'Sent' : 'Queued'} the <b>${esc(THEMES[key].label)}</b> intake to ${esc(prospect.full_name || prospect.email)}. Their proposal auto-builds in this palette when they finish.`,
    [{ label: 'Preview the themed intake', url: `${SITE}/intake?t=${encodeURIComponent(prospect.resume_token)}` }]
  );
}

async function emailClientIntake(env, { prospect, themeKey }) {
  if (!env.RESEND_API_KEY) return false;
  const t = THEMES[themeKey] || THEMES[DEFAULT_THEME];
  const first = (prospect.full_name || '').trim().split(/\s+/)[0] || 'there';
  const link = `${SITE}/intake?t=${encodeURIComponent(prospect.resume_token)}`;
  const accent = t.vars['--accent'];
  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;background:#f6f7f8;margin:0;padding:24px;">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:28px;">
  <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${esc(accent)};font-weight:700;">MarkCMO</div>
  <h1 style="font-size:21px;color:#111;margin:8px 0 12px;">${esc(first)}, here's your intake</h1>
  <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 8px;">Great talking. This short intake is what lets us build everything around your real numbers, your stage and your team, so the plan is the engine your revenue needs, not a template.</p>
  <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 20px;">It takes about ten minutes and saves as you go.</p>
  <a href="${link}" style="display:inline-block;background:${esc(accent)};color:${esc(t.vars['--on-accent'])};text-decoration:none;font-weight:800;font-size:15px;padding:13px 26px;border-radius:10px;">Start the intake &rarr;</a>
  <p style="font-size:12px;color:#9aa0a6;margin:20px 0 0;">Questions? Just reply. - Mark</p>
</div></body></html>`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Mark Gabrielli <mark@markcmo.com>', to: [prospect.email], reply_to: 'mark@markcmo.com', subject: `${prospect.company ? prospect.company + ': ' : ''}your MarkCMO intake`, html, tags: [{ name: 'category', value: 'funnel_client_intake' }] }),
    });
    return r.ok;
  } catch (e) {
    await safeAudit(env, 'dispatch_client_intake_failed', { error: String(e), prospect_id: prospect.id });
    return false;
  }
}

async function notifyMarkCustom(env, { prospect, kit, proposalId }) {
  if (!env.RESEND_API_KEY) return;
  const swatches = (kit.palette || []).slice(0, 6).map((c) => `<span style="display:inline-block;width:22px;height:22px;border-radius:5px;background:${esc(c)};border:1px solid #ddd;margin-right:5px;"></span>`).join('');
  const preview = `${SITE}/api/funnel/proposal?t=${encodeURIComponent(prospect.resume_token)}`;
  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;background:#f6f7f8;margin:0;padding:24px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;">
  <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#C9A84C;font-weight:700;">Custom proposal drafted</div>
  <h1 style="font-size:20px;color:#111;margin:6px 0 12px;">${esc(prospect.company || prospect.full_name)}</h1>
  ${kit.logo ? `<img src="${esc(kit.logo)}" alt="logo" style="max-height:46px;max-width:200px;margin-bottom:12px;"/>` : ''}
  <table style="border-collapse:collapse;width:100%;font-size:13px;">
    <tr><td style="color:#9aa0a6;padding:4px 14px 4px 0;">Brand source</td><td style="color:#111;">${esc(kit.source || '-')}${kit.domain ? ' &middot; ' + esc(kit.domain) : ''}</td></tr>
    <tr><td style="color:#9aa0a6;padding:4px 14px 4px 0;">Accent</td><td style="color:#111;">${esc(kit.accent || '-')}</td></tr>
    <tr><td style="color:#9aa0a6;padding:4px 14px 4px 0;vertical-align:top;">Palette</td><td>${swatches || '-'}</td></tr>
    <tr><td style="color:#9aa0a6;padding:4px 14px 4px 0;">Fonts</td><td style="color:#111;">${esc([kit.font_heading, kit.font_body].filter(Boolean).join(' / ') || '-')}</td></tr>
  </table>
  <a href="${preview}" style="display:inline-block;margin-top:16px;background:#111;color:#fff;text-decoration:none;font-weight:800;font-size:14px;padding:12px 22px;border-radius:9px;">Open branded proposal &rarr;</a>
  <div style="margin-top:14px;font-size:11px;color:#9aa0a6;">Proposal #${esc(proposalId || '?')} &middot; review, edit copy, then send.</div>
</div></body></html>`;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'MarkCMO Funnel <leads@markcmo.com>', to: ['mark@markcmo.com'], subject: `Custom proposal drafted: ${prospect.company || prospect.full_name}`, html, tags: [{ name: 'category', value: 'funnel_custom_ready' }] }),
    });
  } catch (_) {}
}

async function getByToken(env, token) {
  try {
    const r = await sbSelect(env, 'mcf_prospects', `select=*&resume_token=eq.${encodeURIComponent(token)}&limit=1`);
    return r?.[0] || null;
  } catch (_) { return null; }
}

// Confirmation page shown to Mark in the browser.
function page(title, body, links = [], kit = null) {
  const swatches = kit && kit.palette ? `<div style="margin:14px 0;">${kit.palette.slice(0, 6).map((c) => `<span style="display:inline-block;width:26px;height:26px;border-radius:6px;background:${esc(c)};border:1px solid rgba(255,255,255,.2);margin-right:6px;"></span>`).join('')}</div>` : '';
  const btns = links.map((l) => `<a href="${esc(l.url)}" style="display:inline-block;margin:6px 8px 0 0;background:#C9A84C;color:#0A0F2C;text-decoration:none;font-weight:800;font-size:15px;padding:12px 24px;border-radius:10px;">${esc(l.label)}</a>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(title)} - MarkCMO</title></head>
<body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;background:#0A0F2C;color:#fff;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;">
<div style="max-width:520px;background:#141a3d;border:1px solid rgba(201,168,76,.2);border-radius:16px;padding:34px;text-align:center;">
  <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#C9A84C;font-weight:800;">MarkCMO Funnel</div>
  <h1 style="font-size:24px;margin:10px 0 12px;letter-spacing:-.02em;">${esc(title)}</h1>
  <p style="font-size:15px;color:rgba(255,255,255,.82);line-height:1.6;margin:0;">${body}</p>
  ${swatches}
  <div style="margin-top:18px;">${btns}</div>
</div></body></html>`;
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
