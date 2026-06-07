# Calendly post-booking path - config for all 11 event types

There are TWO post-booking pages, one per brand. Each is adaptive within
its brand and detects the specific event type from Calendly's redirect
query params, then rebrands itself + the confirmation email accordingly.

## The TWO redirect URLs

| For these events | Redirect URL |
|---|---|
| All MarkCMO events (9 of 11) | `https://markcmo.com/welcome-to-the-markcmo-club` |
| All WETYR events (2 of 11) | `https://wetyr.com/welcome.html` |

Pass query params: yes (Calendly does this automatically and the page reads them).

## The 11 event types + the mode each one falls into

| Event Type | Set redirect to | Page mode | Branding |
|---|---|---|---|
| Consultation Discovery | markcmo.com/welcome-to-the-markcmo-club | discovery | MarkCMO Club |
| Discovery Call \| Marketing | markcmo.com/welcome-to-the-markcmo-club | discovery | MarkCMO Club |
| Meeting with Mark | markcmo.com/welcome-to-the-markcmo-club | discovery | MarkCMO Club |
| 20-Min Audit Call - $220 | markcmo.com/welcome-to-the-markcmo-club | paid | Payment Received |
| 40-Min Strategy Session - $440 | markcmo.com/welcome-to-the-markcmo-club | paid | Payment Received |
| 60-Min CMO Power Session - $880 | markcmo.com/welcome-to-the-markcmo-club | paid | Payment Received |
| CMO-as-a-Service: Execution Edition - $1,660 | markcmo.com/welcome-to-the-markcmo-club | paid | Payment Received |
| Initial Interview \| Discussion | markcmo.com/welcome-to-the-markcmo-club | interview | Interview Scheduled |
| Second Interview \| Discussion | markcmo.com/welcome-to-the-markcmo-club | interview | Interview Scheduled |
| WETYR \| Introduction Meeting | wetyr.com/welcome.html | wetyr | WETYR (navy + gold), deal-prep slant |
| WETYR Team Meeting | wetyr.com/welcome.html | team | WETYR Team Meeting Confirmed |

## How to set the redirect URL in Calendly

1. Calendly dashboard -> Event Types
2. Click the gear icon on the event -> Edit
3. Confirmation Page (in the left sidebar)
4. "Redirect to an external site after the invitee completes booking"
5. Paste: `https://markcmo.com/welcome-to-the-markcmo-club`
6. Save + Close

Repeat for all 11 event types. Approx 30 seconds each, 5 minutes total.

## What the prospect sees

- **discovery** booking -> "You're in the MarkCMO Club" page on markcmo.com
  + a short warm email from mark@markcmo.com asking for context
- **paid** booking -> "Payment Received. See you soon." page on markcmo.com
  + an email from mark@markcmo.com asking for the 1-3 specific outcomes
  they want + any materials to review
- **interview** booking -> "Interview Scheduled" page on markcmo.com
  + an email from mark@markcmo.com asking them to come ready with questions
- **wetyr** booking -> WETYR-branded "You're booked with WETYR" page on
  wetyr.com + an email from info@wetyr.com asking about the property /
  situation / timeline
- **wetyr team** booking -> "WETYR Team Meeting Confirmed" page on wetyr.com
  + an email from info@wetyr.com asking for the agenda

## Verification

Smoke tests in `tests/smoke.spec.js` assert all 4 modes resolve correctly
on every deploy. CI blocks deploy if any mode regresses.

To test manually after configuring:

```
# discovery (markcmo.com)
open "https://markcmo.com/welcome-to-the-markcmo-club?event_type_name=Consultation+Discovery&event_start_time=2026-12-31T15:00:00-05:00"

# paid (markcmo.com)
open "https://markcmo.com/welcome-to-the-markcmo-club?event_type_name=60-Min+CMO+Power+Session+%E2%80%93+%24880&event_start_time=2026-12-31T15:00:00-05:00"

# interview (markcmo.com)
open "https://markcmo.com/welcome-to-the-markcmo-club?event_type_name=Initial+Interview+%7C+Discussion&event_start_time=2026-12-31T15:00:00-05:00"

# WETYR introduction (wetyr.com)
open "https://wetyr.com/welcome.html?event_type_name=WETYR+%7C+Introduction+Meeting&event_start_time=2026-12-31T15:00:00-05:00"

# WETYR team (wetyr.com)
open "https://wetyr.com/welcome.html?event_type_name=WETYR+Team+Meeting&event_start_time=2026-12-31T15:00:00-05:00"
```

## Deployment

- **markcmo.com/welcome-to-the-markcmo-club** lives at the repo root
  `welcome-to-the-markcmo-club.html` -> auto-uploaded to Cloudflare KV
  on every push to main via `.github/workflows/deploy.yml`.
- **wetyr.com/welcome.html** lives at the wetyr.com repo root (R2 bucket
  `wetyr-com`). Re-upload via `wetyr-cf-worker/upload-to-r2.js` or
  `mcp__cloudflare__r2_put_object` for single-file updates.
