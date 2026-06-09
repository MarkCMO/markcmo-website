# Cirilo Design + Build , SEO + AI Search Setup

What is now built into the site, and the few manual steps to finish.

---

## 1. What is now LIVE in the build (automatic, every deploy)

Built into `scripts/build.js`, regenerated on every `node scripts/build.js`:

- **`/robots.txt`** , public pages open, private app surfaces (admin, portal, proposal, vendors) closed, and 60+ AI/search crawlers explicitly welcomed by name: GPTBot, OAI-SearchBot, ClaudeBot, anthropic-ai, PerplexityBot, Google-Extended, GoogleOther, Applebot-Extended, Bingbot, Amazonbot, Bytespider, CCBot, cohere-ai, DuckAssistBot, YouBot, MistralAI-User, AI2Bot, Diffbot, PetalBot, YandexBot, and more.
- **`/sitemap.xml`** , every public page (currently ~395 URLs) with lastmod, auto-collected.
- **`/llms.txt`** , curated, machine-readable map of services, all 15 guides, and key company pages, for ChatGPT, Perplexity, Claude, Gemini, and Copilot to ground answers in Cirilo's own words. (This is the emerging llmstxt.org standard.)
- **`/llms-full.txt`** , the complete content index, all ~395 pages with descriptions.
- **`/ai.txt`** , a plain AI-usage policy welcoming citation, with contact and content-map pointers.
- **IndexNow key file** (`/c1r110d8a7e94f2b8d6c0e5f3a1b9c7d.txt`) , enables instant indexing on Bing, Yandex, Seznam, and Naver.
- **LocalBusiness JSON-LD** on every page , Organization + GeneralContractor with NAP, geo, areaServed (Charlotte + NC), contactPoint, and a `knowsAbout` list of every service and guide topic. This is what makes Cirilo a recognizable entity to Google rich results and to LLMs.

After a deploy, confirm these resolve:
`/robots.txt` , `/llms.txt` , `/llms-full.txt` , `/ai.txt` , `/sitemap.xml` , `/c1r110d8a7e94f2b8d6c0e5f3a1b9c7d.txt`

---

## 2. IMPORTANT: confirm the production domain first

All of the above (sitemap URLs, canonicals, llms.txt links) now point to **`https://cirilodb.com`**.

Before submitting to Google or Bing, do ONE of these:
- **Point `cirilodb.com` at this Cloudflare Pages project** (so those URLs actually serve), OR
- **Tell Mark/Claude the final production domain.** It is a one-line change. The build reads an env var:
  ```
  CDB_SITE_URL=https://yournewdomain.com node scripts/build.js
  ```
  (or change the `SITE` default in `scripts/build.js`). Everything , robots, sitemap, llms, schema , re-points automatically.

Do not submit a sitemap of `cirilodb.com` URLs while the site only lives on `cirilodb-rebuild.pages.dev`, or the URLs will 404 in Search Console.

---

## 3. Google Search Console (GSC) , do once

1. Go to **search.google.com/search-console** and add a property.
   - Best: **Domain property** (verify by adding one TXT record at the domain registrar). Covers http, https, www, and all subdomains.
   - Or: **URL-prefix property** for the exact production URL.
2. **Verify.** If you want the HTML-file method, set the token before building and redeploy:
   ```
   CDB_GSC_TOKEN=abc123yourtoken node scripts/build.js
   ```
   This writes `/google<token>.html` into the site automatically.
3. **Submit the sitemap:** in GSC, Sitemaps, enter `sitemap.xml`.
4. **Request indexing** for the homepage, the 4 service pages, and the `/guides/` hub to prime the crawl.

---

## 4. Bing Webmaster Tools + IndexNow , do once

1. Go to **bing.com/webmasters**. Add the site. Fastest verification: **Import from Google Search Console** (one click once GSC is set). Or set a token and redeploy:
   ```
   CDB_BING_TOKEN=yourbingtoken node scripts/build.js
   ```
   (writes `/BingSiteAuth.xml`).
2. Submit `sitemap.xml`.
3. **IndexNow** is already wired. Two ways to use it:
   - **Automatic:** in the Cloudflare dashboard for this site, enable Crawler Hints / IndexNow. Cloudflare will detect the key file and notify search engines on changes.
   - **Manual after a deploy:** `node scripts/indexnow-submit.js` , pushes every sitemap URL to IndexNow in one shot.

---

## 5. AI answer engines (ChatGPT, Perplexity, Gemini, Claude, Copilot)

No portal to submit to. They earn citations from crawlable, well-structured, authoritative content, which is now in place:
- `llms.txt` + `llms-full.txt` give them a clean content map.
- The 15 authority guides are answer-first with FAQ schema (the format LLMs quote).
- LocalBusiness schema + `knowsAbout` makes Cirilo a clear entity.
- robots.txt explicitly invites their crawlers.

To strengthen AI citations further (off-site, ongoing):
- Keep the **Google Business Profile** accurate (name, address, phone, primary category "Swimming Pool Contractor", service areas). LLMs lean heavily on it for local answers.
- Get listed and reviewed on directories LLMs trust (Houzz, Google reviews, Yelp, BBB). Volume and consistency of NAP across the web is what makes the entity "real" to an LLM.

---

## 6. Quick reference

| Item | Value |
|---|---|
| Build | `node scripts/build.js` (regenerates everything above) |
| Deploy | `node scripts/build.js && npx wrangler pages deploy ./dist --project-name=cirilodb-rebuild --branch=main --commit-dirty=true` |
| IndexNow ping | `node scripts/indexnow-submit.js` (after deploy) |
| IndexNow key | `c1r110d8a7e94f2b8d6c0e5f3a1b9c7d` |
| Set domain | `CDB_SITE_URL=https://... node scripts/build.js` |
| GSC verify file | `CDB_GSC_TOKEN=... node scripts/build.js` |
| Bing verify file | `CDB_BING_TOKEN=... node scripts/build.js` |
