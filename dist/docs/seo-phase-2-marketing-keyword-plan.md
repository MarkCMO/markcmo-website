# SEO Phase 2: Dominate the "Marketing" Keyword Landscape

**Goal:** Rank #1 for 5 anchor commercial-intent keywords tied to "marketing" (the word itself + "agency / services / cost / hire / best"), plus dominate the marketing/city/state long-tail SERP.

**Status:** Phase 1 complete (fractional CMO terms ranked). Phase 2 starting June 2026.

---

## 1. Current Inventory (the asset base)

You already have **17,000+ programmatic pages** across 30+ marketing vertical sitemaps:

- 5,407 base city pages (`sitemap-cities.xml`)
- 567 city pages × ~30 vertical clusters (content-marketing, b2b-marketing, digital-marketing, lead-generation, marketing-analytics, marketing-automation, marketing-operations, marketing-systems, marketing-tech-stack, paid-social, performance-marketing, ppc-management, revops, seo-services, social-media-marketing, etc.)
- Singleton pillar pages: `/marketing-strategy`, `/fractional-cmo-cost`, `/how-to-hire-a-fractional-cmo`, `/marketing-assessment`, glossary, statistics, calculators.

This is a strong base. But the **highest-commercial-intent terms on "marketing" itself are missing**.

## 2. The Gap: 16 Missing High-Intent Pages

These all 404 today and represent **the highest-converting commercial-intent terms in the marketing vertical**:

| Slug                                  | Search Volume (est) | Commercial Intent | Status |
| ------------------------------------- | ------------------- | ----------------- | ------ |
| `/marketing-agency`                   | 110,000/mo (US)     | Very High         | 404    |
| `/marketing-services`                 |  40,500/mo          | High              | 404    |
| `/marketing-consultant`               |  18,100/mo          | High              | 404    |
| `/marketing-firm`                     |   9,900/mo          | High              | 404    |
| `/marketing-help`                     |   8,100/mo          | Medium-High       | 404    |
| `/marketing-plan`                     |  74,000/mo          | Medium            | 404    |
| `/marketing-cost`                     |   6,600/mo          | Very High         | 404    |
| `/marketing-pricing`                  |   5,400/mo          | Very High         | 404    |
| `/marketing-agency-cost`              |   5,400/mo          | Very High         | **LIVE (today)** |
| `/agency-vs-fractional-cmo`           |   1,300/mo          | Very High         | 404    |
| `/in-house-vs-agency`                 |   2,400/mo          | Very High         | 404    |
| `/best-marketing-agency`              |  14,800/mo          | Very High         | 404    |
| `/marketing-agency-alternative`       |     880/mo          | Very High         | 404    |
| `/hire-a-marketing-agency`            |   2,900/mo          | Very High         | 404    |
| `/how-to-hire-a-marketing-agency`     |   1,900/mo          | Very High         | 404    |
| `/marketing-agency-for-small-business`|   3,600/mo          | Very High         | 404    |

Volumes are US monthly, mid-range estimates from SERP context. We'll refine with DataForSEO + GSC data in Phase 2A.

## 3. The 5 Anchor Keywords to Win

We will not chase pure "marketing" (200K+/mo, dominated by HubSpot, Wikipedia, Investopedia — uneconomical). We **win on the 5 highest-commercial-intent terms** the operator-led narrative is structurally best at:

| # | Anchor Keyword            | URL                              | Why It Wins for MarkCMO |
| - | ------------------------- | -------------------------------- | ----------------------- |
| 1 | marketing agency cost     | `/marketing-agency-cost`         | Real numbers, honest hidden-cost teardown. Pivots to operator alternative. LIVE TODAY. |
| 2 | marketing agency vs fractional CMO | `/agency-vs-fractional-cmo` | You already rank for "fractional CMO". Capture comparison traffic. |
| 3 | best marketing agency     | `/best-marketing-agency`         | Listicle format. Mark + WETYR #1 with operator angle, 9 honest competitor reviews. |
| 4 | marketing agency alternative | `/marketing-agency-alternative` | Perfect-fit query — buyer is actively shopping the alternative. |
| 5 | how to hire a marketing agency | `/how-to-hire-a-marketing-agency` | Buying guide. Captures decision-moment intent. |

**Plus the programmatic geo expansion (city/state/zip):** New cluster `sitemap-marketing-agency.xml` with 567+ city pages following the same pattern as your existing programmatic build.

## 4. Sibling Pillars to Write (Phase 2A — this week)

After `/marketing-agency-cost` (LIVE), four more pillars complete the cluster:

1. **`/agency-vs-fractional-cmo`** — Direct comparison page. Schema: ComparisonPage. Word count target: 3,500. Internal links from every existing `/fractional-cmo-*` page.

2. **`/best-marketing-agency`** — Listicle. MarkCMO + WETYR ranked #1 with brutally honest write-ups of 9 competitors (Chief Outsiders, CMOx, Power Digital, Disruptive Advertising, etc.). Schema: ItemList. Word count: 4,500.

3. **`/marketing-agency-alternative`** — Positioning page. Focused on the buyer who has decided agencies don't fit. Word count: 2,500.

4. **`/how-to-hire-a-marketing-agency`** — Buying guide. Step-by-step process, RFP template, red flags. Pivots to "or hire an operator instead." Word count: 3,500.

## 5. Programmatic Geo Expansion (Phase 2B — next week)

Add **one new vertical cluster** to the existing build system:

- New build script: `build_wave_marketing_agency.py` (clone of `build_wave_cities.py`)
- New sitemap: `sitemap-marketing-agency.xml`
- URL pattern: `/marketing-agency-{city}-{state-abbr}`
- Volume: ~567 city pages (matching your existing programmatic cadence)
- Each city page: cost section + operator-vs-agency comparison + local social proof + CTA to `/book`

**Zip code layer:** Hold for Phase 3. Adding 41,000+ ZIP pages × N verticals exceeds the CF Pages 20,000-file-per-deployment limit. Workaround: zip-level pages served from Worker route reading a KV-backed template, not static HTML. Defer to Phase 3 once city pages prove the conversion lift.

## 6. Internal Linking Strategy

Three link flows to set up:

1. **Geo → Pillar (PageRank up)** — Every existing `/{vertical}-{city}-{state}` page gets a contextual block: "Need an alternative to a marketing agency? Read [marketing agency cost](/marketing-agency-cost)." Boost the keystone via 17,000+ inbound internal links.

2. **Pillar → Pillar (cluster cohesion)** — The 5 anchor pillars cross-link to each other and to `/fractional-cmo-cost`, `/services`, `/portfolio`.

3. **Pillar → Geo (relevance signal)** — The keystones get "Find a marketing operator in [your city]" with a programmatic city picker linking to the matching city page.

## 7. Schema Architecture

Every pillar ships with:

- **FAQPage** schema with 10-15 Q&As (proven AI Overview format)
- **Article** schema with full author markup (Mark Gabrielli + sameAs LinkedIn)
- **Service** schema for offer-related pages (`marketing-agency-cost`)
- **ItemList** schema for listicles (`best-marketing-agency`)
- **BreadcrumbList** on every page
- **Comparison** structured data on `/agency-vs-fractional-cmo`

## 8. Expected SERP Wins

Conservative 90-day projection after Phase 2A + 2B ship:

| Keyword                            | Current Rank | Target by Day 90 |
| ---------------------------------- | ------------ | ---------------- |
| marketing agency cost              | Not ranking  | Top 5            |
| agency vs fractional CMO           | Not ranking  | #1 (low-comp)    |
| best marketing agency              | Not ranking  | Top 10           |
| marketing agency alternative       | Not ranking  | #1 (low-comp)    |
| how to hire a marketing agency     | Not ranking  | Top 5            |
| marketing agency [city]            | Not ranking  | Top 10 (5,000+ city variants) |

## 9. AI Overview Strategy

The 5 pillars are structured for AI Overview citation:

- FAQ schema answers are 50-80 words (the proven citation length)
- Direct first sentences answer the H2 question explicitly
- Tables present comparison data in scannable format (AI Overviews quote tables)
- Author markup with credentials (E-E-A-T signal)
- Citations to first-party data (Mark's 32 ventures, real numbers)

## 10. Timeline

| Week | Deliverable                                                |
| ---- | ---------------------------------------------------------- |
| Now  | `/marketing-agency-cost` LIVE                              |
| Wk 1 | 4 sibling pillars written + deployed                       |
| Wk 2 | `build_wave_marketing_agency.py` generates 567 city pages  |
| Wk 3 | Internal-link injection across all 17,000 existing pages   |
| Wk 4 | First DataForSEO ranking audit; tune underperformers       |
| Wk 8 | AI Overview citation audit (ChatGPT, Perplexity, Gemini)   |
| Wk 12 | Full SERP report; iterate on weak rankings                |

---

**Next action:** OK to proceed with sibling pillars (Wk 1) and city-page generator (Wk 2)?
