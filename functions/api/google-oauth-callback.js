// /api/google-oauth-callback
//
// Step 2 of the one-time Google Drive OAuth setup. Google redirects here
// with ?code=<authorization_code> after Mark approves the consent screen.
// We exchange the code for an access_token + refresh_token, then write
// the refresh_token into the Pages project secrets via the Cloudflare
// API so subsequent requests can use it without Mark re-authorizing.
//
// The refresh token is the prize - it lets the calendly-webhook handler
// (and any cron worker) call Google Drive API as Mark indefinitely.
//
// Required env vars:
//   GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET (set first)
//   CF_ACCOUNT_ID                                      (for env var PATCH)
//   CLOUDFLARE_API_TOKEN                               (Pages:Edit scope)
//
// After this endpoint succeeds, GOOGLE_OAUTH_REFRESH_TOKEN is set on the
// markcmo Pages project automatically. No copy/paste required.

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const oauthError = url.searchParams.get('error');

  if (oauthError) {
    return errorPage(`Google rejected the authorization: ${oauthError}`);
  }
  if (!code) {
    return errorPage('No authorization code in callback URL. Did you start from /api/google-oauth-start?');
  }

  const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return errorPage('GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET not configured as Pages secrets.');
  }

  const redirectUri = `${url.origin}/api/google-oauth-callback`;

  // ─── Exchange authorization code for tokens ────────────────────
  let tokenJson;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      return errorPage(`Google token exchange failed (${tokenRes.status}): ${JSON.stringify(tokenJson)}`);
    }
  } catch (e) {
    return errorPage(`Network error during token exchange: ${(e && e.message) || String(e)}`);
  }

  const refreshToken = tokenJson.refresh_token;
  const accessToken = tokenJson.access_token;
  if (!refreshToken) {
    return errorPage('Google did not return a refresh_token. Re-run /api/google-oauth-start - the consent screen must show "Continue" with offline access. If this keeps happening, revoke previous access at https://myaccount.google.com/permissions and try again.');
  }

  // ─── Verify the token works by calling Drive about endpoint ────
  let userEmail = '(unknown)';
  try {
    const aboutRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (aboutRes.ok) {
      const about = await aboutRes.json();
      userEmail = about.user?.emailAddress || userEmail;
    }
  } catch (_) {}

  // ─── Persist refresh token to CF Pages project secrets ────────
  const accountId = env.CF_ACCOUNT_ID || '5b4ea6b5589fe12f29bea5d7e43fe03c';
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  let secretStored = false;
  let secretError = null;
  if (apiToken) {
    try {
      const patchRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/markcmo`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deployment_configs: {
            production: {
              env_vars: {
                GOOGLE_OAUTH_REFRESH_TOKEN: {
                  type: 'secret_text',
                  value: refreshToken,
                },
              },
            },
          },
        }),
      });
      const patchJson = await patchRes.json();
      if (patchJson.success) {
        secretStored = true;
      } else {
        secretError = JSON.stringify(patchJson.errors || patchJson);
      }
    } catch (e) {
      secretError = (e && e.message) || String(e);
    }
  } else {
    secretError = 'CLOUDFLARE_API_TOKEN not configured - refresh token captured but NOT persisted to Pages secrets.';
  }

  // ─── Render success page ──────────────────────────────────────
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Google Drive Connected - MarkCMO</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#0a0f2c;color:#fff;margin:0;padding:0;display:flex;align-items:center;justify-content:center;min-height:100vh;}
  .card{background:#0F1828;border:1px solid rgba(201,168,76,0.2);border-radius:14px;padding:36px 40px;max-width:560px;width:100%;}
  h1{font-size:1.6rem;margin:0 0 12px;color:${secretStored ? '#2EBA73' : '#C9A84C'};}
  p{line-height:1.55;color:rgba(255,255,255,.85);margin:0 0 14px;}
  .meta{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:10px 14px;font-family:'DM Mono',monospace;font-size:.82rem;margin:0 0 18px;color:rgba(255,255,255,.75);}
  .err{background:rgba(231,76,60,0.1);border-left:3px solid #e74c3c;padding:10px 14px;border-radius:4px;margin:0 0 14px;color:#ffb3aa;font-size:.85rem;line-height:1.5;}
  code{background:rgba(201,168,76,0.1);color:#C9A84C;padding:2px 6px;border-radius:3px;font-family:'DM Mono',monospace;}
</style></head><body>
<div class="card">
  ${secretStored ? `
    <h1>Connected to Google Drive ✓</h1>
    <p>Authorized as <strong>${escapeHtml(userEmail)}</strong>. Refresh token captured and stored as the <code>GOOGLE_OAUTH_REFRESH_TOKEN</code> secret on the markcmo Pages project.</p>
    <div class="meta">Granted scope: drive.readonly<br>Token type: long-lived refresh token<br>Storage: CF Pages production env</div>
    <p>The calendly-webhook handler can now query Drive for Gemini meeting notes after each call ends. The next recap email (T+30min after a meeting) will use real meeting content instead of template bullets.</p>
  ` : `
    <h1>Token captured, persistence failed</h1>
    <p>Authorized as <strong>${escapeHtml(userEmail)}</strong>. Token exchange succeeded but writing the secret to Pages failed.</p>
    <div class="err">${escapeHtml(String(secretError || 'unknown error'))}</div>
    <p>Manual fix: copy the refresh token below and set it as <code>GOOGLE_OAUTH_REFRESH_TOKEN</code> in the markcmo Pages project secrets via the Cloudflare dashboard.</p>
    <div class="meta">${escapeHtml(refreshToken)}</div>
    <p style="color:#e74c3c;font-size:.8rem;">DO NOT share the token above. It grants read access to your Drive.</p>
  `}
</div>
</body></html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=UTF-8' },
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function errorPage(msg) {
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>OAuth Error</title>
<style>body{font-family:Arial,sans-serif;background:#0a0f2c;color:#fff;padding:40px;line-height:1.6;}.err{background:rgba(231,76,60,0.1);border-left:3px solid #e74c3c;padding:12px 16px;border-radius:4px;color:#ffb3aa;}</style>
</head><body>
<h1>Google OAuth Error</h1>
<div class="err">${escapeHtml(msg)}</div>
<p><a href="/api/google-oauth-start" style="color:#C9A84C;">Try again &rarr;</a></p>
</body></html>`;
  return new Response(html, { status: 400, headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
}
