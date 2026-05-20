#!/usr/bin/env bash
set -euo pipefail
PAGES_PROJECT="${PAGES_PROJECT:-markcmo}"
SKIP_SET=0
[[ "${1:-}" == "--skip-set" ]] && SKIP_SET=1

ENV_VARS=(
  ADMIN_PASS
  ADMIN_SECRET
  ADMIN_SESSION_SECRET
  ADMIN_USER
  ADMIN_USERS
  ANTHROPIC_API_KEY
  CALENDLY_API_TOKEN
  CALENDLY_SIGNING_KEY
  GEMINI_API_KEY
  GEMINI_MODEL
  HUNTER_API_KEY
  JSONBIN_API_KEY
  JSONBIN_BIN_ID
  JSONBIN_ENROLLMENTS_BIN_ID
  JSONBIN_FOUNDING_BIN_ID
  JSONBIN_GRADS_BIN_ID
  JSONBIN_NOTIFY_BIN_ID
  JSONBIN_VOTES_BIN_ID
  MARKCMO_ADMIN_API_TOKEN
  MARKCMO_SUPABASE_SERVICE_KEY
  MARKCMO_SUPABASE_URL
  MISTRAL_API_KEY
  NETLIFY_API_TOKEN
  NETLIFY_AUTH_TOKEN
  NETLIFY_SITE_ID
  NETLIFY_TOKEN
  NOTIFY_EMAIL
  RESEND_API_KEY
  RESEND_WEBHOOK_SECRET
  SQUARE_ACCESS_TOKEN
  SQUARE_ENV
  SQUARE_LOCATION_ID
  SQUARE_WEBHOOK_SIGNATURE_KEY
  SUPABASE_SERVICE_KEY
  SUPABASE_URL
  TMDB_API_KEY
  TOKEN_SECRET
  WEBINAR_DATE
  WEBINAR_DISPLAY
  WEBINAR_END_DATE
  WEBINAR_LINK
  WEBINAR_RESEND_KEY
  WEBINAR_TIME
  WEBINAR_TITLE
  CRON_SHARED_SECRET
)

echo "=== Migrating ${#ENV_VARS[@]} env vars: Netlify -> Cloudflare Pages (${PAGES_PROJECT}) ==="
migrated=0; skipped=0; failed=0
for VAR in "${ENV_VARS[@]}"; do
  VALUE="$(netlify env:get "$VAR" 2>/dev/null || true)"
  if [[ -z "$VALUE" ]]; then echo "[skip] $VAR"; skipped=$((skipped+1)); continue; fi
  if [[ $SKIP_SET -eq 1 ]]; then echo "[would-set] $VAR (${#VALUE} chars)"; migrated=$((migrated+1)); continue; fi
  if printf '%s' "$VALUE" | wrangler pages secret put "$VAR" --project-name="$PAGES_PROJECT" >/dev/null 2>&1; then
    echo "[ok]   $VAR"; migrated=$((migrated+1))
  else echo "[FAIL] $VAR"; failed=$((failed+1)); fi
done
echo "=== Done: migrated=$migrated skipped=$skipped failed=$failed ==="
[[ $failed -gt 0 ]] && exit 2 || true
