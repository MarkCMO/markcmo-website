// ═══════════════════════════════════════════════════════════════
// Netlify Function: email-form.js
// Receives filled PDF data from form pages → emails to Mark
//
// Uses Resend (resend.com - free 3000 emails/mo, no credit card)
// Set env var in Netlify dashboard: RESEND_API_KEY=re_xxxxxxxxxx
// ═══════════════════════════════════════════════════════════════

exports.handler = async (event) => {
  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // CORS headers so the form pages can POST cross-origin
  const headers = {
    'Access-Control-Allow-Origin': 'https://markcmo.com',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { docName, docId, filename, fields, pdfBase64, senderEmail, senderName } = body;

  if (!pdfBase64 || !docName) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Email service not configured' }) };
  }

  // Build a clean summary table of submitted fields
  const fieldRows = Object.entries(fields || {})
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#888;white-space:nowrap;">${k}</td><td style="padding:4px 0;color:#fff;">${v}</td></tr>`)
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="background:#0d0d0d;margin:0;padding:0;font-family:'Arial',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">

    <div style="margin-bottom:24px;">
      <span style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#C6A654;">MarkCMO Document System</span>
      <h1 style="font-size:22px;font-weight:700;color:#fff;margin:8px 0 4px;">${docName}</h1>
      <span style="font-size:12px;color:#666;">${docId || ''} &nbsp;·&nbsp; Submitted ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</span>
    </div>

    <div style="background:#141414;border:1px solid #2a2a2a;border-radius:4px;padding:20px;margin-bottom:20px;">
      <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#C6A654;margin-bottom:12px;">Submitted By</div>
      <table style="border-collapse:collapse;width:100%;font-size:13px;">
        ${fieldRows || '<tr><td style="color:#888;">No field data captured</td></tr>'}
      </table>
    </div>

    <div style="background:#141414;border:1px solid rgba(198,166,84,0.3);border-radius:4px;padding:16px;margin-bottom:20px;">
      <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#C6A654;margin-bottom:8px;">Attached File</div>
      <span style="font-size:13px;color:#ccc;">📎 ${filename || docName + '.pdf'}</span>
    </div>

    ${senderEmail ? `
    <div style="border-top:1px solid #2a2a2a;padding-top:16px;font-size:12px;color:#666;">
      Reply-to: <a href="mailto:${senderEmail}" style="color:#C6A654;">${senderEmail}</a>
      ${senderName ? ` &nbsp;·&nbsp; ${senderName}` : ''}
    </div>` : ''}

  </div>
</body>
</html>`;

  // Send via Resend API
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'MarkCMO Forms <forms@markcmo.com>',
        to: ['mark@markcmo.com'],
        reply_to: senderEmail || undefined,
        subject: `📋 ${docName} - Submitted by ${senderName || senderEmail || 'a client'}`,
        html,
        attachments: [
          {
            filename: filename || `${docName}.pdf`,
            content: pdfBase64,
          }
        ],
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Resend error:', result);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: 'Email delivery failed', detail: result }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, id: result.id }),
    };

  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error', detail: err.message }),
    };
  }
};
