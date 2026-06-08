// /api/google-oauth-start
//
// Step 1 of the one-time Google Drive OAuth setup. Mark visits this URL
// in his browser; we redirect him to Google's consent screen. Google then
// redirects back to /api/google-oauth-callback with an authorization code
// which we exchange for a long-lived refresh token (saved as a Pages
// env var so the calendly-webhook cron can read Gemini meeting notes
// from Drive without re-auth).
//
// Required env vars (configured in Cloudflare Pages secrets before this
// endpoint is hit):
//   GOOGLE_OAUTH_CLIENT_ID     - from Google Cloud Console > Credentials
//   GOOGLE_OAUTH_CLIENT_SECRET - same place
//
// See docs/GOOGLE-DRIVE-NOTES-SETUP.md for the one-time Google Cloud
// Console setup steps.

const SCOPES = [
  // Read-only access to Drive metadata + content. We only need to find
  // and read Gemini-generated meeting notes documents; no write access.
  'https://www.googleapis.com/auth/drive.readonly',
];

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return new Response(JSON.stringify({
      error: 'GOOGLE_OAUTH_CLIENT_ID not configured',
      next_step: 'Follow docs/GOOGLE-DRIVE-NOTES-SETUP.md to create OAuth credentials in Google Cloud Console, then set GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET as Pages secrets.',
    }, null, 2), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const redirectUri = `${url.origin}/api/google-oauth-callback`;
  const state = crypto.randomUUID(); // CSRF token; verified in callback

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES.join(' '));
  // access_type=offline + prompt=consent guarantees we receive a refresh
  // token on the first authorization (Google omits the refresh token on
  // subsequent re-auths unless prompt=consent is sent).
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  // Return a small HTML page so Mark sees what he's authorizing before
  // we redirect him to Google. Also gives a visible breadcrumb in case
  // something goes wrong.
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Connect Google Drive - MarkCMO</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#0a0f2c;color:#fff;margin:0;padding:0;display:flex;align-items:center;justify-content:center;min-height:100vh;}
  .card{background:#0F1828;border:1px solid rgba(201,168,76,0.2);border-radius:14px;padding:36px 40px;max-width:520px;width:100%;}
  h1{font-size:1.6rem;margin:0 0 12px;}
  p{line-height:1.55;color:rgba(255,255,255,.78);margin:0 0 14px;}
  .scope{background:rgba(201,168,76,0.08);border-left:3px solid #C9A84C;padding:10px 14px;border-radius:4px;font-family:'DM Mono',monospace;font-size:.85rem;margin:0 0 18px;}
  .btn{display:inline-block;background:#C9A84C;color:#0a0f2c;padding:12px 26px;text-decoration:none;border-radius:8px;font-weight:700;letter-spacing:.04em;}
</style></head><body>
<div class="card">
  <h1>Connect Google Drive</h1>
  <p>This authorizes <strong>markcmo.com</strong> to read Gemini-generated meeting notes from your Google Drive, so the post-meeting recap email can quote the actual notes instead of using template bullets.</p>
  <div class="scope">Scope requested: drive.readonly<br>(read-only, no write/delete)</div>
  <p>You only need to do this once. After approval, a refresh token is captured and stored as a Cloudflare Pages secret.</p>
  <a class="btn" href="${authUrl.toString()}">Authorize with Google &rarr;</a>
</div>
</body></html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=UTF-8' },
  });
}
