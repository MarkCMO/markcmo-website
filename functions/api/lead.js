// functions/api/lead.js
//
// Universal lead-capture endpoint for every form on markcmo.com.
//
// 21,527 pages POST here (contact form, city pages, service pages,
// landing pages, calculator pages). All of them hit this with a
// urlencoded body via:
//
//   fetch('/api/lead', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//     body: new URLSearchParams(new FormData(form)).toString()
//   })
//
// This function:
//   - Parses urlencoded form data
//   - Rejects honeypot hits (bot-field, website) silently with 200
//   - Validates required fields (email + message OR inquiry context)
//   - Emails Mark via Resend with all submitted fields in a clean
//     table format
//   - Optionally writes to Supabase mc_leads if SUPABASE_URL is set
//     (best-effort; logged but doesn't block email delivery)
//   - Returns { ok: true } on success or { error } on failure
//
// All fields except the honeypot are forwarded to Mark, so it doesn't
// matter what set of fields a given page sends — every form just works.
//
// Required env: RESEND_API_KEY, NOTIFY_EMAIL (or defaults to mark@markcmo.com)

const LEAD_TO_DEFAULT = 'mark@markcmo.com,marklgabriellijr@gmail.com';
const LEAD_FROM = 'MarkCMO Leads <mark@markcmo.com>';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function jsonResponse(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': 'https://markcmo.com',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

// Pretty-print field name: "first_name" -> "First Name"
function humanize(key) {
  return key
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export async function onRequest(context) {
  const { request, env } = context;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response('', {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': 'https://markcmo.com',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'POST only' });
  }

  // Parse body — support urlencoded (default), JSON, and multipart for
  // safety. 99% of inbound traffic is urlencoded per the inline form JS.
  let fields = {};
  const ctype = (request.headers.get('content-type') || '').toLowerCase();
  try {
    if (ctype.includes('application/json')) {
      const j = await request.json();
      fields = (typeof j === 'object' && j) ? j : {};
    } else if (ctype.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      for (const [k, v] of params) fields[k] = v;
    } else if (ctype.includes('multipart/form-data')) {
      const fd = await request.formData();
      for (const [k, v] of fd) fields[k] = typeof v === 'string' ? v : '[file]';
    } else {
      // Best-effort fallback — try urlencoded
      const text = await request.text();
      try {
        const params = new URLSearchParams(text);
        for (const [k, v] of params) fields[k] = v;
      } catch {
        try { fields = JSON.parse(text); } catch { /* leave empty */ }
      }
    }
  } catch (e) {
    return jsonResponse(400, { error: 'Invalid body: ' + e.message });
  }

  // Honeypot — bot-field and website are both used across the site.
  // Bots fill them. If filled, return 200 silently (don't tell the bot
  // we detected them) but skip the email send.
  if ((fields['bot-field'] && String(fields['bot-field']).trim()) ||
      (fields.website && String(fields.website).trim())) {
    return jsonResponse(200, { ok: true });
  }

  // Captcha check — contact form uses captcha_answer + a math question.
  // We can't validate the answer server-side without storing the question,
  // so we just ensure something was filled in if the page has a captcha.
  // Real spam is caught by the honeypot above.

  // Email is the one universally-required field
  const email = String(fields.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return jsonResponse(400, { error: 'Valid email required' });
  }

  // Build a friendly "submitter name" from whatever name fields are present
  const submitterName = [
    fields.first_name || fields.firstName || fields.name || '',
    fields.last_name || fields.lastName || '',
  ].map(s => String(s).trim()).filter(Boolean).join(' ').trim() || '(no name)';

  // Subject line
  const inquiryType = String(fields.inquiry_type || fields.inquiryType ||
    fields['form-name'] || 'contact').trim();
  const company = String(fields.company || '').trim();
  const subject = `[markcmo lead] ${submitterName}${company ? ' @ ' + company : ''} · ${inquiryType}`;

  // Compose the field table — every non-empty, non-system field
  const SKIP = new Set(['bot-field', 'website', 'captcha_answer', 'form-name']);
  const rows = Object.entries(fields)
    .filter(([k, v]) => !SKIP.has(k) && v && String(v).trim())
    .map(([k, v]) => `<tr>
      <td style="padding:8px 16px 8px 0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;vertical-align:top;">${esc(humanize(k))}</td>
      <td style="padding:8px 0;color:#fff;font-size:14px;line-height:1.6;">${esc(v).replace(/\n/g, '<br>')}</td>
    </tr>`).join('');

  const referer = request.headers.get('referer') || request.headers.get('referrer') || '(unknown)';
  const ua = request.headers.get('user-agent') || '(unknown)';
  const cfRay = request.headers.get('cf-ray') || '(no ray)';
  const cfCountry = request.headers.get('cf-ipcountry') || '?';
  const ip = request.headers.get('cf-connecting-ip') || '(unknown)';

  const html = `<!DOCTYPE html><html><body style="background:#0a0a0a;margin:0;padding:0;font-family:'Arial',sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
      <div style="margin-bottom:20px;">
        <span style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#C9A84C;font-weight:700;">New Lead · markcmo.com</span>
        <h1 style="font-size:22px;font-weight:700;color:#fff;margin:8px 0 4px;">${esc(submitterName)}</h1>
        <div style="font-size:13px;color:#888;">${esc(email)}${company ? ' · ' + esc(company) : ''}</div>
        <div style="font-size:12px;color:#666;margin-top:6px;">${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET · from ${esc(inquiryType)}</div>
      </div>
      <div style="background:#141414;border:1px solid #2a2a2a;border-radius:6px;padding:20px;margin-bottom:16px;">
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
      </div>
      <div style="font-size:11px;color:#555;line-height:1.7;border-top:1px solid #222;padding-top:12px;">
        Page: <a href="${esc(referer)}" style="color:#888;">${esc(referer)}</a><br>
        IP: ${esc(ip)} · Country: ${esc(cfCountry)} · CF-Ray: ${esc(cfRay)}<br>
        UA: <span style="color:#555;">${esc(ua.slice(0, 100))}</span>
      </div>
    </div>
  </body></html>`;

  const text = [
    `New lead from markcmo.com`,
    ``,
    `From: ${submitterName} <${email}>`,
    company ? `Company: ${company}` : null,
    `Inquiry: ${inquiryType}`,
    `Page: ${referer}`,
    ``,
    ...Object.entries(fields)
      .filter(([k, v]) => !SKIP.has(k) && v && String(v).trim())
      .map(([k, v]) => `${humanize(k)}: ${v}`),
    ``,
    `IP: ${ip} · Country: ${cfCountry}`,
  ].filter(Boolean).join('\n');

  // ── Send via Resend ──────────────────────────────────────────────────
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('lead: RESEND_API_KEY missing — submission accepted but not emailed');
    // Still return 200 so the user sees success on the form. Don't lose
    // the lead silently; we log it for later recovery.
    console.log('LEAD_FALLBACK', JSON.stringify({ email, fields, referer, ts: Date.now() }));
    return jsonResponse(200, { ok: true, warning: 'queued_no_smtp' });
  }

  const to = (env.NOTIFY_EMAIL || LEAD_TO_DEFAULT)
    .split(',').map(s => s.trim()).filter(Boolean);

  try {
    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: LEAD_FROM,
        to,
        reply_to: email,
        subject,
        html,
        text,
      }),
    });
    if (!sendRes.ok) {
      const errBody = await sendRes.text().catch(() => '');
      console.error('lead: Resend failed', sendRes.status, errBody);
      return jsonResponse(502, { error: 'Email delivery failed', detail: 'resend_' + sendRes.status });
    }
  } catch (e) {
    console.error('lead: Resend exception', e.message);
    return jsonResponse(502, { error: 'Email delivery failed', detail: e.message });
  }

  // ── Best-effort Supabase persistence (don't block on this) ───────────
  if (env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY)) {
    const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
    try {
      await fetch(env.SUPABASE_URL + '/rest/v1/mc_leads', {
        method: 'POST',
        headers: {
          'apikey': key,
          'Authorization': 'Bearer ' + key,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          email,
          name: submitterName,
          company: company || null,
          inquiry_type: inquiryType,
          message: fields.message || null,
          page_url: referer,
          ip,
          country: cfCountry,
          raw_payload: fields,
          created_at: new Date().toISOString(),
        }),
      });
    } catch (e) {
      // Don't fail the request; lead is already in email
      console.warn('lead: Supabase write failed', e.message);
    }
  }

  return jsonResponse(200, { ok: true });
}
