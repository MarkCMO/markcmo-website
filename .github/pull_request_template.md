<!-- WETYR Infrastructure Protocol v1 §10 - mandatory pre-merge checklist -->

## Summary

Brief description of what changed and why.

## Checklist

- [ ] Tests pass locally (`npm test`)
- [ ] Lint passes locally (no warnings)
- [ ] No secrets in commits (`git diff --stat | grep -iE 'token|key|password|secret'` returns nothing real)
- [ ] No em-dashes (—) or en-dashes (–) in copy
- [ ] No placeholder content ("lorem ipsum", "TODO", "FIXME" all addressed before merge)
- [ ] `/health` endpoint still returns 200 with this change applied
- [ ] Square Sandbox tested for any payment-touching change
- [ ] Resend `from` domain matches `property_id` for any email-touching change
- [ ] Supabase / JSONBin RLS or auth policies reviewed for any new table or column
- [ ] CHANGELOG.md updated if customer-visible behavior changed
- [ ] Documentation updated in /docs if behavior changed
- [ ] Rollback plan documented below

## Test plan

- [ ] How to verify this works on staging before merge to main
- [ ] What to watch on production after deploy

## Rollback plan

How to revert this change if it causes problems in production.

## Properties affected

- [ ] markcmo.com
- [ ] academy.markcmo.com
- [ ] Other: __________

---

*This template lives at .github/pull_request_template.md and auto-populates every new PR. Per WETYR Infrastructure Protocol v1 §10, every box should be ticked or the PR explains why it's intentionally skipped.*
