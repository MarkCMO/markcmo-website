// Pet Chores legal/support pages, served from Cloudflare Workers.
// Routes: /privacy, /support, /terms, / (index). Deployed as the "petchores-legal" Worker.
// No data, no tracking; static HTML only.

const STYLE = `
  body { font-family: -apple-system, system-ui, "Segoe UI", Roboto, Arial, sans-serif;
         max-width: 720px; margin: 40px auto; padding: 0 20px; color: #1E293B; line-height: 1.6; }
  h1 { font-size: 1.8rem; }
  h2 { font-size: 1.2rem; margin-top: 1.6rem; }
  a { color: #2563EB; }
  ul { padding-left: 1.2rem; }
  .muted { color: #64748B; font-size: 0.9rem; }
`;

const PRIVACY_HTML = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pet Chores Privacy Policy</title><style>${STYLE}</style></head><body>
<h1>Pet Chores Privacy Policy</h1>
<p class="muted">Last updated: June 2026</p>
<p>Pet Chores is built for families and children. We designed it to collect no personal data at all.</p>
<h2>What we collect</h2>
<p>Nothing. Pet Chores has no accounts, no login, and makes no network connections to send your information anywhere. All app data (the child profile, pets, chores, scores, and settings) is stored only on your device.</p>
<h2>Photos</h2>
<p>If a parent turns on the optional "photo proof" feature, photos your child takes to show a finished chore are saved on the device only. They are never uploaded.</p>
<h2>Tracking and ads</h2>
<p>Pet Chores contains no advertising, no analytics, and no third party trackers or SDKs. We do not track you across apps or websites.</p>
<h2>Subscriptions and payments</h2>
<p>The optional Pet Chores subscriptions are processed by Apple through the App Store. We never see or store your payment information. All purchasing is behind a parental gate. See our <a href="/terms">Terms of Use</a> for subscription details.</p>
<h2>Children's privacy</h2>
<p>Because no data leaves the device, Pet Chores does not collect personal information from children or anyone else. This aligns with COPPA and Apple's requirements.</p>
<h2>Contact</h2>
<p>Questions about this policy? Email <a href="mailto:info@wetyr.com">info@wetyr.com</a>.</p>
</body></html>`;

const TERMS_HTML = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pet Chores Terms of Use</title><style>${STYLE}</style></head><body>
<h1>Pet Chores Terms of Use (EULA)</h1>
<p class="muted">Last updated: June 2026</p>
<p>Your use of Pet Chores is governed by the Apple Standard End User License Agreement (EULA), available at
<a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/">apple.com/legal/internet-services/itunes/dev/stdeula</a>,
together with the subscription terms below.</p>
<h2>Subscriptions</h2>
<p>Pet Chores lets you train one pet for free. To train more, you can subscribe to one of these auto-renewable plans:</p>
<ul>
<li><strong>One Pet, weekly</strong> &mdash; one pet at a time, US$1.99 per week, after a 3-day free trial.</li>
<li><strong>One Pet, monthly</strong> &mdash; one pet at a time, US$4.99 per month, after a 3-day free trial.</li>
<li><strong>Unlimited Pets, monthly</strong> &mdash; train as many pets at once as you like, US$19.99 per month.</li>
</ul>
<h2>Billing and renewal</h2>
<p>Payment is charged to your Apple ID at confirmation of purchase. Subscriptions renew automatically at the price above unless cancelled at least 24 hours before the end of the current period. Your Apple ID is charged for renewal within 24 hours before the period ends. Any unused portion of a free trial is forfeited when you buy a subscription.</p>
<h2>Managing or cancelling</h2>
<p>You can manage or cancel your subscription any time in the App Store: open Settings, tap your name, then Subscriptions. Cancelling stops the next renewal; the current period continues until it ends.</p>
<h2>Privacy</h2>
<p>See our <a href="/privacy">Privacy Policy</a>. Pet Chores collects no personal data.</p>
<h2>Contact</h2>
<p>Email <a href="mailto:info@wetyr.com">info@wetyr.com</a>.</p>
</body></html>`;

const SUPPORT_HTML = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pet Chores Support</title><style>${STYLE}</style></head><body>
<h1>Pet Chores Support</h1>
<p>Need help? Email <a href="mailto:info@wetyr.com">info@wetyr.com</a> and we will get back to you.</p>
<h2>How do I open Parent Mode?</h2>
<p>Tap the "Grown-ups" lock button on the Home screen and enter the 4 digit PIN you created during setup.</p>
<h2>I forgot the Parent PIN.</h2>
<p>For privacy, the PIN is stored only as a scrambled value on your device and cannot be recovered. You can delete and reinstall the app to start fresh (this clears all local data).</p>
<h2>How do I add more pets?</h2>
<p>You can train one pet for free. To train more, open Parent Mode, choose Add more pets, and start a subscription. Use Restore Purchases on a new device. See our <a href="/terms">Terms of Use</a> for plan details.</p>
<h2>How do I manage or cancel a subscription?</h2>
<p>On your device, open Settings, tap your name, then Subscriptions, and choose Pet Chores. You can change or cancel there any time.</p>
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
<li><a href="/terms">Terms of Use (EULA)</a></li>
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
    if (path === "/terms") return new Response(TERMS_HTML, { headers });
    if (path === "/support") return new Response(SUPPORT_HTML, { headers });
    if (path === "/") return new Response(INDEX_HTML, { headers });
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
  }
};
