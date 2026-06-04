# Cirilo Design + Build — Website Rebuild

**Status:** Phase 1 foundation. Pre-engagement (Tiffany has not signed yet).
**Target:** Replace cirilodb.com (currently on Wix) with a Cloudflare Pages build that owns analytics, admin, and customer portal.

## Why this project exists

Tiffany's current site is on Wix:
- Slow (Wix bloat: 640KB to 885KB of HTML per page)
- No tracking pixels, no analytics, no schema, no GBP wiring
- No service-area pages, no programmatic SEO, no admin dashboard
- No customer portal, no document signing pipeline
- No path to integrate with QuickBooks, Square, Pool Studio, or the 14-stage pool pipeline her business actually runs on

This rebuild fixes all of that on the same Cloudflare + Supabase + KV stack we run for markcmo.com.

## Reference architecture

Mirrors the markcmo.com backend that already works:

| Layer | Tech | Notes |
|---|---|---|
| Static pages | HTML in KV namespace | Same pattern as markcmo's 21K-page setup |
| CMS pages | Pages Functions + KV | Service-area pages, programmatic SEO pages |
| Backend | CF Pages Functions | Generated from `api-src/*.js` |
| Database | Supabase (CLIPOS project, `cdb_*` prefix) | Separate from `mc_*` tables |
| Auth | Custom (mirrors `admin-auth.js` pattern) | Admin + customer logins |
| Storage | CF KV + Supabase Storage | HTML in KV, files in Supabase |
| Domain | cirilodb-rebuild.pages.dev → cirilodb.com after launch | DNS cutover from Wix |

## Folder layout

```
website-rebuild/
├── pages/                  Static marketing HTML (index, about, services, etc.)
│   ├── _layout.html        Shared layout template
│   ├── _header.html        Shared nav
│   ├── _footer.html        Shared footer
│   └── index.html, about.html, ...
├── admin/                  Admin dashboard (post-sign)
├── portal/                 Customer portal (post-sign)
├── api-src/                Pages Function source (gets wrapped to functions/api/)
├── assets/
│   ├── css/                Design system + page styles
│   ├── images/             Logos, photos, downloaded from Wix
│   └── js/                 Client-side JS
├── scripts/                Build, deploy, scrape, extract scripts
├── docs/                   Project docs, status, decisions
└── _scraped/               Read-only snapshot of current cirilodb.com pages
    └── extracted/          Parsed JSON of each page's content
```

## What's done (Phase 1)

- [x] Scraped all 9 live cirilodb.com pages (read-only snapshot in `_scraped/`)
- [x] Extracted content (titles, copy, images, links) to per-page JSON in `_scraped/extracted/`
- [x] Project scaffolding (folders, README, status docs)
- [ ] Design system CSS (brand colors, typography, tokens)
- [ ] Base layout template (header + footer + meta)
- [ ] Homepage rebuild
- [ ] Remaining 8 marketing pages
- [ ] Service-area page template + 14 location pages
- [ ] wrangler.toml + build scripts
- [ ] Local preview pipeline
- [ ] Audit-finding fixes (analytics, schema, license #, 704 number, financing, warranty)

## What's next

**Phase 1 finish (foundation):**
- Build design system, layout, and ship the 9 marketing pages
- Fix every audit finding in the rebuild from day 1

**Phase 2 (admin + analytics):**
- Admin dashboard with the 14-stage pool pipeline
- Lead capture + CRM (`cdb_clients`, `cdb_engagements`, `cdb_documents`)
- Analytics tracking (page views, source attribution, conversion funnel)

**Phase 3 (post-sign, customer-facing):**
- Customer portal for each pool client
- Document signing pipeline (mirrors `submit-engagement-doc`)
- Project VDR per client
- Square + QuickBooks Online integration
- DNS cutover from Wix
