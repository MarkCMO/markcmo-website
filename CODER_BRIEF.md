# CODER BRIEF - markcmo.com
Generated from SEO/SEM Audit v2
Date: April 5, 2026
Stack: Netlify + Static HTML/CSS/JS + Python build scripts
Site ID: 609d74ca-5f2a-4caa-aa7c-3f6922a7bcb4

---

## EXECUTION ORDER
1. Complete all CRITICAL items first (Sections 1, 2, 4-Organization/FAQ)
2. Then HIGH items (Sections 3, 4-others, 5, 6, 8)
3. Then STANDARD items (Sections 7, 9)
4. Validate each section before moving to the next

---

## SECTION 1 - ROBOTS.TXT
**Priority: CRITICAL**
File: `/robots.txt` (root)

ADD these lines (missing AI crawlers):
```
User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: CCBot
Allow: /

User-agent: cohere-ai
Allow: /

User-agent: Diffbot
Allow: /
```

ADD this Sitemap line at the bottom:
```
Sitemap: https://markcmo.com/llms.txt
```

No lines need to be removed. Existing AI crawler rules are correct.
No Cloudflare firewall - site is on Netlify. No bot fight mode to disable.

---

## SECTION 2 - LLMS.TXT
**Priority: CRITICAL**
File: `/llms.txt` (root, served as `text/plain; charset=utf-8`)

Replace entire file with:

```
# MarkCMO - Mark Gabrielli, Fractional CMO

> MarkCMO is a fractional executive leadership practice founded by Mark Gabrielli that provides part-time CMO, COO, and C-suite advisory services to growth-stage B2B companies across the United States.

## About
MarkCMO publishes in-depth content on fractional CMO services, B2B marketing strategy, demand generation, go-to-market frameworks, and revenue operations. The site serves founders, CEOs, and investors at companies with $1M-$50M in revenue who need executive-level marketing leadership without a full-time hire. Mark Gabrielli has 15+ years of executive marketing experience across SaaS, healthcare, aerospace, fintech, and manufacturing.

Publisher: Mark Gabrielli / WETYR Corp
Contact: mark@markcmo.com
Update frequency: Weekly
AI crawl permission: This site welcomes indexing by AI crawlers, LLM training pipelines, RAG systems, and search engines. All content is freely accessible.

## Priority Pages

- https://markcmo.com/: Homepage - fractional CMO and COO services overview, credentials, and booking
- https://markcmo.com/fractional-cmo.html: Primary fractional CMO service page with full FAQ schema
- https://markcmo.com/fractional-cmo-cost.html: Fractional CMO pricing - hourly, retainer, and performance models
- https://markcmo.com/fractional-cmo-statistics.html: 67 statistics on fractional CMO engagements, market data, and outcomes
- https://markcmo.com/fractional-cmo-roi-calculator.html: Interactive ROI calculator for fractional CMO engagements
- https://markcmo.com/revenue-architecture.html: Mark Gabrielli's proprietary 5-pillar Revenue Architecture framework
- https://markcmo.com/case-studies.html: 4 detailed fractional CMO case studies with metric outcomes
- https://markcmo.com/fractional-cmo-vs-full-time-cmo.html: Full comparison of fractional vs full-time CMO models
- https://markcmo.com/fractional-cmo-vs-agency.html: Comparison of fractional CMO vs marketing agency
- https://markcmo.com/go-to-market-strategy.html: Go-to-market strategy service page with FAQ schema
- https://markcmo.com/marketing-audit.html: Marketing audit service - framework and methodology
- https://markcmo.com/about.html: Mark Gabrielli biography, credentials, and experience
- https://markcmo.com/testimonials.html: 25 named client reviews with industry and role attribution
- https://markcmo.com/speaking.html: Speaking topics, bio, and booking for keynotes and podcasts
- https://markcmo.com/press.html: Media mentions, expert contributions, and press inquiry contact
- https://markcmo.com/blog-fractional-cmo-guide.html: Comprehensive guide to fractional CMO hiring
- https://markcmo.com/blog-go-to-market-strategy-guide.html: B2B go-to-market strategy guide
- https://markcmo.com/blog-b2b-demand-generation.html: B2B demand generation strategy and frameworks
- https://markcmo.com/book.html: Book a free 30-minute fractional CMO diagnostic call

## Content Categories
- Fractional CMO services (national, city-level, and industry-specific)
- Fractional COO and C-suite advisory
- B2B marketing strategy and demand generation
- Go-to-market strategy and frameworks
- Marketing audit methodology
- Revenue operations
- SaaS marketing
- Healthcare marketing
- Industry-specific marketing (aerospace, fintech, manufacturing, cleantech, biotech)
- Fractional CMO cost, ROI, and comparison content
- B2B marketing blog and guides

## Latest Content
- https://markcmo.com/case-studies.html: Case studies - 4 fractional CMO engagements with outcome metrics (April 2026)
- https://markcmo.com/speaking.html: Speaking topics and keynote booking page (April 2026)
- https://markcmo.com/press.html: Press and media page with expert contributions (April 2026)
- https://markcmo.com/fractional-cmo-statistics.html: 67 fractional CMO statistics (2026)
- https://markcmo.com/fractional-cmo-roi-calculator.html: Interactive CMO ROI calculator (2026)
```

Serve with headers:
```
Content-Type: text/plain; charset=utf-8
ETag: [hash of file content]
Cache-Control: max-age=86400
```

In Netlify `_headers` file, add:
```
/llms.txt
  Content-Type: text/plain; charset=utf-8
  Cache-Control: max-age=86400
```

---

## SECTION 3 - XML SITEMAP
**Priority: HIGH**
File: `/sitemap.xml` (generated by `generate_sitemap.py`)

Current state: 5,306 URLs, `lastmod` set to build date, priorities set correctly.

Changes needed:
1. Verify `<lastmod>` is present on every `<url>` entry - it is (TODAY variable in script). No change needed.
2. Add `<image:sitemap>` namespace if og:image tags are added to pages in future.
3. Content-Type header for sitemap: add to `_headers` file:
```
/sitemap.xml
  Content-Type: application/xml; charset=utf-8
```
4. No dynamic generation needed - static HTML site, Python regeneration on deploy is correct approach.

---

## SECTION 4 - SCHEMA MARKUP
**Priority: CRITICAL for Organization + WebSite. HIGH for all others.**

### 4A. Homepage - ADD Organization + WebSite + SearchAction schema
**PAGE: index.html**
**ACTION: ADD to `<head>`**

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://markcmo.com/#organization",
      "name": "MarkCMO",
      "legalName": "WETYR Corp",
      "url": "https://markcmo.com",
      "logo": "https://markcmo.com/og-image.jpg",
      "foundingDate": "2020",
      "founder": {"@id": "https://markcmo.com/#mark-gabrielli"},
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+13219175738",
        "contactType": "customer service",
        "email": "mark@markcmo.com",
        "availableLanguage": "English"
      },
      "sameAs": [
        "https://www.linkedin.com/in/markgabriellijr",
        "https://clutch.co/profile/mark-gabrielli-chief-marketing-officer"
      ],
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Cape Canaveral",
        "addressRegion": "FL",
        "postalCode": "32920",
        "addressCountry": "US"
      }
    },
    {
      "@type": "WebSite",
      "@id": "https://markcmo.com/#website",
      "url": "https://markcmo.com",
      "name": "MarkCMO",
      "publisher": {"@id": "https://markcmo.com/#organization"},
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://markcmo.com/?s={search_term_string}"
        },
        "query-input": "required name=search_term_string"
      }
    }
  ]
}
```

### 4B. All Blog Pages - ADD Article schema with datePublished + dateModified + Author
**PAGE TEMPLATE: all blog-*.html pages (52 pages)**
**ACTION: ADD or UPDATE Article schema**
Script: `build_article_schema.py` - inject into all blog-*.html

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "[PAGE TITLE FROM <title> TAG]",
  "description": "[META DESCRIPTION CONTENT]",
  "url": "https://markcmo.com/[FILENAME]",
  "datePublished": "2026-01-01",
  "dateModified": "2026-04-05",
  "author": {
    "@type": "Person",
    "@id": "https://markcmo.com/#mark-gabrielli",
    "name": "Mark Gabrielli",
    "url": "https://markcmo.com/about.html",
    "sameAs": ["https://www.linkedin.com/in/markgabriellijr"]
  },
  "publisher": {
    "@id": "https://markcmo.com/#organization"
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://markcmo.com/[FILENAME]"
  }
}
```

### 4C. All Interior Pages - ADD BreadcrumbList schema
**PAGE TEMPLATE: All non-homepage pages**
**ACTION: ADD to `<head>`**

Pattern rules for Python script:
- `fractional-cmo-[city]-[state].html` → Home > Fractional CMO > [City, State]
- `fractional-cmo-[industry].html` → Home > Fractional CMO > [Industry]
- `blog-*.html` → Home > Blog > [Title]
- `fractional-cmo-vs-*.html` → Home > Fractional CMO > [Comparison]
- Service pages (go-to-market-strategy.html, etc.) → Home > Services > [Service Name]

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://markcmo.com/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "[PARENT CATEGORY]",
      "item": "https://markcmo.com/[PARENT-URL]"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "[PAGE TITLE]",
      "item": "https://markcmo.com/[CURRENT-URL]"
    }
  ]
}
```

### 4D. Blog Posts with Steps - ADD HowTo schema
**TARGET PAGES:** blog-marketing-audit-guide.html, blog-how-to-evaluate-fractional-cmo.html, blog-how-to-hire-fractional-cmo.html, blog-go-to-market-strategy-guide.html
**ACTION: ADD to `<head>`**

```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "[PAGE H1]",
  "description": "[META DESCRIPTION]",
  "author": {"@id": "https://markcmo.com/#mark-gabrielli"},
  "datePublished": "2026-01-01",
  "dateModified": "2026-04-05",
  "step": [
    {"@type": "HowToStep", "position": 1, "name": "[STEP 1 HEADING]", "text": "[STEP 1 SUMMARY]"},
    {"@type": "HowToStep", "position": 2, "name": "[STEP 2 HEADING]", "text": "[STEP 2 SUMMARY]"},
    {"@type": "HowToStep", "position": 3, "name": "[STEP 3 HEADING]", "text": "[STEP 3 SUMMARY]"}
  ]
}
```

### 4E. LocalBusiness schema - index.html and about.html
**ACTION: ADD to both pages**

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": "https://markcmo.com/#local-business",
  "name": "Mark Gabrielli - Fractional CMO",
  "image": "https://markcmo.com/og-image.jpg",
  "telephone": "+13219175738",
  "email": "mark@markcmo.com",
  "url": "https://markcmo.com",
  "priceRange": "$$$",
  "currenciesAccepted": "USD",
  "paymentAccepted": "Invoice",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Cape Canaveral",
    "addressLocality": "Cape Canaveral",
    "addressRegion": "FL",
    "postalCode": "32920",
    "addressCountry": "US"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 28.3922,
    "longitude": -80.6077
  },
  "areaServed": {
    "@type": "Country",
    "name": "United States"
  },
  "serviceType": ["Fractional CMO", "Marketing Strategy", "Demand Generation", "Go-To-Market Strategy"],
  "sameAs": [
    "https://www.linkedin.com/in/markgabriellijr",
    "https://clutch.co/profile/mark-gabrielli-chief-marketing-officer"
  ]
}
```

---

## SECTION 5 - META TAGS AND PAGE HEAD
**Priority: HIGH**

New pages already have correct meta tags (built in wave 6). No rewrites needed.

Flag: Verify these three pages have canonical tags pointing to the correct URL (no .html extension):
- press.html → canonical: `https://markcmo.com/press`
- speaking.html → canonical: `https://markcmo.com/speaking`
- case-studies.html → canonical: `https://markcmo.com/case-studies`

All three were built with .html extension in canonical - confirm with: `grep -n "canonical" press.html speaking.html case-studies.html`

---

## SECTION 6 - CONTENT STRUCTURE FIXES
**Priority: HIGH for primary service pages**

### 6A. fractional-cmo.html
**ADD at top of main content, before first H2:**
```html
<div class="quick-answer" style="background:#1a1a1a;border-left:3px solid #c9a84c;padding:1.25rem 1.5rem;margin-bottom:2rem;border-radius:0 6px 6px 0;">
  <strong style="color:#c9a84c;font-size:.8rem;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.1em;">Quick Answer</strong>
  <p style="color:#ccc;margin:.5rem 0 0;line-height:1.7;">A fractional CMO is a part-time Chief Marketing Officer who provides executive-level marketing leadership to growth-stage companies without the cost of a full-time hire. Engagements typically run $3,500-$15,000/month versus $200,000-$350,000/year for a full-time CMO. Results typically appear within 30-90 days.</p>
</div>
```
**ADD `Last updated: April 2026` line above the footer on the page.**

### 6B. fractional-cmo-cost.html
**ADD Quick Answer block at top of content:**
```html
<div class="quick-answer" ...>
  <strong>Quick Answer</strong>
  <p>A fractional CMO costs $3,500-$15,000 per month on retainer, or $200-$350 per hour for project work. Full-time CMO total compensation runs $200,000-$350,000 annually. Most growth-stage companies save $120,000-$250,000 per year by hiring fractional.</p>
</div>
```

### 6C. All 52 blog pages
**ADD to each blog post, below the H1:**
```html
<p style="color:#666;font-size:.8rem;font-family:'DM Mono',monospace;">By <a href="/about.html" style="color:#c9a84c;">Mark Gabrielli</a> · Last updated: April 2026</p>
```

### 6D. fractional-cmo-statistics.html
This page is the highest GEO-citation candidate on the site. Ensure:
- First paragraph begins: "Fractional CMO engagements have grown significantly - here are 67 data points on costs, outcomes, and market trends."
- All statistics are in a numbered list format (not just paragraphs) so LLMs can extract them as list items
- `dateModified: 2026-04-05` in schema

---

## SECTION 7 - INTERNAL LINKING
**Priority: STANDARD**

New pages (press.html, speaking.html, case-studies.html) currently have no inbound internal links. Fix:

ADD link to `case-studies.html` from:
- `fractional-cmo.html` - add in the social proof section: "See client case studies →"
- `about.html` - add near the bottom: "View engagement results →"
- `testimonials.html` - add above testimonials grid: "Read full case studies with metrics →"
- `book.html` - add near CTA: "See what results look like first →"

ADD link to `press.html` from:
- `about.html` - add "Press & Media →" link in credential section
- `speaking.html` - already links to book.html, add "View press page →"

ADD link to `speaking.html` from:
- `about.html` - add "Book Mark to Speak →" in bio section
- `press.html` - already references speaking, add direct link

ADD to nav.html or footer.html:
- Case Studies link under "Work" or "Results" section
- Press link under "About" section
- Speaking link under "About" section

---

## SECTION 8 - PAGE SPEED AND CORE WEB VITALS
**Priority: HIGH**

### 8A. Google Fonts render-blocking - CRITICAL performance fix
**Problem:** Every page loads Google Fonts via synchronous `<link>` tag, blocking render.
**Affected file:** Every HTML page (5,306 files) - injected via `build_components.py`
**Fix:** Replace in `fractional-cmo.html` and all pages - change:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:ital,wght@0,400;0,500;0,600;0,700;0,800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
```
To:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:ital,wght@0,400;0,500;0,600;0,700;0,800&family=DM+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:ital,wght@0,400;0,500;0,600;0,700;0,800&family=DM+Mono:wght@400;500&display=swap" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:ital,wght@0,400;0,500;0,600;0,700;0,800&family=DM+Mono:wght@400;500&display=swap"></noscript>
```
Apply via Python script across all HTML files. Target LCP improvement: 400-800ms.

### 8B. Add `font-display: swap` to style.css
In `style.css`, any `@font-face` declarations need `font-display: swap;`

### 8C. Add `width` and `height` attributes to all `<img>` tags
**Problem:** Images without explicit dimensions cause CLS (layout shift)
**Fix:** Add `width` and `height` to every `<img>` tag. For og-image.jpg: width="1200" height="630"
**Target CLS:** < 0.1

### 8D. Netlify image optimization
In `netlify.toml` (create if missing):
```toml
[build.processing]
  skip_processing = false
[build.processing.images]
  compress = true
```

### 8E. Add HTTP security and cache headers
In `_headers` file (create if missing at root):
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Cache-Control: public, max-age=31536000, immutable

/index.html
  Cache-Control: public, max-age=0, must-revalidate

/*.html
  Cache-Control: public, max-age=3600

/sitemap.xml
  Content-Type: application/xml; charset=utf-8

/llms.txt
  Content-Type: text/plain; charset=utf-8
```

---

## SECTION 9 - REDIRECTS AND TECHNICAL CLEANUP
**Priority: STANDARD**

No broken links or 4xx/5xx errors identified.

Canonical tag review: All pages use `.html` extension in canonical but Netlify serves both `/page` and `/page.html`. Confirm in GSC that canonical is being respected and Google is not indexing both versions.

Add to `_redirects` file (Netlify):
```
/fractional-cmo   /fractional-cmo.html   301
/about            /about.html            301
/book             /book.html             301
/press            /press.html            301
/speaking         /speaking.html         301
/case-studies     /case-studies.html     301
/testimonials     /testimonials.html     301
```
This ensures clean URLs work and canonical signals are consistent.

---

## SECTION 10 - LOCAL SEO AND DIRECTORY TASKS
**Priority: HIGH - no code required, ops team action**

Use this exact NAP on every external listing:
```
Business Name:  Mark Gabrielli - Fractional CMO
Address:        Cape Canaveral, FL 32920
Phone:          (321) 917-5738
Website:        https://markcmo.com
Category:       Marketing Consultant
```

Description (use on all profiles - 175 words):
```
Mark Gabrielli is a fractional CMO and COO with 15+ years of executive marketing
experience across SaaS, healthcare, aerospace, fintech, and manufacturing. He serves
growth-stage B2B companies with $1M-$50M in annual revenue that need CMO-level
marketing leadership without the cost of a full-time hire. Engagements deliver results
in 30-90 days across demand generation, go-to-market strategy, brand positioning,
paid media, and revenue operations. Mark holds a degree in Biological Sciences, is a
Certified Surgical Technologist, and is the creator of the Revenue Architecture
Framework - a 5-pillar system for building scalable B2B marketing engines. He has
served as Global CMO across multiple industries and has managed marketing budgets from
$20K to $400K/month. Based in Cape Canaveral, FL. Serving clients nationwide.
```

Hours: Monday-Friday 9:00 AM - 6:00 PM ET

| Platform | DA | Status | Action |
|---|---|---|---|
| Google Business Profile (CMO) | - | Reclaimed, needs reviews | Optimize + get 10 reviews |
| Google Business Profile (Marketing) | - | Not yet claimed | Claim + optimize |
| Clutch.co | 72 | LIVE - 0 reviews | Get 5 verified reviews |
| G2.com | 91 | Missing | Create profile |
| GoodFirms | 68 | Missing | Create profile |
| Expertise.com | 52 | Missing | Create profile |
| DesignRush | 62 | Missing | Create profile |
| FeaturedCustomers | 55 | Missing | Create profile, add 3 case studies |
| Crunchbase | 91 | Missing | Create WETYR Corp organization profile |
| Bing Places | 65 | Missing | Create (free, syncs to Copilot) |
| Apple Maps | - | Missing | register.apple.com/business |
| Yelp Business | 93 | Missing | business.yelp.com (free) |
| Data Axle/Infogroup | - | Missing | data.axleinfo.com - seeds 100s of downstream citations |
| Localeze/Neustar | - | Missing | expressupdate.com |
| Wikidata | - | Missing | wikidata.org/wiki/Special:NewItem - Person entity |

---

## SECTION 11 - MONITORING AND MEASUREMENT
**Priority: HIGH**

| Tool | Status | Action |
|---|---|---|
| Google Analytics 4 (G-BXK5Y3DQBL) | LIVE | No action needed |
| Google Search Console | LIVE (sitemap submitted daily) | Monitor Index Coverage report weekly - check for "Crawled but not indexed" on city pages |
| Google PageSpeed Insights | Not configured | Test index.html and fractional-cmo.html at pagespeed.web.dev after font fix |
| Core Web Vitals (CrUX) | No data yet (low traffic) | Check GSC > Core Web Vitals monthly; will populate once traffic grows |
| AI Citation Tracking | Missing | Set up free monitoring: |
| | | (1) Mention.com - track "Mark Gabrielli" + "markcmo.com" mentions across web |
| | | (2) Manual monthly check: ask ChatGPT "who are the best fractional CMOs" and log whether markcmo.com appears |
| | | (3) Brandwatch or Meltwater for enterprise Share of Model tracking (optional, paid) |
| Schema Validation | Post-deploy action | Validate all new schema at search.google.com/test/rich-results |

---

## DELIVERY NOTES

- All Python scripts are in the site root. Run order: `build_wave*.py` → `build_components.py` → `generate_sitemap.py` → `netlify deploy --prod --site 609d74ca-5f2a-4caa-aa7c-3f6922a7bcb4`
- Never edit HTML files directly - always edit the build scripts and regenerate
- robots.txt and llms.txt are static files in root - edit directly, no rebuild needed
- _headers and _redirects are Netlify config files in root - edit directly, no rebuild needed
- After every deploy, verify at: https://markcmo.com/robots.txt, https://markcmo.com/llms.txt, https://markcmo.com/sitemap.xml
- Validate schema at: https://search.google.com/test/rich-results
- Test fonts fix at: https://pagespeed.web.dev/analysis/https-markcmo-com/
