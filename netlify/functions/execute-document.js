// ═══════════════════════════════════════════════════════════════
// execute-document.js - v2 (stateless)
// Mark uploads the signed PDF + his sig → we merge → email both
// ═══════════════════════════════════════════════════════════════
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch (e) { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { docName, docId, filename, fields, clientName, clientEmail, executedPdfBase64 } = body;

  if (!executedPdfBase64) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing executedPdfBase64' }) };
  if (!clientEmail)       return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing clientEmail' }) };
  if (!docName)           return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing docName' }) };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'RESEND_API_KEY not set' }) };

  const executedAt = new Date().toISOString();
  const executedDateStr = new Date(executedAt).toLocaleString('en-US', {
    timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short'
  });
  const execFilename = (filename || `${docName}.pdf`).replace(/\.pdf$/i, '') + '-EXECUTED.pdf';

  const fieldRows = Object.entries(fields || {})
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#888;font-size:13px;">${k}</td><td style="padding:4px 0;color:#222;font-size:13px;">${String(v).substring(0, 200)}</td></tr>`)
    .join('');

  const makeHtml = (recipientName, dark) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="background:${dark ? '#0d0d0d' : '#f9f8f5'};margin:0;padding:0;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;">
  <div style="background:#0d0d0d;padding:28px 32px;">
    <div style="font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#C6A654;margin-bottom:6px;">MarkCMO · Document Executed</div>
    <h1 style="font-size:22px;font-weight:700;color:#fff;margin:0;">${docName}</h1>
  </div>
  <div style="padding:28px 32px;background:${dark ? '#141414' : '#fff'};">
    <div style="background:#f0faf4;border:1px solid #b2dfcc;border-radius:4px;padding:14px 18px;margin-bottom:24px;font-size:14px;color:#1a5c36;">
      ✅ <strong>This document is fully executed.</strong> Both parties have signed.<br/>
      <span style="font-size:12px;color:#555;margin-top:4px;display:block;">Executed: ${executedDateStr} ET · ${docId || ''}</span>
    </div>
    <p style="font-size:14px;color:${dark ? '#ccc' : '#333'};line-height:1.6;margin:0 0 20px;">Hi ${recipientName}, the executed copy of <strong>${docName}</strong> is attached. Please retain it for your records.</p>
    <table style="border-collapse:collapse;width:100%;margin-bottom:20px;">${fieldRows}</table>
    <div style="border-top:1px solid ${dark ? '#2a2a2a' : '#e8e8e8'};padding-top:16px;font-size:12px;color:#999;">
      Questions? <a href="mailto:mark@markcmo.com" style="color:#C6A654;">mark@markcmo.com</a>
    </div>
  </div>
  <div style="background:#0d0d0d;padding:16px 32px;font-size:11px;color:#555;text-align:center;">
    Mark Gabrielli · Fractional CMO · markcmo.com
  </div>
</div></body></html>`;

  const results = await Promise.allSettled([
    // Client gets executed copy
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Mark Gabrielli <mark@markcmo.com>',
        to: [clientEmail],
        reply_to: 'mark@markcmo.com',
        subject: `✅ Executed: ${docName}`,
        html: makeHtml(clientName || 'there', false),
        attachments: [{ filename: execFilename, content: executedPdfBase64 }],
      }),
    }),
    // Mark gets his copy
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'MarkCMO Documents <forms@markcmo.com>',
        to: ['mark@markcmo.com'],
        reply_to: clientEmail,
        subject: `✅ Executed: ${docName} - ${clientName || clientEmail}`,
        html: makeHtml('Mark', true),
        attachments: [{ filename: execFilename, content: executedPdfBase64 }],
      }),
    }),
  ]);

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'rejected') console.error(`Email ${i} error:`, r.reason);
    else r.value.json().then(d => { if (d.statusCode >= 400) console.error(`Email ${i} API error:`, JSON.stringify(d)); }).catch(() => {});
  }

  if (results[0].status === 'rejected') {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to send executed document: ' + results[0].reason }) };
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ success: true, executedAt, filename: execFilename }),
  };
};
