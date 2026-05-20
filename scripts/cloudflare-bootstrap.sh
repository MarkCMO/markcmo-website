#!/usr/bin/env bash
set -euo pipefail
echo "=== Creating KV namespaces for markcmo ==="
wrangler kv namespace create "BLOBS_DOCUMENTS" 2>&1 | grep -E "id|binding" || true
echo "=== Done. Paste ID into wrangler.toml ==="
