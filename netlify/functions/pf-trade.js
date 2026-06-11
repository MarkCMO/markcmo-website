// ═══════════════════════════════════════════════════════════════
// pf-trade.js  (WETYR Arena)
// Server-authoritative fill. The client requests "buy/sell at market"; this
// function fills at the price the realtime Worker reports (NOT a client-supplied
// price), updates the account, enforces the rules, and records the trade.
// This is the anti-cheat boundary: the server owns price and position.
//
// POST { account_id, side: 'buy'|'sell', qty }
//
// Port of the verified client engine in arena/app/index.html (weighted-avg add,
// realize-on-reduce, max-contract cap, trailing-DD / daily-loss / target rules).
//
// PENDING go-live: trader-session auth (see TODO), PF_REALTIME_URL pointing at the
// deployed MarketSession Worker, schema.sql applied.
// ═══════════════════════════════════════════════════════════════
const { sbSelect, sbInsert, sbUpdate, corsHeaders } = require('./_lib_supabase');

const POINT_VALUE = { MNQ: 2, MES: 5, NQ: 20, ES: 50, MCL: 100, CL: 1000, MGC: 10, GC: 100 }; // $ per index point

exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return resp(headers, 405, { error: 'POST only' });

  try {
    const { account_id, side, qty } = JSON.parse(event.body || '{}');
    // TODO(auth): verify a trader session cookie/token owns account_id before filling.
    if (!account_id || !['buy', 'sell'].includes(side) || !(Number(qty) > 0)) {
      return resp(headers, 400, { error: 'account_id, side (buy|sell), qty>0 required' });
    }
    const n = Math.floor(Number(qty));

    // load account + its plan (division rules)
    const accts = await sbSelect(`pf_accounts?id=eq.${encodeURIComponent(account_id)}&select=*,pf_plans(*)`);
    if (!accts.length) return resp(headers, 404, { error: 'account not found' });
    const a = accts[0];
    const plan = a.pf_plans;
    if (a.status !== 'active') return resp(headers, 409, { error: 'account not active', status: a.status });

    const sym = (plan && plan.default_symbol) || 'MNQ';
    const mult = POINT_VALUE[sym] || 2;

    // server-authoritative price
    const price = await currentPrice(sym);
    if (price == null) return resp(headers, 503, { error: 'no market price available' });

    // ---- position math (mirrors the verified client engine) ----
    const dir = side === 'buy' ? 1 : -1;
    const add = dir * n;
    let netQty = a.open_qty | 0;
    let avg = Number(a.open_avg) || 0;
    let balanceCents = Number(a.balance_cents);
    let realizedCents = 0;

    const newNet = netQty + add;
    if (Math.abs(newNet) > plan.max_contracts) {
      return resp(headers, 409, { error: 'exceeds max contracts', max_contracts: plan.max_contracts });
    }

    if (netQty === 0 || (netQty > 0) === (add > 0)) {
      // adding in the same direction: weighted average
      avg = (avg * Math.abs(netQty) + price * Math.abs(add)) / (Math.abs(netQty) + Math.abs(add));
      netQty = newNet;
    } else {
      // reducing / closing / flipping: realize on the closed portion
      const closeQty = Math.min(Math.abs(add), Math.abs(netQty)) * (netQty > 0 ? 1 : -1);
      realizedCents = Math.round((price - avg) * closeQty * mult * 100);
      balanceCents += realizedCents;
      const prevNet = netQty;
      netQty = newNet;
      if (netQty === 0) avg = 0;
      else if (Math.abs(add) > Math.abs(prevNet)) avg = price; // flipped through zero
    }

    // record the fill
    await sbInsert('pf_trades', {
      account_id, symbol: sym, side, qty: n,
      entry_price: price, status: netQty === 0 ? 'closed' : 'open',
      pnl_cents: realizedCents || null,
    });

    // recompute equity + trailing floor
    const openPnlCents = netQty !== 0 ? Math.round((price - avg) * netQty * mult * 100) : 0;
    const equityCents = balanceCents + openPnlCents;
    let hwm = Number(a.high_water_mark_cents);
    let floor = Number(a.drawdown_floor_cents);
    if (balanceCents > hwm) { hwm = balanceCents; floor = hwm - plan.max_drawdown_cents; }

    // rule checks (same order as the client: drawdown, then daily loss, then target)
    let status = a.status, breachReason = a.breach_reason, passedAt = a.passed_at, breachedAt = a.breached_at;
    const nowIso = new Date().toISOString();
    if (equityCents <= floor) { status = 'breached'; breachReason = 'trailing_drawdown'; breachedAt = nowIso; }
    else if ((equityCents - Number(a.day_start_balance_cents)) <= -plan.daily_loss_cents) { status = 'breached'; breachReason = 'daily_loss'; breachedAt = nowIso; }
    else if ((balanceCents - Number(plan.account_size_cents)) >= Number(plan.profit_target_cents)) { status = 'passed'; passedAt = passedAt || nowIso; }

    await sbUpdate('pf_accounts', `id=eq.${encodeURIComponent(account_id)}`, {
      balance_cents: balanceCents, equity_cents: equityCents,
      open_qty: netQty, open_avg: Number(avg.toFixed(4)),
      high_water_mark_cents: hwm, drawdown_floor_cents: floor,
      status, breach_reason: breachReason, passed_at: passedAt, breached_at: breachedAt,
    });

    // snapshot for the equity curve / consistency calc
    await sbInsert('pf_account_snapshots', {
      account_id, balance_cents: balanceCents, equity_cents: equityCents, open_pnl_cents: openPnlCents,
    });

    if (status !== a.status) {
      await sbInsert('pf_rule_events', {
        account_id,
        event_type: status === 'breached' ? `${breachReason}_breach` : 'profit_target_hit',
        detail: { equity_cents: equityCents, floor_cents: floor },
      });
    }

    return resp(headers, 200, {
      ok: true, price, net_qty: netQty, avg: Number(avg.toFixed(4)),
      balance_cents: balanceCents, equity_cents: equityCents, open_pnl_cents: openPnlCents,
      realized_cents: realizedCents, status,
    });
  } catch (e) {
    return resp(headers, 500, { error: e.message });
  }
};

// Read the authoritative price from the realtime MarketSession Worker.
async function currentPrice(sym) {
  const base = process.env.PF_REALTIME_URL; // e.g. https://wetyr-arena-realtime.<acct>.workers.dev
  if (!base) return null;
  try {
    const r = await fetch(`${base}/session/${encodeURIComponent(sym)}/price`);
    const j = await r.json();
    return typeof j.price === 'number' ? j.price : null;
  } catch { return null; }
}

function resp(headers, statusCode, obj) {
  return { statusCode, headers, body: JSON.stringify(obj) };
}
