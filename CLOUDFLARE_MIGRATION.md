# Cloudflare Migration — markcmo.com

Status: **code-complete**, awaiting Cloudflare Pages auto-deploy to land the latest commits.

## What changed (vs. Netlify)

### 1. Inter-function fetch → in-process `require()+invoke`

Cloudflare Pages returns **HTTP 405** when a function `fetch()`-es another
function on the same zone (`/.netlify/functions/X`). All same-zone
loopback calls now `require()` the target handler and invoke it directly.
No network hop, no CORS preflight, no method-routing surprises.

Files patched:

- `netlify/functions/_wetyr_jobs.js` — generic `kickoffJob()` helper used
  by 8 of the 9 WETYR Studio kickoffs (schedule, budget, callsheet,
  shotlist, orders, locations, safety, post)
- `netlify/functions/script-dissect.js` — own kickoff (was hand-rolled)
- `netlify/functions/execute-engagement-doc.js` — calls
  `square-invoice-action` to auto-create draft invoice

### 2. Netlify Blobs → Supabase shim

`@netlify/blobs` doesn't work on Cloudflare. New
`netlify/functions/_blobs_shim.js` exports a drop-in `getStore({ name })`
backed by a Supabase `kv_store` table. Five files migrated transparently
(no API changes):

- `admin-upload.js`
- `film-rolodex.js`
- `film-rolodex-cron.js`
- `film-rolodex-deep-cron.js`
- `film-rolodex-import.js`

Supabase table:

```sql
CREATE TABLE kv_store (
  store_name TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB,
  raw_text TEXT,
  metadata JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (store_name, key)
);
CREATE INDEX kv_store_prefix_idx ON kv_store (store_name, key text_pattern_ops);
ALTER TABLE kv_store ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service-only" ON kv_store FOR ALL USING (false) WITH CHECK (false);
```

The shim uses Supabase's REST API with `SUPABASE_URL` +
`SUPABASE_SERVICE_KEY` (already configured for WETYR Studio jobs).

### 3. `wrangler.toml` (replaces `netlify.toml`)

- Pages project `markcmo`
- `compatibility_flags = ["nodejs_compat"]` (mandatory for `require()` etc)
- `pages_build_output_dir = "."`
- `[vars]` block exposes `SITE_URL`, `URL`, `NODE_ENV` (replaces what
  Netlify auto-injected)
- `[triggers] crons = [...]` mirrors the 4 Netlify schedules

### 4. Cron worker (fallback for scheduled functions)

Cloudflare Pages does NOT reliably support cron triggers on Pages
Functions. A separate Worker (`cloudflare/cron-worker.{js,toml}`)
fan-outs to function URLs on each tick.

Mapped functions (mirrors `netlify.toml`):

| Cron | Function(s) |
|---|---|
| `0 * * * *` (hourly) | `email-drip` |
| `0 */6 * * *` (every 6h) | `engagement-payment-followups`, `film-rolodex-cron` |
| `0 9 * * *` (daily 09:00 UTC) | `film-rolodex-deep-cron` |

Deploy:

```sh
wrangler deploy --config cloudflare/cron-worker.toml
wrangler secret put CRON_SHARED_SECRET --config cloudflare/cron-worker.toml
# Set the SAME value as a Pages secret too:
wrangler pages secret put CRON_SHARED_SECRET --project-name=markcmo
```

The Pages-side functions can verify
`headers['x-cron-secret'] === env.CRON_SHARED_SECRET` to reject
unauthenticated cron calls.

### 5. `package.json` cleanup

- Removed `@netlify/blobs` (root + `netlify/functions/`)
- Kept `pdf-parse` (needed by `script-upload.js`)

## What still works unchanged

- `_redirects` — Cloudflare Pages reads this format (with minor caveats:
  no `Access-Control-Allow-*` headers via `_redirects`; use `_headers`
  for those — already in place)
- `_headers` — works as-is on Cloudflare Pages
- All `event.headers.host` / `event.headers.cookie` reads — Cloudflare
  Pages Functions provide these
- All Netlify-style `exports.handler = async (event) => { ... }` — works
  via Cloudflare's built-in Netlify compatibility
- `/.netlify/functions/<name>` URLs — Cloudflare Pages auto-routes them
  to `netlify/functions/<name>.js`

## Required Cloudflare Pages secrets (set via dashboard or wrangler)

Critical for WETYR Studio + admin:

```
GEMINI_API_KEY              # Studio AI engine
MISTRAL_API_KEY             # PDF OCR fallback
TMDB_API_KEY                # Film Intel dashboard
SUPABASE_URL                # primary Supabase (wetyr_jobs, kv_store)
SUPABASE_SERVICE_KEY        # primary Supabase service role
ADMIN_USERS                 # JSON array of {user, pass}
ADMIN_USER, ADMIN_PASS      # legacy single-admin fallback
ADMIN_SESSION_SECRET        # HMAC for session cookies
TOKEN_SECRET                # legacy HMAC alias
EMAIL_ADMIN_SECRET          # email admin endpoints
RESEND_API_KEY              # transactional email
WEBINAR_RESEND_KEY          # webinar email (separate sender)
NOTIFY_EMAIL                # admin notification target
```

Engagement pipeline:

```
MARKCMO_SUPABASE_URL        # second Supabase project (engagement docs)
MARKCMO_SUPABASE_SERVICE_KEY
SQUARE_ACCESS_TOKEN
SQUARE_LOCATION_ID
SQUARE_APPLICATION_ID
SQUARE_ENV                  # production | sandbox
SQUARE_PLAN_VARIATION_PREMIUM
SQUARE_PLAN_VARIATION_ELITE
SQUARE_PLAN_VARIATION_SPONSOR
SQUARE_WEBHOOK_SIGNATURE_KEY
CALENDLY_SIGNING_KEY
MARKCMO_ADMIN_API_TOKEN
```

JSONBin (legacy, used by some flows):

```
JSONBIN_API_KEY
JSONBIN_LINKS_BIN_ID
JSONBIN_ENROLLMENTS_BIN_ID
JSONBIN_GRADS_BIN_ID
JSONBIN_INTL_BIN_ID
JSONBIN_FOUNDING_BIN_ID
JSONBIN_LESSON_CACHE_BIN_ID
JSONBIN_VOTES_BIN_ID
JSONBIN_DRIP_BIN_ID
JSONBIN_DOCS_BIN_ID
JSONBIN_BIN_ID
```

Other:

```
ELEVENLABS_API_KEY          # voice generation
CRON_SHARED_SECRET          # auth for cron-worker fan-out (set on BOTH cron worker AND Pages project)
```

## Deploy steps (when ready)

```sh
# 1. Authenticate
wrangler login                        # or set CLOUDFLARE_API_TOKEN env var

# 2. Pages project (creates if needed)
wrangler pages project create markcmo --production-branch=main || true

# 3. Set secrets (one at a time - copy from Netlify dashboard, paste here)
for s in GEMINI_API_KEY MISTRAL_API_KEY TMDB_API_KEY SUPABASE_URL SUPABASE_SERVICE_KEY \
         ADMIN_USERS ADMIN_USER ADMIN_PASS ADMIN_SESSION_SECRET TOKEN_SECRET EMAIL_ADMIN_SECRET \
         RESEND_API_KEY WEBINAR_RESEND_KEY NOTIFY_EMAIL \
         MARKCMO_SUPABASE_URL MARKCMO_SUPABASE_SERVICE_KEY \
         SQUARE_ACCESS_TOKEN SQUARE_LOCATION_ID SQUARE_APPLICATION_ID SQUARE_ENV \
         SQUARE_PLAN_VARIATION_PREMIUM SQUARE_PLAN_VARIATION_ELITE SQUARE_PLAN_VARIATION_SPONSOR \
         SQUARE_WEBHOOK_SIGNATURE_KEY CALENDLY_SIGNING_KEY MARKCMO_ADMIN_API_TOKEN \
         JSONBIN_API_KEY JSONBIN_LINKS_BIN_ID JSONBIN_ENROLLMENTS_BIN_ID JSONBIN_GRADS_BIN_ID \
         JSONBIN_INTL_BIN_ID JSONBIN_FOUNDING_BIN_ID JSONBIN_LESSON_CACHE_BIN_ID \
         JSONBIN_VOTES_BIN_ID JSONBIN_DRIP_BIN_ID JSONBIN_DOCS_BIN_ID JSONBIN_BIN_ID \
         ELEVENLABS_API_KEY CRON_SHARED_SECRET; do
  wrangler pages secret put $s --project-name=markcmo
done

# 4. Deploy Pages
wrangler pages deploy . --project-name=markcmo

# 5. Deploy cron worker
wrangler deploy --config cloudflare/cron-worker.toml
wrangler secret put CRON_SHARED_SECRET --config cloudflare/cron-worker.toml

# 6. Verify
curl -X POST https://markcmo.com/.netlify/functions/script-dissect \
  -H 'content-type: application/json' \
  -d '{"scriptText":"INT. ROOM - DAY\nMan stands.\nFADE OUT.","title":"smoke"}'
# Expected: HTTP 202 with {"ok":true,"jobId":"...","status":"processing"}
# NOT: HTTP 500 with "Background trigger failed: HTTP 405"
```

## What's intentionally NOT done

- **No `functions/[[path]].js` catch-all router** — Cloudflare Pages
  has built-in Netlify-compat for `/.netlify/functions/*` paths, and
  all our client code uses those URLs. Adding a custom router would
  duplicate work and risk regressions.
- **No KV namespace migration** — we use Supabase for blobs (already
  configured, easier to query, RLS, and migrations). KV would be
  faster but isn't needed.

## Smoke test checklist (run after deploy)

- [ ] `GET /` returns 200, latest HTML
- [ ] `GET /wetyr-films` returns 200, has admin/public split
- [ ] `GET /wetyr-studio` returns 200, has Master Workflow tab
- [ ] `POST /.netlify/functions/admin-auth?action=verify` (no cookie) → 401
- [ ] `POST /.netlify/functions/script-dissect` with sample script → 202 + jobId
- [ ] Wait 60s, `GET /.netlify/functions/script-result?jobId=X` → status: complete
- [ ] `GET /.netlify/functions/script-jobs?limit=5` (admin auth required) → 401 or list
- [ ] `GET /.netlify/functions/film-rolodex?action=list` (admin auth required) → 401 or rolodex
- [ ] Cron worker manually fires: `wrangler tail --config cloudflare/cron-worker.toml` shows `cron 0 * * * * -> email-drip: 200`
