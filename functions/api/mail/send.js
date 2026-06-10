// /api/mail/send
// ─────────────────────────────────────────────────────────────────
// Outbound sender for mark@markcmo.com webmail.
// POSTs to Resend with the correct From + DKIM signing. Stores
// the sent message in mc_mailbox_messages for the sent folder.
//
// Mark's directive 2026-06-10: "setup somewhere clean so it works
// and does not rely on any other service or platform."
//   - Sender: this endpoint (on Cloudflare Pages, Mark's infra)
//   - Auth via Resend (Mark's account, sending key locked to markcmo.com)
//   - Storage: Supabase mc_mailbox_messages (Mark's DB)
//   - No Gmail, no M365, no GoDaddy in the path.

const HANDLER_VERSION = 'mail-send-v1-2026-06-10';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' });
  }

  // Auth: HTTP Basic with admin password
  const authOk = await checkAuth(request, env);
  if (!authOk) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Basic realm="MarkCMO Mail"',
      },
    });
  }

  // Parse body
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return jsonResponse(400, { error: 'invalid_json' });
  }

  const to = parseRecipients(payload.to);
  const cc = parseRecipients(payload.cc);
  const bcc = parseRecipients(payload.bcc);
  const subject = (payload.subject || '').toString().trim();
  const bodyText = (payload.body_text || payload.body || '').toString();
  const bodyHtml = (payload.body_html || '').toString() || textToHtml(bodyText);
  const replyTo = payload.reply_to || 'mark@markcmo.com';
  const inReplyTo = payload.in_reply_to || null;
  const referencesHeader = payload.references || null;

  if (to.length === 0) return jsonResponse(400, { error: 'missing_to' });
  if (!subject) return jsonResponse(400, { error: 'missing_subject' });
  if (!bodyText.trim()) return jsonResponse(400, { error: 'missing_body' });

  const fromName = payload.from_name || env.MAIL_FROM_NAME || 'Mark Gabrielli';
  const fromAddr = 'mark@markcmo.com';
  const fromHeader = `${fromName} <${fromAddr}>`;

  // Build Resend request
  const sendBody = {
    from: fromHeader,
    to,
    cc: cc.length ? cc : undefined,
    bcc: bcc.length ? bcc : undefined,
    reply_to: replyTo,
    subject,
    text: bodyText,
    html: bodyHtml,
    tags: [
      { name: 'category', value: 'mark_personal_outbound' },
      { name: 'source', value: 'mail_webui' },
    ],
  };
  // Thread headers (Resend supports these in headers map)
  if (inReplyTo || referencesHeader) {
    sendBody.headers = {};
    if (inReplyTo) sendBody.headers['In-Reply-To'] = inReplyTo;
    if (referencesHeader) sendBody.headers['References'] = referencesHeader;
  }

  // Send via Resend API
  let resendId = null;
  let resendStatus = 0;
  let sendError = null;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sendBody),
    });
    resendStatus = r.status;
    if (r.ok) {
      const j = await r.json().catch(() => null);
      resendId = j && j.id || null;
    } else {
      sendError = (await r.text().catch(() => '')).slice(0, 600);
    }
  } catch (e) {
    sendError = (e && e.message) || String(e);
  }

  // Store in mc_mailbox_messages (best-effort; don't fail send if DB write fails)
  let stored = null;
  try {
    const row = {
      direction: 'outbound',
      from_addr: fromAddr,
      from_name: fromName,
      to_addrs: to,
      cc_addrs: cc.length ? cc : null,
      bcc_addrs: bcc.length ? bcc : null,
      reply_to: replyTo,
      subject,
      body_text: bodyText,
      body_html: bodyHtml,
      body_preview: bodyText.replace(/\s+/g, ' ').trim().slice(0, 200),
      in_reply_to: inReplyTo,
      references_header: referencesHeader,
      resend_id: resendId,
      resend_status: resendStatus,
      send_error: sendError,
      read_at: new Date().toISOString(),  // outbound is read by default
      metadata: { handler_version: HANDLER_VERSION },
    };
    const ins = await sbInsert(env, 'mc_mailbox_messages', row);
    stored = ins[0]?.id || null;
  } catch (e) {
    // Don't fail the request just because storage failed. Log to audit.
    try {
      await sbInsert(env, 'mc_audit_log', {
        event: 'mailbox_store_failed',
        payload: {
          handler: 'mail_send', resend_id: resendId,
          error_message: (e && e.message) || String(e),
        },
      });
    } catch (_) {}
  }

  if (resendId) {
    return jsonResponse(200, {
      ok: true,
      resend_id: resendId,
      stored_id: stored,
    });
  }
  return jsonResponse(502, {
    ok: false,
    resend_status: resendStatus,
    send_error: sendError,
    stored_id: stored,
  });
}

// ───── Helpers ────────────────────────────────────────────────────
function parseRecipients(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(s => String(s).trim()).filter(Boolean);
  return String(input).split(/[,;]\s*/).map(s => s.trim()).filter(Boolean);
}

function textToHtml(text) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const paras = text.split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;">${paras}</div></body></html>`;
}

async function checkAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.toLowerCase().startsWith('basic ')) return false;
  let decoded;
  try {
    decoded = atob(auth.slice(6).trim());
  } catch (_) { return false; }
  const idx = decoded.indexOf(':');
  if (idx < 0) return false;
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  // Accept either MAIL_ADMIN_PASSWORD or fall back to ADMIN_PASSWORD env vars
  const expectedUser = env.MAIL_ADMIN_USER || 'mark@markcmo.com';
  const expectedPass = env.MAIL_ADMIN_PASSWORD || env.ADMIN_PASSWORD || '';
  if (!expectedPass) return false;
  // Constant-time-ish compare
  if (user !== expectedUser) return false;
  if (pass.length !== expectedPass.length) return false;
  let diff = 0;
  for (let i = 0; i < pass.length; i++) diff |= pass.charCodeAt(i) ^ expectedPass.charCodeAt(i);
  return diff === 0;
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
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
