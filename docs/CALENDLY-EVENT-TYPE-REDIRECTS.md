# Calendly post-booking path - config for all 11 event types

The post-booking page at https://markcmo.com/welcome-to-the-markcmo-club is
**adaptive**. It detects the event type from the Calendly redirect query
params and rebrands itself + the confirmation email automatically.

You only need to set **one redirect URL** on every event type. The page
handles the rest.

## The one URL to set everywhere

```
https://markcmo.com/welcome-to-the-markcmo-club
```

Set this on every active event type. Pass query params: yes (Calendly does
this automatically and the page reads them).

## The 11 event types + the mode each one falls into

| Event Type | Mode | Branding |
|---|---|---|
| Consultation Discovery | discovery | MarkCMO Club |
| Discovery Call \| Marketing | discovery | MarkCMO Club |
| Meeting with Mark | discovery | MarkCMO Club |
| 20-Min Audit Call - $220 | paid | Payment Received |
| 40-Min Strategy Session - $440 | paid | Payment Received |
| 60-Min CMO Power Session - $880 | paid | Payment Received |
| CMO-as-a-Service: Execution Edition - $1,660 | paid | Payment Received |
| Initial Interview \| Discussion | interview | Interview Scheduled |
| Second Interview \| Discussion | interview | Interview Scheduled |
| WETYR \| Introduction Meeting | wetyr | WETYR Meeting Confirmed |
| WETYR Team Meeting | wetyr | WETYR Meeting Confirmed |

## How to set the redirect URL in Calendly

1. Calendly dashboard -> Event Types
2. Click the gear icon on the event -> Edit
3. Confirmation Page (in the left sidebar)
4. "Redirect to an external site after the invitee completes booking"
5. Paste: `https://markcmo.com/welcome-to-the-markcmo-club`
6. Save + Close

Repeat for all 11 event types. Approx 30 seconds each, 5 minutes total.

## What the prospect sees

- **discovery** booking -> "You're in the MarkCMO Club" page + a short
  warm email from mark@markcmo.com asking for context
- **paid** booking -> "Payment Received. See you soon." page + an email
  asking for the 1-3 specific outcomes they want + any materials to review
- **interview** booking -> "Interview Scheduled" page + an email asking
  them to come ready with questions about the role
- **wetyr** booking -> "You're booked with WETYR" page + an email from
  info@wetyr.com asking about the property / situation / timeline

## Verification

Smoke tests in `tests/smoke.spec.js` assert all 4 modes resolve correctly
on every deploy. CI blocks deploy if any mode regresses.

To test manually after configuring:

```
# discovery
open "https://markcmo.com/welcome-to-the-markcmo-club?event_type_name=Consultation+Discovery&event_start_time=2026-12-31T15:00:00-05:00"

# paid
open "https://markcmo.com/welcome-to-the-markcmo-club?event_type_name=60-Min+CMO+Power+Session+%E2%80%93+%24880&event_start_time=2026-12-31T15:00:00-05:00"

# interview
open "https://markcmo.com/welcome-to-the-markcmo-club?event_type_name=Initial+Interview+%7C+Discussion&event_start_time=2026-12-31T15:00:00-05:00"

# wetyr
open "https://markcmo.com/welcome-to-the-markcmo-club?event_type_name=WETYR+%7C+Introduction+Meeting&event_start_time=2026-12-31T15:00:00-05:00"
```
