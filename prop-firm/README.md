# WETYR Arena: futures trading competition, win a real prop account

Working name (was "WETYR Funded"). A **paid futures trading competition**: traders pay a low weekly
fee (headline tier **$5/week**) to compete in a simulated-trading season inside their account-size
**division**. Each division has its own **leaderboard**. **Winners earn a real funded/evaluation
account at a partner prop firm as the prize**, so they reach real funded trading for a fraction of
the normal challenge price, and WETYR never pays cash to a trader (no money flows out).

Business shape:
- **Revenue:** weekly subscriptions ($5 / $10 / $15 by division).
- **Cost of goods:** prop-firm accounts awarded as prizes, sourced at affiliate / bulk / partner
  rates. Prop firms run affiliate programs and heavy coupon promos, so this is cheap, and a direct
  partner deal is realistic because WETYR delivers pre-vetted, rule-disciplined traders.
- **Story:** "Do not pay $150+ for a prop firm challenge. Prove you can trade here for $5/week and
  earn the account."

A future cash-payout funded program stays possible behind a `PF_MODE=live` flag, but the **prize
model is the launch mechanism precisely because it avoids cash payouts**. Modeled on the Topstep /
Apex lane.

> Namespaced and isolated from locked MarkCMO surfaces: `pf_*` Supabase tables, `pf-*` Netlify
> functions, own admin console. NEVER touch `admin.html`, `index.html`, `mc_*` tables, or any
> function locked in the root `CLAUDE.md`. No em-dashes or en-dashes anywhere (RULE #3).

## Launch decision (2026-06-11)

Launching as a **prize-based skill competition**, not a cash-payout prop firm. WETYR takes
subscription money IN but never pays cash OUT to traders; prizes are **prop-firm accounts** (a
product/service), sourced cheaply via affiliate/partner deals. This moves us out of securities/CFTC
"payouts-from-fees" territory entirely. The trade-off: it lands in **contest/sweepstakes law**
instead (see below), a friendlier, cheaper-to-navigate area. `PF_MODE=test` until proven.

## The legal reality (prize-competition model)

Removing cash payouts removes the big risk. It introduces standard **contest / sweepstakes
compliance**:

- **Skill vs chance:** a paid-entry contest with prizes can be an illegal lottery if it has prize +
  chance + consideration. Defense: it must be **skill-based** (objective, published trading-
  performance ranking), and/or remove consideration.
- **Free alternative method of entry (AMOE):** a no-purchase free entry path removes the
  "consideration" leg and keeps it clean in strict states. Build supports `amoe_enabled` per competition.
- **Official rules + prize disclosure:** publish rules, ranking metric, prize value, eligibility.
- **State exclusions:** a few states are strict on skill contests with fees; may exclude them.
- **Taxes:** prizes over $600 trigger 1099-MISC; collect W-9 + identity before issuing any prize.

No big legal budget needed to start (templates + precedent abundant), but an attorney should review
the official rules + AMOE before scaling. Honesty on every surface: "simulated competition", "earn a
prop account as a prize", never "we pay you" or "guaranteed funding".

## Divisions + economics (Mark-adjustable, `pf_plans` seed)

Tiers are now **divisions**: which account size you compete in, each with its own leaderboard and prize.

| Division | Weekly | Sim account | Profit target | Trailing drawdown | Daily loss | Max contracts | Min days |
|---|---|---|---|---|---|---|---|
| Starter | $5 | $25,000 | $1,500 | $1,000 | $500 | 3 micro | 5 |
| Pro | $10 | $50,000 | $3,000 | $2,000 | $1,100 | 5 micro | 7 |
| Elite | $15 | $100,000 | $6,000 | $3,000 | $2,200 | 10 micro | 10 |

Prize per division = a partner prop-firm account, ideally matched to the division size (e.g. Elite
winner earns a $100K prop evaluation). Ranking metric, season cadence, and number of winners are
open decisions (see schema `pf_competitions`).

## Architecture (reuses the existing MarkCMO stack)

| Layer | Implementation | Reuses |
|---|---|---|
| Funnel + pricing | `wetyr.com/arena/` static HTML | WETYR design system |
| Trader app + simulator | `wetyr.com/arena/app`: TradingView charts + WETYR order ticket; WETYR is the broker | n/a |
| Market data feed | Databento (live CME NQ/ES) at launch; replay/delayed for test. Live needs CME display license + data fees | new |
| Realtime delivery | Cloudflare Worker + Durable Object `MarketSession`: one feed in, identical ticks fanned out over WebSocket; `/price` is server-authoritative for fills (anti-cheat); `/ingest` accepts a live relay | CF Workers (existing stack) |
| Leaderboards | per-division, per-season, computed from trades/snapshots | Supabase |
| Billing ($5/wk) | Square Subscriptions | `_lib_square.js` |
| Data | Supabase `pf_*` tables | `_lib_supabase.js`, RLS deny-all |
| Backend | Netlify functions `pf-*` | function + redirect patterns |
| Risk + ranking engine | `pf-risk-cron` sweep: enforce rules + recompute leaderboard | `engagement-payment-followups` cron |
| Prizes / partners | award flow, KYC + W-9/1099, fulfillment | new |
| Admin | separate prop-firm console HTML | admin auth pattern (NOT locked admin.html) |

## Phased roadmap

- [x] **P0 - Foundation:** data model (`db/schema.sql`), this README. *(no DB run, no deploy)*
- [x] **P1 - Funnel:** `/arena/index.html` built and reworked to the prize story (hero = win a funded Apex account; prize/leaderboard/divisions sections; AMOE + contest disclaimers). Verified in preview.
- [~] **P2 - Auth + billing:** `pf-subscribe.js` authored + syntax-checked (trader upsert, Square subscription via `_lib_square` invoice-billed + sandbox-aware, free AMOE path, creates account + competition entry, audit). Signup UI `/arena/join/` built + verified (division select, paid vs free AMOE, validation, wired to pf-subscribe with test-mode fallback). PENDING: trader auth/session, Square catalog plans with `square_plan_id`, Supabase migration.
- [~] **P3 - Simulator:** `/arena/app/index.html` PROTOTYPE built + verified (front-end only). TradingView Lightweight Charts candlesticks + WETYR order ticket, client-side fill/P&L engine, live rule tracking (trailing DD, daily loss, profit target, breach/pass), seeded replayed NQ session, sample leaderboard. Verified: P&L math, max-contract cap, breach all correct. PENDING: wire to `pf-trade` + Supabase, point client at the realtime feed, server-side fill authority for anti-cheat.
- [~] **P3.5 - Realtime feed:** CF Worker + DO `MarketSession` authored (`realtime/market-session.js`, `wrangler.toml`): WebSocket tick fan-out, `/price` for server-side fills, `/ingest` for a live relay. Runs on free seeded replay now; live NQ/ES needs a Databento key + a relay + CME display license. PENDING: deploy to Cloudflare (offered via CF tooling), then point the sim client at it.
- [~] **P4 - Risk + ranking engine:** `pf-trade.js` (server-authoritative fills, exact port of the verified client engine, reads price from the realtime Worker) and `pf-risk-cron.js` (equity/rule sweep, ET daily reset, weekly competition close + top-3 winner selection + `pf_prizes` records) authored + syntax-checked. PENDING: `PF_REALTIME_URL`, Supabase migration, real consistency metric from snapshots, schedule in netlify.toml at go-live.
- [x] **P5 - Dashboard + leaderboards:** `/arena/dashboard/` (equity curve, rule gauges, prize progress, rank, history) and `/arena/leaderboard/` (per-division standings, top-3 prize zone, division tabs) built + verified (front-end, sample data; wire to Supabase next).
- [x] **P6 - Competitions:** weekly seasons, pass-then-consistency ranking, entry tracking. Implemented across `pf-subscribe` (entry), `pf-admin-write` create_seasons/close, and `pf-risk-cron` (close + rank + award).
- [~] **P7 - Prizes + partners:** claim page `/arena/claim/` built + verified (identity form, ID upload, W-9/1099 over-$600 gate, attestation) and `pf-claim-prize.js` authored + syntax-checked (marks claim received, sets tax-form requirement, stores NO raw PII, audit). Winner selection + `pf_prizes` already created by `pf-risk-cron`. PENDING: claim-token auth, KYC provider integration, admin issuance/fulfillment, Supabase migration.
- [x] **P8 - Admin console:** `/arena/admin/` built + verified (separate from locked admin.html). Login gate (reuses admin-auth, test-mode fallback), KPIs/margin, division config, weekly seasons (create/close+award), live risk monitor, prize fulfillment (KYC-gated), partner management, audit log. `pf-admin-data` (reader) + `pf-admin-write` (writer) authored + syntax-checked. Plus `pf-setup-square` (one-time Square sandbox catalog setup). **CODE BUILD COMPLETE.** Go-live wiring steps in `prop-firm/GO-LIVE.md`.
- [x] **P9.5 - SEO + indexing:** all arena pages have canonical (wetyr.com/arena/), OG/Twitter, favicon, theme-color; funnel has Organization + FAQPage JSON-LD; `/app/`, `/dashboard/`, `/claim/`, `/admin/` set `noindex`; `arena/sitemap.xml` + `arena/llms.txt` + `arena/og.svg` created; launch/Search Console/DNS steps in GO-LIVE.md section 8. Verified in preview.
- [ ] **P9 - Partner BD + official rules + legal review** before scaling.

## Conventions

- Tables: `pf_` prefix, RLS enabled, deny-all anon/auth (service role via functions only).
- Functions: `netlify/functions/pf-*.js`, reuse `_lib_supabase.js` / `_lib_square.js`.
- Public routes: `/arena/*`. Money stored in integer **cents**.
- No em-dashes or en-dashes anywhere (root CLAUDE.md RULE #3).
