#!/usr/bin/env bash
# cf-env-migrate.sh
# Copies all Netlify production env vars → Cloudflare Pages project (as secrets).
#
# BEFORE RUNNING:
#   1. export CLOUDFLARE_API_TOKEN=your_cf_api_token
#   2. Confirm CF Pages project name below matches what you created in the CF dashboard
#   3. Run: bash scripts/cf-env-migrate.sh
#
# The script reads each value live from Netlify and pipes it to `wrangler secret put`
# so values are never written to disk or this transcript.

CF_PROJECT="markcmo"   # must match wrangler.toml name

VARS=(
  ADMIN_EMAIL
  ADMIN_PASS
  ADMIN_SECRET
  ADMIN_SESSION_SECRET
  ADMIN_USER
  ADMIN_USERS
  ANTHROPIC_API_KEY
  CALENDLY_API_TOKEN
  CALENDLY_SIGNING_KEY
  ELEVENLABS_API_KEY
  EMAIL_ADMIN_SECRET
  GEMINI_API_KEY
  HUNTER_API_KEY
  JSONBIN_API_KEY
  JSONBIN_BIN_ID
  JSONBIN_DOCS_BIN_ID
  JSONBIN_DRIP_BIN_ID
  JSONBIN_ENROLLMENTS_BIN_ID
  JSONBIN_FOUNDING_BIN_ID
  JSONBIN_GRADS_BIN_ID
  JSONBIN_NOTIFY_BIN_ID
  JSONBIN_VOTES_BIN_ID
  MARKCMO_ADMIN_API_TOKEN
  MARKCMO_SUPABASE_SERVICE_KEY
  MARKCMO_SUPABASE_URL
  MISTRAL_API_KEY
  NETLIFY_TOKEN
  NOTIFY_EMAIL
  RESEND_API_KEY
  RESEND_FROM
  RESEND_WEBHOOK_SECRET
  SQUARE_ACCESS_TOKEN
  SQUARE_ENV
  SQUARE_LOCATION_ID
  SQUARE_WEBHOOK_SIGNATURE_KEY
  SUPABASE_SERVICE_KEY
  SUPABASE_URL
  TMDB_API_KEY
  TOKEN_SECRET
  WEBINAR_RESEND_KEY
  WEBINAR_RESEND_KEY
)

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "ERROR: CLOUDFLARE_API_TOKEN is not set."
  echo "  Get one at https://dash.cloudflare.com/profile/api-tokens"
  echo "  Needs: Cloudflare Pages:Edit permission"
  exit 1
fi

echo "Migrating ${#VARS[@]} env vars from Netlify → Cloudflare Pages project '$CF_PROJECT'"
echo ""

OK=0; FAIL=0
for VAR in "${VARS[@]}"; do
  # Get value from Netlify (suppresses the interactive prompt via --context production)
  VALUE=$(netlify env:get "$VAR" --context production 2>/dev/null | tail -1)
  if [ -z "$VALUE" ]; then
    echo "  SKIP  $VAR  (not set in Netlify production)"
    continue
  fi
  # Pipe value to wrangler - never stored in a variable visible in logs
  echo -n "$VALUE" | npx wrangler pages secret put "$VAR" \
    --project-name "$CF_PROJECT" \
    --stdin 2>&1 | grep -v "^>" | tail -1
  if [ $? -eq 0 ]; then
    echo "  OK    $VAR"
    OK=$((OK+1))
  else
    echo "  FAIL  $VAR"
    FAIL=$((FAIL+1))
  fi
done

echo ""
echo "Done: $OK set, $FAIL failed"
echo ""
echo "REMEMBER: Set ANTHROPIC_API_KEY manually if not in Netlify:"
echo "  echo -n 'sk-ant-...' | npx wrangler pages secret put ANTHROPIC_API_KEY --project-name $CF_PROJECT --stdin"
