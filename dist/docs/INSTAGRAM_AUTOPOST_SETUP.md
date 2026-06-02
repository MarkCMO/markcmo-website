# Instagram Autoposter - One-Time Setup

This is the one-time setup so the autoposter can publish your carousel days to
Instagram automatically at 9am ET. You do this ONCE. After that it runs itself
and you only film the reel days.

What you have now: an Instagram Business account, no Meta app yet.
What you need to end up with: three values pasted into Cloudflare as secrets -
`IG_USER_ID`, `IG_ACCESS_TOKEN`, and the kill-switch `AUTOPOST_ENABLED`.

Total time: about 15 minutes. Do it on a laptop, not your phone.

---

## Before you start - two prerequisites

1. Your Instagram must be a **Business** (or Creator) account, not Personal.
   On the IG app: Settings -> Account type and tools -> Switch to professional
   account -> Business. (You said this is already done.)

2. Your IG account must be **linked to a Facebook Page**. The publishing API
   only works through a Page.
   - Go to https://www.facebook.com/pages/create and make a Page (name it
     "Mark Gabrielli" or "MarkCMO" - it can stay empty, nobody has to see it).
   - On the IG app: Settings -> Account type and tools -> Sharing to other apps
     -> Facebook -> connect it to that Page.
   - Or from the Page: Settings -> Linked accounts -> Instagram -> connect.

If both are true, continue.

---

## Step 1 - Create a Meta app

1. Go to https://developers.facebook.com/apps -> **Create app**.
2. Use case: choose **Other** -> Next.
3. App type: choose **Business** -> Next.
4. App name: `MarkCMO Autoposter`. Contact email: mark@markcmo.com. Create app.
5. You will land on the app dashboard. Note the **App ID** and (under
   App settings -> Basic) the **App secret** - you may want these later for the
   optional token-refresh cron, but they are NOT required to start.

---

## Step 2 - Add the Instagram product

1. On the app dashboard, find **Add products to your app**.
2. Add **Instagram** (the "Instagram Graph API" / "Instagram" product).
3. This unlocks the Graph API permissions you need.

---

## Step 3 - Get a User token with the right permissions (Graph API Explorer)

1. Go to https://developers.facebook.com/tools/explorer
2. Top right, **Meta App** dropdown: select `MarkCMO Autoposter`.
3. **User or Page** dropdown: select **User Token**.
4. Click **Add a Permission** and add ALL of these:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`
   - `business_management`
5. Click **Generate Access Token**. A Facebook login/consent popup appears -
   log in as yourself and **approve** every permission. Make sure you tick the
   Page you created and the Instagram account when it asks which assets to allow.
6. A token string now appears in the box. This is a SHORT-lived token (about 1
   hour). We will exchange it for a long-lived one and find your IG user id next.

Keep this Explorer tab open.

---

## Step 4 - Find your IG_USER_ID

Still in Graph API Explorer, run these two GET calls (change the dropdown next to
the URL bar to **GET**, paste the path, click Submit):

1. Get your Page id:
   ```
   me/accounts
   ```
   In the response, find your Page and copy its `id` (a long number). Call it
   PAGE_ID.

2. Get the IG account attached to that Page:
   ```
   PAGE_ID?fields=instagram_business_account
   ```
   (replace PAGE_ID with the number from step 1)
   The response has `instagram_business_account.id`. **That number is your
   `IG_USER_ID`.** Copy it somewhere safe.

---

## Step 5 - Turn the short token into a long-lived token (about 60 days)

You need your App ID and App secret (Step 1) for this. In your browser address
bar, paste this URL, filling in the three values, then hit enter:

```
https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=YOUR_SHORT_TOKEN
```

The response is JSON like:
```json
{ "access_token": "EAAG...verylong...", "token_type": "bearer", "expires_in": 5183944 }
```

That `access_token` is your **long-lived token**. `expires_in` ~5,184,000 seconds
= ~60 days. Copy the token. This is your `IG_ACCESS_TOKEN`.

> Tip: a token derived from a long-lived USER token, used for a Page-linked IG
> account, can be refreshed indefinitely. The optional `ig-token-refresh` cron
> (already built) will auto-extend it every week IF you also set `META_APP_ID`
> and `META_APP_SECRET` as secrets. If you skip that, just re-run Step 5 every
> ~50 days. The autoposter emails you a receipt on every post, so you'll notice
> fast if the token ever lapses.

---

## Step 6 - Put the three secrets into Cloudflare

These go on the **markcmo** Cloudflare Pages project (not committed to git -
they are secrets). Easiest path is the dashboard:

1. Cloudflare dashboard -> Workers & Pages -> **markcmo** -> Settings ->
   **Environment variables / Secrets** (Production).
2. Add these (use "Encrypt" for the token):

   | Name                | Value                                   |
   |---------------------|-----------------------------------------|
   | `IG_USER_ID`        | the number from Step 4                  |
   | `IG_ACCESS_TOKEN`   | the long token from Step 5 (Encrypt)    |
   | `CRON_SHARED_SECRET`| (should already exist - leave it)       |
   | `AUTOPOST_ENABLED`  | leave UNSET for now (keeps it OFF)      |

   Optional, only if you want auto-refresh:
   | `META_APP_ID`       | your App ID                             |
   | `META_APP_SECRET`   | your App secret (Encrypt)               |

3. Also bind the KV namespace `AUTOPOST_KV` (Settings -> Functions -> KV
   bindings) if not already bound. It is optional but gives once-per-day dedup
   and stores the rotated token. (I can do this binding for you at deploy time.)

---

## Step 7 - Test BEFORE going live (no post is made)

Once deployed, you can dry-run safely. In a browser, visit:

```
https://markcmo.com/api/ig-autopost?key=YOUR_CRON_SHARED_SECRET&test=1&day=3
```

Day 3 is a carousel. You should see JSON with `dryRun: true`, the image count,
and the image URLs - but nothing is posted to Instagram. If that looks right,
you're wired correctly.

To test an ACTUAL post on demand (this DOES publish):
```
https://markcmo.com/api/ig-autopost?key=YOUR_CRON_SHARED_SECRET&force=1&day=3
```

---

## Step 8 - Flip it live

When you're ready for it to run on its own:

1. Set `AUTOPOST_ENABLED` = `true` in Cloudflare (Step 6).
2. That's it. Every day the hourly cron checks; at 9am ET on a **carousel** day
   it builds that day's slides, publishes the carousel, and emails you a receipt.
   **Reel days are skipped** - you film and post those yourself.

To pause anytime: set `AUTOPOST_ENABLED` to anything other than `true` (or delete
it). No posts go out while it's off.

---

## What runs automatically once live

- **Hourly cron** -> `ig-autopost` self-gates to 9am ET, carousel days only.
- **Daily 9am cron** -> `ig-token-refresh` (only if you set META_APP_ID/SECRET)
  extends the token so it never expires.
- **Receipt email** to mark@markcmo.com on every post (success or failure).

## Quick troubleshooting

- `IG_USER_ID / IG_ACCESS_TOKEN not set` -> Step 6 secrets missing/typo'd.
- `AUTOPOST_ENABLED is not "true"` -> it's still OFF (expected until Step 8).
- `(#10) Application does not have permission` -> re-do Step 3, make sure
  `instagram_content_publish` was approved.
- `media ... not ready` or image fetch error -> the daily-assets PNG for that
  day isn't published yet; assets must be live at markcmo.com/daily-assets/.
- Token expired after ~60 days -> re-run Step 5, paste new token into
  `IG_ACCESS_TOKEN`, OR set META_APP_ID/SECRET so the refresh cron handles it.
