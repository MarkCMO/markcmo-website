// ═══════════════════════════════════════════════════════════════
// pf-risk-cron.js  (WETYR Arena)  -- scheduled
// Three jobs each run:
//   A. Rule sweep   : recompute equity for active accounts with open positions
//                     (market moves can breach a sitting position) and flag breaches.
//   B. Daily reset  : at the ET reset hour, set day_start_balance = balance so the
//                     daily-loss limit measures from a fresh start each session.
//   C. Weekly close : for live competitions past ends_at, rank entries, pick the
//                     top-N winners, and create their prize records.
//
// Wire the schedule in netlify.toml only at go-live (so it does not fire against an
// un-migrated DB): [functions."pf-risk-cron"] schedule = "0 * * * *"
//
// PENDING: PF_REALTIME_URL (price), schema.sql applied, true consistency metric
// (currently ranks passed entries by profit; see computeConsistency TODO).
// ═══════════════════════════════════════════════════════════════
const { sbSelect, sbInsert, sbUpdate } = require('./_lib_supabase');

const POINT_VALUE = { MNQ: 2, MES: 5, NQ: 20, ES: 50, MCL: 100, CL: 1000, MGC: 10, GC: 100 };
const RESET_HOUR_ET = Number(process.env.PF_RESET_HOUR_ET || 9); // pre-open reset

exports.handler = async () => {
  const summary = { swept: 0, breached: 0, reset: 0, competitionsClosed: 0, prizesAwarded: 0, errors: [] };
  try {
    await ruleSweep(summary);
    await maybeDailyReset(summary);
    await closeDueCompetitions(summary);
  } catch (e) {
    summary.errors.push(e.message);
  }
  return { statusCode: 200, body: JSON.stringify(summary) };
};

// ── A. recompute equity for active accounts holding a position, flag breaches ──
async function ruleSweep(summary) {
  const accts = await sbSelect(`pf_accounts?status=eq.active&open_qty=neq.0&select=*,pf_plans(*)&limit=500`);
  const priceCache = {};
  for (const a of accts) {
    summary.swept++;
    const plan = a.pf_plans;
    const sym = (plan && plan.default_symbol) || 'MNQ';
    if (!(sym in priceCache)) priceCache[sym] = await currentPrice(sym);
    const price = priceCache[sym];
    if (price == null) continue;
    const mult = POINT_VALUE[sym] || 2;
    const openPnlCents = Math.round((price - Number(a.open_avg)) * a.open_qty * mult * 100);
    const equityCents = Number(a.balance_cents) + openPnlCents;

    let status = 'active', breachReason = null;
    if (equityCents <= Number(a.drawdown_floor_cents)) { status = 'breached'; breachReason = 'trailing_drawdown'; }
    else if ((equityCents - Number(a.day_start_balance_cents)) <= -Number(plan.daily_loss_cents)) { status = 'breached'; breachReason = 'daily_loss'; }

    const patch = { equity_cents: equityCents };
    if (status === 'breached') {
      patch.status = 'breached'; patch.breach_reason = breachReason; patch.breached_at = new Date().toISOString();
      summary.breached++;
      await sbInsert('pf_rule_events', { account_id: a.id, event_type: `${breachReason}_breach`, detail: { equity_cents: equityCents, source: 'cron' } });
    }
    await sbUpdate('pf_accounts', `id=eq.${a.id}`, patch);
  }
}

// ── B. daily reset of the day-start balance at the ET reset hour ──
async function maybeDailyReset(summary) {
  if (etHour() !== RESET_HOUR_ET) return;
  const accts = await sbSelect(`pf_accounts?status=eq.active&select=id,balance_cents&limit=2000`);
  for (const a of accts) {
    await sbUpdate('pf_accounts', `id=eq.${a.id}`, { day_start_balance_cents: a.balance_cents });
    summary.reset++;
  }
}

// ── C. close competitions past their end, rank, award top-N prizes ──
async function closeDueCompetitions(summary) {
  const nowIso = new Date().toISOString();
  const comps = await sbSelect(`pf_competitions?status=eq.live&ends_at=lte.${nowIso}&select=*&limit=50`);
  for (const comp of comps) {
    const plan = (await sbSelect(`pf_plans?id=eq.${comp.plan_id}&select=*`))[0];
    const entries = await sbSelect(`pf_leaderboard_entries?competition_id=eq.${comp.id}&select=*,pf_accounts(*)&limit=5000`);

    // score: passed entries first, ranked by consistency (profit as the current proxy)
    const scored = entries.map((e) => {
      const acct = e.pf_accounts || {};
      const profitCents = Number(acct.balance_cents || 0) - Number(plan.account_size_cents);
      const passed = acct.status === 'passed' || profitCents >= Number(plan.profit_target_cents);
      const consistency = computeConsistency(acct); // TODO: real value from snapshots; null for now
      const metric = passed ? (consistency != null ? consistency : profitCents) : -1e15;
      return { e, passed, profitCents, metric };
    }).sort((x, y) => y.metric - x.metric);

    // write ranks + pass flags
    for (let i = 0; i < scored.length; i++) {
      const s = scored[i];
      await sbUpdate('pf_leaderboard_entries', `id=eq.${s.e.id}`, {
        rank: i + 1, passed: s.passed, metric_value: s.profitCents / 100,
      });
    }

    // award top-N passed entries
    const winners = scored.filter((s) => s.passed).slice(0, comp.num_winners || 3);
    for (const w of winners) {
      await sbInsert('pf_prizes', {
        competition_id: comp.id, trader_id: w.e.trader_id, partner_id: comp.prize_partner_id || null,
        prize_type: 'prop_account', account_size_cents: plan.account_size_cents,
        fulfillment_status: 'pending', kyc_verified: false,
      });
      await sbInsert('pf_audit_log', {
        trader_id: w.e.trader_id, account_id: w.e.account_id, event: 'prize_awarded', actor: 'system',
        detail: { competition_id: comp.id, rank: scored.indexOf(w) + 1 },
      });
      summary.prizesAwarded++;
    }

    await sbUpdate('pf_competitions', `id=eq.${comp.id}`, { status: 'closed' });
    summary.competitionsClosed++;
  }
}

// TODO: real consistency = 1 - (largest single ET-day gain / total gain), using
// pf_account_snapshots bucketed by day. Returns null until implemented so the
// ranker falls back to profit.
function computeConsistency() { return null; }

function etHour() {
  try {
    return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(new Date()));
  } catch { return new Date().getUTCHours(); }
}

async function currentPrice(sym) {
  const base = process.env.PF_REALTIME_URL;
  if (!base) return null;
  try {
    const r = await fetch(`${base}/session/${encodeURIComponent(sym)}/price`);
    const j = await r.json();
    return typeof j.price === 'number' ? j.price : null;
  } catch { return null; }
}
