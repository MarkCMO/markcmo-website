// Pet Chores legal/support pages, served from Cloudflare Workers.
// Routes: /privacy, /support, / (index). Deployed as the "petchores-legal" Worker.
// No data, no tracking; static HTML only.

const STYLE = `
  body { font-family: -apple-system, system-ui, "Segoe UI", Roboto, Arial, sans-serif;
         max-width: 720px; margin: 40px auto; padding: 0 20px; color: #1E293B; line-height: 1.6; }
  h1 { font-size: 1.8rem; }
  h2 { font-size: 1.2rem; margin-top: 1.6rem; }
  a { color: #2563EB; }
  .muted { color: #64748B; font-size: 0.9rem; }
`;

const PRIVACY_HTML = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pet Chores Privacy Policy</title><style>${STYLE}</style></head><body>
<h1>Pet Chores Privacy Policy</h1>
<p class="muted">Last updated: 2026</p>
<p>Pet Chores is built for families and children. We designed it to collect no personal data at all.</p>
<h2>What we collect</h2>
<p>Nothing. Pet Chores has no accounts, no login, and makes no network connections to send your information anywhere. All app data (the child profile, pets, chores, scores, and settings) is stored only on your device.</p>
<h2>Photos</h2>
<p>If a parent turns on the optional "photo proof" feature, photos your child takes to show a finished chore are saved on the device only. They are never uploaded.</p>
<h2>Tracking and ads</h2>
<p>Pet Chores contains no advertising, no analytics, and no third party trackers or SDKs. We do not track you across apps or websites.</p>
<h2>Purchases</h2>
<p>The optional one-time unlock is processed by Apple through the App Store. We never see or store your payment information. All purchasing is behind a parental gate.</p>
<h2>Children's privacy</h2>
<p>Because no data leaves the device, Pet Chores does not collect personal information from children or anyone else. This aligns with COPPA and Apple's Kids Category requirements.</p>
<h2>Contact</h2>
<p>Questions about this policy? Email <a href="mailto:info@wetyr.com">info@wetyr.com</a>.</p>
</body></html>`;

const SUPPORT_HTML = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pet Chores Support</title><style>${STYLE}</style></head><body>
<h1>Pet Chores Support</h1>
<p>Need help? Email <a href="mailto:info@wetyr.com">info@wetyr.com</a> and we will get back to you.</p>
<h2>Common questions</h2>
<h2>How do I open Parent Mode?</h2>
<p>Tap the "Grown-ups" lock button on the Home screen and enter the 4 digit PIN you created during setup.</p>
<h2>I forgot the Parent PIN.</h2>
<p>For privacy, the PIN is stored only as a scrambled value on your device and cannot be recovered. You can delete and reinstall the app to start fresh (this clears all local data).</p>
<h2>How do I unlock all pets?</h2>
<p>Open Parent Mode, choose Unlock, and complete the one-time purchase. Use Restore Purchases on a new device.</p>
<h2>Reminders are not arriving.</h2>
<p>Make sure notifications are allowed for Pet Chores in the iOS Settings app, and check the Quiet Hours setting in Parent Mode.</p>
<h2>Is my child's data safe?</h2>
<p>Yes. Nothing leaves the device. See our <a href="/privacy">Privacy Policy</a>.</p>
</body></html>`;

const INDEX_HTML = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pet Chores</title><style>${STYLE}</style></head><body>
<h1>Pet Chores</h1>
<p>Train to care for a real pet before you get one.</p>
<ul>
<li><a href="/privacy">Privacy Policy</a></li>
<li><a href="/support">Support</a></li>
</ul>
</body></html>`;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    let path = url.pathname.replace(/\/+$/, "") || "/";
    // Tolerate a /petchores prefix so the same Worker serves both
    // markcmo.com/petchores/... (via a path route) and the workers.dev URL.
    if (path === "/petchores") path = "/";
    else if (path.startsWith("/petchores/")) path = path.slice("/petchores".length);
    const headers = { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" };
    if (path === "/privacy") return new Response(PRIVACY_HTML, { headers });
    if (path === "/support") return new Response(SUPPORT_HTML, { headers });
    if (path === "/") return new Response(INDEX_HTML, { headers });
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
  }
};
