// /api/lead
// ─────────────────────────────────────────────────────────────────
// Inbound contact-form receiver for markcmo.com.
//
// Replaces the broken Netlify Forms POST-to-"/" pattern that has
// silently dropped every contact-form submission since the May 29
// 2026 Cloudflare migration. The old JS submitted to "/" expecting
// Netlify to pick it up; CF Pages just answered with the homepage
// HTML, the fetch resolved 200, and the user saw "Message Sent" -
// but no data was stored and Mark never got an email.
//
// What this does:
//   1. Accept POST (JSON or x-www-form-urlencoded)
//   2. Light spam check + light validation
//   3. Store in mc_inbound_leads
//   4. Email Mark immediately at mark@markcmo.com via Resend
//      (this is INBOUND notification to Mark, not outbound to the
//       prospect, so it does NOT go through the approval queue)
//   5. Return JSON {ok: true}
//
// HANDLER_VERSION below is a sentinel that ships with each deploy.

const HANDLER_VERSION = 'lead-v1-2026-06-12';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' });
  }

  // Parse body - accept JSON or urlencoded (form posts)
  const payload = await parseBody(request);
  if (!payload) return jsonResponse(400, { error: 'invalid_body' });

  // Honeypot check (hidden bot-field)
  if (payload['bot-field'] && String(payload['bot-field']).trim()) {
    return jsonResponse(200, { ok: true, spam: true });
  }

  const source = String(payload['form-name'] || payload.source || 'unknown').slice(0, 80);
  const name = String(payload.name || payload.full_name || '').trim().slice(0, 200);
  const email = String(payload.email || '').trim().toLowerCase().slice(0, 200);
  const company = String(payload.company || '').trim().slice(0, 200);
  const phone = String(payload.phone || '').trim().slice(0, 60);
  const message = String(payload.message || payload.challenge || payload.biggestChallenge || '').trim().slice(0, 5000);

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return jsonResponse(400, { error: 'invalid_email' });
  }

  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
  const userAgent = request.headers.get('user-agent') || '';
  const referer = request.headers.get('referer') || '';

  // Rapid-duplicate guard: a double-clicked form (same email inside RECENT_DUP_MS)
  // must not fire a second identical alert to Mark - repeated near-identical mail
  // is a spam-filter trigger. We still STORE every submission; we only suppress the
  // duplicate NOTIFICATION.
  const RECENT_DUP_MS = 60 * 1000;
  const isRapidDuplicate = await recentDuplicateExists(env, email, RECENT_DUP_MS);

  // Insert into Supabase
  let leadId = null;
  try {
    const inserted = await sbInsert(env, 'mc_inbound_leads', {
      source,
      page_url: referer,
      name: name || null,
      email,
      company: company || null,
      phone: phone || null,
      message: message || null,
      ip,
      user_agent: userAgent,
      raw: payload,
      status: 'new',
    });
    leadId = inserted?.[0]?.id || null;
  } catch (e) {
    // DB failure must not block - audit log + send the email anyway
    await safeAudit(env, 'lead_db_insert_failed', { error: String(e), payload: redact(payload) });
  }

  // Email Mark with the lead (skipped when this is a rapid duplicate of a just-received lead)
  let resendId = null;
  let notifyError = null;
  try {
    if (isRapidDuplicate) {
      await safeAudit(env, 'lead_notify_skipped_duplicate', { email, lead_id: leadId, source });
      return jsonResponse(200, {
        ok: true,
        lead_id: leadId,
        notified: false,
        duplicate: true,
        handler_version: HANDLER_VERSION,
      });
    }
    const html = renderEmailHtml({ source, name, email, company, phone, message, referer, ip, leadId });
    const text = renderEmailText({ source, name, email, company, phone, message, referer, leadId });
    const subject = buildSubject({ source, name, company, email });

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'MarkCMO Leads <leads@markcmo.com>',
        to: ['mark@markcmo.com'],
        reply_to: email,
        subject,
        html,
        text,
        tags: [
          { name: 'category', value: 'inbound_lead' },
          { name: 'source', value: source.replace(/[^a-z0-9_]/gi, '_').slice(0, 40) },
        ],
      }),
    });
    if (r.ok) {
      const j = await r.json().catch(() => null);
      resendId = j && j.id || null;
    } else {
      notifyError = (await r.text().catch(() => '')).slice(0, 600);
    }
  } catch (e) {
    notifyError = (e && e.message) || String(e);
  }

  // Update lead row with notification result (best-effort)
  if (leadId) {
    try {
      await sbPatch(env, 'mc_inbound_leads', `id=eq.${leadId}`, {
        notified_at: new Date().toISOString(),
        resend_id: resendId,
        status: resendId ? 'notified' : 'new',
      });
    } catch (_) {}
  }

  if (notifyError) {
    await safeAudit(env, 'lead_notify_failed', { error: notifyError, lead_id: leadId, source });
  }

  return jsonResponse(200, {
    ok: true,
    lead_id: leadId,
    notified: Boolean(resendId),
    handler_version: HANDLER_VERSION,
  });
}

// ───── Helpers ────────────────────────────────────────────────────

async function parseBody(request) {
  const ct = (request.headers.get('content-type') || '').toLowerCase();
  try {
    if (ct.includes('application/json')) {
      return await request.json();
    }
    if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
      const fd = await request.formData();
      const out = {};
      for (const [k, v] of fd.entries()) out[k] = typeof v === 'string' ? v : v.name || '';
      return out;
    }
    // Try JSON first, then urlencoded fallback
    const text = await request.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (_) {
      const out = {};
      for (const [k, v] of new URLSearchParams(text).entries()) out[k] = v;
      return out;
    }
  } catch (_) {
    return null;
  }
}

function buildSubject({ source, name, company, email }) {
  const who = name ? name : email;
  const where = company ? ` (${company})` : '';
  const sourceLabel = friendlyFormName(source);
  return `New lead: ${who}${where} via ${sourceLabel}`;
}

function friendlyFormName(source) {
  const map = {
    homepage_cta: 'Homepage form',
    contact: 'Contact page',
    fractional_cmo: 'Fractional CMO page',
    fractional_coo: 'Fractional COO page',
    marketing_strategy: 'Marketing Strategy page',
    executive_advisory: 'Executive Advisory page',
    book_inquiry: 'Book inquiry',
    'book-inquiry': 'Book inquiry',
  };
  return map[source] || source.replace(/[_-]+/g, ' ');
}

function renderEmailHtml({ source, name, email, company, phone, message, referer, ip, leadId }) {
  const row = (label, value) => value
    ? `<tr><td style="padding:6px 18px 6px 0;color:#9aa0a6;font-size:13px;white-space:nowrap;vertical-align:top;">${esc(label)}</td><td style="padding:6px 0;color:#111;font-size:14px;">${esc(value)}</td></tr>`
    : '';
  const messageBlock = message
    ? `<div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:6px;padding:14px 16px;margin:18px 0;color:#111;font-size:14px;line-height:1.55;white-space:pre-wrap;">${esc(message)}</div>`
    : `<div style="color:#9aa0a6;font-size:13px;font-style:italic;margin:18px 0;">(no message provided)</div>`;
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f6f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:24px 16px;">
  <div style="background:#fff;border-radius:8px;border:1px solid #e5e7eb;padding:24px;">
    <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#C9A84C;font-weight:700;margin-bottom:6px;">New lead</div>
    <h1 style="font-size:20px;font-weight:700;color:#111;margin:0 0 4px;">${esc(name || email)}</h1>
    <div style="font-size:13px;color:#6b7280;margin-bottom:18px;">${esc(friendlyFormName(source))} &middot; ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</div>

    <table style="border-collapse:collapse;width:100%;margin-bottom:4px;">
      ${row('Name', name)}
      ${row('Email', email)}
      ${row('Company', company)}
      ${row('Phone', phone)}
      ${row('Page', referer)}
    </table>

    ${messageBlock}

    <div style="margin-top:20px;display:flex;gap:8px;">
      <a href="mailto:${esc(email)}?subject=${encodeURIComponent('Re: your message to MarkCMO')}" style="display:inline-block;background:#C9A84C;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:10px 18px;border-radius:6px;">Reply to ${esc(name || email)}</a>
    </div>

    <div style="margin-top:18px;border-top:1px solid #e5e7eb;padding-top:14px;font-size:11px;color:#9aa0a6;">
      Lead #${leadId || '?'} &middot; IP ${esc(ip || 'unknown')} &middot; Source: <code>${esc(source)}</code>
    </div>
  </div>
</div>
</body></html>`;
}

function renderEmailText({ source, name, email, company, phone, message, referer, leadId }) {
  const lines = [
    `New lead from markcmo.com`,
    ``,
    `From:    ${name || '(no name)'}`,
    `Email:   ${email}`,
  ];
  if (company) lines.push(`Company: ${company}`);
  if (phone)   lines.push(`Phone:   ${phone}`);
  if (referer) lines.push(`Page:    ${referer}`);
  lines.push(``);
  lines.push(`Message:`);
  lines.push(message || '(none)');
  lines.push(``);
  lines.push(`---`);
  lines.push(`Lead #${leadId || '?'}  Source: ${source}`);
  return lines.join('\n');
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function sbHeaders(env) {
  const key = env.MARKCMO_SUPABASE_SERVICE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}
async function sbInsert(env, table, body) {
  const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...sbHeaders(env), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`sbInsert ${table} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
async function sbPatch(env, table, filter, body) {
  const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(env), Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`sbPatch ${table} ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function safeAudit(env, event, payload) {
  try {
    await sbInsert(env, 'mc_audit_log', { event, payload });
  } catch (_) {}
}

// True if a lead with this email was already stored within `windowMs` (double-submit).
// Best-effort: any lookup failure returns false so a real lead is never silently dropped.
async function recentDuplicateExists(env, email, windowMs) {
  if (!email) return false;
  try {
    const since = new Date(Date.now() - windowMs).toISOString();
    const filter = `email=eq.${encodeURIComponent(email)}&created_at=gte.${encodeURIComponent(since)}&limit=1`;
    const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/mc_inbound_leads?${filter}`, {
      method: 'GET',
      headers: sbHeaders(env),
    });
    if (!res.ok) return false;
    const rows = await res.json().catch(() => null);
    return Array.isArray(rows) && rows.length > 0;
  } catch (_) {
    return false;
  }
}

function redact(p) {
  if (!p || typeof p !== 'object') return p;
  const out = {};
  for (const [k, v] of Object.entries(p)) out[k] = typeof v === 'string' ? v.slice(0, 300) : v;
  return out;
}
