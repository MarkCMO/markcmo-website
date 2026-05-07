#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# verify-locked-files.sh
#
# Pre-deploy sanity check for the LOCKED files listed in
# CLAUDE.md RULE #-2. Run before any deploy to catch accidental
# deletions / shrinks of admin.html / backend functions.
#
# Exits 0 if everything is intact, 1 if anything is missing or
# admin.html is suspiciously small.
#
# Usage:
#   bash scripts/verify-locked-files.sh
# ═══════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

ADMIN_MIN_SIZE=500000  # admin.html should be at least 500 KB (rich version is ~525 KB)
LOCKED_FUNCTIONS=(
  submit-engagement-doc execute-engagement-doc send-engagement-proposal-email
  square-invoice-action square-invoice-sync square-webhook square-webhook-register
  engagement-payment-followups _lib_payment_apply _lib_supabase _lib_square
  calendly-webhook calendly-sync-history
  send-template-email resend-webhook
  admin-engagement-data admin-mc-write admin-auth admin-data admin-links admin-upload
  update-client client-portal-data
  admin-blog public-blog
  track pay
  course-enroll generate-engagement-docs get-document submit-document execute-document
)
LOCKED_HTML=( admin.html portal/index.html blog-post.html )

errors=0

# admin.html size check
if [ ! -f admin.html ]; then
  echo "[fatal] admin.html is missing"
  errors=$((errors + 1))
else
  size=$(stat -c "%s" admin.html 2>/dev/null || stat -f "%z" admin.html)
  if [ "$size" -lt "$ADMIN_MIN_SIZE" ]; then
    echo "[fatal] admin.html is $size bytes (below $ADMIN_MIN_SIZE minimum). Has someone deleted features?"
    errors=$((errors + 1))
  else
    echo "  ok   admin.html ($size bytes)"
  fi
fi

# HTML files
for f in "${LOCKED_HTML[@]}"; do
  if [ "$f" = "admin.html" ]; then continue; fi
  if [ ! -f "$f" ]; then
    echo "[fatal] $f is missing"
    errors=$((errors + 1))
  else
    echo "  ok   $f"
  fi
done

# Netlify functions
for fn in "${LOCKED_FUNCTIONS[@]}"; do
  if [ ! -f "netlify/functions/$fn.js" ]; then
    echo "[fatal] netlify/functions/$fn.js is missing"
    errors=$((errors + 1))
  fi
done

if [ $errors -gt 0 ]; then
  echo
  echo "═══════════════════════════════════════════════════════════════"
  echo " $errors locked-file violations. See CLAUDE.md RULE #-2."
  echo " To recover: git log --all --oneline -- admin.html | head -5"
  echo "             git checkout <good-commit> -- admin.html netlify/functions/"
  echo "═══════════════════════════════════════════════════════════════"
  exit 1
fi

echo
echo "  all locked files intact (${#LOCKED_FUNCTIONS[@]} functions + ${#LOCKED_HTML[@]} html files + admin.html)"
exit 0
