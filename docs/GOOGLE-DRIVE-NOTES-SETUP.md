# Connect Google Drive so Gemini Meet notes power the recap email

One-time setup. ~10 minutes. After this, every booking's T+30min recap
email will pull the actual Gemini-generated meeting notes from your
Drive instead of using template bullets.

## Step 1 - Create OAuth credentials in Google Cloud Console

1. Go to <https://console.cloud.google.com/>
2. Create a new project (or pick existing). Name suggestion:
   "MarkCMO Webhooks"
3. From the left nav: **APIs & Services > Enabled APIs & Services**
4. Click **+ ENABLE APIS AND SERVICES**, search for and enable:
   - **Google Drive API**
5. From the left nav: **APIs & Services > OAuth consent screen**
   - User type: **External**
   - App name: "MarkCMO Meeting Notes"
   - User support email: mark@markcmo.com
   - Developer contact: mark@markcmo.com
   - **Save and continue** through the rest of the screens (defaults are fine)
   - Add yourself (mark@markcmo.com) as a Test User
   - Click **Back to dashboard**
6. From the left nav: **APIs & Services > Credentials**
7. Click **+ CREATE CREDENTIALS > OAuth client ID**
   - Application type: **Web application**
   - Name: "MarkCMO Pages"
   - Authorized redirect URIs: add exactly:
     ```
     https://markcmo.com/api/google-oauth-callback
     ```
   - Click **Create**
8. Copy the **Client ID** and **Client secret** shown in the popup.

## Step 2 - Add the credentials to Cloudflare Pages

1. Go to Cloudflare dashboard > Workers & Pages > **markcmo** project
2. Settings tab > Environment variables > Production
3. Add two secrets:

   | Variable name | Value |
   |---|---|
   | `GOOGLE_OAUTH_CLIENT_ID` | (Client ID from step 1.8) |
   | `GOOGLE_OAUTH_CLIENT_SECRET` | (Client secret from step 1.8) |

   Both should be type **Encrypt** (secret).
4. Save. Wait ~30 seconds for the change to propagate.

## Step 3 - Authorize

1. In your browser, go to:
   ```
   https://markcmo.com/api/google-oauth-start
   ```
2. Click the gold **Authorize with Google** button
3. Sign in as the same Google account where Gemini Meet notes are saved
   (the account you use for Google Meet calls)
4. Click **Continue** to grant `drive.readonly` access
5. You should land on a success page reading "Connected to Google Drive ✓"

That's it. The refresh token is automatically stored as
`GOOGLE_OAUTH_REFRESH_TOKEN` on the Pages project. You never need to
authorize again unless you revoke access from
<https://myaccount.google.com/permissions>.

## Step 4 - Verify it works

Hit this URL in your browser:

```
https://markcmo.com/api/google-drive-test
```

Expected response (JSON):
- `ok: true`
- `authorized_as: "mark@markcmo.com"` (or whichever Google account you used)
- `recent_docs_for_browsing: [...]` listing your 15 most recent Google Docs

If the response shows your recent docs, the connection works. Done.

## What happens after a meeting

1. Calendly meeting ends.
2. Google Meet's Gemini ("Take Notes for Me") finishes writing the
   notes doc to your Drive (~5-10 min after meeting end).
3. The cron worker (planned next) polls Drive for the doc.
4. Parses out the Summary / Key points / Action items sections.
5. Generates a personalized recap email with:
   - "Here is what stood out from our conversation..." (from Gemini's summary)
   - "Here is what you can expect from me..." (existing template, tweaked
     with action items from the meeting)
   - "Here is what I will need from you..." (existing template, tweaked
     with any items that fell to the prospect during the meeting)
6. Replaces the scheduled template recap with the personalized version
   before the T+30min send fires.

## What to do if something goes wrong

| Symptom | Fix |
|---|---|
| `/api/google-oauth-start` returns "GOOGLE_OAUTH_CLIENT_ID not configured" | Step 2 isn't complete or hasn't propagated yet. Wait 30s and reload. |
| Google consent screen says "App not verified" | Click "Advanced" > "Go to MarkCMO Meeting Notes (unsafe)" - this is fine for a personal app with only you as user. |
| Callback page says "No refresh_token returned" | Revoke prior access at <https://myaccount.google.com/permissions> (find "MarkCMO Meeting Notes" and remove), then re-run step 3. |
| `/api/google-drive-test` returns `ok: false` with `error: 'Token refresh failed (400)'` | The refresh token may have expired (rare - usually only if Google rotates them). Re-run step 3 to capture a fresh one. |
| Recap emails still use template bullets after a real meeting | The cron worker that polls Drive isn't built yet (planned as the next commit). Once that ships, recaps will be personalized automatically. |
