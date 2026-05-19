/**
 * functions/api/lead.js — MarkCMO Lead Capture
 *
 * Handles form submissions from all markcmo.com pages.
 * Sends email via Resend (RESEND_API_KEY already in Cloudflare env from
 * email-form.js setup). Also stores to KV if LEADS binding is configured.
 *
 * Env vars (Cloudflare Pages > Settings > Environment variables):
 *   RESEND_API_KEY  — Already configured. Sends email to mark@markcmo.com.
 *   LEADS           — Optional KV namespace binding for record storage.
 *   LEAD_WEBHOOK    — Optional Make.com/Zapier webhook URL.
 */

const TO_EMAIL   = 'mark@markcmo.com';
const FROM_EMAIL = 'MarkCMO Leads <leads@markcmo.com>';

export async function onRequestPost(context) {
  const { request, env } = context;

  // ── Parse body (urlencoded or JSON) ────────────────────────────────────────
  let data = {};
  try {
    const ct = (request.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/json')) {
      data = await request.json();
    } else {
      const text = await request.text();
      for (const pair of text.split('&')) {
        const eq = pair.indexOf('=');
        if (eq === -1) continue;
        const k = decodeURIComponent(pair.slice(0, eq).replace(/\+/g, ' '));
        const v = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' '));
        if (k) data[k] = v;
      }
    }
  } catch (_) {}

  // ── Honeypot spam check ────────────────────────────────────────────────────
  if (data['bot-field'] && data['bot-field'].trim()) {
    return ok({ spam: true });
  }

  // ── Enrich ─────────────────────────────────────────────────────────────────
  const ts     = new Date().toISOString();
  const ip     = request.headers.get('CF-Connecting-IP') || '';
  const city   = (request.cf && request.cf.city)   || '';
  const region = (request.cf && request.cf.region) || '';
  const ref    = request.headers.get('referer')    || '';

  const name    = (data.name    || '').trim();
  const email   = (data.email   || '').trim();
  const company = (data.company || '').trim();
  const phone   = (data.phone   || '').trim();
  const msg     = (data.message || '').trim();
  const form    = (data['form-name'] || 'contact').trim();
  const page    = ref ? new URL(ref).pathname : '';

  const leadId = `lead_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;

  // ── Store in KV ────────────────────────────────────────────────────────────
  if (env.LEADS) {
    try {
      await env.LEADS.put(leadId, JSON.stringify({ ...data, ts, ip, city, region, ref }), {
        expirationTtl: 60 * 60 * 24 * 365,
        metadata: { name, email, form, ts },
      });
    } catch (_) {}
  }

  // ── Send email via Resend ──────────────────────────────────────────────────
  if (env.RESEND_API_KEY) {
    try {
      const replyTo = email ? [{ email, name: name || undefined }] : undefined;
      const subject = `New Lead${name ? ': ' + name : ''}${company ? ' @ ' + company : ''} — ${form}`;

      const html = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0f0f0f;font-family:-apple-system,Segoe UI,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#111;border:1px solid #2a2a2a;border-radius:8px;overflow:hidden;">
  <tr><td style="background:#C9A84C;padding:20px 32px;">
    <div style="font-size:22px;font-weight:900;color:#0f0f0f;">MarkCMO — New Lead</div>
    <div style="font-size:13px;color:#4a3000;margin-top:4px;">${esc(form)} · ${ts.slice(0,16).replace('T',' ')} UTC</div>
  </td></tr>
  <tr><td style="padding:32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${row('Name',    name    || '—')}
      ${row('Email',   email   ? `<a href="mailto:${esc(email)}" style="color:#C9A84C;">${esc(email)}</a>` : '—')}
      ${company ? row('Company', company) : ''}
      ${phone   ? row('Phone',   phone)   : ''}
      ${msg     ? row('Message', `<div style="white-space:pre-wrap;max-width:420px;">${esc(msg)}</div>`) : ''}
      ${page    ? row('Page',    `<a href="https://markcmo.com${esc(page)}" style="color:#C9A84C;">${esc(page)}</a>`) : ''}
      ${city    ? row('Location', esc(city) + (region ? ', ' + esc(region) : '')) : ''}
      ${ip      ? row('IP',       esc(ip)) : ''}
    </table>
  </td></tr>
  <tr><td style="padding:0 32px 32px;">
    ${email ? `<a href="mailto:${esc(email)}?subject=Re: Your MarkCMO Inquiry&body=Hi ${esc(name)},%0A%0A" style="display:inline-block;background:#C9A84C;color:#0f0f0f;padding:12px 24px;border-radius:6px;font-weight:700;text-decoration:none;font-size:14px;">Reply to ${esc(name || email)}</a>` : ''}
  </td></tr>
</table>
</body></html>`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to:   [TO_EMAIL],
          reply_to: replyTo,
          subject,
          html,
        }),
      });
    } catch (e) {
      console.error('[lead] Resend error:', e.message);
    }
  }

  // ── Forward to webhook (Make/Zapier) ───────────────────────────────────────
  if (env.LEAD_WEBHOOK) {
    try {
      await fetch(env.LEAD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, name, email, company, phone, message: msg, form, page, city, region, ts }),
      });
    } catch (_) {}
  }

  return ok({ id: leadId });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors() });
}

export async function onRequestGet() {
  return ok({ service: 'markcmo-lead-capture', status: 'ok' });
}

function ok(data) {
  return new Response(JSON.stringify(data), { status: 200, headers: cors() });
}
function cors() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function row(label, value) {
  return `<tr>
    <td style="padding:8px 12px 8px 0;font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.05em;vertical-align:top;white-space:nowrap;">${label}</td>
    <td style="padding:8px 0;font-size:14px;color:#e8e8e8;border-bottom:1px solid #1e1e1e;">${value}</td>
  </tr>`;
}
