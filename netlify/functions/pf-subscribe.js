// ═══════════════════════════════════════════════════════════════
// pf-subscribe.js  (WETYR Arena)
// Enrolls a trader into a division: creates/links the Square subscription,
// the trader record, the simulated account, and the live competition entry.
//
// POST { email, name, plan_slug, amoe? }
//   - amoe:true  -> free Alternative Method of Entry (no purchase, no Square)
//
// Prerequisites to go LIVE (authored, not yet runnable):
//   - schema.sql applied to Supabase (pf_* tables)
//   - Square subscription plan + plan variation created in the catalog, and its
//     variation id stored in pf_plans.square_plan_id (run against SQUARE_ENV=sandbox first)
//   - SQUARE_LOCATION_ID, SQUARE_ACCESS_TOKEN, MARKCMO_SUPABASE_* env vars set
// ═══════════════════════════════════════════════════════════════
const crypto = require('crypto');
const { sbSelect, sbInsert, sbUpdate, corsHeaders } = require('./_lib_supabase');
const { findOrCreateCustomer, sqCall } = require('./_lib_square');

exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return resp(headers, 405, { error: 'POST only' });

  try {
    const { email, name, plan_slug, amoe } = JSON.parse(event.body || '{}');
    if (!email || !plan_slug) return resp(headers, 400, { error: 'email and plan_slug required' });

    // 1. resolve the division/plan
    const plans = await sbSelect(`pf_plans?slug=eq.${encodeURIComponent(plan_slug)}&active=eq.true&select=*`);
    if (!plans.length) return resp(headers, 400, { error: 'unknown or inactive plan' });
    const plan = plans[0];

    // 2. current live competition for this division (entry is optional if none open)
    const comps = await sbSelect(`pf_competitions?plan_id=eq.${plan.id}&status=eq.live&select=*&order=starts_at.desc&limit=1`);
    const comp = comps[0] || null;

    // 3. upsert the trader by email
    const nm = (name || '').trim();
    const sp = nm.indexOf(' ');
    const given = sp > 0 ? nm.slice(0, sp) : nm;
    const family = sp > 0 ? nm.slice(sp + 1) : '';
    const traderRows = await sbInsert('pf_traders',
      { email: email.toLowerCase(), full_name: nm || null },
      { upsert: 'email' });
    const trader = traderRows[0];

    // 4. paid path: Square customer + subscription (invoice-billed; no card needed to start the test)
    let subscription = null;
    if (!amoe) {
      const customer = await findOrCreateCustomer({ email, givenName: given, familyName: family });
      if (customer?.id && customer.id !== trader.square_customer_id) {
        await sbUpdate('pf_traders', `id=eq.${trader.id}`, { square_customer_id: customer.id });
      }
      if (!plan.square_plan_id) {
        return resp(headers, 409, { error: 'plan.square_plan_id not set; create the Square subscription plan variation first' });
      }
      const startIso = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const sub = await sqCall('POST', '/subscriptions', {
        idempotency_key: crypto.randomUUID(),
        location_id: process.env.SQUARE_LOCATION_ID,
        plan_variation_id: plan.square_plan_id, // the $5/$10/$15 weekly variation
        customer_id: customer.id,
        start_date: startIso,
        // No card_id -> Square bills via invoice each cycle (good for the sandbox test).
      });
      const sq = sub.subscription || {};
      const subRows = await sbInsert('pf_subscriptions', {
        trader_id: trader.id, plan_id: plan.id,
        square_subscription_id: sq.id || null, status: 'active',
        weekly_price_cents: plan.weekly_price_cents,
      });
      subscription = subRows[0];
    }

    // 5. create the simulated account for this division
    const acctRows = await sbInsert('pf_accounts', {
      trader_id: trader.id, plan_id: plan.id, subscription_id: subscription ? subscription.id : null,
      account_type: 'evaluation', status: 'active',
      balance_cents: plan.account_size_cents, equity_cents: plan.account_size_cents,
      high_water_mark_cents: plan.account_size_cents,
      drawdown_floor_cents: plan.account_size_cents - plan.max_drawdown_cents,
      day_start_balance_cents: plan.account_size_cents,
      open_qty: 0, open_avg: 0,
    });
    const account = acctRows[0];

    // 6. enter the live competition (if one is open)
    let entry = null;
    if (comp) {
      const entryRows = await sbInsert('pf_leaderboard_entries', {
        competition_id: comp.id, trader_id: trader.id, account_id: account.id,
        entry_method: amoe ? 'amoe' : 'subscription',
      });
      entry = entryRows[0];
    }

    // 7. audit
    await sbInsert('pf_audit_log', {
      trader_id: trader.id, account_id: account.id,
      event: amoe ? 'amoe_entry' : 'subscribed', actor: 'system',
      detail: { plan: plan.slug, competition_id: comp ? comp.id : null },
    });

    return resp(headers, 200, {
      ok: true, trader_id: trader.id, account_id: account.id,
      entry_id: entry ? entry.id : null,
      subscription_id: subscription ? subscription.id : null,
      entered_competition: !!comp,
    });
  } catch (e) {
    return resp(headers, 500, { error: e.message });
  }
};

function resp(headers, statusCode, obj) {
  return { statusCode, headers, body: JSON.stringify(obj) };
}
