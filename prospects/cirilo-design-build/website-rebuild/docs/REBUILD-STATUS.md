# Cirilodb Rebuild - Status

## 2026-06-02 (cont. 27) - QBO VENDOR AP + AUTO-SYNC + UPTIME MONITOR

The "all of it" dev batch. Completes both sides of the QuickBooks books and adds external uptime monitoring.

Vendor AP -> QuickBooks:
- Schema: cdb_vendors.qbo_vendor_id; cdb_vendor_assignments.qbo_purchase_id + synced_at.
- _lib_qbo refactored: AR helpers (ensureCustomer/ensureInvoice/ensurePayment/syncDraw) moved in + exported; new AP helpers ensureVendor (query-or-create QBO Vendor) and ensureVendorExpense (QBO Purchase, PaymentType Check, AccountBasedExpenseLineDetail) + syncVendorAssignment. Idempotent via mapping columns.
- New env: CDB_QBO_BANK_ACCOUNT_ID, CDB_QBO_EXPENSE_ACCOUNT_ID (AP skipped gracefully until set; returns needs_account_config).
- qbo-sync gained ops sync_vendor_assignment + sync_vendors_all (cap 50). Admin Vendors view: per-paid-assignment "Sync to QB" + "Sync vendors to QB" header button (shown when connected).

Auto-sync (background, non-blocking):
- _lib_qbo qboAutoSyncDraw(env,id) + qboAutoSyncVendor(env,id): self-contained, safe, no-op when not configured/connected.
- admin-payment issue_draw and set_status (received/cleared, not scheduled/void) fire context.waitUntil(qboAutoSyncDraw). admin-vendor set_vendor_paid fires context.waitUntil(qboAutoSyncVendor). Manual Sync buttons remain.

Uptime monitor (Pages cannot self-cron):
- New /api/uptime-record (shared-secret CDB_MONITOR_SECRET; writes cdb_uptime; graceful demo).
- New cdb_uptime table.
- monitor/ standalone Worker (worker.js + wrangler.toml) DEPLOYED as cirilodb-monitor with cron */15. Pings /api/health, records result, posts to optional CDB_ALERT_WEBHOOK on failure. On-demand fetch endpoint verified: {ok:true,status:200,latency_ms:33}. URL https://cirilodb-monitor.marklgabriellijr.workers.dev
- Set on the monitor after deploy: wrangler secret put CDB_MONITOR_SECRET (match Pages), optional CDB_ALERT_WEBHOOK.

Verified live (deploy 6c0a6988): sync_vendors_all + auto-sync paths return clean (not_configured in demo), set_vendor_paid / issue_draw unaffected, uptime-record accepts, health green. ESM parse-checked, dash clean. QUICKBOOKS-SETUP.md updated with AP env vars.

---


## 2026-06-01 (cont. 26) - FINANCIALS / MARGIN DASHBOARD

Admin Financials view tying billing + vendor cost into per-project gross margin. Pure client-side aggregation from already-loaded data (no new endpoint, works in demo mode).

- New nav "Financials" + view-financials (fin-kpis + fin-table).
- renderFinancials aggregates by project name from DATA.projects (contract value), DATA.payments (billed = non-scheduled/void; collected = received/cleared; outstanding = billed - collected), VDATA.assignments (vendor committed + paid).
- Per project: Contract / Billed / Collected / Outstanding / Vendor Cost / Gross Margin (contract - vendor cost) with margin% pill (>=40 green, >=25 amber, else red). Totals row + 5 KPI cards.
- Wired into render() and loadVendorsAdmin so it refreshes when payments or vendor data load.
- Labeled "gross margin before overhead" (vendor assignment costs only, not labor/overhead).
- Dash clean, deployed; verified nav + fin-table + renderFinancials present.

---


## 2026-06-01 (cont. 25) - QUICKBOOKS ONLINE ACCOUNTING CONNECTION

Real QBO OAuth2 integration so billing flows into accounting. Customer -> Invoice -> Payment, mirroring the check/ACH draw schedule.

- _lib_qbo.js: config (sandbox/production), token storage in cdb_integrations (upsert on provider), exchangeCode/refreshToken/storeTokens, freshConnection (auto-refresh w/ 2-min buffer), qboApi (v3, minorversion=70). btoa Basic auth.
- OAuth flow: qbo-connect (admin -> signed-state authorize URL) -> Intuit -> qbo-callback (verify state via verifyAdmin, exchange code, store tokens + realmId, redirect /admin/?qbo=...). State is a 1h signed admin token (anti-CSRF).
- qbo-status (admin): configured/connected/mode/company (live companyinfo probe + token validation). qbo-disconnect (admin): best-effort Intuit revoke + delete row.
- qbo-sync (admin): sync_draw / sync_all. ensureCustomer (query-or-create, maps qbo_customer_id), ensureInvoice (SalesItemLineDetail w/ CDB_QBO_ITEM_ID, maps qbo_invoice_id), ensurePayment (LinkedTxn to invoice when received/cleared, maps qbo_payment_id). Idempotent via mapping columns. sync_all capped at 50.
- Schema: cdb_integrations table + cdb_clients.qbo_customer_id + cdb_payments.qbo_invoice_id/qbo_payment_id/synced_at.
- health.js: quickbooks_configured + quickbooks_connected checks. Admin System Health chip + new "Accounting (QuickBooks)" dashboard panel (Connect/Disconnect/Sync all, company shown). Billing view: per-draw "Sync to QB" when connected. mcModalForm select support reused.
- Env (user sets in CF Pages): CDB_QBO_CLIENT_ID, CDB_QBO_CLIENT_SECRET, CDB_QBO_ENV, CDB_QBO_REDIRECT_URI, CDB_QBO_ITEM_ID. Full steps in docs/QUICKBOOKS-SETUP.md.
- Manual-sync design (no auto API calls). Verified live: health keys present; qbo-status 401 unauth / 200 not-configured; connect+sync report not_configured; callback w/o state -> 302 /admin/?qbo=error; disconnect 401 unauth. ESM parse-checked, dash clean, deployed.

---


## 2026-06-01 (cont. 24) - CUSTOMER BILLING: DRAW SCHEDULE SETUP

Set up customer billing for when a client comes on board. Check + ACH only (per decision); draw schedule auto-generated at onboarding, admin edits + issues.

Status flow on cdb_payments: scheduled -> due (billed) -> reported (homeowner says sent) -> received -> cleared (or void).

- Onboarding (portal-onboard): on sign, auto-creates the 5 standard draws (Deposit 15 / Excavation 20 / Shotcrete 25 / Tile+equipment 20 / Final 20) as 'scheduled' rows from contract_value.
- admin-payment gained ops: create_schedule (idempotent, builds from project contract_value; 409 if exists), add_draw, update_draw (amount/label/due), issue_draw (scheduled -> due, logs draw_issued event). set_status now also accepts scheduled/due. All isUuid-gated.
- admin-data payments now include project_id, draw_no, due_at.
- Admin Payments view rebuilt as "Billing & Draws": KPIs (Scheduled / Due+Reported / Collected / Billed), sorted by project+draw, per-draw actions (Issue/bill, Edit, Confirm received, Mark cleared). New "Set up billing" header button (project picker) for the fallback path. mcModalForm gained select-field support.
- Portal: buildSuite now builds the homeowner's draws from cdb_payments (drawsFromPayments) when present, hiding 'scheduled' until issued; falls back to derived schedule. Statuses map to paid/due/reported.
- portal-payment: reporting now UPDATES the existing scheduled/due draw (matched by draw_id or project+draw_number) to 'reported' instead of inserting a duplicate; portal sends draw_id.
- Schema: cdb_payments + due_at, issued_at columns.
- Verified live: create_schedule/issue_draw/update_draw/set_status bad-id 400, valid 200 demo, unauth 401. Dash-checked clean. Deployed.
- Processor (Stripe/Square) intentionally NOT added; structure leaves method field ready for it later.

---


## 2026-06-01 (cont. 23) - CUSTOMER REFERRAL LOOP COMPLETED

Closed the gaps in the existing customer-referral plumbing so the full loop works and is manageable.

Chain (already wired, now verified): Owner Suite shares /book?ref=CODE -> footer persists cdb_ref -> booking + contact forms send referred_by_code -> contact.js creates cdb_referrals tied to referrer_client_id (looked up by referral_code).

New this pass:
- portal-auth buildSuite now BACKFILLS a referral_code for any client missing one (seeded / Calendly / contact-created), persists it, and returns referral data on both the has-project and no-project paths. Guarantees every homeowner sees their share link.
- admin-data referrals now include id + reward_status.
- New /api/admin-referral (admin, isUuid-gated): set_status (pending/consult/converted/rewarded) and set_reward (none/pending/issued). Advancing to converted auto-sets reward_status=pending so payouts are not missed.
- Admin Referrals panel: added Reward column + Consult / Converted / Reward-sent actions (optimistic local update + server write). "Needs Attention" now flags referral rewards due.
- /book shows a warm "You were referred by a Cirilo homeowner" banner when cdb_ref is set.
- Verified live: /book?ref= 200 with banner element, admin-referral 401 unauth / 400 bad id / 400 bad status / 200 valid. Dash-checked clean. Deployed.

NOTE: kept this strictly customer referrals per request. Partner referral attribution (per-firm codes) intentionally NOT built.

---


## 2026-06-01 (cont. 22) - 3D RENDERING REQUEST TOOL (real-estate offer)

Built the self-serve tool the entire real-estate partner pillar hinges on.

- /partners/rendering-request page: agent submits name/firm/email/listing + up to 6 backyard photos (8MB each, image mime). Client reads files to base64 and posts JSON. Spam-defended (honeypot, timing, Turnstile-ready), graceful mailto fallback.
- POST /api/rendering-request: validates, rate-limits, uploads each photo to the cdb-files vault under rendering/<ts>/, records cdb_rendering_requests (new table) with photo_paths. No email. Demo-graceful.
- GET/POST /api/admin-renderings: admin reader returns requests with short-lived signed photo URLs; set_status (new/in_progress/delivered/declined), isUuid-gated.
- Admin Partners view gained a "3D Rendering Requests" panel: agent, listing, clickable signed photo links, and Start/Delivered/Decline actions. "Needs Attention" now flags new rendering requests.
- Real-estate pillar page CTA (hero + bottom + related) now points to /partners/rendering-request instead of generic apply, the rendering is the hook.
- Schema: cdb_rendering_requests table added to cdb-schema-journey.sql (RLS enabled).
- Verified live: page 200, endpoint ok (honeypot dropped), admin-renderings 401 unauth / 200 authed / 400 bad id. Dash-checked clean. Deployed.

---


## 2026-06-01 (cont. 21) - PARTNER APPLICATION FLOW + VENDOR SIGNUP

End-to-end intake for the two partner programs, public form to admin queue.

Partner flow:
- /partners/apply page (honeypot + timing + Turnstile-ready, matches contact form UX). All partner-page CTAs (hero + bottom) now point here (added ctaHref to _geo-lib page()).
- POST /api/partner-apply: spam-defended, inserts cdb_partners (new table), no email (consent-gated). Graceful demo.
- New cdb_partners table in docs/cdb-schema-journey.sql (name, firm, partner_type, email, phone, territory, message, source, status, ip, ua) + RLS.
- Admin: new /api/admin-partners reader/writer (GET list, POST set_status: new/contacted/active/declined, isUuid-gated). New "Partners" nav + view with KPIs + table + Activate/Contacted/Decline actions. Demo rows render in demo mode.

Vendor signup:
- /vendor-signup page (trades intake: trade, service area, license/insurance, message). Placed OUTSIDE /vendors so robots.txt (which disallows /vendors portal) does not block it; confirmed crawlable + in sitemap.
- POST /api/vendor-apply: spam-defended, inserts cdb_vendors status='pending' (+ service_area, applied_at columns added). No email.
- Admin vendor panel now shows a Pending KPI, renders pending applications with Approve / Decline actions (set_vendor_status active/archived).

Cross-cutting:
- "Needs Attention" dashboard now flags new partner applications + pending vendor applications.
- Footer gained "Trades & Vendors" link (Partner With Us + Press already present). package.json gen unchanged (partners already included).
- Verified live: pages 200, partner-apply/vendor-apply ok (honeypot silently dropped), admin-partners 401 unauth / 200 authed / 400 bad id. Dash-checked clean. Deployed.

---


## 2026-06-01 (cont. 20) - PARTNER PROGRAM + PR PAGES (from the playbook)

Turned the Partnership/Outreach/PR playbook (05-partnerships-pr-playbook.html) into live site pages.

- New gen-partners.js (uses _geo-lib). _geo-lib page()/hub() gained a noindex flag.
- PUBLIC, indexed: /partners/ hub + 5 pillar program pages (real-estate-agents, home-builders, landscape-architects, country-clubs, luxury-brands) + /press/ media page. Each presents the partner-facing offer (2.5% realtor / 3% builder+designer referral, free 3D rendering, pool-spec-at-framing, member benefits, co-marketing) with FAQ + Service/Org/FAQPage JSON-LD.
- OUTREACH, noindex,follow (auto-excluded from sitemap): 38 per-firm landing pages for every target in the playbook (10 real estate firms, 8 builders, 6 designers, 8 clubs, 6 brands), each personalized with territory + a partner-facing angle. These are the destinations Tiffany/Ramon link in cold outreach; they do not compete in organic search.
- Internal-only material (CPA math, "cap at 15 agents" scarcity, the cold-email templates, the target-outlet media list, the 12-month calendar) was intentionally NOT published. Public pages present the offer; the strategy stays in the internal doc.
- Footer gained "Partner With Us" + "Press & Media" links. package.json "npm run gen" now includes gen-partners.
- Sitemap 376 URLs (added hub + 5 pillars + press; firm pages excluded via noindex). 451 files in dist. Dash-checked clean. Deployed; verified pillar/press 200 + firm pages 200 with noindex.

---


## 2026-06-01 (cont. 19) - FULL GEO FOOTPRINT (369 local URLs)

Programmatic local-SEO build covering all of NC + Charlotte by neighborhood, ZIP, and "near me".

- New shared lib scripts/_geo-lib.js: page()/hub() renderers mirroring the service-area design + deterministic hashPick for varied-but-stable templated copy (no per-build churn).
- gen-neighborhoods.js: 106 real Charlotte neighborhoods at /neighborhoods/<slug>/ grouped by 6 sectors (Center City, South, East, West/SW, North/University, Lake/NW) + hub.
- gen-zips.js: 72 Charlotte-metro ZIP pages at /pool-builder/<zip>/, each mapped to its place + city, cross-linked to the matching /service-areas/ guide and nearby ZIPs + hub.
- gen-nc-cities.js: 100 long-tail NC municipalities at /north-carolina/<slug>/ across Outer Charlotte, Triangle, Triad, Sandhills, Mountains, Coast (far = destination framing) + hub. Excludes cities already in /service-areas/ (no dupes).
- gen-near-me.js: /pool-builder-near-me/, /custom-pool-builder-near-me/, /pool-renovation-near-me/, /outdoor-living-near-me/ with a hub+top-area directory to aid crawl/indexation.
- Every page: localized title/meta/canonical, LocalBusiness + FAQPage JSON-LD; hubs carry ItemList. package.json gained an "npm run gen" convenience (does not auto-run on build).
- Sitemap now 369 URLs (service-areas 69, neighborhoods 107, ZIPs 73, NC cities 101, near-me 4 + the rest). 406 files in dist. Dash-checked clean across 285 new pages. Deployed; spot-checked 200s across every section.
- NOTE on SEO risk: this is large programmatic coverage. Pages use real place data + varied templates + strong internal linking to stay on the right side of thin/doorway-content guidelines, but ZIP/long-tail pages should be monitored in Search Console; prune or enrich any that underperform. Adding photos + real project examples per area will strengthen them further.

---


## 2026-06-01 (cont. 18) - GEO EXPANSION ROUND 2 (44 -> 68 area pages)

Pushed the service-area footprint deeper into the Charlotte metro and across NC.

- 24 new area pages, 4 new region groups on the hub (Rowan, Iredell, Catawba Valley, Lincoln).
- Charlotte: Plaza Midwood, Elizabeth, Sedgefield. Union: Monroe, Unionville. Cabarrus: Mount Pleasant.
- Lake Norman: Terrell. Rowan: Salisbury, China Grove. Iredell: Statesville, Troutman.
- Catawba Valley: Hickory, Newton, Conover, Lake Hickory. Lincoln: Lincolnton.
- SC line: Clover, York. Greater NC destination tier: Pinehurst, Highlands, Cashiers, Blowing Rock, Chapel Hill, Durham.
- Same per-page SEO treatment (localized meta/canonical, LocalBusiness + FAQPage JSON-LD, region-aware internal links, destination copy for far-NC). Hub regions now 11.
- 69 service-area URLs in sitemap. Dash-checked clean. Deployed; spot-checked 200s across the new counties.

---


## 2026-06-01 (cont. 17) - NC/CHARLOTTE GEO EXPANSION (14 -> 44 area pages)

Grew the local-SEO footprint across the Charlotte metro and North Carolina.

- gen-service-areas.js rebuilt: now 44 area pages + a region-grouped hub (was 14 + flat hub).
- New Charlotte neighborhoods: Eastover, Dilworth, Cotswold, Foxcroft, Quail Hollow, Providence, Mint Hill, Pineville.
- New Union County: Indian Trail, Wesley Chapel, Stallings.
- New Lake Norman: Lake Norman (region overview), Denver, Sherrills Ford, Lake Norman Waterfront (signature builds).
- New Cabarrus: Concord, Harrisburg, Kannapolis. New Gaston: Belmont, Mount Holly, Gastonia.
- New SC line: Lake Wylie, Indian Land, Rock Hill (added to existing Tega Cay, Fort Mill).
- New Greater NC destination tier (honest framing: we travel for select signature projects): Raleigh, Cary, Greensboro, Winston-Salem, Asheville, Wilmington.
- Each page: localized title/meta/canonical, LocalBusiness + FAQPage JSON-LD, neighborhood-specific blurb, region-aware "We Also Serve" internal links, destination pages get adjusted hero/FAQ/CTA copy.
- Hub now groups by region (Charlotte & Neighborhoods, Union County, Lake Norman, Cabarrus, Gaston, SC Line, Greater NC) + ItemList schema.
- Sitemap auto-includes all 45 URLs (walks dist). Dash-checked clean. Deployed; spot-checked 200s across regions.

---


## 2026-06-01 (cont. 16) - INJECTION HARDENING + DOCUMENTS/PROPOSALS/SYSTEMS

Continued "documents, proposals, ui/ux, systems" pass.

Security (PostgREST injection):
- _lib_security: isUuid(s) + isSlug(s). All body-supplied ids validated before interpolation.
- Gated: admin-data advance_stage (project_id), admin-payment (payment_id), admin-vendor (bid/job/vendor/assignment/project ids), vendor-action (job_id, assignment_id), proposal-data (slug via isSlug).
- Verified live: bad id/slug -> 400; valid uuid -> 200 (no regression).

Documents:
- portal-onboard now persists the captured signature PNG to the cdb-files vault + records a cdb_documents row (doc_type 'signature', uploaded_by 'client'). Ties the proposal e-sign to the vault. Best-effort, 2MB cap, graceful in demo.
- New doc-delete endpoint (admin only): removes the storage object then the metadata row; isUuid-gated. Admin Documents table gained a Delete action (mcConfirm guarded). Verified: no auth -> 401, bad id -> 400, valid -> 200.

Proposals:
- proposal-data marks status sent -> viewed (+ viewed_at) on first prospect view; schema viewed_at column added; admin proposal pill maps 'viewed'.

Systems (data retention):
- New admin-maintenance endpoint: op:'purge_events' deletes cdb_events older than N days (default 180, floor 30, cap 3650); op:'stats' returns row counts. Admin only. Admin System Health panel gained a "Purge analytics older than 180 days" control (mcConfirm guarded). Verified: no auth -> 401, purge/stats -> graceful demo.
- FOLLOW-UP (needs infra/Mark): wire a scheduled Cloudflare Cron Worker to call purge_events automatically (e.g. weekly), and to ping /api/health for uptime alerting. Pages Functions alone cannot self-schedule.

---


## 2026-06-01 (cont. 15) - CLOSED THE GAP: signed portal/vendor tokens + mime allowlist

Defense-in-depth follow-up to the admin-auth fix. Portal + vendor tokens were unsigned base64 (email|id|ts) - forgeable by anyone who learned a client/vendor UUID. Now signed.

- _lib_security: signSession(env, role, id) / verifySession(env, token) - HMAC-SHA256, role|id|exp, 12h expiry, same secret.
- portal-auth issues signed client + admin-preview tokens; portal-data + portal-payment verify (role must be 'client' for data/pay access).
- vendor-auth issues signed vendor + vadmin tokens; vendor-data + vendor-action verify (role 'vendor').
- doc-upload + doc-list verify portal/vendor sessions (and admin) before scoping; removed all raw atob(token) trust.
- doc-upload now enforces a MIME allowlist (pdf + common images); rejects others 400.
- Verified live: forged portal token -> ok:false; forged vendor token -> ok:false; team preview token is signed (has signature); admin-data still 200 with real token (no regression); .exe upload -> 400 "file type not allowed".

Every session token in the system (admin, homeowner, vendor) is now HMAC-signed + expiring. No remaining forgeable-token gaps.

---


## 2026-06-01 (cont. 14) - CLOSED REAL VULN: admin API was forgeable

Found + fixed a genuine hole: every admin endpoint guarded only by "x-cdb-admin header contains '@'" = anyone could read/write the CRM with header x@x.

- New HMAC-signed session tokens (_lib_security: signAdmin/verifyAdmin/guardAdmin, HMAC-SHA256 via Web Crypto, secret = ADMIN_SESSION_SECRET || CDB_ADMIN_PASS, 12h expiry).
- admin-auth issues the token; admin.js stores it (sessionStorage cdb_admin = token, cdb_admin_email for display) and sends it as x-cdb-admin; logout clears both.
- All admin endpoints now verify the signature: admin-data, admin-activity, admin-vendor, admin-proposal, admin-payment, seed-cirilo, and the admin branch of doc-upload/doc-list.
- Verified live: valid token 200; forged x@x 401; no header 401; tampered token 401; seed forged 401.

Follow-up (noted, lower risk): portal + vendor tokens are still unsigned base64 (email|id|ts) - forgeable only with a valid client/vendor UUID. Sign these next with the same helper for defense in depth.

---


## 2026-06-01 (cont. 13) - SECURITY/HEALTH SURFACED IN ADMIN + CAPTCHA WIRED

- Admin dashboard "System Health" panel reads /api/health and shows green/grey chips for Database, Storage, Rate limiting, Email, Captcha + live|demo mode (loadHealth on login).
- Captured client JS errors now appear in admin Activity feed (admin-activity reads cdb_events type=error; warning icon). Self-healing loop is now visible to Tiffany.
- Cloudflare Turnstile widget wired into contact + book forms, DORMANT: set CDB_TURNSTILE_SITEKEY in the page (and TURNSTILE_SECRET env) to turn the visible captcha on; token already flows to contact.js which verifies it. Honeypot+timing+rate-limit active regardless.
- Verified live: sys-health panel + health-chips present, cf-widget mount present, admin-activity guarded/ok.

To enable visible captcha: 1) create a Turnstile widget in Cloudflare, 2) set CDB_TURNSTILE_SITEKEY='<site key>' in pages/contact.html + pages/book.html, 3) set TURNSTILE_SECRET secret on the project.

---


## 2026-06-01 (cont. 12) - SECURITY + SELF-HEALING (real gaps closed)

Honest note: prior claims overstated security/metrics. These were the real gaps, now built:

1. FORM SPAM PROTECTION (functions/api/_lib_security.js):
   - Honeypot field (company_website) on contact + book forms; bots that fill it get a silent 200 (no lead created).
   - Submit-timing check: submissions under 2.5s are dropped silently.
   - Cloudflare Turnstile server verify wired (activates when TURNSTILE_SECRET set; honeypot+timing active now with zero config).
   - Verified: honeypot + too-fast both silently rejected; legit submit still ok.

2. RATE LIMITING (KV-backed, LIVE):
   - Created KV namespace cdb_rl, bound as CDB_RL in wrangler.toml (health check confirms rate_limit_kv:true in prod).
   - contact (5/10min), admin-auth / portal-auth / vendor-auth (12/10min per IP). Fails open if KV ever unbound.

3. HARDENED HEADERS (build _headers, all routes):
   - Content-Security-Policy (default-src self; scripts self+inline+Turnstile; img https; etc.), Strict-Transport-Security (HSTS preload), Cross-Origin-Opener-Policy, Permissions-Policy (+interest-cohort=()), X-DNS-Prefetch-Control. Verified live.

4. SELF-HEALING / OBSERVABILITY:
   - /api/health probe: reports supabase/storage/KV/email/turnstile status + live|demo mode (200 always). For uptime monitors.
   - Client JS error capture in footer -> /api/track type:'error' (sampled, max 3/page) so runtime errors land in cdb_events.
   - window.cdbFetch retry helper (1 retry on network failure).
   - track.js now stores 'error' event type.

STILL NEEDS MARK (optional hardening): set TURNSTILE_SECRET + add the Turnstile widget site key to forms to turn on captcha; everything else is active now.

---


## 2026-06-01 (cont. 11) - NEEDS-ATTENTION DASHBOARD + PERF

- Admin dashboard now leads with a "Needs Attention" panel computed from live data: new leads to respond to, payments awaiting confirmation, proposals awaiting signature, vendor bids to review, completed vendor jobs to pay. Each row has a jump-to-view button (gotoView). Hides when nothing is pending.
- Refreshes when vendor/proposal data loads.
- Performance: build-time transform adds loading="lazy" + decoding="async" to all content <img> (verified 18 on portfolio). Fonts already display=swap.
- Verified live (panel shipped, admin 200, dash-clean).

---


## 2026-06-01 (cont. 10) - ADMIN UX UPGRADE (sophistication + ease of use)

- Replaced ALL prompt()/alert()/confirm() in the admin with a branded UI kit:
  - mcModalForm() : real form modal (labels, placeholders, required validation) for New Proposal, Add Vendor, Post a Job, Set Due Date.
  - mcConfirm() : styled confirm for Award bid, Mark vendor paid.
  - mcToast() : elegant corner toasts (success/error) replacing alerts; clipboard copies now toast.
  - Modal closes on Escape and backdrop click; autofocus first field.
- Admin is now mobile-responsive: sidebar collapses behind a hamburger (closes on nav select); KPI grid reflows.
- Verified: zero raw prompt/alert/confirm left in admin.js; modal + toast + mobile-menu shipped live; admin 200.

---


## 2026-06-01 (cont. 9) - SEO / META / JSON-LD SWEEP

- build.js now runs enhanceHead() on every page: injects og:* + twitter:* + Organization/WebSite JSON-LD when missing; skips any page with noindex.
- Closed gaps: about, book, contact, financing, portfolio, process, service-areas, warranty (JSON-LD), and privacy + terms (OG/twitter/JSON-LD).
- Service-area child pages already carried LocalBusiness + FAQ schema (left intact; the global block only adds when no ld+json present).
- Default OG image set (brand pool photo). SITE canonical base = https://cirilodb.com.
- Re-audit: ALL indexable pages now have description + canonical + OG + twitter + JSON-LD. Verified live (privacy/about have it; proposal noindex skipped). Dash-clean.

---


## 2026-06-01 (cont. 8) - 404 PAGE + PER-CLIENT PROPOSALS

- Branded 404 page (pages/404.html); Cloudflare serves it on unknown routes (verified 404 status). noindex, excluded from sitemap.
- Per-client proposals:
  - cdb_proposals table (slug, client, title, value, vision, inclusions, draws, status). In cdb-schema-journey.sql.
  - /api/admin-proposal (GET list, POST create -> returns unique /proposal?c=slug). Guarded.
  - /api/proposal-data?c=slug (public read by secret slug).
  - proposal.html hydrates from ?c=slug (title, client, neighborhood, value, vision, inclusions, draws, prefilled email); falls back to demo with no slug.
  - Signing passes proposal_slug; portal-onboard marks the proposal 'signed'.
  - Admin "Proposals" view: create (prompt-based), list, Open + Copy link.
- Verified live: 404 serves, admin-proposal create/guard, proposal-data graceful, proposal page slug logic present.

The proposal flow is now real per-prospect: Tiffany clicks New proposal -> gets a unique link -> sends it -> prospect signs -> becomes a client with Owner Suite access, and the proposal is marked signed.

---


## 2026-06-01 (cont. 7) - HARDENING + GO-LIVE PREP

- Fixed broken footer links: built /privacy and /terms (real pages, indexed, in sitemap).
- Removed public "[TBD - pull from Tiffany]" license placeholder from footer (now "NC Licensed General Contractor").
- /api/seed-cirilo: admin-guarded, idempotent showcase seed (client + project + docs + 2 vendors + assignment + open job + bid). Requires {confirm:"SEED"} and a live Supabase key. Owner Suite test login it creates: james@harrington.example / HARRY1.
- docs/OPERATING-GUIDE.txt: full plain-text runbook for Tiffany/Mark (logins, journey, every admin tab, vendors/bidding, payments, go-live checklist, what is/ isn't automated).
- Verified live: /privacy 200, /terms 200, no TBD on homepage, seed guards (400 no confirm / 401 no admin / graceful no-Supabase).

---


## 2026-06-01 (cont. 6) - SCHEDULING, VENDOR PAY, NOTIFICATIONS, DOC VAULT

Loop-closers shipped earlier this pass: award_bid auto-creates the assignment + declines other bids; admin can confirm payments (received/cleared) via /api/admin-payment; vendor "Mark complete" requires lien-waiver acknowledgment (cdb_vendor_assignments.lien_waiver_at), shown as "Signed" in admin.

Then the final four:

1) VENDOR SCHEDULING:
   - cdb_vendor_assignments.due_date used; admin Vendors "Build Schedule" panel sorts assignments by due date with "Set date" action (op set_due). Vendor portal shows Due per job.

2) VENDOR PAYMENTS (what Cirilo owes subs):
   - cdb_vendor_assignments.pay_status/paid_at/paid_amount. Admin assignments table shows Paid/Unpaid + "Mark paid" (op set_vendor_paid). Vendor portal shows Paid / Awaiting payment per assignment.

3) NOTIFICATIONS / ACTIVITY CENTER:
   - /api/admin-activity merges leads, payments, bids, referrals, project events into one time-sorted feed. Admin Activity view + topbar bell with count. Demo feed when offline.

4) DOCUMENT VAULT (Supabase Storage, bucket cdb-files):
   - /api/doc-upload (base64 -> Storage, metadata in cdb_documents; auth by portal/vendor/admin token; 10MB cap) and /api/doc-list (lists scoped docs with 1h signed download URLs).
   - Upload UI in: homeowner portal (Documents card), vendor portal (Your Documents: COI/W-9), admin (Document Vault view with download links).
   - Schema addendum in cdb-schema-journey.sql: vendor pay columns, cdb_documents uploaded_by/vendor_id/size_bytes/mime, and a note to create the private 'cdb-files' Storage bucket.

All endpoints verified live + guarded (admin-activity 401 unauth). Demo-graceful everywhere.

GO-LIVE CHECKLIST (unchanged + additions):
- Set MARKCMO_SUPABASE_SERVICE_KEY on cirilodb-rebuild.
- Apply docs/cdb-schema.sql then docs/cdb-schema-journey.sql.
- Create private Supabase Storage bucket 'cdb-files'.
- Fill PAY_INFO (payee/mailing + bank/routing/account) in portal/index.html.
- Optionally set EMAIL_SEND_ENABLED (still no auto-send; Resend call intentionally unwired per RULE #0).

---


## 2026-06-01 (cont. 5) - PAYMENTS, REFERRALS, TRACKING, EMAIL, VENDORS

New schema migration: docs/cdb-schema-journey.sql (additive, run after cdb-schema.sql):
cdb_payments, cdb_referrals (+cdb_clients.referral_code, cdb_leads.referred_by_code/utm),
cdb_email_templates (seeded), cdb_email_log, cdb_vendors, cdb_vendor_assignments,
cdb_jobs, cdb_bids. All RLS deny-all.

1) PAYMENTS (check + ACH only; no processor yet):
   - Portal draw "Pay" button -> modal with check (payee/mail/memo) + ACH (bank/routing/account/memo) tabs + "I've sent payment" -> /api/portal-payment records cdb_payments (status reported) + project event.
   - PAY_INFO placeholders in portal/index.html: update payee/mailing + bank/routing/account once client provides them.
   - Admin Payments view (reported/received KPIs + table).

2) REFERRALS:
   - Footer captures ?ref= and utm_* to sessionStorage site-wide; book + contact include them.
   - contact.js stores referred_by_code/utm on lead + inserts cdb_referrals.
   - Onboarding issues a referral_code per client; portal Refer card shows the client's link (book?ref=CODE) + copy + count.
   - Admin Referrals view (KPIs + table).

3) TRACKING METRICS:
   - track.js detail enriched (title, action, method, ref, utm).
   - Footer emits a page-view on every marketing page (guarded by window.__cdb_pageTracked so self-tracking pages don't double count).

4) EMAIL + FOLLOW-UPS (RULE #0: never auto-sends):
   - /api/email-followups computes due follow-ups (consult 24h-21d, payment reminder 72h), logs to cdb_email_log as 'dry_run'. The Resend send is intentionally NOT wired; gated behind EMAIL_SEND_ENABLED and still no-send.
   - Admin Email view: template list + "Preview queue (dry run)" button + "sending disabled" banner.

5) VENDOR PORTAL + ASSIGNMENTS + BIDDING:
   - /vendors/ (noindexed): vendor login (email + code; mark/tiffany = team preview), KPIs, assigned jobs with status advance (accept/start/complete), open jobs with bid modal, my-bids table.
   - Functions: vendor-auth, vendor-data (resume), vendor-action (op bid / assignment_status).
   - Admin Vendors view: vendors / assignments / open jobs / bids tables + Add vendor, Post a job, Award bid. Endpoint admin-vendor (GET aggregate, POST add_vendor/post_job/assign/award_bid/set_vendor_status).
   - robots disallows /vendors; build copies vendors/.

All endpoints verified live (demo-graceful). Go-live still needs MARKCMO_SUPABASE_SERVICE_KEY + both schema files applied. Then update PAY_INFO bank details when merchant/bank info arrives.

---


## 2026-06-01 (cont. 4) - FULL CUSTOMER JOURNEY + REAL AUTH

**Login is now real auth (no bypass), two roles:**
- Admin/Team: mark@markcmo.com / [standard pw] and tiffany@cirilodb.com, verified server-side against CDB_ADMIN_PASS. Works at /admin/ AND the /portal/ "Cirilo Team" tab.
- Homeowner: email + access code, verified against cdb_clients (activates when Supabase key is set; correctly declines until then, no fake-suite bypass).
- Admin console /admin/ no longer has the pass.length>=4 fallback.

**End-to-end journey now built and live:**
1. Discover - 27 marketing/trust/service-area pages
2. Inquire - /contact form -> /api/contact -> cdb_leads
3. **Book** - /book multi-step wizard (project -> scope -> day/time slot picker -> details -> confirmation). Posts to /api/contact with source=booking, status=consult_requested. Nav CTA + /book-online + /book-consultation all route here.
4. **Proposal + e-sign** - /proposal (noindexed): luxury proposal viewer (vision, inclusions, specs, investment + draw schedule) with canvas signature + typed name + authorization. On sign -> /api/portal-onboard.
5. **Onboard** - portal-onboard creates/updates cdb_clients with a generated 6-char access code, creates cdb_projects at 'contract' stage, files signed contract doc + stage event. Returns the access code. Proposal success overlay hands the homeowner their code + "Enter Your Owner's Suite".
6. **Build tracking** - /portal Owner's Suite (14-stage timeline, gallery, docs, draws, activity).
7. **Completion & Care** - new portal section: 10-yr warranty certificate, care guide, leave-a-review, refer-a-friend. Locked as "at handover" until the project reaches fill_startup, then unlocks.

**New files this pass:**
- pages/book.html, pages/proposal.html
- functions/api/portal-onboard.js
- build.js: sitemap now skips noindex pages; robots disallows /admin /portal /proposal; /book redirects.

**All endpoints verified live.** Still demo/preview until MARKCMO_SUPABASE_SERVICE_KEY is set + cdb-schema.sql applied (then booking captures real leads, signing creates real clients, homeowner login works).

---


## 2026-06-01 (cont. 2) — OWNER'S SUITE customer portal LIVE

**Live at https://cirilodb-rebuild.pages.dev/portal/ (200, noindexed + robots-disallowed)**

A luxurious post-sign client portal where a pool owner logs in to watch
their build come to life. Not a dashboard, an experience:

- **Cinematic login gate** — ken-burns pool hero, frosted-glass card, gold crest, "Owner's Suite" framing. Email + access code.
- **Full-bleed project hero** — project name in Cormorant display, neighborhood + pool type, animated progress bar + live % + current stage + "up next".
- **Snapshot stat band** (navy) — % complete, stage X of 14, est. completion, schedule status.
- **14-stage journey timeline** — animated gold progress rail, done/current/upcoming states, the current stage expands with a description. Maps the same 14 construction stages as the admin kanban.
- **Progress gallery** — editorial asymmetric grid, ken-burns hover, click-to-lightbox, captioned by stage/date.
- **Documents card** — contract / renderings / permit / specs / warranty with signed/sent/draft pills.
- **Investment & Draws card** — draw schedule (deposit/excavation/shotcrete/tile+equip/final) with paid/due states + contract-value footer. Auto-derived 15/20/25/20/20 from contract_value, or real cdb invoice rows when present.
- **Recent activity feed** + **concierge block** (project lead avatar, message/call CTAs).
- Film grain, scroll reveals, respects prefers-reduced-motion. Matches the rose-gold/navy/Cormorant brand system.

**Backend (2 new Pages Functions, verified live):**
- /api/portal-auth (POST) — client login by email + access code (cdb_clients.portal_code, else last4 phone, else name). Returns opaque token + full suite payload. Graceful 200 ok:false when Supabase unset.
- /api/portal-data (GET) — auto-resume: reads x-cdb-portal token, rebuilds the suite. Shares buildSuite() with portal-auth.

**Demo/Preview mode:** with no service key set, any email + 4+ char code opens a fully-populated Preview Suite (The Harrington Residence, Myers Park Vanishing Edge, $312K, stage 9 of 14). Demos beautifully on a call today.

**To go live per-client:** same two prerequisites as admin (set MARKCMO_SUPABASE_SERVICE_KEY + apply cdb-schema.sql, which now includes cdb_clients.portal_code). Then each signed client logs in with their email + code and sees their real project, photos, docs, and draws.

---


## 2026-06-01 (cont.) — SITE LIVE + ADMIN + BACKEND deployed

**Deployed live at https://cirilodb-rebuild.pages.dev (Global API key auth via ~/.cloudflare-global.env)**

- 27 marketing/trust/service-area pages — elevated design (motion engine, editorial layout, grain, parallax, count-up, marquee). All 200.
- Admin console at /admin/ — login gate, 14-stage kanban (drag-to-advance), leads inbox, clients, analytics funnel + source bars. Runs on demo data, swaps to live when API returns data. noindexed.
- 4 Pages Functions live + verified: /api/track (200), /api/contact (200, graceful), /api/admin-auth (401 wrong / 200 right), /api/admin-data (aggregator).
- Secrets set on project: MARKCMO_SUPABASE_URL, CDB_ADMIN_PASS (= standard admin pw).
- cdb_* schema written (docs/cdb-schema.sql): leads, clients, projects (14-stage), project_events, documents, events, admin_users. RLS deny-all, service-role only.

**TWO THINGS TO GO FULLY LIVE (need Mark):**
1. Set MARKCMO_SUPABASE_SERVICE_KEY secret on cirilodb-rebuild project
   (value is the CLIPOS service-role key — same one markcmo uses;
    not readable from here). Command:
   `printf '<key>' | npx wrangler pages secret put MARKCMO_SUPABASE_SERVICE_KEY --project-name=cirilodb-rebuild`
2. Apply docs/cdb-schema.sql to the CLIPOS Supabase project
   (SQL editor, or a bootstrap function like seed-cirilo).
   After both: contact form captures real leads, tracking flows,
   admin shows live data instead of demo.

**Admin login (demo):** Tiffany@CiriloDB.com / [standard admin pw]
Falls back to client-side gate if /api/admin-auth unreachable.

---


## 2026-06-01 session — 27 pages built, deploy auth-blocked

**Built this session (all dash-clean per RULE #3, all in sitemap):**
- 8 marketing pages: index, about, 4 service pages, portfolio (16 real photos + lightbox + filter), contact (booking form w/ budget+timeline qualifier)
- 4 trust pages (audit fixes / Phase 0 gate #3): /process (14-stage timeline), /financing (Lyon Financial), /warranty (10-yr structural), /faq (FAQ schema)
- 15 service-area pages: hub + 14 Charlotte-metro localized pages (each w/ LocalBusiness + FAQ schema, local copy, internal links) — Phase 0 gate #5, SEO compounding
- Generators: gen-service-pages.js, gen-trust-pages.js, gen-service-areas.js
- Footer/header updated to link service-areas, financing, warranty, faq

**TOTAL: 27 HTML pages built in dist/, 0 em/en dashes, 27-entry sitemap.**

**BLOCKER: Cloudflare OAuth token lost account-list permission mid-session.**
- Earlier this session it worked (created project + deployed homepage)
- Now every wrangler call fails "Failed to automatically retrieve account IDs"
- Env var CLOUDFLARE_ACCOUNT_ID does not bypass it; account_id not allowed in Pages toml
- FIX: user runs `npx wrangler login` to refresh the browser OAuth session
- Then: `cd prospects/cirilo-design-build/website-rebuild && npm run deploy`
- Everything is staged in dist/ — one command ships all 27 pages

**DECISION FLAGGED: About page features BOTH founders (Tiffany + Ramon).**
- Her real live-site About lists both as co-founders with bios
- "Remove Ramon" was scoped to Mark's proposal docs, not her own public site
- Built About with both. Mark to confirm or override to Tiffany-only.

---

**Last updated:** 2026-05-30, end of Phase 1 kickoff session

## Done in this session

- [x] Scraped all 9 live cirilodb.com pages, snapshot in `_scraped/`
- [x] Wrote `scripts/extract-wix-content.js` to pull meaningful copy/images/links out of Wix HTML bloat
- [x] Extracted JSON for all 9 pages in `_scraped/extracted/`
- [x] Scaffolded project folder structure (pages, admin, portal, api-src, assets, scripts, docs)
- [x] Wrote `README.md` with architecture, folder layout, and 3-phase plan
- [x] Wrote `assets/css/brand.css` — design system locked to Cirilo's existing rose-gold brand (#AB7E37 / #D6BB89 / #E3D3B2)
- [x] Wrote `pages/_header.html` — sticky site nav with brand wordmark + 7-item menu
- [x] Wrote `pages/_footer.html` — 4-column footer with services / company / contact / trust signals
- [x] Wrote `pages/index.html` — full clean homepage rebuild with hero, 4 service cards, 3 why-cirilo blocks, story teaser, consultation CTA
  - SEO meta + canonical URL FIXED
  - OG / Twitter cards FIXED
  - LocalBusiness schema.org JSON-LD FIXED
  - Charlotte 910 number to be replaced with 704/980 tracking number when ported
  - Tracking pixel POST to `/api/track` wired

## Audit findings addressed in the homepage rebuild

| Audit issue | Status |
|---|---|
| No GA4 / analytics | Tracking pixel wired (POST /api/track) |
| No Meta Pixel | Will add when ad accounts go live |
| No schema.org | LocalBusiness + areaServed JSON-LD in `<head>` |
| Brand-only title tags | New title includes geo + service modifier |
| No meta descriptions | Written for every page |
| No OG / Twitter tags | Added |
| Site frozen since 2026-02-12 | Building from scratch on CF Pages |
| Orphan `/copy-of-new-residential-construction` URL | Will not exist in new build |
| 910 area code | Footer + hero CTA flagged for swap to 704/980 |
| No NC GC license on site | Footer trust-bar `[TBD - pull from Tiffany]` placeholder |
| No bonded + insured | Footer trust-bar says it explicitly |
| No warranty page | "10-Year Structural Warranty" mentioned in hero + footer; dedicated `/warranty` page to be built |
| No financing | `/financing` link in footer ready for dedicated Lyon Financial page |
| Generic CTAs | Every page has primary "Book Consultation" + secondary action |

## What to build next (Phase 1 finish)

1. **Remaining 8 marketing pages** based on extracted content:
   - `/about` — founder story (rewrite from Wix copy, add year founded, project count, certifications)
   - `/custom-concrete-swimming-pools` — service page with finishes, equipment, process, FAQ schema
   - `/outdoor-living-spaces`
   - `/home-renovations-and-remodeling`
   - `/home-additions`
   - `/portfolio` — project gallery with caption, location, budget tier, build-day reel
   - `/contact` — booking form (Wix Bookings replacement) with budget/timeline qualifier
   - `/book-online` — redirect to /contact

2. **New pages we need (audit-driven):**
   - `/process` — what to expect, timeline, draw schedule
   - `/financing` — Lyon Financial / HFS / LightStream partner page
   - `/warranty` — 10-year structural warranty details
   - `/faq` — buyer FAQ with FAQ schema

3. **Service-area pages — phased geographic expansion:**

   **Phase 1 (launch): Charlotte metro — 14 pages**
   - Charlotte, SouthPark, Myers Park, Ballantyne, Waxhaw, Weddington, Marvin, Davidson, Cornelius, Mooresville, Huntersville, Matthews, Tega Cay, Fort Mill SC
   - Each with local schema, embedded map, neighborhood photo, FAQ schema
   - URL structure: `/service-areas/charlotte/`, `/service-areas/southpark/`, etc.

   **Phase 2 (Year 1 H2): North Carolina statewide expansion — 16+ pages**
   - **Triangle (Raleigh-Durham):** Raleigh, Durham, Chapel Hill, Cary, Apex, Holly Springs, Wake Forest, Morrisville
   - **Triad (Greensboro-Winston):** Greensboro, Winston-Salem, High Point
   - **Asheville (luxury mountain):** Asheville, Black Mountain, Hendersonville, Brevard
   - **Wilmington / coastal:** Wilmington, Wrightsville Beach
   - URL structure: `/service-areas/raleigh/`, `/service-areas/asheville/`, etc.

   **Phase 3 (Year 2): Programmatic SEO across all NC metros — 200+ pages**
   - City × pool type matrix (e.g., `/asheville/infinity-edge-pools/`, `/raleigh/gunite-pool-builder/`)
   - This is the Tier 3 programmatic SEO build in the proposal
   - Designed to capture long-tail "luxury pool builder [NC city]" intent statewide

   **Positioning rule:** Charlotte stays primary in homepage hero + brand voice. NC statewide expansion shows up in schema.org `areaServed`, footer ("expanding across North Carolina"), and service-area architecture from day one — so the technical SEO foundation is statewide even while marketing focus stays Charlotte.

4. **Build pipeline:**
   - `package.json` with deploy script
   - `wrangler.toml` for CF Pages
   - `scripts/build-pages.js` to inline `_header.html` and `_footer.html` into each page
   - `scripts/upload-html-to-kv.js` to push HTML pages into a dedicated CDB KV namespace
   - Local preview via `wrangler pages dev`

5. **Backend (Phase 2):**
   - Supabase schema with `cdb_*` tables (clients, projects, documents, events, leads)
   - `api-src/track.js` — page view + click tracking (mirrors `mc-track`)
   - `api-src/contact.js` — form submission handler with budget/timeline qualifier routing
   - `api-src/admin-auth.js` — Tiffany's admin login
   - `api-src/admin-data.js` — admin dashboard reader

## What needs Tiffany's input before launch

- NC GC license number
- Year founded + project count for About page
- Past project list with photos for Portfolio (we have the existing 14 images in `_scraped/` references)
- Confirmed financing partner (Lyon? HFS? Both?)
- Final warranty terms (years, what's covered, what's not)
- Pool finishes/equipment catalog (what brands she uses)
- Headshot of Tiffany for About page
- Approval on hero copy and brand voice before we go live

## Deploy plan

**Dev preview (now to launch):** Build at `markcmo.com/cirilo-preview/` for Mark to review (or as standalone CF Pages project `cirilodb-rebuild.pages.dev`).

**Launch (post-sign, after parallel running on staging):** Cut DNS from Wix to new CF Pages project. Keep Wix site available at `wix.cirilodb.com` for 90 days as fallback.
