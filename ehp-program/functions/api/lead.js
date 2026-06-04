// ===================================================================
// functions/api/lead.js  (Cloudflare Pages Function)
//
// Public lead-capture endpoint for the Zero Pay Benefits
// (EHP / Section 125 preventative care program) site.
//
// Receives a POST from the landing pages and emails the lead to Mark
// via Resend. No DB write. Honeypot + basic validation guard against spam.
//
// Route: /api/lead   (POST JSON, OPTIONS preflight)
// Env:   RESEND_API_KEY  (set in the Cloudflare Pages project)
// Returns: { ok: true } on success.
// ===================================================================

const LEAD_TO = ['mark@markcmo.com', 'marklgabriellijr@gmail.com'];
const LEAD_FROM = 'Zero Pay Benefits <mark@markcmo.com>'; // verified markcmo.com domain in Resend

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const corsHeaders = (request) => ({
  'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
});

const json = (obj, status, headers) =>
  new Response(JSON.stringify(obj), { status, headers });

export async function onRequest(context) {
  const { request, env } = context;
  const headers = corsHeaders(request);

  if (request.method === 'OPTIONS') return new Response('', { status: 204, headers });
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405, headers);

  let b;
  try { b = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400, headers); }

  // Honeypot: bots fill hidden field. Pretend success, send nothing.
  if (b.website && String(b.website).trim() !== '') {
    return json({ ok: true }, 200, headers);
  }

  const firstName = String(b.firstName || '').trim();
  const lastName = String(b.lastName || '').trim();
  const company = String(b.company || '').trim();
  const email = String(b.email || '').trim();
  const employees = String(b.employees || '').trim();
  if (!firstName || !lastName || !company || !email || !employees) {
    return json({ error: 'Missing required fields.' }, 400, headers);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Invalid email address.' }, 400, headers);
  }

  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return json({ error: 'Email service not configured.' }, 500, headers);

  const phone = String(b.phone || '').trim();
  const orgType = String(b.orgType || '').trim();
  const message = String(b.message || '').trim();
  const estimate = String(b.estimate || '').trim();
  const source = String(b.source || 'zeropaybenefits').trim();
  const pageUrl = String(b.pageUrl || '').trim();
  const submittedAt = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

  const row = (label, value) => value
    ? `<tr><td style="padding:8px 14px;font-weight:700;color:#0B1F2A;border-bottom:1px solid #EEF4F5;white-space:nowrap;vertical-align:top;">${esc(label)}</td><td style="padding:8px 14px;color:#15323C;border-bottom:1px solid #EEF4F5;">${esc(value)}</td></tr>`
    : '';

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:#0B1F2A;color:#fff;padding:22px 26px;border-radius:12px 12px 0 0;">
      <div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#E0A82E;font-weight:700;">New Lead - Zero Pay Benefits</div>
      <div style="font-size:22px;font-weight:700;margin-top:4px;">${esc(company)}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #DCE6E8;border-top:0;">
      ${row('Name', firstName + ' ' + lastName)}
      ${row('Company', company)}
      ${row('Work email', email)}
      ${row('Phone', phone)}
      ${row('Employees', employees)}
      ${row('Organization', orgType)}
      ${row('Calculator estimate', estimate)}
      ${row('Message', message)}
      ${row('Source', source)}
      ${row('Page', pageUrl)}
      ${row('Submitted', submittedAt + ' ET')}
    </table>
    <div style="background:#E8F8EE;color:#15803D;padding:14px 26px;border-radius:0 0 12px 12px;font-size:14px;font-weight:600;">
      Reply to this email to reach ${esc(firstName)} directly.
    </div>
  </div>`;

  const text = [
    'New lead - Zero Pay Benefits',
    'Name: ' + firstName + ' ' + lastName,
    'Company: ' + company,
    'Email: ' + email,
    'Phone: ' + phone,
    'Employees: ' + employees,
    'Org type: ' + orgType,
    'Estimate: ' + estimate,
    'Message: ' + message,
    'Source: ' + source,
    'Page: ' + pageUrl,
    'Submitted: ' + submittedAt + ' ET'
  ].join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: LEAD_FROM,
        to: LEAD_TO,
        reply_to: email,
        subject: `New lead: ${company} (${employees} employees)`,
        html,
        text
      })
    });
    if (!res.ok) {
      const detail = await res.text();
      return json({ error: 'Email send failed.', detail: detail.slice(0, 300) }, 502, headers);
    }
  } catch (e) {
    return json({ error: 'Email send error: ' + e.message }, 502, headers);
  }

  return json({ ok: true }, 200, headers);
}
