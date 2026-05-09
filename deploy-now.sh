#!/usr/bin/env bash
# deploy-now.sh — one-shot Cloudflare Pages deploy for markcmo.com
#
# Usage:   bash deploy-now.sh
# First run will open a browser for OAuth (one-time login).
# All subsequent runs use cached credentials.

set -e

cd "$(dirname "$0")"

echo "═══════════════════════════════════════════════════════════"
echo "  MarkCMO → Cloudflare Pages deploy"
echo "═══════════════════════════════════════════════════════════"
echo

# 1. Check wrangler installed
if ! command -v wrangler >/dev/null 2>&1; then
  echo "ERROR: wrangler not installed. Install with:"
  echo "  npm install -g wrangler"
  exit 1
fi

# 2. Check auth (login if needed - opens browser ONCE)
echo "→ Verifying Cloudflare auth..."
if ! wrangler whoami >/dev/null 2>&1; then
  echo "  Not logged in. Opening browser for one-time OAuth..."
  wrangler login
fi
wrangler whoami | grep -E "^✔|email" | head -2

# 3. Show what's about to deploy
echo
echo "→ Latest commit:"
git log -1 --oneline

# 4. Make sure netlify/functions/ deps are installed (some functions need pdf-parse)
echo
echo "→ Installing function deps..."
( cd netlify/functions && npm install --silent 2>&1 | tail -3 ) || true

# 5. Deploy Pages
echo
echo "→ Deploying Pages..."
wrangler pages deploy . \
  --project-name=markcmo \
  --branch=main \
  --commit-dirty=true \
  2>&1 | tail -20

# 6. Smoke test
echo
echo "→ Sleeping 15s for edge propagation..."
sleep 15

echo
echo "→ Smoke test: script-dissect kickoff"
RESPONSE=$(curl -s -w "\n__HTTP__%{http_code}" -X POST "https://markcmo.com/.netlify/functions/script-dissect" \
  -H "content-type: application/json" \
  -d '{"scriptText":"INT. ROOM - DAY\n\nMan stands.\n\nFADE OUT.","title":"deploy-smoke"}')
HTTP=$(echo "$RESPONSE" | tail -1 | sed 's/__HTTP__//')
BODY=$(echo "$RESPONSE" | head -n -1)
echo "  HTTP $HTTP"
echo "  body: $BODY"
echo
if [ "$HTTP" = "202" ]; then
  echo "✅ DEPLOY SUCCESS — kickoff returns 202 + jobId"
elif echo "$BODY" | grep -q "Background trigger failed: HTTP 405"; then
  echo "❌ Old code still serving — deploy didn't propagate yet, OR there's a build cache."
  echo "   Wait 30s and re-run smoke test, OR check Pages dashboard for build status."
else
  echo "⚠ Unexpected response — check the body above."
fi
