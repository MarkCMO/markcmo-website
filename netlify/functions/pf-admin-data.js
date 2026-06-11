// ═══════════════════════════════════════════════════════════════
// pf-admin-data.js  (WETYR Arena)  -- admin-gated reader for /arena/admin/
// Returns the data the console renders. GET ?section=overview|divisions|
// seasons|risk|prizes|partners|audit|all  (default: all).
//
// Auth: requires the mcadmin_session cookie or x-admin-api-token header
// (same gate as the rest of the admin surface, via isAdminAuthed).
// ═══════════════════════════════════════════════════════════════
const { sb, sbSelect, isAdminAuthed, corsHeaders } = require('./_lib_supabase');

exports.handler = async (event) => {
  const headers = corsHeaders(event, ['https://wetyr.com', 'https://markcmo.com']);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (!(await isAdminAuthed(event))) return resp(headers, 401, { error: 'unauthorized' });

  const section = (event.queryStringParameters && event.queryStringParameters.section) || 'all';
  try {
    const out = {};
    if (section === 'all' || section === 'overview') out.overview = await overview();
    if (section === 'all' || section === 'divisions') out.divisions = await sbSelect('pf_plans?select=*&order=weekly_price_cents.asc');
    if (section === 'all' || section === 'seasons') out.seasons = await seasons();
    if (section === 'all' || section === 'risk') out.risk = await risk();
    if (section === 'all' || section === 'prizes') out.prizes = await prizes();
    if (section === 'all' || section === 'partners') out.partners = await sbSelect('pf_partners?select=*&order=name.asc');
    if (section === 'all' || section === 'audit') out.audit = await sbSelect('pf_audit_log?select=*&order=ts.desc&limit=50');
    return resp(headers, 200, out);
  } catch (e) {
    return resp(headers, 500, { error: e.message });
  }
};

async function overview() {
  const sinceMidnight = new Date(); sinceMidnight.setUTCHours(0, 0, 0, 0);
  const iso = sinceMidnight.toISOString();
  const [traders, subsActive, amoe, acctsActive, passed, breachedToday, prizesPending] = await Promise.all([
    sbCount('pf_traders?status=eq.active'),
    sbCount('pf_subscriptions?status=eq.active'),
    sbCount('pf_leaderboard_entries?entry_method=eq.amoe'),
    sbCount('pf_accounts?status=eq.active'),
    sbCount('pf_accounts?status=eq.passed'),
    sbCount(`pf_accounts?status=eq.breached&breached_at=gte.${iso}`),
    sbCount('pf_prizes?fulfillment_status=eq.pending'),
  ]);
  // weekly subscription revenue (sum of active sub prices)
  const subs = await sbSelect('pf_subscriptions?status=eq.active&select=weekly_price_cents&limit=5000');
  const weeklyRevCents = subs.reduce((s, r) => s + Number(r.weekly_price_cents || 0), 0);
  return { traders, subsActive, amoe, acctsActive, passed, breachedToday, prizesPending, weeklyRevCents };
}

async function seasons() {
  const comps = await sbSelect('pf_competitions?select=*,pf_plans(name)&order=starts_at.desc&limit=24');
  // attach entrant counts
  for (const c of comps) c.entrants = await sbCount(`pf_leaderboard_entries?competition_id=eq.${c.id}`);
  return comps;
}

async function risk() {
  // active accounts ordered by smallest cushion to the trailing floor
  const accts = await sbSelect('pf_accounts?status=eq.active&select=*,pf_traders(email),pf_plans(name,daily_loss_cents)&order=equity_cents.asc&limit=50');
  return accts.map((a) => {
    const cushionCents = Number(a.equity_cents) - Number(a.drawdown_floor_cents);
    const dll = Number(a.pf_plans && a.pf_plans.daily_loss_cents) || 0;
    const dailyBufferCents = (Number(a.equity_cents) - Number(a.day_start_balance_cents)) + dll;
    let flag = 'ok';
    if (cushionCents <= dll * 0.25 || dailyBufferCents <= dll * 0.25) flag = 'danger';
    else if (cushionCents <= dll || dailyBufferCents <= dll) flag = 'warn';
    return {
      id: a.id, email: a.pf_traders && a.pf_traders.email, division: a.pf_plans && a.pf_plans.name,
      equity_cents: a.equity_cents, cushion_cents: cushionCents, daily_buffer_cents: dailyBufferCents, flag,
    };
  });
}

async function prizes() {
  return sbSelect('pf_prizes?fulfillment_status=in.(pending,issued)&select=*,pf_traders(email),pf_competitions(name)&order=awarded_at.desc&limit=100');
}

// PostgREST exact count without pulling rows.
async function sbCount(path) {
  const { url, key } = sb();
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${url}/rest/v1/${path}${sep}select=id`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact', Range: '0-0' },
  });
  const cr = res.headers.get('content-range') || '*/0'; // "0-0/123"
  return Number(cr.split('/')[1]) || 0;
}

function resp(headers, statusCode, obj) {
  return { statusCode, headers, body: JSON.stringify(obj) };
}
