# EBFS Outbound, INTERNAL Build Spec (NOT for client)

> Internal only. Do NOT link from any client-facing doc or send to Terry.
> This holds the "how it's set up" detail that we intentionally keep OUT of the client docs
> (blueprint / game-plan / roadmap / proposal). Terry sees the ramp, the timeline, and the
> reverse-engineering to calls only. The mechanics below are ours.

## Sending infrastructure (per option)
- Unit = sending address: 25-30 emails/day each, 3 addresses per domain.
- Small Start: 6 domains, 18 addresses, shared IP, ~450/day, ~10k/mo.
- Immediate Growth: 12 domains, 36 addresses, 1 dedicated IP, ~900/day, ~20k/mo.
- Scale Up: 16 domains, 48 addresses, 1-2 dedicated IPs, ~1,300/day, ~28k/mo.
- Platform: Resend (account in EBFS' name), custom tracking domain, reply inbox(es) on an EBFS domain. Sequencing layer scheduled on the Resend API.

## Warmup ramp (per address)
Wk1 ~8-10/day (30%), Wk2 ~12-15 (50%), Wk3 ~18-22 (75%), Wk4 ~25 (90%), Wk5+ 25-30 (100%).

## Waterfall validation
2-3 verifiers in sequence; valid -> send queue, catch-all/risky -> LinkedIn/phone only, invalid -> suppress. Bounce held <2%.

## Sequence (8-15 touches, ~3.5 wks + nurture)
1. D1 Email cold opener (plain text, no links/images, signature only)
2. D1 LinkedIn connect
3. D3 Email value + Funding Playbook (one tracked link)
4. D4 LinkedIn message
5. D6 Phone (opened-2x/clicked/intent-hot)
6. D8 Email CTA Diagnostic Call (15min) + booking link + phone
7. D11 LinkedIn follow-up
8. D13 Email proof/case + slides/carousel (engaged only)
9. D16 Phone #2 (engaged)
10. D18 Email breakup (plain)
11. D22 Email re-engage Funding Assessment Call (30min) + assessment one-pager (engaged/intent-hot)
12+. Monthly nurture; re-enter on intent surge.

## Trigger engine
- Click playbook -> engaged, advance to Diagnostic CTA + call task within 24h.
- Click booking, no booking -> same-day nudge + call task.
- Click case slides -> hot, offer Assessment + top of phone queue, notify Terry.
- Multiple clicks -> highest-touch branded track + priority call.
- Opened 2x no click -> switch angle next touch.
- No opens after touches 1-3 -> pause email, shift LinkedIn/phone, test subject/inbox.
- Positive reply -> stop sequence, route to Terry, send booking.
- "Not now" -> monthly nurture; re-enter on Prospero surge.
- Books -> Booked stage, confirm + prep, suppress; no-show -> re-book mini-seq.
- Unsubscribe/negative -> suppress permanently.
- Rising intent (Prospero/Bombora) -> bump priority, compress cadence, brand earlier.

## Deliverability playbook (primary inbox)
SPF/DKIM/DMARC (BIMI later); separate cold domains (never the brand domain); dedicated IP + warmup; 25-30/address/day; waterfall validation; plain cold opener, <=1 link early; custom tracking domain; first-line personalization + spintax; real from-name + monitored reply-to; compliant plain-text opt-out; engagement-based sending; seed-inbox monitoring, complaints <0.1%, blocklist monitoring. Warm-then-brand ordering: plain cold touches land, then branded asset-rich touches go to engaged prospects so those land too.

## Assets
Funding Playbook (PDF), case one-pagers, slide carousels, assessment one-pager, branded templates, signature block (real name/title/direct phone/one booking link/one tagline, lightweight text-based). Delivered as LINKS on EBFS tracked domain on cold/early touches; real PDF attachments only after a reply or on request.

## Tooling (at cost, EBFS-owned), monthly
Small Start ~$250 (Resend ~$20, domains ~$8, reply inbox ~$7, validation ~$60, LinkedIn ~$60, CRM ~$40, automation ~$25).
Immediate Growth ~$550 (Resend ~$90, domains ~$15, inboxes ~$14, validation ~$130, LinkedIn ~$120, CRM ~$80, automation ~$50).
Scale Up ~$950 (Resend ~$90-120, domains ~$20, inboxes ~$21, validation ~$250, LinkedIn ~$200, CRM ~$120, automation ~$80, dialer ~$100).
ZoomInfo/Bombora/Prospero stay on Terry's accounts.
