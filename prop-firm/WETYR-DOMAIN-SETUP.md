# WETYR Arena on wetyr.com: domain + deploy setup

Decision: WETYR Arena lives on **its own domain, wetyr.com**, kept off markcmo.com (brand + legal
separation). This is the one-time setup to make `https://wetyr.com/arena/` live. Arena is static, so
this is a plain Cloudflare Pages static deploy (no KV, no functions needed for the public pages).

## Already done in the repo (no action needed)

- Arena is now **excluded from the markcmo.com deploy** (`scripts/upload-html-to-kv.js` SKIP_DIRS +
  `build-dist.js` whitelist never included it). It will not appear on markcmo.com.
- A dedicated deploy workflow `.github/workflows/deploy-wetyr.yml` builds `arena/` + `wetyr-static/`
  + favicons into `wetyr-dist/` and `wrangler pages deploy`s to a Cloudflare Pages project named
  **wetyr**. Triggers on push to `main` when `arena/**` changes, or via "Run workflow" (manual).
- `wetyr-static/index.html` (root redirect to /arena/) and `wetyr-static/robots.txt` (disallows the
  private app/admin paths, points at the sitemap).
- All arena pages already canonicalize to `https://wetyr.com/arena/` with OG/Twitter/JSON-LD.

## What you do once (Cloudflare dashboard + DNS)

1. **Make sure wetyr.com is on Cloudflare.** Cloudflare dashboard -> is `wetyr.com` listed as a
   zone? If not, add the site (Add a site -> wetyr.com) and change the nameservers at your registrar
   to the two Cloudflare nameservers it gives you. Wait for "Active".

2. **Create the Pages project + first deploy.** Easiest path: after this branch is on `main`, run the
   workflow once (GitHub -> Actions -> "Deploy WETYR Arena (wetyr.com)" -> Run workflow). `wrangler`
   creates the **wetyr** project automatically and deploys, giving you a `https://wetyr.pages.dev`
   URL. Open `https://wetyr.pages.dev/arena/` to confirm it serves.
   - If the run fails on permissions, the repo's `CLOUDFLARE_API_TOKEN` secret needs **Account ->
     Cloudflare Pages -> Edit** scope (the same token markcmo deploy uses; broaden it if it is
     project-scoped to markcmo only).

3. **Attach the custom domain.** Cloudflare dashboard -> Workers & Pages -> **wetyr** -> Custom
   domains -> Set up a custom domain -> `wetyr.com` (and optionally `www.wetyr.com`). Because the
   zone is on Cloudflare, it auto-creates the CNAME and provisions SSL. wetyr.com now serves the
   project; `/` redirects to `/arena/`.

4. **Verify:** `https://wetyr.com/arena/` loads, `https://wetyr.com/favicon.svg` and
   `https://wetyr.com/arena/sitemap.xml` resolve, and `https://wetyr.com/arena/app/` (the simulator)
   works.

## Then: indexing (see GO-LIVE.md section 8)

5. Export `arena/og.svg` -> `arena/og.jpg` (1200x630) so social cards render.
6. Add wetyr.com to **Google Search Console** + **Bing Webmaster**, submit
   `https://wetyr.com/arena/sitemap.xml`, request indexing for `/arena/`.
7. Run the funnel through Google's Rich Results Test (FAQ), the Facebook Sharing Debugger, and the
   Twitter Card Validator.

## Notes

- This is a **soft launch**: funnel + simulator are fully public and indexable; signup/claim are in
  test mode until the backend wiring (Supabase + Square sandbox, see GO-LIVE.md steps 1-2). No real
  money flows yet, which is also why launching on wetyr.com now (vs the markcmo brand) is low-risk.
- Deploy is `git push origin main` (the live pipeline), NOT `safe-deploy.sh` (the stale Netlify path
  in CLAUDE.md RULE #1). The push triggers both the markcmo deploy (now arena-free) and this wetyr
  deploy.
- No em-dashes or en-dashes anywhere (CLAUDE.md RULE #3).
