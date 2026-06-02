# MarkCMO / WETYR Incident Response Playbook v1

Per WETYR Infrastructure Protocol v1 §8. When production breaks, follow this.

**Owner:** Mark Gabrielli — `mark@markcmo.com` / `+1 (321) 917-5738`

---

## Severity levels

| Level | Definition | Response time | Notify |
|---|---|---|---|
| **SEV1** | Production down for any property, payment processing broken, data breach suspected | Immediate, 24/7 | Mark by SMS + email |
| **SEV2** | Degraded service, single feature broken, monitoring alert sustained 15+ min | Within 1 hour during business hours | Mark by email |
| **SEV3** | Non-urgent bug, cosmetic issue, single user complaint | Within 1 business day | Standard ticket queue |

---

## Step 1 — Acknowledge (within 5 minutes for SEV1)

When an alert lands:

1. Open `/admin#ops` on `markcmo.com` → check health card colors and the stale-cron list.
2. Open Cloudflare Pages dashboard → confirm last deploy time, look for failed deploys.
3. Open `https://markcmo.com/health` and `https://academy.markcmo.com/health` directly. The JSON tells you which dependency is down (Square, Resend, JSONBin, KV).
4. If you can't reach the site at all, check `status.cloudflare.com`.

---

## Step 2 — Identify the failing property and component

Use the table on the Ops dashboard. Common patterns:

| Symptom | Likely cause | Where to look |
|---|---|---|
| `/health` returns 503 with `square: { ok: false }` | Square API outage or token rotated | `status.squareup.com` + verify `SQUARE_ACADEMY_ACCESS_TOKEN` env var |
| Webhook events not appearing in admin | Webhook signature key mismatch | Square Developer → Webhooks → check signature key matches `SQUARE_ACADEMY_WEBHOOK_SIGNATURE_KEY` env var |
| Customers report missing welcome email | Resend API rejecting OR enrollments not creating | `/admin#ops` Errors panel for `source=square-subscription-webhook` |
| Admin login doesn't work | Recent admin.html commit broke JS | `git log -- admin.html` for last commit, look for `<script>` tags inside template literals |
| `/checkout` page blank | Square Web Payments SDK CDN blocked | Test on different network. Verify `web.squarecdn.com/v1/square.js` loads |
| Customer says "I paid but I'm not enrolled" | Webhook didn't fire OR reconcile cron stale | `/admin#ops` Webhook Events panel + check `academy-enrollment-reconcile` heartbeat age |

---

## Step 3 — Rollback if a recent deploy caused it

If the issue started right after a deploy:

### Cloudflare Pages (markcmo.com)

1. `gh run list --workflow deploy.yml --limit 5` — find the last successful deploy SHA
2. `git revert HEAD` — create a new commit reverting the bad change
3. `git push origin main` — auto-deploy fires
4. Verify `/health` returns 200 again

### Cloudflare Worker (academy.markcmo.com)

1. `cd "MarkCMO Academy" && npx wrangler deployments list --name markcmo-academy`
2. Note the version ID before the bad one
3. `npx wrangler rollback --message "revert to <previous> per incident" <version-id>`
4. Verify `https://academy.markcmo.com/` loads

### Supabase migration revert

1. Identify the bad migration in `/migrations`
2. Write a down-migration that reverses it
3. Apply via Supabase SQL editor

---

## Step 4 — Verify recovery

- Hit `/health` on both properties → both 200, all checks green
- Run smoke tests locally: `npm test`
- Refresh `/admin#ops` → no fresh errors, heartbeats current
- Spot-check the user-reported scenario manually

---

## Payment incident procedure (SEV1)

If a payment is wrong (missed charge, duplicate, refund anomaly, wrong-property email):

1. **Pull Square Dashboard payment record** by payment ID — note customer, amount, time, status
2. **Pull JSONBin enrollment** for the customer email
3. **Pull `/admin#ops` webhook events** filtered to that customer's email
4. **Identify the divergence** — payment without enrollment, enrollment without payment, both but wrong product, etc.
5. **Manually reconcile** in Square Dashboard and JSONBin
6. **Email the affected customer** from `mark@markcmo.com` with apology + confirmation. Do NOT use a notification template that might attribute the incident to the wrong property.
7. **Add a regression test to `tests/smoke.spec.js`** that would catch this exact divergence

The payment-reconcile cron in `wetyr-ops-cron?mode=payment-reconcile` catches Square payments without matching enrollments. If it flagged the incident, that's the trail.

---

## Postmortem (within 24 hours of any SEV1)

Create `/docs/incidents/YYYY-MM-DD-short-name.md` with:

```markdown
# Incident: <short name>

**Date:** YYYY-MM-DD HH:MM ET start → HH:MM ET end
**Severity:** SEV1 | SEV2 | SEV3
**Customer impact:** N customers affected, $X revenue affected
**Detection:** how we noticed (alert / monitor / customer report)

## Timeline
- HH:MM — first signal
- HH:MM — acknowledged
- HH:MM — identified root cause
- HH:MM — rollback / fix deployed
- HH:MM — recovery verified

## Root cause
One paragraph.

## Why it wasn't caught earlier
What monitor or test should have caught this and didn't.

## Permanent fix
Specific code change or process change. Link to PR.

## Detection improvement
New monitor, smoke test, or alert added so this incident class is caught faster next time. Link to PR.
```

Mark reviews every postmortem.

---

## Communication templates

### Customer apology — payment incident
```
Subject: About your recent MarkCMO Academy charge

Hi [first name],

I'm writing to apologize for an issue with your recent enrollment.
[1-sentence specific explanation]

Your access has now been activated. You can log in at:
https://academy.markcmo.com/?email=[email]&token=[token]&mycourses=1

If you have any questions or want a refund, just reply.
We will respond within 24 hours.

Mark Gabrielli
mark@markcmo.com
+1 (321) 917-5738
```

### Status update for ongoing SEV1
Post in real-time to status channel (TBD). Format:
```
[HH:MM ET] [SEV1] Brief description.
- Investigating: what we're checking right now.
- Impact: which property + how many customers.
- ETA to resolution: <our best guess>.
- Next update: <time>.
```

---

## Quick command reference

```bash
# Check both health endpoints
curl -s https://markcmo.com/health | jq
curl -s https://academy.markcmo.com/health | jq

# Force a payment reconcile right now
curl 'https://academy.markcmo.com/.netlify/functions/wetyr-ops-cron?mode=payment-reconcile'

# Force a synthetic monitor sweep
curl 'https://academy.markcmo.com/.netlify/functions/wetyr-ops-cron?mode=synthetic-monitor'

# Pull last 24h Square payments
curl -s 'https://markcmo.com/api/admin-square-audit?type=orders' -b /tmp/admin.txt | jq

# Roll back academy Worker
cd "MarkCMO Academy" && npx wrangler deployments list --name markcmo-academy
npx wrangler rollback --name markcmo-academy <version-id>

# Roll back markcmo.com (creates revert commit, deploys via CI)
git revert HEAD && git push origin main
```

---

## Quarterly review (every 90 days)

- Run a tabletop SEV1 drill — simulate a real incident, walk through this playbook, time each step
- Restore one property from backup to a fresh CF/JSONBin setup, verify functionality (RTO target: 4 hours)
- Review all alert thresholds — are they too noisy or too quiet?
- Update this document with any new patterns learned
