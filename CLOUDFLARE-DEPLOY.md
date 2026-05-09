# Cloudflare Pages - Complete Deploy Guide

## What Was Migrated

| Item | Before | After |
|---|---|---|
| Hosting | Netlify | Cloudflare Pages |
| Functions | `netlify/functions/*.js` | Wrapped by `functions/[[path]].js` |
| Blobs/KV storage | Netlify Blobs | Supabase `kv_store` table (already done) |
| Scheduled jobs | Netlify cron | CF Pages cron triggers (wrangler.toml) |
| Redirects | `_redirects` (Netlify) | `_redirects` (CF Pages — same format) |
| Headers | `_headers` (Netlify) | `_headers` (CF Pages — same format) |
| Env vars | Netlify site settings | CF Pages secrets |

---

## Step 1 — Create the CF Pages Project

In the Cloudflare Dashboard:
1. Go to **Workers & Pages** → **Create application** → **Pages**
2. Connect to GitHub → select `MarkCMO/markcmo-website`
3. Settings:
   - **Project name**: `markcmo`
   - **Production branch**: `main`
   - **Build command**: *(leave blank — static site)*
   - **Build output directory**: `/` (root)
4. Click **Save and Deploy**

---

## Step 2 — Set All Environment Variables

Get a Cloudflare API token first:
- Go to https://dash.cloudflare.com/profile/api-tokens
- Create token with **Cloudflare Pages: Edit** permission

Then run the migration script (copies from Netlify automatically):

```bash
export CLOUDFLARE_API_TOKEN=your_token_here
bash scripts/cf-env-migrate.sh
```

If you need to set `ANTHROPIC_API_KEY` manually (not in Netlify):
```bash
echo -n "sk-ant-YOUR_KEY" | npx wrangler pages secret put ANTHROPIC_API_KEY \
  --project-name markcmo --stdin
```

---

## Step 3 — Verify Deployment

After deploy completes, test:

```bash
# Static pages
curl -I https://markcmo.com/fractional-cmo

# Functions
curl https://markcmo.com/.netlify/functions/founding-status
curl https://markcmo.com/.netlify/functions/public-blog
curl https://markcmo.com/.netlify/functions/course-enroll
curl https://markcmo.com/.netlify/functions/news-feed

# Auth-protected (should return 401)
curl https://markcmo.com/.netlify/functions/admin-blog

# Film rolodex cron (was 500, should now be 200)
curl https://markcmo.com/.netlify/functions/film-rolodex-cron
```

---

## Step 4 — Point Domain to Cloudflare Pages

In the CF Pages project settings:
1. **Custom domains** → Add `markcmo.com` and `www.markcmo.com`
2. CF will auto-create the DNS records (CNAME to `markcmo.pages.dev`)
3. Re-enable the www redirect in `_redirects` (already done in this commit)

---

## Step 5 — Disable Netlify

Once CF Pages is confirmed working:
1. In Netlify dashboard → Site settings → **Danger zone** → **Delete site** (or pause deploys)
2. Remove the Netlify site link: `netlify unlink`

---

## Architecture Notes

### Function Adapter
`functions/[[path]].js` is a CF Pages catch-all that:
- Receives any request that isn't a static file
- Routes `/.netlify/functions/<name>` to the matching handler in `netlify/functions/`
- Converts CF Pages request format ↔ Netlify event format
- Bridges `context.env` → `process.env` so all existing function code works unchanged

### Scheduled Functions
`functions/scheduled.js` + `wrangler.toml [triggers].crons` replace Netlify's scheduled functions:

| Schedule | Function |
|---|---|
| Every hour | `email-drip` |
| Every 6 hours | `engagement-payment-followups` + `film-rolodex-cron` |
| Daily 09:00 UTC | `film-rolodex-deep-cron` |

### Blobs / KV Storage
Already migrated to Supabase `kv_store` table via `netlify/functions/_blobs_shim.js`.
No action needed — works the same on CF as on Netlify.

### Env Vars Added to CF (not in Netlify)
- `ANTHROPIC_API_KEY` — set manually (see Step 2)
- `JSONBIN_NOTIFY_BIN_ID` — set to same value as `JSONBIN_BIN_ID` if not separate
