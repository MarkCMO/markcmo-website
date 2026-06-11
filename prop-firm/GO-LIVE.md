# WETYR Arena: go-live runbook

The whole product is built (UI + backend + realtime). This is the exact, ordered list to take it
from authored code to a running test, then to live. Every step before "Flip to live" is sandbox/test
and spends no real money. Do them in order.

## 0. Env vars (set in Netlify, + Cloudflare for the Worker)

Already present (engagement pipeline): `MARKCMO_SUPABASE_URL`, `MARKCMO_SUPABASE_SERVICE_KEY`,
`SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `ADMIN_SESSION_SECRET`, `MARKCMO_ADMIN_API_TOKEN`.

Add for Arena:
- `SQUARE_ENV = sandbox`  (use a SANDBOX `SQUARE_ACCESS_TOKEN` + `SQUARE_LOCATION_ID` while testing)
- `PF_REALTIME_URL = https://wetyr-arena-realtime.<account>.workers.dev`  (after step 3)
- `PF_RESET_HOUR_ET = 9`  (daily-loss reset hour; optional, defaults to 9)
- Cloudflare Worker secrets (step 3): `DATABENTO_KEY`, `INGEST_SECRET` (only when going to live data)

## 1. Supabase: create the tables

Apply `prop-firm/db/schema.sql` to the CLIPOS project (SQL editor or psql). It is additive and uses
`create table if not exists`; it never touches `mc_*` tables. Verify the 14 `pf_*` tables exist and
the seed rows landed (3 plans, 8 instruments, 5 partners).

## 2. Square: create the weekly subscription plans (sandbox)

The `$5/$10/$15` weekly plans must exist in the Square catalog and their variation ids stored in
`pf_plans.square_plan_id`. Two ways:
- Automated: with `SQUARE_ENV=sandbox`, call the admin-gated `pf-setup-square` function once. It
  upserts the plan + per-division weekly variations and writes `square_plan_id` back to `pf_plans`.
- Manual: create them in the Square dashboard (sandbox) and paste each variation id into
  `pf_plans.square_plan_id`.

## 3. Cloudflare: deploy the realtime Worker

From `prop-firm/realtime/`: `wrangler deploy`. Note Durable Objects need the Workers **Paid** plan
(~$5/mo). It runs on free seeded replay immediately. Copy the deployed URL into `PF_REALTIME_URL`.
(Live NQ/ES data comes later: a Databento relay POSTs ticks to `/session/<sym>/ingest` with
`INGEST_SECRET`, and requires a CME real-time display license.)

## 4. Netlify: routes + the cron schedule

Add to `netlify.toml` (only now, so the cron does not fire against an empty DB earlier):

```toml
[functions."pf-risk-cron"]
  schedule = "0 * * * *"   # hourly: sweep, daily reset at ET open, weekly close + winners

[[redirects]]
  from = "/arena/api/subscribe"
  to = "/.netlify/functions/pf-subscribe"
  status = 200
[[redirects]]
  from = "/arena/api/trade"
  to = "/.netlify/functions/pf-trade"
  status = 200
[[redirects]]
  from = "/arena/api/claim"
  to = "/.netlify/functions/pf-claim-prize"
  status = 200
[[redirects]]
  from = "/arena/api/admin-data"
  to = "/.netlify/functions/pf-admin-data"
  status = 200
[[redirects]]
  from = "/arena/api/admin-write"
  to = "/.netlify/functions/pf-admin-write"
  status = 200
```

If `/arena/*` is served from wetyr.com (Cloudflare Pages) while the functions live on the Netlify
site, the front-end fetch URLs and CORS allow-list must point cross-origin to the functions host.
The `pf-*` functions already allow `https://wetyr.com` and `https://markcmo.com` origins; align the
client fetch paths to wherever the functions are reachable. Deploy with `bash scripts/safe-deploy.sh`.

## 5. Open the first competitions

In `/arena/admin/` (Seasons tab) click "Create next week", or insert `pf_competitions` rows directly
(one per division, `status='live'`, `starts_at`/`ends_at` for the week, `num_winners=3`,
`prize_partner_id` = Apex).

## 6. End-to-end test (all sandbox)

1. `/arena/join/` -> subscribe (sandbox) or free AMOE -> confirm `pf_accounts` + `pf_leaderboard_entries` rows.
2. `/arena/app/` -> trade -> `pf-trade` fills against the Worker price, `pf_trades` + snapshots written, rules enforced.
3. `/arena/leaderboard/` + `/arena/dashboard/` -> standings update.
4. Force a competition `ends_at` into the past -> next `pf-risk-cron` run closes it, ranks, writes `pf_prizes` for top 3.
5. `/arena/claim/` -> submit KYC -> `pf-claim-prize` sets the tax-form flag.
6. `/arena/admin/` -> issue the prize (after KYC verified).

## 7. Flip to live (the only part that needs a lawyer + real money)

Do NOT do this until:
- A futures/securities or contest attorney reviews the Official Rules + AMOE + disclaimers.
- Square confirms it will process the business category.
- A KYC provider is wired (Persona/Veriff) and 1099 handling is set for prizes over $600.
- Real prize sourcing is arranged with the partner firm(s) (Apex first).

Then: switch `SQUARE_ENV=production` (real token), enable live data (Databento + relay + CME license),
set `PF_MODE=live`, and exclude any strict states from entry.

## 8. Launch + SEO indexing

Arena is canonicalized to **wetyr.com/arena/**. Domain decision made 2026-06-11: its own domain,
off markcmo.com (brand + legal separation). Full domain + Cloudflare Pages setup is in
`prop-firm/WETYR-DOMAIN-SETUP.md`. Arena is excluded from the markcmo deploy
(`scripts/upload-html-to-kv.js` SKIP_DIRS) so it never appears on markcmo.com, and a dedicated
`.github/workflows/deploy-wetyr.yml` deploys it to the `wetyr` Pages project.

Already done in code:
- Per-page meta on every arena page: canonical, Open Graph, Twitter card, theme-color, favicon.
- JSON-LD on the funnel: Organization + FAQPage (rich-result eligible, mirrors the on-page FAQ).
- robots meta: `index` on `/arena/`, `/arena/join/`, `/arena/leaderboard/`; `noindex` on `/app/`,
  `/dashboard/`, `/claim/`, `/admin/`.
- `arena/sitemap.xml` (public URLs) and `arena/llms.txt` (AI-citation reference, matches the markcmo AI-SEO approach).

To do at launch:
1. Point wetyr.com DNS at the deploy; confirm `/arena/` serves and `/favicon.svg` + `/favicon.webp` resolve at the wetyr.com root (copy them there if the deploy root differs).
2. Export `arena/og.svg` to `arena/og.jpg` (1200x630) so social shares render the card. The `og:image` tags already point at it.
3. Add a wetyr.com root `robots.txt`: `Allow: /`, `Disallow: /arena/admin/`, `/arena/app/`, `/arena/dashboard/`, `/arena/claim/`, and `Sitemap: https://wetyr.com/arena/sitemap.xml`.
4. Verify wetyr.com in Google Search Console + Bing Webmaster Tools; submit the sitemap; request indexing for `/arena/`.
5. Optional fast-index: IndexNow ping (you already run IndexNow on markcmo.com) for the three public URLs.
6. After deploy, run the funnel through Google's Rich Results Test (FAQ), the Facebook Sharing Debugger, and the Twitter Card Validator.

## Reminders

- Never run `netlify deploy --prod` directly; use `scripts/safe-deploy.sh`.
- Never send test emails without Mark's explicit consent (root CLAUDE.md RULE #0).
- This product never touches `admin.html`, `index.html`, or any `mc_*` table.
- No em-dashes or en-dashes anywhere (RULE #3).
