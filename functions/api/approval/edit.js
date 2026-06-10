// /api/approval/edit
// ─────────────────────────────────────────────────────────────────
// GET  /api/approval/edit?token=<approval_token>
//   Renders an editor with the email subject + body, lets Mark
//   change them, then submits POST to this same path.
//
// POST /api/approval/edit?token=<approval_token>
//   Body: form-encoded { subject, body_text, action }
//   Updates the row's subject/body_text/body_html (HTML regenerated
//   from text), saves the prior version into edit_history, and if
//   action='approve_after_edit' immediately approves + fires Resend.

const HANDLER_VERSION = 'approval-edit-v1-2026-06-09';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  if (!token) return htmlResponse(400, errorPage('Bad request', 'Missing token.'));

  let row;
  try {
    const rows = await sbSelect(env, `mc_pending_outbound_emails?approval_token=eq.${encodeURIComponent(token)}&select=*&limit=1`);
    row = rows && rows[0];
  } catch (e) {
    return htmlResponse(500, errorPage('Database error', (e && e.message) || String(e)));
  }
  if (!row) return htmlResponse(404, errorPage('Not found', 'No pending email for this token.'));

  if (request.method === 'GET') {
    return htmlResponse(200, editorPage(row));
  }

  if (request.method === 'POST') {
    // Only allow editing if still pending
    if (row.status !== 'pending') {
      return htmlResponse(409, errorPage('Already decided', `This email is ${row.status}. Cannot edit.`));
    }

    const form = await request.formData().catch(() => null);
    if (!form) return htmlResponse(400, errorPage('Bad request', 'Invalid form data.'));

    const newSubject = String(form.get('subject') || '').trim();
    const newBodyText = String(form.get('body_text') || '').trim();
    const action = String(form.get('action') || 'save');

    if (!newSubject || !newBodyText) {
      return htmlResponse(400, errorPage('Validation', 'Subject and body cannot be empty.'));
    }

    // Generate updated HTML from the new plain text. Keep it simple: wrap
    // each paragraph in <p>. Mark's edits stay readable in both formats.
    const newBodyHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body>
<div>
${newBodyText.split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n')}
</div>
</body></html>`;

    const editHistoryEntry = {
      edited_at: new Date().toISOString(),
      before_subject: row.subject,
      before_body_text: row.body_text,
      via: 'web_editor',
    };
    const updatedHistory = Array.isArray(row.edit_history) ? [...row.edit_history, editHistoryEntry] : [editHistoryEntry];

    try {
      await sbUpdate(env, 'mc_pending_outbound_emails', `id=eq.${encodeURIComponent(row.id)}`, {
        subject: newSubject,
        body_text: newBodyText,
        body_html: newBodyHtml,
        edit_history: updatedHistory,
      });
    } catch (e) {
      return htmlResponse(500, errorPage('Save failed', (e && e.message) || String(e)));
    }

    if (action === 'approve_after_edit') {
      // Redirect to the decide endpoint with action=approve
      const decideUrl = new URL('/api/approval/decide', request.url);
      decideUrl.searchParams.set('token', token);
      decideUrl.searchParams.set('action', 'approve');
      return Response.redirect(decideUrl.toString(), 303);
    }
    return htmlResponse(200, savedPage(token, newSubject));
  }

  return new Response('Method not allowed', { status: 405 });
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

function pageShell(title, inner) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · MarkCMO Approval</title></head>
<body style="margin:0;padding:0;background:#0a0f2c;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Inter',Arial,sans-serif;color:#fff;min-height:100vh;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="min-height:100vh;background:#0a0f2c;">
<tr><td align="center" valign="top" style="padding:48px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;background:#0F1828;border-radius:16px;overflow:hidden;">
${inner}
</table></td></tr></table></body></html>`;
}

function errorPage(headline, detail) {
  return pageShell(headline, `
<tr><td style="padding:40px 36px;">
<h1 style="margin:0 0 12px;font-family:'Newsreader','Charter',Georgia,serif;font-size:32px;font-weight:500;line-height:1.1;color:#fff;">${esc(headline)}</h1>
<div style="font-size:15px;line-height:1.6;color:rgba(255,255,255,0.78);">${esc(detail)}</div>
</td></tr>`);
}

function savedPage(token, newSubject) {
  return pageShell('Saved', `
<tr><td style="padding:40px 36px;">
<h1 style="margin:0 0 12px;font-family:'Newsreader','Charter',Georgia,serif;font-size:32px;font-weight:500;line-height:1.1;color:#fff;">Saved ✓</h1>
<div style="font-size:15px;line-height:1.6;color:rgba(255,255,255,0.78);margin-bottom:24px;">Updated subject: <strong>${esc(newSubject)}</strong>. Email still PENDING — approve or decline when ready.</div>
<a href="/api/approval/decide?token=${esc(token)}&action=approve" style="display:inline-block;padding:12px 24px;background:#7DB87D;color:#0a0f2c;font-weight:700;font-size:14px;text-decoration:none;border-radius:8px;margin-right:10px;">Approve send</a>
<a href="/api/approval/decide?token=${esc(token)}&action=decline" style="display:inline-block;padding:12px 24px;background:transparent;color:#e74c3c;border:1px solid rgba(231,76,60,0.4);font-weight:600;font-size:14px;text-decoration:none;border-radius:8px;">Decline</a>
</td></tr>`);
}

function editorPage(row) {
  const whenStr = row.scheduled_send_at
    ? new Date(row.scheduled_send_at).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }) + ' ET'
    : 'send now on approval';
  return pageShell('Edit email', `
<tr><td style="padding:40px 36px 0;">
<div style="display:inline-block;padding:6px 14px;background:rgba(201,168,76,0.16);border-radius:9999px;margin-bottom:16px;">
<span style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#C9A84C;font-weight:700;">${esc(row.source)}</span>
</div>
<h1 style="margin:0 0 8px;font-family:'Newsreader','Charter',Georgia,serif;font-size:32px;font-weight:500;line-height:1.1;color:#fff;">Edit before sending</h1>
<div style="font-size:14px;color:rgba(255,255,255,0.65);margin-bottom:6px;">To: <strong style="color:rgba(255,255,255,0.9);font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;">${esc(row.recipient_email)}</strong></div>
<div style="font-size:14px;color:rgba(255,255,255,0.65);">Scheduled: <strong style="color:rgba(255,255,255,0.9);">${esc(whenStr)}</strong></div>
</td></tr>
<tr><td style="padding:28px 36px 36px;">
<form method="POST" action="/api/approval/edit?token=${esc(row.approval_token)}">
<label style="display:block;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.55);font-weight:600;margin-bottom:8px;">subject</label>
<input type="text" name="subject" value="${esc(row.subject)}" required style="width:100%;box-sizing:border-box;padding:12px 14px;font-size:15px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#fff;font-family:inherit;margin-bottom:20px;">

<label style="display:block;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.55);font-weight:600;margin-bottom:8px;">body</label>
<textarea name="body_text" required rows="18" style="width:100%;box-sizing:border-box;padding:14px;font-size:14px;line-height:1.6;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#fff;font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;margin-bottom:24px;resize:vertical;">${esc(row.body_text)}</textarea>

<div style="display:flex;gap:10px;flex-wrap:wrap;">
<button type="submit" name="action" value="approve_after_edit" style="padding:13px 24px;background:#7DB87D;color:#0a0f2c;border:none;font-weight:700;font-size:14px;border-radius:8px;cursor:pointer;">Save + approve send</button>
<button type="submit" name="action" value="save" style="padding:13px 24px;background:rgba(255,255,255,0.06);color:#fff;border:1px solid rgba(255,255,255,0.16);font-weight:600;font-size:14px;border-radius:8px;cursor:pointer;">Save edits only</button>
<a href="/api/approval/decide?token=${esc(row.approval_token)}&action=decline" style="padding:13px 24px;background:transparent;color:#e74c3c;border:1px solid rgba(231,76,60,0.4);font-weight:600;font-size:14px;border-radius:8px;text-decoration:none;display:inline-block;">Decline</a>
</div>
</form>
</td></tr>`);
}
