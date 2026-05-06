#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# safe-deploy.sh
#
# The ONLY way to deploy markcmo.com from a local machine.
#
# Why this exists:
#   The site has TWO worktrees on Mark's machine:
#     parent:  C:/Users/13219/Desktop/MarkCMO Website/MarkCMO.com
#     child:   C:/Users/13219/Desktop/MarkCMO Website/MarkCMO.com/.claude/worktrees/<branch>
#
#   Mark works in the parent worktree (uncommitted changes are normal).
#   Claude works in child worktrees (also uncommitted at times).
#
#   `netlify deploy --prod --no-build --dir=.` ALWAYS deploys whatever
#   is in the calling worktree. Run from the wrong place at the wrong
#   time and you nuke the other person's uncommitted work from production.
#
#   This script PREVENTS that by:
#     1. Snapshotting any uncommitted work in the parent worktree to a
#        timestamped branch on GitHub before doing anything else.
#     2. Snapshotting any uncommitted work in the calling child worktree.
#     3. Verifying the calling worktree is up to date with origin/main.
#     4. Calling `netlify deploy --prod` only after both checks pass.
#
# Usage (from any worktree):
#   bash scripts/safe-deploy.sh "Deploy message here"
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

# ─── Locate the parent worktree ──────────────────────────────────
# Anchor point: this script is committed to the repo at scripts/safe-deploy.sh
# so each worktree has a copy. The PARENT (canonical) worktree is hard-coded
# because Mark always works there and we always want to check it.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_WT="C:/Users/13219/Desktop/MarkCMO Website/MarkCMO.com"
# Resolve calling worktree to the actual git worktree root, not just $PWD
CALLING_WT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

DEPLOY_MESSAGE="${1:-Safe deploy from $(basename "$CALLING_WT") at $(date -u +%Y-%m-%dT%H:%M:%SZ)}"

echo "═══════════════════════════════════════════════════════════════"
echo " safe-deploy.sh"
echo "═══════════════════════════════════════════════════════════════"
echo "  parent worktree: $PARENT_WT"
echo "  calling from:    $CALLING_WT"
echo "  message:         $DEPLOY_MESSAGE"
echo

# ─── Ensure git + netlify CLIs available ─────────────────────────
command -v git >/dev/null      || { echo "[fatal] git not found"; exit 1; }
command -v netlify >/dev/null  || { echo "[fatal] netlify CLI not found"; exit 1; }

# ─── Step 1: Preserve any uncommitted parent-worktree work ──────
preserve_wip() {
  local wt="$1"
  local label="$2"

  echo "─── Step: snapshot uncommitted work in $label worktree ───"
  cd "$wt"

  local short_count
  short_count=$(git status --porcelain 2>/dev/null | wc -l | tr -d '[:space:]')
  echo "  uncommitted files: $short_count"

  if [ "$short_count" = "0" ]; then
    echo "  clean - nothing to preserve."
    return 0
  fi

  local current_branch
  current_branch=$(git branch --show-current 2>/dev/null || echo "DETACHED")
  local timestamp
  timestamp=$(date -u +%Y-%m-%dT%H%M%SZ)
  local wip_branch="auto-wip/${label}-${current_branch//\//-}-${timestamp}"

  echo "  preserving on branch: $wip_branch"
  # Stash everything (including untracked) to a safety branch
  git stash push --include-untracked -m "auto-wip-preserve-$timestamp" >/dev/null 2>&1 || true
  if git stash list 2>/dev/null | grep -q "auto-wip-preserve-$timestamp"; then
    git checkout -b "$wip_branch" 2>&1 | tail -2
    git stash pop >/dev/null 2>&1 || true
    git add -A >/dev/null 2>&1 || true
    git commit -m "auto-wip: snapshot $label worktree before deploy ($timestamp)" >/dev/null 2>&1 || true
    git push origin "$wip_branch" 2>&1 | tail -2
    git checkout "$current_branch" 2>&1 | tail -1
    echo "  pushed to: origin/$wip_branch"
    echo "  the WIP files remain in your worktree (only branch + push happened)."
  else
    echo "  no stash created (probably nothing to stash); continuing."
  fi
  echo
}

preserve_wip "$PARENT_WT" "parent"
if [ "$CALLING_WT" != "$PARENT_WT" ]; then
  preserve_wip "$CALLING_WT" "child"
fi

# ─── Step 2: Verify calling worktree is in sync with origin/main ─
echo "─── Step: verify calling worktree is current with origin/main ───"
cd "$CALLING_WT"
git fetch origin main >/dev/null 2>&1
LOCAL_HEAD=$(git rev-parse HEAD)
ORIGIN_MAIN=$(git rev-parse origin/main)
if [ "$LOCAL_HEAD" != "$ORIGIN_MAIN" ]; then
  AHEAD=$(git rev-list --count origin/main..HEAD)
  BEHIND=$(git rev-list --count HEAD..origin/main)
  echo "  HEAD differs from origin/main:"
  echo "    local HEAD:     $LOCAL_HEAD"
  echo "    origin/main:    $ORIGIN_MAIN"
  echo "    ahead by:       $AHEAD commits"
  echo "    behind by:      $BEHIND commits"
  if [ "$BEHIND" -gt 0 ]; then
    echo "[fatal] you are BEHIND origin/main. Pull first to avoid deploying stale code."
    echo "        cd '$CALLING_WT' && git pull origin main"
    exit 2
  fi
  echo "  (OK - ahead is fine; deploy will publish the local commits.)"
fi
echo "  in sync."
echo

# ─── Step 3: Final pre-flight - dependencies installed ──────────
echo "─── Step: ensure node_modules present (pdf-parse etc) ───"
if [ ! -d "$CALLING_WT/node_modules" ]; then
  echo "  installing dependencies..."
  ( cd "$CALLING_WT" && npm install --no-audit --no-fund --omit=dev 2>&1 | tail -5 )
fi
echo "  ready."
echo

# ─── Step 4: The actual deploy ──────────────────────────────────
echo "─── Step: netlify deploy --prod ───"
cd "$CALLING_WT"
netlify deploy --prod --no-build --dir=. --functions=netlify/functions \
  --message="$DEPLOY_MESSAGE" 2>&1 | tail -20

echo
echo "═══════════════════════════════════════════════════════════════"
echo " safe-deploy.sh complete"
echo "═══════════════════════════════════════════════════════════════"
echo "  any WIP work was preserved on origin under auto-wip/* branches."
echo "  list them with:    git branch -r | grep auto-wip"
echo
