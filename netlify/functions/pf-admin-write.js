// ═══════════════════════════════════════════════════════════════
// pf-admin-write.js  (WETYR Arena)  -- admin-gated writer for /arena/admin/
// POST { action, ...payload }
//   update_division   { slug, weekly_price_cents?, profit_target_cents?, max_drawdown_cents?,
//                       daily_loss_cents?, max_contracts?, num_winners? -> stored on competitions }
//   create_seasons    { starts_at, ends_at, prize_partner_id? }  // one per active division
//   close_competition { competition_id }  // sets ends_at=now so pf-risk-cron ranks + awards
//   update_partner    { id, status?, coupon_code?, deal_terms? }
//   issue_prize       { prize_id }  // requires kyc_verified; marks issued
//
// Auth: isAdminAuthed (mcadmin_session cookie or x-admin-api-token).
// ═══════════════════════════════════════════════════════════════
const { sbSelect, sbUpdate, sbInsert, isAdminAuthed, corsHeaders } = require('./_lib_supabase');

exports.handler = async (event) => {
  const headers = corsHeaders(event, ['https://wetyr.com', 'https://markcmo.com']);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return resp(headers, 405, { error: 'POST only' });
  if (!(await isAdminAuthed(event))) return resp(headers, 401, { error: 'unauthorized' });

  try {
    const body = JSON.parse(event.body || '{}');
    const action = body.action;
    const who = adminLabel(event);

    switch (action) {
      case 'update_division': {
        if (!body.slug) return resp(headers, 400, { error: 'slug required' });
        const fields = pick(body, ['weekly_price_cents', 'profit_target_cents', 'max_drawdown_cents', 'daily_loss_cents', 'max_contracts', 'consistency_pct', 'default_symbol']);
        if (!Object.keys(fields).length) return resp(headers, 400, { error: 'no updatable fields' });
        const rows = await sbUpdate('pf_plans', `slug=eq.${encodeURIComponent(body.slug)}`, fields);
        await audit(who, 'division_updated', { slug: body.slug, fields });
        return resp(headers, 200, { ok: true, plan: rows[0] });
      }

      case 'create_seasons': {
        if (!body.starts_at || !body.ends_at) return resp(headers, 400, { error: 'starts_at and ends_at required' });
        const plans = await sbSelect('pf_plans?active=eq.true&select=*');
        const created = [];
        for (const p of plans) {
          const rows = await sbInsert('pf_competitions', {
            name: `${p.name} . ${body.starts_at.slice(0, 10)}`,
            plan_id: p.id, ranking_metric: 'pass_then_consistency',
            starts_at: body.starts_at, ends_at: body.ends_at, status: 'live',
            prize_partner_id: body.prize_partner_id || null,
            prize_description: body.prize_description || `Funded ${dollars(p.account_size_cents)} account`,
            num_winners: body.num_winners || 3, amoe_enabled: true,
          });
          created.push(rows[0]);
        }
        await audit(who, 'seasons_created', { count: created.length, starts_at: body.starts_at });
        return resp(headers, 200, { ok: true, created });
      }

      case 'close_competition': {
        if (!body.competition_id) return resp(headers, 400, { error: 'competition_id required' });
        // Set ends_at to now and keep status live; pf-risk-cron ranks + awards on its next run.
        await sbUpdate('pf_competitions', `id=eq.${encodeURIComponent(body.competition_id)}`, { ends_at: new Date().toISOString() });
        await audit(who, 'competition_close_requested', { competition_id: body.competition_id });
        return resp(headers, 200, { ok: true, note: 'winners selected on next pf-risk-cron run' });
      }

      case 'update_partner': {
        if (!body.id) return resp(headers, 400, { error: 'id required' });
        const fields = pick(body, ['status', 'coupon_code', 'deal_terms', 'affiliate_url', 'cost_per_account_cents']);
        const rows = await sbUpdate('pf_partners', `id=eq.${encodeURIComponent(body.id)}`, fields);
        await audit(who, 'partner_updated', { id: body.id, fields });
        return resp(headers, 200, { ok: true, partner: rows[0] });
      }

      case 'issue_prize': {
        if (!body.prize_id) return resp(headers, 400, { error: 'prize_id required' });
        const prizes = await sbSelect(`pf_prizes?id=eq.${encodeURIComponent(body.prize_id)}&select=*`);
        if (!prizes.length) return resp(headers, 404, { error: 'prize not found' });
        if (!prizes[0].kyc_verified) return resp(headers, 409, { error: 'KYC not verified; cannot issue' });
        const rows = await sbUpdate('pf_prizes', `id=eq.${encodeURIComponent(body.prize_id)}`, {
          fulfillment_status: 'issued', issued_at: new Date().toISOString(),
        });
        await audit(who, 'prize_issued', { prize_id: body.prize_id });
        return resp(headers, 200, { ok: true, prize: rows[0] });
      }

      default:
        return resp(headers, 400, { error: 'unknown action' });
    }
  } catch (e) {
    return resp(headers, 500, { error: e.message });
  }
};

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}
function dollars(cents) { return '$' + Math.round(Number(cents) / 100).toLocaleString('en-US'); }
function adminLabel(event) {
  const t = event.headers && (event.headers['x-admin-api-token'] || event.headers['X-Admin-Api-Token']);
  return t ? 'admin:token' : 'admin:session';
}
async function audit(actor, eventName, detail) {
  try { await sbInsert('pf_audit_log', { event: eventName, actor, detail }); } catch (_) { /* non-fatal */ }
}
function resp(headers, statusCode, obj) {
  return { statusCode, headers, body: JSON.stringify(obj) };
}
