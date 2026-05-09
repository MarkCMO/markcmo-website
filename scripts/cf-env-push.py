#!/usr/bin/env python3
"""
cf-env-push.py
Reads all env vars from Netlify production and pushes them to CF Pages
via the Cloudflare REST API (PATCH /pages/projects/{name}).
All values are stored as secret_text (encrypted at rest).
"""
import json
import os
import subprocess
import sys
import urllib.request
import urllib.error

ACCOUNT_ID   = "5b4ea6b5589fe12f29bea5d7e43fe03c"
PROJECT_NAME = "markcmo"
CF_KEY       = os.environ["CLOUDFLARE_API_KEY"]
CF_EMAIL     = os.environ["CLOUDFLARE_EMAIL"]

VARS = [
    "ADMIN_EMAIL", "ADMIN_PASS", "ADMIN_SECRET", "ADMIN_SESSION_SECRET",
    "ADMIN_USER", "ADMIN_USERS", "CALENDLY_API_TOKEN", "CALENDLY_SIGNING_KEY",
    "ELEVENLABS_API_KEY", "EMAIL_ADMIN_SECRET", "GEMINI_API_KEY", "HUNTER_API_KEY",
    "JSONBIN_API_KEY", "JSONBIN_BIN_ID", "JSONBIN_DOCS_BIN_ID", "JSONBIN_DRIP_BIN_ID",
    "JSONBIN_ENROLLMENTS_BIN_ID", "JSONBIN_FOUNDING_BIN_ID", "JSONBIN_GRADS_BIN_ID",
    "JSONBIN_NOTIFY_BIN_ID", "JSONBIN_VOTES_BIN_ID", "MARKCMO_ADMIN_API_TOKEN",
    "MARKCMO_SUPABASE_SERVICE_KEY", "MARKCMO_SUPABASE_URL", "MISTRAL_API_KEY",
    "NETLIFY_TOKEN", "NOTIFY_EMAIL", "RESEND_API_KEY", "RESEND_FROM",
    "RESEND_WEBHOOK_SECRET", "SQUARE_ACCESS_TOKEN", "SQUARE_ENV",
    "SQUARE_LOCATION_ID", "SQUARE_WEBHOOK_SIGNATURE_KEY", "SUPABASE_SERVICE_KEY",
    "SUPABASE_URL", "TMDB_API_KEY", "TOKEN_SECRET", "WEBINAR_RESEND_KEY",
]

# --- 1. Collect values from Netlify ---
print("Fetching env vars from Netlify...")
env_vars = {}
skipped  = []
for var in VARS:
    result = subprocess.run(
        f'netlify env:get {var} --context production',
        capture_output=True, text=True, shell=True
    )
    value = result.stdout.strip().splitlines()[-1] if result.stdout.strip() else ""
    if not value:
        skipped.append(var)
        print(f"  SKIP  {var}")
    else:
        env_vars[var] = value
        print(f"  GOT   {var}")

print(f"\n{len(env_vars)} vars collected, {len(skipped)} skipped: {skipped}\n")

if not env_vars:
    print("Nothing to push. Exiting.")
    sys.exit(0)

# --- 2. Build CF API payload ---
secret_entries = {k: {"value": v, "type": "secret_text"} for k, v in env_vars.items()}
payload = json.dumps({
    "deployment_configs": {
        "production": {"env_vars": secret_entries},
        "preview":    {"env_vars": secret_entries},
    }
}).encode()

# --- 3. PATCH the Pages project ---
url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/pages/projects/{PROJECT_NAME}"
req = urllib.request.Request(
    url,
    data=payload,
    method="PATCH",
    headers={
        "Content-Type":  "application/json",
        "X-Auth-Key":    CF_KEY,
        "X-Auth-Email":  CF_EMAIL,
    }
)

print(f"Pushing {len(env_vars)} secrets to CF Pages project '{PROJECT_NAME}'...")
try:
    with urllib.request.urlopen(req) as resp:
        body = json.loads(resp.read())
        if body.get("success"):
            print(f"\n✅  All {len(env_vars)} vars set successfully in production + preview environments.")
        else:
            print(f"\n❌  API returned success=false:\n{json.dumps(body, indent=2)}")
            sys.exit(1)
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"\n❌  HTTP {e.code}:\n{body}")
    sys.exit(1)
