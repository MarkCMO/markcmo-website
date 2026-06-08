// /api/google-setup
//
// Plain HTML version of docs/GOOGLE-DRIVE-NOTES-SETUP.md so Mark can
// follow the setup steps in a browser without opening markdown files.
// Linked from the OAuth start page and accessible at any time.

export async function onRequest() {
  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="robots" content="noindex,follow">
<title>Connect Google Drive setup - MarkCMO</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#0a0f2c;color:#fff;margin:0;padding:0;line-height:1.6;}
.wrap{max-width:760px;margin:0 auto;padding:48px 24px 80px;}
h1{font-size:2.2rem;font-weight:800;margin:0 0 .35rem;letter-spacing:-.01em;}
.sub{color:rgba(255,255,255,.6);font-size:1rem;margin:0 0 2.5rem;}
h2{font-size:1.4rem;color:#C9A84C;margin:2.5rem 0 1rem;border-bottom:1px solid rgba(201,168,76,.2);padding-bottom:.6rem;}
ol{padding-left:1.4rem;margin:0 0 1.5rem;}
ol li{margin:0 0 .8rem;}
ul{padding-left:1.4rem;margin:.4rem 0;}
ul li{margin:0 0 .35rem;}
code{background:rgba(201,168,76,.12);color:#C9A84C;padding:2px 7px;border-radius:4px;font-family:'DM Mono','Menlo',monospace;font-size:.92em;}
.codeblock{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-left:3px solid #C9A84C;border-radius:6px;padding:14px 18px;font-family:'DM Mono','Menlo',monospace;font-size:.88rem;margin:.6rem 0 1.2rem;color:#C9A84C;word-break:break-all;}
strong{color:#fff;}
a{color:#C9A84C;}
.btn{display:inline-block;background:#C9A84C;color:#0a0f2c;padding:14px 28px;text-decoration:none;border-radius:10px;font-weight:700;margin:1.5rem 0;}
.note{background:rgba(46,186,115,.08);border-left:3px solid #2EBA73;padding:10px 14px;border-radius:4px;margin:.8rem 0 1.5rem;font-size:.94rem;color:rgba(255,255,255,.85);}
.warn{background:rgba(255,193,7,.08);border-left:3px solid #ffc107;padding:10px 14px;border-radius:4px;margin:.8rem 0 1.5rem;font-size:.94rem;color:rgba(255,255,255,.85);}
table{width:100%;border-collapse:collapse;margin:.6rem 0 1.5rem;font-size:.94rem;}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.08);}
th{color:#C9A84C;font-weight:600;background:rgba(201,168,76,.04);}
.step{display:inline-block;background:#C9A84C;color:#0a0f2c;width:28px;height:28px;line-height:28px;text-align:center;border-radius:50%;font-weight:700;font-size:.9rem;margin-right:10px;vertical-align:middle;}
.time{color:rgba(255,255,255,.5);font-size:.9rem;font-weight:400;}
</style></head>
<body><div class="wrap">

<h1>Connect Google Drive</h1>
<p class="sub">One-time setup. Lets the calendly-webhook read Gemini Meet notes for personalized recap emails. <strong>~10 minutes total.</strong></p>

<h2><span class="step">1</span>Google Cloud Console <span class="time">(~5 min)</span></h2>
<ol>
  <li>Open <a href="https://console.cloud.google.com/" target="_blank">console.cloud.google.com</a> in your browser</li>
  <li>Top bar → project dropdown → <strong>New Project</strong>. Name it <code>MarkCMO Webhooks</code>. Click <strong>Create</strong>. Wait ~10 sec then make sure the new project is selected.</li>
  <li>Left hamburger menu → <strong>APIs &amp; Services</strong> → <strong>Enabled APIs &amp; Services</strong></li>
  <li>Click <strong>+ ENABLE APIS AND SERVICES</strong> at top → search <strong>Google Drive API</strong> → click it → <strong>Enable</strong> button. Wait for the green check.</li>
  <li>Left menu → <strong>APIs &amp; Services</strong> → <strong>OAuth consent screen</strong>
    <ul>
      <li>User type: <strong>External</strong> → Create</li>
      <li>App name: <code>MarkCMO Meeting Notes</code></li>
      <li>User support email: <code>mark@markcmo.com</code></li>
      <li>Developer contact: <code>mark@markcmo.com</code></li>
      <li><strong>Save and continue</strong> through Scopes (skip), Test users (add <code>mark@markcmo.com</code>), and Summary</li>
      <li><strong>Back to dashboard</strong></li>
    </ul>
  </li>
  <li>Left menu → <strong>APIs &amp; Services</strong> → <strong>Credentials</strong></li>
  <li><strong>+ CREATE CREDENTIALS</strong> at top → <strong>OAuth client ID</strong>
    <ul>
      <li>Application type: <strong>Web application</strong></li>
      <li>Name: <code>MarkCMO Pages</code></li>
      <li>Under <strong>Authorized redirect URIs</strong> click <strong>+ ADD URI</strong>, paste:</li>
    </ul>
    <div class="codeblock">https://markcmo.com/api/google-oauth-callback</div>
    Click <strong>CREATE</strong>.
  </li>
  <li>A popup shows your <strong>Client ID</strong> and <strong>Client secret</strong>. Keep this tab open - you need both values for Step 2.</li>
</ol>

<h2><span class="step">2</span>Paste credentials into Cloudflare <span class="time">(~2 min)</span></h2>
<ol>
  <li>Open <a href="https://dash.cloudflare.com/" target="_blank">dash.cloudflare.com</a></li>
  <li>Left menu → <strong>Workers &amp; Pages</strong> → click <code>markcmo</code> (your Pages project)</li>
  <li><strong>Settings</strong> tab (top) → <strong>Variables and Secrets</strong> in the sidebar → <strong>Production</strong> environment</li>
  <li>Click <strong>Add variable</strong> twice, set both as type <strong>Secret</strong>:
    <table>
      <tr><th>Variable name</th><th>Value</th></tr>
      <tr><td><code>GOOGLE_OAUTH_CLIENT_ID</code></td><td>(Client ID from Step 1.8)</td></tr>
      <tr><td><code>GOOGLE_OAUTH_CLIENT_SECRET</code></td><td>(Client secret from Step 1.8)</td></tr>
    </table>
  </li>
  <li><strong>Save</strong>. Wait 30 seconds for the change to apply.</li>
</ol>

<h2><span class="step">3</span>Authorize <span class="time">(~30 sec)</span></h2>
<p>In your browser, open:</p>
<div class="codeblock">https://markcmo.com/api/google-oauth-start</div>
<p>Click the gold <strong>Authorize with Google</strong> button.</p>
<div class="warn"><strong>If Google warns "App not verified":</strong> click <strong>Advanced</strong> → <strong>Go to MarkCMO Meeting Notes (unsafe)</strong>. Safe because it's your own app with you as the only user.</div>
<p>Sign in with the same Google account you use for Meet calls. Grant <code>drive.readonly</code> access.</p>
<div class="note">You should land on a green success page: <strong>"Connected to Google Drive ✓"</strong>. The refresh token is automatically stored as <code>GOOGLE_OAUTH_REFRESH_TOKEN</code> on the Pages project.</div>

<h2><span class="step">4</span>Verify <span class="time">(~10 sec)</span></h2>
<p>Open in browser:</p>
<div class="codeblock">https://markcmo.com/api/google-drive-test</div>
<p>You should see JSON with <code>"ok": true</code> and a list of your recent Google Docs in <code>recent_docs_for_browsing</code>.</p>
<a class="btn" href="/api/google-oauth-start">Start setup &rarr;</a>

<h2>Troubleshooting</h2>
<table>
  <tr><th>Symptom</th><th>Fix</th></tr>
  <tr><td>oauth-start says "GOOGLE_OAUTH_CLIENT_ID not configured"</td><td>Step 2 isn't complete or hasn't propagated. Wait 30s and reload.</td></tr>
  <tr><td>"App not verified" warning</td><td>Click <strong>Advanced</strong> → <strong>Go to MarkCMO Meeting Notes (unsafe)</strong></td></tr>
  <tr><td>Callback says "No refresh_token returned"</td><td>Revoke prior access at <a href="https://myaccount.google.com/permissions" target="_blank">myaccount.google.com/permissions</a> then re-run Step 3.</td></tr>
  <tr><td>drive-test returns <code>Token refresh failed (400)</code></td><td>Refresh token expired (rare). Re-run Step 3 to capture a fresh one.</td></tr>
</table>

</div></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=UTF-8' },
  });
}
