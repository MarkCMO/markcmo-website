// /api/approval/decide
// ─────────────────────────────────────────────────────────────────
// One-click approve/decline endpoint for prospect-facing emails
// queued in mc_pending_outbound_emails.
//
// URL:   /api/approval/decide?token=<approval_token>&action=approve
//        /api/approval/decide?token=<approval_token>&action=decline
//
// Mark's directive 2026-06-09: every prospect-facing email is gated
// through this endpoint. On approve: POST to Resend (with scheduled_at
// preserved if in future). On decline: mark row, never sends.
//
// Returns a styled HTML confirmation page so Mark sees what happened.

const HANDLER_VERSION = 'approval-decide-v1-2026-06-09';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  const action = (url.searchParams.get('action') || '').toLowerCase();

  if (!token || !['approve', 'decline'].includes(action)) {
    return htmlResponse(400, errorPage('Bad request', 'Missing or invalid token / action.'));
  }

  // Look up the pending email by approval_token
  let row;
  try {
    const rows = await sbSelect(env,
      `mc_pending_outbound_emails?approval_token=eq.${encodeURIComponent(token)}&select=*&limit=1`);
    row = rows && rows[0];
  } catch (e) {
    return htmlResponse(500, errorPage('Database error', (e && e.message) || String(e)));
  }
  if (!row) {
    return htmlResponse(404, errorPage('Not found', 'No pending email matches this approval token. It may have expired or already been processed.'));
  }

  // Idempotency: if already decided/sent, show the existing state.
  if (row.status === 'approved' || row.status === 'sent') {
    return htmlResponse(200, statusPage('Already approved', row, {
      headline: row.status === 'sent' ? 'Already sent ✓' : 'Already approved ✓',
      detail: row.status === 'sent'
        ? `Delivered via Resend. Resend ID: ${esc(row.resend_id || 'unknown')}`
        : `Queued for delivery at the scheduled time.`,
    }));
  }
  if (row.status === 'declined') {
    return htmlResponse(200, statusPage('Already declined', row, {
      headline: 'Already declined ✗',
      detail: 'This email was previously declined and will not send.',
    }));
  }
  if (row.status === 'expired' || row.status === 'superseded') {
    return htmlResponse(200, statusPage('Stale', row, {
      headline: `Email is ${row.status}`,
      detail: row.status === 'expired'
        ? 'The scheduled send time passed without a decision.'
        : 'A newer version of this email replaced it.',
    }));
  }

  // status === 'pending' — process the action
  if (action === 'decline') {
    try {
      await sbUpdate(env, 'mc_pending_outbound_emails', `id=eq.${encodeURIComponent(row.id)}`, {
        status: 'declined',
        declined_at: new Date().toISOString(),
        decision_via: 'one_click',
      });
      await auditDecision(env, row, 'declined');
    } catch (e) {
      return htmlResponse(500, errorPage('Update failed', (e && e.message) || String(e)));
    }
    return htmlResponse(200, statusPage('Declined', row, {
      headline: 'Declined ✗',
      detail: 'This email will not send. Logged to audit.',
    }));
  }

  // action === 'approve' — fire the Resend send
  let resendId = null;
  let resendStatus = 0;
  let sendError = null;
  try {
    const sendBody = {
      from: row.from_addr,
      to: [row.recipient_email],
      reply_to: row.reply_to || undefined,
      cc: Array.isArray(row.cc) && row.cc.length > 0 ? row.cc : undefined,
      subject: row.subject,
      html: row.body_html || undefined,
      text: row.body_text,
      tags: Array.isArray(row.tags_json) ? row.tags_json : undefined,
      attachments: Array.isArray(row.attachments_json) ? row.attachments_json : undefined,
    };
    // Preserve scheduled_at if the scheduled time is still in the future.
    // If past, Resend would reject - send now instead.
    if (row.scheduled_send_at) {
      const schedMs = new Date(row.scheduled_send_at).getTime();
      if (!isNaN(schedMs) && schedMs > Date.now() + 30 * 1000) {
        // Resend caps scheduled_at at 28 days ahead
        const maxAheadMs = 28 * 24 * 60 * 60 * 1000;
        if (schedMs - Date.now() <= maxAheadMs) {
          sendBody.scheduled_at = new Date(schedMs).toISOString();
        }
      }
    }
    const headers = {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    };
    if (row.resend_idempotency_key) {
      headers['Idempotency-Key'] = row.resend_idempotency_key;
    }
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify(sendBody),
    });
    resendStatus = r.status;
    if (r.ok) {
      const j = await r.json().catch(() => null);
      resendId = j && j.id || null;
    } else {
      sendError = (await r.text().catch(() => '')).slice(0, 500);
    }
  } catch (e) {
    sendError = (e && e.message) || String(e);
  }

  const updates = {
    status: resendId ? 'approved' : 'send_failed',
    approved_at: new Date().toISOString(),
    decision_via: 'one_click',
    resend_id: resendId,
    resend_status: resendStatus,
    send_error: sendError,
  };
  if (resendId && (!row.scheduled_send_at || new Date(row.scheduled_send_at).getTime() <= Date.now() + 30 * 1000)) {
    updates.sent_at = new Date().toISOString();
    updates.status = 'sent';
  }
  try {
    await sbUpdate(env, 'mc_pending_outbound_emails', `id=eq.${encodeURIComponent(row.id)}`, updates);
    await auditDecision(env, row, updates.status, { resend_id: resendId, resend_status: resendStatus, send_error: sendError });
  } catch (e) {
    return htmlResponse(500, errorPage('Update failed after Resend send', `Resend ID: ${resendId || 'none'}. DB error: ${(e && e.message) || String(e)}`));
  }

  if (resendId) {
    return htmlResponse(200, statusPage('Approved', row, {
      headline: updates.status === 'sent' ? 'Sent ✓' : 'Approved ✓',
      detail: updates.status === 'sent'
        ? `Delivered via Resend. ID: ${esc(resendId)}`
        : `Queued for delivery at ${esc(new Date(row.scheduled_send_at).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }))} ET. Resend ID: ${esc(resendId)}`,
    }));
  }
  return htmlResponse(502, statusPage('Send failed', row, {
    headline: 'Approved but send failed',
    detail: `Resend returned ${resendStatus}: ${esc(sendError || 'unknown')}. The row is marked send_failed - retry manually.`,
  }));
}

// ───── Helpers ────────────────────────────────────────────────────
function sbHeaders(env) {
  const key = env.MARKCMO_SUPABASE_SERVICE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}
async function sbSelect(env, path) {
  const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders(env) });
  if (!res.ok) throw new Error(`sbSelect ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
async function sbUpdate(env, table, filter, body) {
  const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(env), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`sbUpdate ${table} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
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

async function auditDecision(env, row, statusAfter, extras = {}) {
  try {
    await sbInsert(env, 'mc_audit_log', {
      client_id: row.client_id || null,
      engagement_id: row.engagement_id || null,
      event: 'pending_email_decision',
      payload: {
        pending_email_id: row.id,
        source: row.source,
        recipient_email: row.recipient_email,
        status_after: statusAfter,
        scheduled_send_at: row.scheduled_send_at,
        handler_version: HANDLER_VERSION,
        ...extras,
      },
    });
  } catch (_) {}
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function htmlResponse(status, body) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// WETYR dark navy design system
function pageShell(title, innerHtml) {
  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · MarkCMO Approval</title>
</head>
<body style="margin:0;padding:0;background:#0a0f2c;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Inter',Arial,sans-serif;color:#fff;min-height:100vh;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="min-height:100vh;background:#0a0f2c;">
<tr><td align="center" valign="middle" style="padding:48px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0F1828;border-radius:16px;overflow:hidden;">
${innerHtml}
</table>
</td></tr></table>
</body></html>`;
}

function errorPage(headline, detail) {
  return pageShell(headline, `
<tr><td style="padding:40px 36px;">
<div style="display:inline-block;padding:6px 14px;background:rgba(231,76,60,0.16);border-radius:9999px;margin-bottom:16px;">
<span style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#e74c3c;font-weight:700;">error</span>
</div>
<h1 style="margin:0 0 12px;font-family:'Newsreader','Charter',Georgia,serif;font-size:32px;font-weight:500;line-height:1.1;color:#fff;">${esc(headline)}</h1>
<div style="font-size:15px;line-height:1.6;color:rgba(255,255,255,0.78);">${esc(detail)}</div>
</td></tr>`);
}

function statusPage(title, row, { headline, detail }) {
  const tier = headline.includes('Approved') || headline.includes('Sent') ? 'ok' : headline.includes('Declined') ? 'neutral' : 'stale';
  const tierColor = tier === 'ok' ? '#7DB87D' : tier === 'neutral' ? '#7BA7E0' : '#A1A1AA';
  const tierBg = tier === 'ok' ? 'rgba(125,184,125,0.16)' : tier === 'neutral' ? 'rgba(123,167,224,0.16)' : 'rgba(161,161,170,0.16)';
  return pageShell(title, `
<tr><td style="padding:40px 36px 24px;">
<div style="display:inline-block;padding:6px 14px;background:${tierBg};border-radius:9999px;margin-bottom:18px;">
<span style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${tierColor};font-weight:700;">${esc(row.source)}</span>
</div>
<h1 style="margin:0 0 12px;font-family:'Newsreader','Charter',Georgia,serif;font-size:36px;font-weight:500;line-height:1.05;letter-spacing:-0.02em;color:#fff;">${esc(headline)}</h1>
<div style="font-size:15px;line-height:1.6;color:rgba(255,255,255,0.78);margin-bottom:24px;">${esc(detail)}</div>
</td></tr>
<tr><td style="padding:0 36px 32px;">
<div style="padding:18px 20px;background:rgba(255,255,255,0.04);border-radius:10px;">
<div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.5);font-weight:600;margin-bottom:8px;">to</div>
<div style="font-size:14px;color:rgba(255,255,255,0.92);font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;margin-bottom:14px;">${esc(row.recipient_email)}</div>
<div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.5);font-weight:600;margin-bottom:8px;">subject</div>
<div style="font-size:15px;color:#fff;font-weight:500;">${esc(row.subject)}</div>
</div>
</td></tr>
<tr><td style="padding:0 36px 36px;">
<a href="/admin/bookings" style="font-size:13px;color:#C9A84C;text-decoration:none;">Back to admin →</a>
</td></tr>`);
}
