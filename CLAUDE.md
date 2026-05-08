# CLAUDE.md: operating guide for any Claude session in this repo

> **Read this first. Six rules at the top will save the user hours of lost work.**

## RULE #3: NEVER write em-dashes or en-dashes. Period.

Mark explicitly told Claude on 2026-05-07:

> "remove all en and emdashes and never use them in anything we do"

This is a hard rule. Em-dashes (`U+2014`) and en-dashes (`U+2013`) **must not appear in any file we write or edit**, regardless of language, file type, or context. Not in HTML, not in JS strings, not in Markdown, not in JSDoc, not in code comments. CSS box-drawing decorations are different characters (U+2500 horizontal-line and U+2550 double-line) and are fine.

**What to use instead:**

| Wrong | Right |
|---|---|
| `It's a fixed-fee [em-dash] we move at your pace.` | `It's a fixed-fee. We move at your pace.` |
| `Three documents [em-dash] one signature.` | `Three documents, one signature.` |
| `Ages 5 [en-dash] 10` | `Ages 5 to 10` or `Ages 5-10` |
| `Mark [en-dash] Tyler call` | `Mark-Tyler call` or `Mark and Tyler call` |
| HTML em-dash entity (ampersand-m-dash-semicolon) | `, ` or `:` or `.` whichever fits |
| HTML en-dash entity (ampersand-n-dash-semicolon) | `-` (hyphen) |

**Replacements at a glance:**

- space + em-dash + space (the most common case) becomes `, ` or `: ` for headers/setoffs
- em-dash with no surrounding spaces (mid-word) becomes `-` (hyphen)
- space + en-dash + space becomes ` - ` (hyphen with same spacing)
- en-dash in number ranges becomes `-` or ` to ` (e.g. "8 to 12 weeks")
- HTML em-dash entity becomes `, ` or `-` based on context
- HTML en-dash entity becomes `-`

The site was swept clean on 2026-05-08 across `admin.html`, all 32 `netlify/functions/*.js`, all SLCPL client docs + sign form, `portal/index.html`, `blog-post.html`, and this `CLAUDE.md`. **Do not re-introduce dashes.**

## RULE #-2: The admin console + the engagement-pipeline backends are LOCKED.

Mark explicitly told Claude on 2026-05-07 after a parallel session deleted ~5,300 lines of admin.html plus 12 backend functions and called it "Wire all admin panels + lock admin.html permanently":

> "the rich with everything wired"
> "after we fix everything we need to lock this so noone can change it"

**Reference state:** child branch `claude/stoic-raman-9cafcb` HEAD = `96180cbb` (deploy `69fd18ea3d69382756e07c14`). Live admin.html is **524,598 bytes** with 14 mc-dash-* widgets, 37 drag-drop refs, 72 journey refs, 18 Blog Manager refs.

### LOCKED files, do NOT replace, simplify, "consolidate," or delete without explicit per-file Mark permission:

**Admin console:**
- `admin.html`, the rich console (524 KB). Has drag-drop kanban pipeline, journey timeline, mc_* wired panels (CRM/Engagements/Forms/Email/Revenue/Analytics/Webinars/Blog), Compose Email modal, Client Editor with Square sync, full Blog Manager, Case Files VDR embedded, dashboard with mc-dash-kpis/stages/insights/activity/projects/outstanding tied to mcLoadDashboard.
- `portal/index.html`, client portal page.
- `blog-post.html`, dynamic blog post viewer.
- `admin/vdr/index.html`, Case Files VDR.

**Backend functions** (`netlify/functions/`):
- Pipeline (Supabase + Square + Resend): `submit-engagement-doc`, `execute-engagement-doc`, `send-engagement-proposal-email`, `square-invoice-action`, `square-invoice-sync`, `square-webhook`, `square-webhook-register`, `engagement-payment-followups`, `_lib_payment_apply`, `_lib_supabase`, `_lib_square`
- Calendly: `calendly-webhook`, `calendly-sync-history`
- Email (Resend): `send-template-email`, `resend-webhook`
- Admin readers/writers: `admin-engagement-data`, `admin-mc-write`, `admin-auth`, `admin-data`, `admin-links`, `admin-upload`, `update-client`, `client-portal-data`
- Blog: `admin-blog`, `public-blog`
- Tracking: `track`
- Misc: `pay`, `course-enroll`, `generate-engagement-docs`, `get-document`, `submit-document`, `execute-document`

**Supabase tables (CLIPOS project, ref `saoomfwycegflxelggxv`):**
- `mc_clients`, `mc_engagements`, `mc_documents`, `mc_invoices`, `mc_audit_log`, `mc_notes`, `mc_products`, `mc_email_templates`, `mc_webinar_events`, `mc_journey_events`, `mc_tasks`, `mc_blog_posts`

### What "locked" means in practice:

Going forward, do **NOT**:
- Delete any of the files listed above
- Reduce admin.html below ~520 KB (the rich version size)
- Replace admin.html with a "simpler" or "cleaner" version (this has happened twice, both times destroyed work)
- Drop any of the 12 mc-dash-* dashboard widgets
- Remove the drag-drop kanban, journey timeline, Compose Email modal, Client Editor, Blog Manager, or Case Files VDR
- Delete Supabase tables or drop columns from any `mc_*` table
- Commit a change with the message "Wire all admin panels" / "lock admin.html" / "clean up admin" / "simplify admin" without explicit Mark approval, those messages have all been used to justify destructive deletes

You **MAY**:
- Fix bugs in admin.html (wiring mismatches, broken handlers, layout issues, auth bugs)
- Add NEW panels, widgets, or backend functions
- Add NEW columns to existing mc_* tables (never drop)
- Refactor internals as long as the user-facing surface and the file inventory above stay intact
- Wire a panel to a new data source if it currently shows wrong/empty data

If a session's job feels like "consolidate" or "remove" or "simplify" anything in this list, **STOP and ask Mark first**. Quote this rule back at him before any destructive action.

### Recovery, if locked files were deleted by another session:

The auto-wip safety branches preserve every state. To find the last known-good rich admin:
```bash
git log --all --oneline -- admin.html | grep -i "rich\|wired\|build" | head -5
git checkout <commit-with-rich-admin> -- admin.html netlify/functions/ portal/index.html
```
Or restore from `auto-wip/child-claude-stoic-raman-9cafcb-2026-05-07T225208Z` which has the full set.

### Session ownership division (to prevent this happening again):

- **claude/stoic-raman-9cafcb** owns: `admin.html`, all `netlify/functions/*`, `portal/index.html`, `blog-post.html`, `admin/vdr/`, all `mc_*` Supabase tables.
- **markcmo.com / parent worktree session** owns: `index.html`, `about.html`, `services.html`, `blog.html`, `results.html`, `portfolio.html`, all `blog-*.html`, `style.css`, sitemap files, SEO meta, marketing surfaces.

If two sessions are running and one needs to touch the other's files, **stop and let Mark decide which session does it.** Don't merge, don't override.

## RULE #-1: The homepage at `markcmo.com/` (i.e. `index.html`) is LOCKED.

Mark explicitly told Claude on 2026-05-07 after multiple failed template changes:

> "that is it. do not let that ever change again"

Reference state: the deploy that landed at commit `99b6a24a` ("Revert Homepage: replace with MAGNET Framework template").

Going forward, do **NOT**:
- Replace `index.html` content with another page's template (the magnet-framework template, the about template, etc.)
- Change the body background color of `index.html`
- Change the hero copy, the nav structure, the section structure, or the layout of `index.html`
- Restyle `index.html` "to match the brand" or "to match the magnet-framework page", those are different surfaces
- Add `MAGNET™` to the nav of `index.html` unless explicitly asked
- Inject CSS overrides into `index.html` (no `BRAND-LOCK` blocks, no body bg flips)

You **MAY**:
- Fix bugs in `index.html` (broken links, security issues, accessibility, schema.org, sitemap entries)
- Update SEO metadata if Mark explicitly asks for it
- Add new content sections only if Mark asks for them by name

If Mark asks for a styling change to the homepage, **stop and confirm by re-quoting this rule back at him before doing the edit**. He has been bitten multiple times by Claude restyling the homepage to match other pages or design templates that turned out to be the wrong reference.

When in doubt: do not touch `index.html`. Touch any other file instead.

## RULE #0: NEVER send any email without explicit user consent. Not even tests.

This includes:
- `send-engagement-proposal-email`, even with `testRecipient` set
- `send-template-email`, same, even when routed to mark@markcmo.com
- Any direct call to the Resend API
- Triggering anything that fires `_lib_payment_apply.sendOnboardingIntake` (e.g. flipping an invoice paid via SQL or curl when the user hasn't asked for that test)

Mark gets every email Resend sends through his inbox, there is no such thing as a "private" test send. Smoke-testing email functions must use `curl` against Supabase / Square / etc, OR a `dry_run: true` flag if the function supports it. **If you need to verify an email function works end-to-end, ASK THE USER FIRST.**

If the user explicitly says "send a test to mark@markcmo.com" or "fire the proposal to Wendal now," that's consent, proceed. Otherwise: do not.

## RULE #1: Never run `netlify deploy --prod` directly. Use safe-deploy.sh.

```bash
bash scripts/safe-deploy.sh "your deploy message"
```

The script:
1. Snapshots any uncommitted work in **both** worktrees to a timestamped `auto-wip/*` branch on GitHub before doing anything.
2. Verifies the calling worktree is in sync with `origin/main` (refuses to deploy if behind).
3. Runs `netlify deploy --prod --no-build --dir=. --functions=netlify/functions` with your message.

If you skip the script and just call `netlify deploy --prod`, you risk overwriting Mark's uncommitted local work in production. **It has happened. Multiple times. Don't repeat.**

## RULE #2: There are TWO worktrees on this machine. Always check both.

```
parent worktree:   C:/Users/13219/Desktop/MarkCMO Website/MarkCMO.com/
child worktree:    C:/Users/13219/Desktop/MarkCMO Website/MarkCMO.com/.claude/worktrees/<branch>/
```

Mark works in the **parent** worktree (typically with thousands of uncommitted files, em-dash normalizations, BOM additions, favicon updates, new SEO pages). His version is the **canonical home/about/blog/marketing pages**.

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
  - `submit-engagement-doc.js`, client signs → upload PDF + sig to Supabase Storage, update mc_documents, send Mark countersign email + client receipt
  - `execute-engagement-doc.js`, Mark countersigns → upload executed PDF, update mc_documents, **auto-create Square draft invoice**, email both parties
  - `send-engagement-proposal-email.js`, admin-gated, sends the proposal+SOW+timeline email package
  - `square-invoice-action.js`, admin-gated, single endpoint for create-draft / publish / cancel Square invoices
  - `square-webhook.js`, Square → mark `mc_invoices.paid_at`, start delivery clock, email receipt
  - `engagement-payment-followups.js`, scheduled cron (every 6h), sends 24h/48h/72h reminders + 96h escalation
  - `calendly-webhook.js`, Calendly → upsert mc_clients + create lead-status mc_engagements
  - `generate-engagement-docs.js`, admin-gated, lead → draft engagement with `mc_documents` records
  - `admin-engagement-data.js`, admin-gated reader for `/admin/vdr/`
  - `_lib_supabase.js` + `_lib_square.js`, shared helpers
  - `get-document.js`, token validator for `/sign/`, supports v1 JSONBin and v2 Supabase paths
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
- `MARKCMO_SUPABASE_URL`, `MARKCMO_SUPABASE_SERVICE_KEY`, namespaced to avoid colliding with `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` (which point at a different project for unrelated systems)
- `MARKCMO_ADMIN_API_TOKEN`, server-to-server admin auth header
- `RESEND_API_KEY`, `TOKEN_SECRET`, `ADMIN_SESSION_SECRET`
- `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_ENV`, production Square (WETYR Corporation location)

User must register and set:
- `SQUARE_WEBHOOK_SIGNATURE_KEY`, from Square Webhook Subscriptions dashboard
- `CALENDLY_SIGNING_KEY`, from Calendly webhook subscription

## Brand / design system

**Don't use these patterns (they read as Claude design templates and have been removed):**
- 4px solid colored `border-left` accent stripes on cards. Use floating shadow + hairline border instead.
- Top gradient stripes on heroes (`linear-gradient(90deg, blue, orange, blue) 4px`). Use a strong drop shadow under the hero block instead.
- Trailing fade-to-transparent gradient lines after section eyebrows. Use a clean inline blue-pale pill badge instead.
- 2.5rem horizontal dash before eyebrow labels (`::before { width: 2.5rem; height: 1px }`). Just remove it.

**Don't use these in any prose or form text:**
- Em dashes (`-` U+2014) → use period, comma, or colon
- En dashes (`-` U+2013) → use hyphen or "to" (for ranges)

**Color tokens (in `style.css` :root):**
- `--navy: #0A1628` (heroes, footers, sidebar chrome)
- `--blue: #2563EB` (primary accent)
- `--orange: #F97316` (CTAs)
- `--white: #FFFFFF` (cards)
- `--off-white: #F8FAFC` (page bg)
- `--text: #1E293B` (body text on light)

**Typography:**
- `Bebas Neue`, display headings (h1, h2, big numbers)
- `Barlow`, body, weights 400/500/600/700/800
- `DM Mono`, eyebrow labels, doc IDs, metadata

## Branch hygiene

- Default branch: `main`
- Auto-deploy to Netlify is **NOT** wired to GitHub. Deploys are manual via `safe-deploy.sh`.
- WIP branches:
  - `auto-wip/*`, created by `safe-deploy.sh` on each run that finds uncommitted work (delete after recovering or merging)
  - `mark-wip/*`, manually-created safety snapshots of large WIP rescue (e.g. `mark-wip/seo-favicon-emdash-2026-05-06`)
  - `claude/*`, Claude session worktrees (typically `claude/<adjective>-<noun>-<hash>`)

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
