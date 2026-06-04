// netlify/functions/health-check.js
// Daily synthetic check of the booking + lead-capture funnel.
// Invoked by the CF cron worker (POST, X-Cron-Secret) once a day, or
// manually via GET ?key=<CRON_SHARED_SECRET>.
//
// Verifies, with NO side effects (no leads stored, no marketing mail sent):
//   1. Calendly booking page is live and the event type still exists
//   2. The key form pages render with their form markup present
//   3. The capture pipeline is wired: JSONBin + Resend env present and
//      the leads / drip bins are readable with the expected shape
//
// Emails Mark a one-line digest each run (internal/transactional alert,
// so it skips the bulk-outreach validation waterfall).
//
// Reuses the same infra/env as leak-audit-signup.js:
//   JSONBIN_API_KEY, JSONBIN_BIN_ID, JSONBIN_DRIP_BIN_ID
//   WEBINAR_RESEND_KEY || RESEND_API_KEY
//   NOTIFY_EMAIL (comma-separated, defaults to mark@markcmo.com)
//   PAGES_BASE_URL (defaults to https://markcmo.com)
//   CRON_SHARED_SECRET (auth)

const CALENDLY_URL = 'https://calendly.com/marklgabriellijr/discovery-call-marketing-clone';

exports.handler = async (event) => {
  const method = event.httpMethod;
  if (method === 'OPTIONS') return resp(200, '');

  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = process.env.CRON_SHARED_SECRET || '';
  const provided = (event.headers && (event.headers['x-cron-secret'] || event.headers['X-Cron-Secret'])) ||
                   (event.queryStringParameters && event.queryStringParameters.key) || '';
  if (secret && provided !== secret) return resp(403, JSON.stringify({ error: 'forbidden' }));

  const base = process.env.PAGES_BASE_URL || 'https://markcmo.com';
  const checks = [];

  // 1) Calendly booking page
  checks.push(await checkCalendly());

  // 2) Form pages render with their form markup
  const pages = [
    { path: '/leak-audit.html', marker: 'id="leakForm"', label: 'Leak-audit capture form' },
    { path: '/book.html', marker: 'Calendly', label: 'Booking page (book.html)' },
    { path: '/', marker: 'home-audit-offer', label: 'Homepage audit offer band' },
    { path: '/account-based-marketing-tampa-fl.html', marker: 'mc-form', label: 'Programmatic page form (sample)' },
  ];
  for (const p of pages) checks.push(await checkPage(base, p));

  // 3) Capture pipeline config + storage reachability
  checks.push(...await checkPipeline());

  const failures = checks.filter(c => !c.ok);
  const ok = failures.length === 0;
  const summary = ok
    ? 'All systems healthy'
    : `${failures.length} issue${failures.length === 1 ? '' : 's'}: ${failures.map(f => f.name).join(', ')}`;

  // Daily digest email (best-effort; never throws the request)
  let emailed = false;
  try { emailed = await sendDigest(ok, summary, checks); }
  catch (err) { console.error('[health-check] digest email failed:', err && err.message); }

  console.log(`[health-check] ${ok ? 'OK' : 'ALERT'} - ${summary}`);
  return resp(ok ? 200 : 503, JSON.stringify({ ok, summary, emailed, checks, ranAt: new Date().toISOString() }, null, 2));
};

// ── Individual checks ─────────────────────────────────────────────────────────
async function checkCalendly() {
  const name = 'Calendly booking';
  try {
    const res = await fetch(CALENDLY_URL, { headers: { 'User-Agent': 'markcmo-health/1.0' } });
    const body = (await res.text()).toLowerCase();
    const gone = /no longer available|not a valid|event type.*not found|page not found/.test(body);
    if (!res.ok) return fail(name, `HTTP ${res.status}`);
    if (gone) return fail(name, 'event type appears deleted/renamed');
    return pass(name, `HTTP ${res.status}, event type live`);
  } catch (err) { return fail(name, err && err.message || 'fetch failed'); }
}

async function checkPage(base, p) {
  const name = p.label;
  try {
    const res = await fetch(base + p.path, { headers: { 'User-Agent': 'markcmo-health/1.0' } });
    if (!res.ok) return fail(name, `HTTP ${res.status} at ${p.path}`);
    const body = await res.text();
    if (!body.includes(p.marker)) return fail(name, `loaded but "${p.marker}" missing`);
    return pass(name, `HTTP ${res.status}, form markup present`);
  } catch (err) { return fail(name, err && err.message || 'fetch failed'); }
}

async function checkPipeline() {
  const out = [];
  const { JSONBIN_API_KEY, JSONBIN_BIN_ID, JSONBIN_DRIP_BIN_ID } = process.env;
  const resendKey = process.env.WEBINAR_RESEND_KEY || process.env.RESEND_API_KEY;

  // env presence
  const missing = [];
  if (!JSONBIN_API_KEY) missing.push('JSONBIN_API_KEY');
  if (!JSONBIN_BIN_ID) missing.push('JSONBIN_BIN_ID');
  if (!JSONBIN_DRIP_BIN_ID) missing.push('JSONBIN_DRIP_BIN_ID');
  if (!resendKey) missing.push('RESEND key');
  out.push(missing.length ? fail('Capture env config', `missing: ${missing.join(', ')}`)
                          : pass('Capture env config', 'all keys present'));

  // leads bin readable + shaped
  if (JSONBIN_API_KEY && JSONBIN_BIN_ID) out.push(await checkBin('Leads store (JSONBin)', JSONBIN_BIN_ID, JSONBIN_API_KEY, 'leads'));
  // drip queue readable + shaped
  if (JSONBIN_API_KEY && JSONBIN_DRIP_BIN_ID) out.push(await checkBin('Drip queue (JSONBin)', JSONBIN_DRIP_BIN_ID, JSONBIN_API_KEY, 'queue'));

  return out;
}

async function checkBin(name, binId, key, field) {
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
      headers: { 'X-Master-Key': key, 'Content-Type': 'application/json' }
    });
    if (!res.ok) return fail(name, `HTTP ${res.status}`);
    const data = await res.json();
    const val = data && data.record && data.record[field];
    if (!Array.isArray(val)) return fail(name, `readable but record.${field} is not an array`);
    return pass(name, `reachable, ${val.length} record(s)`);
  } catch (err) { return fail(name, err && err.message || 'fetch failed'); }
}

// ── Digest email ──────────────────────────────────────────────────────────────
async function sendDigest(ok, summary, checks) {
  const apiKey = process.env.WEBINAR_RESEND_KEY || process.env.RESEND_API_KEY;
  if (!apiKey) { console.warn('[health-check] no Resend key - skipping digest email'); return false; }
  const to = (process.env.NOTIFY_EMAIL || 'mark@markcmo.com').split(',').map(s => s.trim()).filter(Boolean);
  const rows = checks.map(c => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #1a1a1a;font-size:13px;">${c.ok ? '✅' : '🚨'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1a1a1a;font-size:13px;color:#fff;font-weight:600;">${esc(c.name)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1a1a1a;font-size:13px;color:#999;">${esc(c.detail)}</td>
    </tr>`).join('');
  const html = `<div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#0a0a0a;padding:32px;">
    <div style="max-width:640px;margin:0 auto;background:#111;border-top:3px solid ${ok ? '#3fb950' : '#C9A84C'};padding:28px 32px;">
      <div style="font-size:10px;letter-spacing:4px;color:#C9A84C;text-transform:uppercase;margin-bottom:6px;">MarkCMO Monitor</div>
      <h2 style="color:#fff;margin:0 0 4px;font-size:20px;">${ok ? '✅ Daily health: all green' : '🚨 Daily health: action needed'}</h2>
      <p style="color:#999;margin:0 0 20px;font-size:14px;">${esc(summary)}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>
      <p style="color:#444;font-size:11px;margin:24px 0 0;">Booking + lead-capture funnel check &middot; ${new Date().toUTCString()}</p>
    </div>
  </div>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'MarkCMO Monitor <mark@markcmo.com>',
      to,
      subject: ok ? '✅ MarkCMO daily health: all green' : `🚨 MarkCMO daily health: ${summary}`,
      html
    })
  });
  if (!res.ok) throw new Error(`Resend error: ${await res.text()}`);
  return true;
}

// ── helpers ───────────────────────────────────────────────────────────────────
function pass(name, detail) { return { name, ok: true, detail }; }
function fail(name, detail) { return { name, ok: false, detail }; }
function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
function resp(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body };
}
