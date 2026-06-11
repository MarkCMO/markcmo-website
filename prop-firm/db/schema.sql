-- ============================================================================
-- WETYR Arena - prop firm / trading simulator schema  (Supabase / Postgres)
-- Namespace: pf_*   |   Money: integer CENTS   |   RLS: deny-all (service role only)
--
-- SAFE TO AUTHOR, NOT YET RUN. Review economics first, then apply via Supabase SQL
-- editor or migration. Does NOT touch any mc_* table.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Reference: tradable futures instruments (micro + mini)
-- ---------------------------------------------------------------------------
create table if not exists pf_instruments (
  symbol          text primary key,           -- 'MES', 'ES', 'MNQ', 'NQ', 'MCL', 'CL', 'MGC', 'GC'
  name            text not null,
  tick_size       numeric(12,6) not null,      -- price increment, e.g. 0.25 for ES
  tick_value_cents integer not null,           -- $ value of one tick, in cents (e.g. MES = 125)
  is_micro        boolean not null default false,
  active          boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Plans: the subscription tiers ($5/wk etc.). Drives funnel + account creation.
-- ---------------------------------------------------------------------------
create table if not exists pf_plans (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text unique not null,            -- 'starter','pro','elite'
  name                 text not null,
  weekly_price_cents   integer not null,                 -- 500 = $5.00/wk
  account_size_cents   bigint not null,                  -- sim balance, e.g. 2500000 = $25,000
  profit_target_cents  bigint not null,
  max_drawdown_cents   bigint not null,                  -- trailing drawdown amount
  daily_loss_cents     bigint not null,                  -- daily loss limit
  max_contracts        integer not null,
  profit_split_pct     integer not null,                 -- trader's share, e.g. 80
  min_trading_days     integer not null default 5,
  consistency_pct      integer,                          -- null = off; e.g. 40 = no day > 40% of profit
  trailing_drawdown    boolean not null default true,
  default_symbol       text not null default 'MNQ',          -- instrument the division trades in the sim
  active               boolean not null default true,
  square_plan_id       text,                             -- Square subscription plan/variation id
  created_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Traders
-- ---------------------------------------------------------------------------
create table if not exists pf_traders (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique not null,
  full_name          text,
  country            text,
  state              text,
  status             text not null default 'active',     -- active | suspended | banned
  kyc_status         text not null default 'none',       -- none | pending | verified | rejected
  square_customer_id text,
  referred_by        uuid references pf_traders(id),
  created_at         timestamptz not null default now()
);
create index if not exists pf_traders_email_idx on pf_traders(email);

-- ---------------------------------------------------------------------------
-- Subscriptions: the recurring $5/week that keeps an account alive
-- ---------------------------------------------------------------------------
create table if not exists pf_subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  trader_id            uuid not null references pf_traders(id),
  plan_id              uuid not null references pf_plans(id),
  square_subscription_id text,
  status               text not null default 'active',    -- active | past_due | canceled
  weekly_price_cents   integer not null,
  current_period_end   timestamptz,
  created_at           timestamptz not null default now(),
  canceled_at          timestamptz
);
create index if not exists pf_subs_trader_idx on pf_subscriptions(trader_id);
create index if not exists pf_subs_status_idx on pf_subscriptions(status);

-- ---------------------------------------------------------------------------
-- Accounts: one simulated funded account per active subscription
-- ---------------------------------------------------------------------------
create table if not exists pf_accounts (
  id                   uuid primary key default gen_random_uuid(),
  trader_id            uuid not null references pf_traders(id),
  plan_id              uuid not null references pf_plans(id),
  subscription_id      uuid references pf_subscriptions(id),
  account_type         text not null default 'evaluation', -- evaluation | funded
  status               text not null default 'active',      -- active | passed | breached | lapsed | closed
  balance_cents        bigint not null,                     -- realized balance
  equity_cents         bigint not null,                     -- balance + open P&L
  high_water_mark_cents bigint not null,                    -- peak balance, for trailing drawdown
  drawdown_floor_cents bigint not null,                     -- equity must stay above this
  day_start_balance_cents bigint not null,                  -- reset daily by pf-risk-cron
  open_qty             integer not null default 0,          -- signed net open position (contracts), maintained by pf-trade
  open_avg             numeric(14,4) not null default 0,    -- avg entry price of the open position
  trading_days         integer not null default 0,
  start_date           timestamptz not null default now(),
  passed_at            timestamptz,
  breached_at          timestamptz,
  breach_reason        text,
  created_at           timestamptz not null default now()
);
create index if not exists pf_accounts_trader_idx on pf_accounts(trader_id);
create index if not exists pf_accounts_status_idx on pf_accounts(status);

-- ---------------------------------------------------------------------------
-- Trades: simulated fills posted by the browser simulator
-- ---------------------------------------------------------------------------
create table if not exists pf_trades (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references pf_accounts(id),
  symbol        text not null references pf_instruments(symbol),
  side          text not null,                  -- long | short
  qty           integer not null,
  entry_price   numeric(14,4) not null,
  exit_price    numeric(14,4),
  entry_at      timestamptz not null default now(),
  exit_at       timestamptz,
  pnl_cents     bigint,                          -- realized on close
  fees_cents    bigint not null default 0,
  status        text not null default 'open'     -- open | closed
);
create index if not exists pf_trades_account_idx on pf_trades(account_id);
create index if not exists pf_trades_open_idx on pf_trades(account_id) where status = 'open';

-- ---------------------------------------------------------------------------
-- Equity snapshots: time series for equity curve + daily loss / drawdown checks
-- ---------------------------------------------------------------------------
create table if not exists pf_account_snapshots (
  id             bigserial primary key,
  account_id     uuid not null references pf_accounts(id),
  ts             timestamptz not null default now(),
  balance_cents  bigint not null,
  equity_cents   bigint not null,
  open_pnl_cents bigint not null default 0
);
create index if not exists pf_snap_account_ts_idx on pf_account_snapshots(account_id, ts);

-- ---------------------------------------------------------------------------
-- Rule events: every risk-engine decision (breaches, target hits, milestones)
-- ---------------------------------------------------------------------------
create table if not exists pf_rule_events (
  id          bigserial primary key,
  account_id  uuid not null references pf_accounts(id),
  event_type  text not null,    -- daily_loss_breach | max_drawdown_breach | profit_target_hit
                                 -- | min_days_met | consistency_flag | daily_reset
  detail      jsonb not null default '{}'::jsonb,
  ts          timestamptz not null default now()
);
create index if not exists pf_rule_events_account_idx on pf_rule_events(account_id, ts);

-- ---------------------------------------------------------------------------
-- Payouts: KYC-gated request → approval → paid
-- ---------------------------------------------------------------------------
create table if not exists pf_payouts (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references pf_accounts(id),
  trader_id        uuid not null references pf_traders(id),
  gross_pnl_cents  bigint not null,
  profit_split_pct integer not null,
  payout_cents     bigint not null,                  -- gross * split
  status           text not null default 'requested', -- requested | approved | paid | rejected
  method           text,                              -- wise | crypto | ach
  kyc_verified     boolean not null default false,
  requested_at     timestamptz not null default now(),
  approved_at      timestamptz,
  paid_at          timestamptz,
  notes            text
);
create index if not exists pf_payouts_status_idx on pf_payouts(status);

-- ---------------------------------------------------------------------------
-- Audit log (mirrors mc_audit_log pattern)
-- ---------------------------------------------------------------------------
create table if not exists pf_audit_log (
  id         bigserial primary key,
  trader_id  uuid references pf_traders(id),
  account_id uuid references pf_accounts(id),
  event      text not null,
  actor      text,             -- 'system' | 'trader' | 'admin:<email>'
  detail     jsonb not null default '{}'::jsonb,
  ts         timestamptz not null default now()
);
create index if not exists pf_audit_ts_idx on pf_audit_log(ts);

-- ============================================================================
-- RLS: deny-all to anon/auth. All access via Netlify functions w/ service role.
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'pf_instruments','pf_plans','pf_traders','pf_subscriptions','pf_accounts',
    'pf_trades','pf_account_snapshots','pf_rule_events','pf_payouts','pf_audit_log'
  ] loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- ============================================================================
-- Seed: instruments (tick_value in cents)
-- ============================================================================
insert into pf_instruments (symbol, name, tick_size, tick_value_cents, is_micro) values
  ('MES','Micro E-mini S&P 500', 0.25,  125,  true),
  ('ES', 'E-mini S&P 500',       0.25, 1250,  false),
  ('MNQ','Micro E-mini Nasdaq',  0.25,   50,  true),
  ('NQ', 'E-mini Nasdaq 100',    0.25,  500,  false),
  ('MCL','Micro Crude Oil',      0.01,  100,  true),
  ('CL', 'Crude Oil',            0.01, 1000,  false),
  ('MGC','Micro Gold',           0.10,  100,  true),
  ('GC', 'Gold',                 0.10, 1000,  false)
on conflict (symbol) do nothing;

-- ============================================================================
-- Seed: plan tiers (Mark-adjustable). Money in cents.
-- ============================================================================
insert into pf_plans
  (slug, name, weekly_price_cents, account_size_cents, profit_target_cents,
   max_drawdown_cents, daily_loss_cents, max_contracts, profit_split_pct,
   min_trading_days, consistency_pct)
values
  ('starter','Starter',  500,  2500000, 150000, 100000,  50000,  3, 80,  5, 40),
  ('pro',    'Pro',     1000,  5000000, 300000, 200000, 110000,  5, 85,  7, 40),
  ('elite',  'Elite',   1500, 10000000, 600000, 300000, 220000, 10, 90, 10, 40)
on conflict (slug) do nothing;

-- ============================================================================
-- COMPETITION + PRIZE MODEL  (added 2026-06-11)
-- Pivot: winners earn a real prop-firm account as a PRIZE (no cash from WETYR).
-- WETYR sources accounts at affiliate / bulk / partner rates. pf_payouts above is
-- retained for a future PF_MODE=live cash path but is NOT the active mechanism.
-- ============================================================================

-- Prop-firm partners we source prize accounts from
create table if not exists pf_partners (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  website       text,
  products      jsonb not null default '[]'::jsonb,   -- [{label, size_cents}]
  cost_per_account_cents bigint,                       -- our cost at affiliate/bulk rate
  affiliate_url text,
  coupon_code   text,
  deal_terms    text,
  status        text not null default 'prospect',      -- prospect | active | paused
  created_at    timestamptz not null default now()
);

-- A competition season, scoped to one division (account size / plan)
create table if not exists pf_competitions (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  plan_id           uuid not null references pf_plans(id),   -- the division / account size
  ranking_metric    text not null default 'pass_then_consistency',
                    -- pass_then_consistency | return_pct | risk_adjusted | net_profit_cents
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  status            text not null default 'upcoming',        -- upcoming | live | closed
  prize_partner_id  uuid references pf_partners(id),
  prize_description text,                                     -- e.g. 'Apex $50K evaluation account'
  num_winners       integer not null default 1,
  amoe_enabled      boolean not null default true,           -- free alternative method of entry
  created_at        timestamptz not null default now()
);
create index if not exists pf_comp_status_idx on pf_competitions(status);

-- A trader's standing within a competition (one row per account per competition)
create table if not exists pf_leaderboard_entries (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references pf_competitions(id),
  trader_id      uuid not null references pf_traders(id),
  account_id     uuid not null references pf_accounts(id),
  entry_method   text not null default 'subscription',       -- subscription | amoe (free)
  metric_value   numeric(18,4) not null default 0,           -- computed per ranking_metric
  rank           integer,
  passed         boolean not null default false,
  status         text not null default 'active',             -- active | breached | disqualified
  updated_at     timestamptz not null default now(),
  unique (competition_id, account_id)
);
create index if not exists pf_lb_comp_rank_idx on pf_leaderboard_entries(competition_id, rank);

-- Prize awards (the prop account a winner earns)
create table if not exists pf_prizes (
  id                 uuid primary key default gen_random_uuid(),
  competition_id     uuid not null references pf_competitions(id),
  trader_id          uuid not null references pf_traders(id),
  partner_id         uuid references pf_partners(id),
  prize_type         text not null default 'prop_account',   -- prop_account | coupon
  account_size_cents bigint,
  fulfillment_status text not null default 'pending',         -- pending | issued | redeemed
  kyc_verified       boolean not null default false,
  tax_form_status    text not null default 'none',            -- none | requested | received (W-9; 1099 if > $600)
  awarded_at         timestamptz not null default now(),
  issued_at          timestamptz,
  notes              text
);
create index if not exists pf_prizes_status_idx on pf_prizes(fulfillment_status);

-- RLS for the competition/prize tables (deny-all, service role only)
do $$
declare t text;
begin
  foreach t in array array[
    'pf_partners','pf_competitions','pf_leaderboard_entries','pf_prizes'
  ] loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- Seed: TOP 5 prop-firm partners from WETYR "Complete Prop Firm Matrix v2"
-- (NQ/ES futures, scored for the 9:30 OMP strategy). status 'prospect' until a deal is struck.
insert into pf_partners (name, website, status, coupon_code, products, deal_terms) values
  ('Apex Trader Funding','https://apextraderfunding.com','prospect','DGT',
    '[{"label":"25K","size_cents":2500000},{"label":"50K","size_cents":5000000},{"label":"100K","size_cents":10000000},{"label":"150K","size_cents":15000000}]'::jsonb,
    'Rank 1 (93/100). DGT = up to 90% off eval (~$208 all-in for 50K). Mark already holds 20 Apex PA accounts (existing relationship). EOD trailing; 100% first 25K/PA then 90/10. Target as FIRST partner: cheapest prize sourcing + standing relationship.'),
  ('Alpha Futures','https://alphafutures.io','prospect','Paul001554',
    '[{"label":"25K","size_cents":2500000},{"label":"50K","size_cents":5000000},{"label":"100K","size_cents":10000000},{"label":"150K","size_cents":15000000}]'::jsonb,
    'Rank 2 (92/100). Paul001554 = 25% off; ~$79/mo for 50K Premium. Highest Trustpilot (4.9), $70M+ paid, EOD + no daily loss limit + no funded consistency.'),
  ('Tradeify','https://tradeify.co','prospect','DASH',
    '[{"label":"25K","size_cents":2500000},{"label":"50K","size_cents":5000000},{"label":"100K","size_cents":10000000},{"label":"150K","size_cents":15000000}]'::jsonb,
    'Rank 3 (91/100). DASH = ~30% off (~$103 all-in for 50K). Only major firm EOD on BOTH eval and funded; Lightning = instant funded; daily payouts. Max 5 accounts.'),
  ('TradeDay','https://tradeday.com','prospect','VIBES',
    '[{"label":"50K","size_cents":5000000},{"label":"100K","size_cents":10000000},{"label":"150K","size_cents":15000000}]'::jsonb,
    'Rank 4 (88/100). VIBES = 30% off. Choose drawdown type at purchase (Static = only $500 DD on 50K). 95% split ceiling; no daily loss limit.'),
  ('Phidias Prop Firm','https://phidiaspropfirm.com','prospect',null,
    '[{"label":"25K","size_cents":2500000},{"label":"50K","size_cents":5000000},{"label":"100K","size_cents":10000000},{"label":"150K","size_cents":15000000}]'::jsonb,
    'Rank 5 (85/100). No code found. No DLL, no news restrictions, no time limit, no consistency; weekend/overnight allowed; 30-min payouts.')
on conflict (name) do nothing;

-- NOTE: pf_competitions rows are NOT seeded here. Create them once season cadence,
-- ranking metric, num_winners, and the prize partner are decided.
