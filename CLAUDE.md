# CLAUDE.md — operating guide for any Claude session in this repo

> **Read this first. Rules at the top will save the user hours of lost work.**

---

## RULE #0 — admin.html is PERMANENTLY LOCKED

Mark explicitly stated on 2026-05-07: "once everything is wired we need to lock the admin panel to never get changed again. this is retarded that I have to get this all back every time you decide to make the wrong changes."

**DO NOT, under any circumstances:**
- Replace any panel content with stubs, placeholders, or "Coming Next Build" blocks
- Remove or rename any `<div id="panel-*">` elements
- Change `<nav class="admin-nav">` structure or `.admin-nav-item` elements
- Restyle admin.html "to match" another page, template, or design refresh
- Add new panels without Mark explicitly naming the panel ID and content
- Modify the `switchPanel()` or `toggleGroup()` functions
- Remove or break any data-loading functions (`loadClients`, `loadEngagements`, `loadInvoices`, `loadContacts`, `loadPipeline`, `loadAuditLog`, `loadFormSubmissions`, `loadSubscribers`, `loadLeadSources`, `loadFunnelData`, `loadRevenueReport`, `populateWebinarSchedule`, etc.)
- Change the admin dark theme colors (`--black`, `--surface`, `--gold`, `--border`, `--dim`)

**YOU MAY ONLY:**
- Fix bugs in data loading (fetch errors, broken response parsing, missing null checks)
- Add new `?type=` routes to `admin-data.js` if Mark explicitly asks for a new data type
- Fix display/formatting issues within a panel if Mark identifies a specific visual bug
- Update Square payment link values inside `panel-rev-products` if Mark gives new links
- Fix spelling errors or update text Mark explicitly identifies

**HISTORY:** The admin panel has been rebuilt from scratch multiple times after Claude regressions. The final wired version was locked on 2026-05-07. Every panel either loads live data or links to the correct third-party service. This is the permanent state.

---

## RULE #1 — Never run `netlify deploy --prod` directly. Use safe-deploy.sh.

```bash
bash .claude/scripts/safe-deploy.sh "your deploy message"
```

The script:
1. Snapshots any uncommitted work in **both** worktrees to a timestamped `auto-wip/*` branch on GitHub before doing anything.
2. Verifies the calling worktree is in sync with `origin/main` (refuses to deploy if behind).
3. Runs `netlify deploy --prod --no-build --dir=. --functions=netlify/functions` with your message.

If you skip the script and just call `netlify deploy --prod`, you risk overwriting Mark's uncommitted local work in production. **It has happened. Multiple times. Don't repeat.**

## RULE #2 — There are TWO worktrees on this machine. Always check both.

```
parent worktree:   C:/Users/13219/Desktop/MarkCMO Website/MarkCMO.com/
child worktree:    C:/Users/13219/Desktop/MarkCMO Website/MarkCMO.com/.claude/worktrees/<branch>/
```

Mark works in the **parent** worktree (typically with thousands of uncommitted files — em-dash normalizations, BOM additions, favicon updates, new SEO pages). His version is the **canonical home/about/blog/marketing pages**.

Claude works in **child** worktrees (Wendal docs, /admin/vdr, /forms/wendal-enterprise-audit.html, all `netlify/functions/_lib_*` and engagement-pipeline functions).

**Before any deploy, always check `git status --short` in the parent worktree.** If there are uncommitted changes, the safe-deploy script will preserve them automatically. If you bypass the script, you must `git stash`, `commit`, or otherwise handle them manually before deploying.

## Project structure

This is the **markcmo.com** static site + Netlify Functions backend, hosted at https://markcmo.com.

### Site map (high-level)
- **Public site**: `index.html`, `about.html`, `services.html`, `portfolio.html`, `results.html`, `blog.html`, `contact.html`, `book.html`, `faq.html`, all `blog-*.html`, all `brand-strategy-*.html`, all `MLG-Resume-*.html`, plus `services/`, `fractional-cmo/`, `fractional-coo/`, `guides/`, `compare/`, `magnet/`
- **Admin console**: `admin.html` (legacy 4900-line, light-theme rebrand applied) + `admin/vdr/index.html` (Case Files VDR)
- **Document signing**:
  - Customer-facing: `documents/clients/<slug>/<doc-type>.html` (proposal / sow / timeline / cover index)
  - Sign forms: `forms/<slug>-audit.html`
  - Countersign page: `sign/index.html` (handles BOTH legacy v1 JSONBin tokens AND new v2 Supabase-backed tokens)
- **Static styles**: `style.css` (light/blue/orange/navy palette + Bebas Neue/Barlow/DM Mono)

### Netlify Functions worth knowing
- **Engagement pipeline (Supabase + Square + Resend)**:
  - `submit-engagement-doc.js` — client signs → upload PDF + sig to Supabase Storage, update mc_documents, send Mark countersign email + client receipt
  - `execute-engagement-doc.js` — Mark countersigns → upload executed PDF, update mc_documents, **auto-create Square draft invoice**, email both parties
  - `send-engagement-proposal-email.js` — admin-gated, sends the proposal+SOW+timeline email package
  - `square-invoice-action.js` — admin-gated, single endpoint for create-draft / publish / cancel Square invoices
  - `square-webhook.js` — Square → mark `mc_invoices.paid_at`, start delivery clock, email receipt
  - `engagement-payment-followups.js` — scheduled cron (every 6h), sends 24h/48h/72h reminders + 96h escalation
  - `calendly-webhook.js` — Calendly → upsert mc_clients + create lead-status mc_engagements
  - `generate-engagement-docs.js` — admin-gated, lead → draft engagement with `mc_documents` records
  - `admin-engagement-data.js` — admin-gated reader for `/admin/vdr/`
  - `_lib_supabase.js` + `_lib_square.js` — shared helpers
  - `get-document.js` — token validator for `/sign/`, supports v1 JSONBin and v2 Supabase paths
- **Legacy signing (still used by /forms/proposal, NDA, MSA)**: `submit-document.js`, `execute-document.js`, JSONBin-backed
- **Auth**: `admin-auth.js` (sets `mcadmin_session` HMAC cookie for VDR + new endpoints; `admin.html` doLogin calls this in addition to its sessionStorage flag)

### Supabase (CLIPOS project, ref `saoomfwycegflxelggxv`)
Tables (all `mc_*` prefix, namespaced from credit-repair `cp_*` tables):
- `mc_clients` (slug, legal_name, primary_contact, status, square_customer_id)
- `mc_engagements` (client_id, doc_prefix, name, fee_usd, delivery_window_hrs, status, paid_at, **delivery_due_at** = paid_at + delivery_window_hrs)
- `mc_documents` (engagement_id, doc_id, doc_type, status, storage_path, signed/executed timestamps)
- `mc_invoices` (engagement_id, square_invoice_id, status, amount_usd, **is_test**, draft_at, sent_at, paid_at, void_at, **reminder_count**, last_reminder_at, escalated_at, square_invoice_url)
- `mc_audit_log` (every event: client_signed, executed, invoice_drafted, invoice_sent, invoice_paid, invoice_reminder_*_sent, invoice_escalated, calendly_booking_created, etc.)

All RLS-enabled, deny-all anon/auth policies. Service role only via Netlify Functions.

Storage bucket: `markcmo-engagement-docs` (private, 10 MB limit, PDF/PNG/JPEG only).

### Required Netlify env vars
Already set:
- `MARKCMO_SUPABASE_URL`, `MARKCMO_SUPABASE_SERVICE_KEY` — namespaced to avoid colliding with `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` (which point at a different project for unrelated systems)
- `MARKCMO_ADMIN_API_TOKEN` — server-to-server admin auth header
- `RESEND_API_KEY`, `TOKEN_SECRET`, `ADMIN_SESSION_SECRET`
- `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_ENV` — production Square (WETYR Corporation location)

User must register and set:
- `SQUARE_WEBHOOK_SIGNATURE_KEY` — from Square Webhook Subscriptions dashboard
- `CALENDLY_SIGNING_KEY` — from Calendly webhook subscription

## Brand / design system

**Don't use these patterns (they read as Claude design templates and have been removed):**
- 4px solid colored `border-left` accent stripes on cards. Use floating shadow + hairline border instead.
- Top gradient stripes on heroes (`linear-gradient(90deg, blue, orange, blue) 4px`). Use a strong drop shadow under the hero block instead.
- Trailing fade-to-transparent gradient lines after section eyebrows. Use a clean inline blue-pale pill badge instead.
- 2.5rem horizontal dash before eyebrow labels (`::before { width: 2.5rem; height: 1px }`). Just remove it.

**Don't use these in any prose or form text:**
- Em dashes (`—` U+2014) → use period, comma, or colon
- En dashes (`–` U+2013) → use hyphen or "to" (for ranges)

**Color tokens (in `style.css` :root):**
- `--navy: #0A1628` (heroes, footers, sidebar chrome)
- `--blue: #2563EB` (primary accent)
- `--orange: #F97316` (CTAs)
- `--white: #FFFFFF` (cards)
- `--off-white: #F8FAFC` (page bg)
- `--text: #1E293B` (body text on light)

**Typography:**
- `Bebas Neue` — display headings (h1, h2, big numbers)
- `Barlow` — body, weights 400/500/600/700/800
- `DM Mono` — eyebrow labels, doc IDs, metadata

## Branch hygiene

- Default branch: `main`
- Auto-deploy to Netlify is **NOT** wired to GitHub. Deploys are manual via `safe-deploy.sh`.
- WIP branches:
  - `auto-wip/*` — created by `safe-deploy.sh` on each run that finds uncommitted work (delete after recovering or merging)
  - `mark-wip/*` — manually-created safety snapshots of large WIP rescue (e.g. `mark-wip/seo-favicon-emdash-2026-05-06`)
  - `claude/*` — Claude session worktrees (typically `claude/<adjective>-<noun>-<hash>`)

## Testing the engagement pipeline

End-to-end test sequence on Wendal Enterprise Inc. (the seeded test client, slug `wendal-enterprise`, engagement_id `3a391c7b-7ff2-49b6-8f0a-7901295d6b4f`):

1. From `/admin/vdr/?slug=wendal-enterprise`: click "Send Test Copy (to mark@markcmo.com)" → verify Resend inbox for the proposal email
2. Open the sign form: https://markcmo.com/documents/clients/wendal-enterprise/sign?test=1 → submit a fake signature → check Supabase `mc_documents` for `client_signed`
3. Click the countersign link in the resulting email → draw signature → Execute → check Supabase for `executed` and a draft invoice (Square + `mc_invoices`)
4. In VDR: click "Prepare $1 Test Invoice" then "Send Payment Request" → verify Square shows the published invoice
5. Pay it ($1) via Square's payment link → webhook fires → check `mc_invoices.paid_at` flipped + `mc_engagements.delivery_due_at` populated + receipt emails sent

If any of these fail, the audit log (`mc_audit_log`) shows exactly which step broke.

## Things that have happened before (don't repeat)

1. **The site got reverted twice** because a deploy went out from a worktree that didn't have Mark's uncommitted home-page WIP. Fix: always use `safe-deploy.sh`.
2. **Mystery Netlify deploys** with empty titles came from running `netlify deploy --prod` from the parent worktree with no `-m` flag and stale local main. Fix: same script + `git pull` first.
3. **Hardcoded admin credentials** are still in `admin.html` client-side JS (`ADMIN_USER`, `ADMIN_PASS`). Anyone can view-source. Don't fix without explicit user permission since changing auth could break the legacy admin flow. Flag it if asked.
4. **Two parallel auth systems**: legacy `admin.html` uses `sessionStorage.admin_auth='1'`, new VDR + payment endpoints use the `mcadmin_session` HMAC cookie. The doLogin in admin.html now calls both, but be aware of the dual system.
