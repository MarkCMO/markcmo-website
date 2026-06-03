// ═══════════════════════════════════════════════════════════════
// Cloudflare Pages Function: /api/lead
// Receives leads from public contact forms across markcmo.com.
// REJECTS empty/spam submissions with clear 400 errors so the
// client cannot show false-positive success messages.
// ═══════════════════════════════════════════════════════════════

const ALLOWED_ORIGINS = new Set([
  'https://markcmo.com',
  'https://www.markcmo.com',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://markcmo.com';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(status, body, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json',
    },
  });
}

async function parseBody(request) {
  const ct = (request.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) {
    return await request.json();
  }
  if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    const form = await request.formData();
    const out = {};
    for (const [k, v] of form.entries()) out[k] = typeof v === 'string' ? v : '';
    return out;
  }
  // Fallback: try JSON, then URL-encoded
  const text = await request.text();
  try {
    return JSON.parse(text);
  } catch {
    return Object.fromEntries(new URLSearchParams(text));
  }
}

function clean(v) {
  return (v == null ? '' : String(v)).trim();
}

function validate(body) {
  const errors = [];
  const name = clean(body.name);
  const email = clean(body.email);
  const company = clean(body.company);
  const phone = clean(body.phone);
  const service = clean(body.service);
  const message = clean(body.message);
  const honeypot = clean(body['bot-field']);

  // Honeypot — silently drop bot submissions
  if (honeypot) {
    return { spam: true };
  }

  if (!name || name.length < 2) {
    errors.push({ field: 'name', message: 'Please enter your full name.' });
  }
  if (name.length > 200) {
    errors.push({ field: 'name', message: 'Name is too long.' });
  }
  if (!email) {
    errors.push({ field: 'email', message: 'Please enter your work email.' });
  } else if (!EMAIL_RE.test(email)) {
    errors.push({ field: 'email', message: 'Please enter a valid email address.' });
  } else if (email.length > 254) {
    errors.push({ field: 'email', message: 'Email is too long.' });
  }
  if (company.length > 200 || phone.length > 50 || service.length > 200 || message.length > 5000) {
    errors.push({ field: 'general', message: 'One or more fields are too long.' });
  }

  return {
    errors,
    data: { name, email, company, phone, service, message,
            formName: clean(body['form-name']) || 'page-contact' },
  };
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin') || '') });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('origin') || '';

  let body;
  try {
    body = await parseBody(request);
  } catch (e) {
    return json(400, { ok: false, error: 'invalid_body' }, origin);
  }

  const v = validate(body);

  // Silent honeypot accept (don't reveal the trap to bots)
  if (v.spam) {
    return json(200, { ok: true, spam: true }, origin);
  }

  if (v.errors && v.errors.length) {
    return json(400, { ok: false, error: 'validation_failed', errors: v.errors }, origin);
  }

  const d = v.data;
  const apiKey = env && env.RESEND_API_KEY;
  if (!apiKey) {
    // Fail loudly — we want to know if the secret is missing.
    return json(500, { ok: false, error: 'email_not_configured' }, origin);
  }

  const escape = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const subject = `[markcmo lead] ${escape(d.name)} @ ${escape(d.company || 'no company')} · ${escape(d.service || d.formName)}`;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="background:#0d0d0d;margin:0;padding:0;font-family:Arial,sans-serif;color:#eee;">
<div style="max-width:600px;margin:0 auto;padding:24px;">
  <div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#C6A654;margin-bottom:6px;">New Lead · ${d.formName}</div>
  <h1 style="font-size:20px;margin:0 0 16px;color:#fff;">${escape(d.name)}</h1>
  <table style="border-collapse:collapse;width:100%;font-size:13px;">
    <tr><td style="padding:6px 12px 6px 0;color:#888;width:90px;">Email</td><td style="padding:6px 0;"><a href="mailto:${escape(d.email)}" style="color:#C6A654;">${escape(d.email)}</a></td></tr>
    ${d.company ? `<tr><td style="padding:6px 12px 6px 0;color:#888;">Company</td><td style="padding:6px 0;color:#fff;">${escape(d.company)}</td></tr>` : ''}
    ${d.phone ? `<tr><td style="padding:6px 12px 6px 0;color:#888;">Phone</td><td style="padding:6px 0;color:#fff;">${escape(d.phone)}</td></tr>` : ''}
    ${d.service ? `<tr><td style="padding:6px 12px 6px 0;color:#888;">Service</td><td style="padding:6px 0;color:#fff;">${escape(d.service)}</td></tr>` : ''}
  </table>
  ${d.message ? `<div style="margin-top:16px;padding:14px;background:#141414;border:1px solid #2a2a2a;border-radius:4px;color:#ddd;white-space:pre-wrap;">${escape(d.message)}</div>` : ''}
</div></body></html>`;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'MarkCMO <forms@markcmo.com>',
        to: ['mark@markcmo.com', 'marklgabriellijr@gmail.com'],
        reply_to: d.email,
        subject,
        html,
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      return json(502, { ok: false, error: 'email_delivery_failed', detail: txt.slice(0, 500) }, origin);
    }
    const out = await resp.json();
    return json(200, { ok: true, id: out.id }, origin);
  } catch (e) {
    return json(500, { ok: false, error: 'server_error' }, origin);
  }
}

// Reject everything else
export async function onRequest({ request }) {
  if (request.method === 'POST') return onRequestPost({ request, env: {} });
  if (request.method === 'OPTIONS') return onRequestOptions({ request });
  return new Response('Method Not Allowed', { status: 405 });
}
