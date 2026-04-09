const crypto = require('crypto');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function makeToken(payload, secret) {
  const data = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return Buffer.from(JSON.stringify({ ...payload, hmac })).toString('base64url');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch (e) { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { docName, docId, filename, fields, pdfBase64, clientName, clientEmail, clientSigBase64, markSig } = body;
  if (!pdfBase64)       return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing pdfBase64' }) };
  if (!docName)         return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing docName' }) };
  if (!clientEmail)     return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing clientEmail' }) };
  if (!clientSigBase64) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing clientSigBase64' }) };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'RESEND_API_KEY not set' }) };

  const submittedAt = new Date().toISOString();
  const secret = process.env.TOKEN_SECRET || 'markcmo-signing-secret-change-me';
  const jsonbinKey = process.env.JSONBIN_API_KEY;

  // ── Try to store PDF in JSONBin (if key set) ──────────────
  let binId = null;
  if (jsonbinKey) {
    try {
      const binRes = await fetch('https://api.jsonbin.io/v3/b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': jsonbinKey,
          'X-Bin-Name': `${docId || docName}-${Date.now()}`,
          'X-Bin-Private': 'true',
        },
        body: JSON.stringify({ pdfBase64, clientSigBase64, submittedAt }),
      });
      const binData = await binRes.json();
      if (binData.metadata?.id) {
        binId = binData.metadata.id;
        console.log('Stored PDF in JSONBin, id:', binId);
      } else {
        console.warn('JSONBin storage failed:', JSON.stringify(binData));
      }
    } catch (e) {
      console.warn('JSONBin error:', e.message);
    }
  }

  // ── Build token (metadata + optional binId) ───────────────
  const tokenPayload = {
    docName, docId: docId || '', filename: filename || `${docName}.pdf`,
    fields: fields || {}, clientName: clientName || '', clientEmail,
    submittedAt, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    ...(binId ? { binId } : {}),
    ...(markSig ? { markSig } : {}),
  };
  const token = makeToken(tokenPayload, secret);

  const siteUrl = process.env.URL || 'https://markcmo.com';
  const countersignUrl = `${siteUrl}/sign?token=${token}`;
  const submittedDateStr = new Date(submittedAt).toLocaleString('en-US', {
    timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short'
  });

  const fieldRows = Object.entries(fields || {})
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `<tr><td style="padding:5px 16px 5px 0;color:#888;font-size:13px;white-space:nowrap;">${k}</td><td style="padding:5px 0;color:#f0f0f0;font-size:13px;">${String(v).substring(0, 200)}</td></tr>`)
    .join('');

  const markHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="background:#0d0d0d;margin:0;padding:0;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 24px;">
  <div style="margin-bottom:24px;">
    <div style="font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#C6A654;margin-bottom:8px;">MarkCMO · Countersignature Needed</div>
    <h1 style="font-size:22px;font-weight:700;color:#fff;margin:0 0 6px;">${docName}</h1>
    <div style="font-size:12px;color:#666;">${docId || ''} · ${submittedDateStr} ET</div>
  </div>
  <div style="background:#141414;border:1px solid #2a2a2a;border-radius:4px;padding:20px;margin-bottom:20px;">
    <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#C6A654;margin-bottom:12px;">Submitted By</div>
    <table style="border-collapse:collapse;width:100%;">${fieldRows}</table>
  </div>
  ${binId ? '' : '<div style="background:#1a1208;border:1px solid #3a2a10;border-radius:3px;padding:12px 16px;margin-bottom:16px;font-size:12px;color:#C6A654;">📎 Signed PDF attached — save it, then upload on the countersign page.</div>'}
  <a href="${countersignUrl}" style="display:block;background:#C6A654;color:#000;font-weight:700;font-size:14px;letter-spacing:.08em;text-transform:uppercase;text-decoration:none;padding:16px 24px;border-radius:4px;text-align:center;margin-bottom:16px;">
    ✍ Review &amp; Countersign →
  </a>
  <div style="font-size:11px;color:#444;line-height:1.6;">
    ${binId ? 'The document loads automatically on the countersign page — just draw your signature and click Execute.' : 'Download the attached PDF, then upload it on the countersign page.'}
    Link expires: ${new Date(tokenPayload.expiresAt).toLocaleDateString('en-US', { dateStyle: 'long' })}
  </div>
</div></body></html>`;

  const clientFieldRows = Object.entries(fields || {})
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `<tr><td style="padding:5px 16px 5px 0;color:#888;font-size:13px;">${k}</td><td style="padding:5px 0;color:#333;font-size:13px;">${String(v).substring(0, 200)}</td></tr>`)
    .join('');

  const clientHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="background:#f9f8f5;margin:0;padding:0;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;">
  <div style="background:#0d0d0d;padding:28px 32px;">
    <div style="font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#C6A654;margin-bottom:6px;">MarkCMO · Document Received</div>
    <h1 style="font-size:22px;font-weight:700;color:#fff;margin:0;">${docName}</h1>
  </div>
  <div style="padding:28px 32px;background:#fff;">
    <div style="background:#fffbf0;border:1px solid #e8d98a;border-radius:4px;padding:14px 18px;margin-bottom:24px;font-size:14px;color:#7a6010;">
      ⏳ <strong>Your signed document has been received.</strong><br/>
      <span style="font-size:12px;color:#888;margin-top:4px;display:block;">Mark will countersign within 24 hours. You'll receive the fully executed copy by email.</span>
    </div>
    <p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 16px;">Hi ${clientName || 'there'}, your signed copy of <strong>${docName}</strong> is attached for your records.</p>
    <table style="border-collapse:collapse;width:100%;margin-bottom:20px;">${clientFieldRows}</table>
    <div style="font-size:13px;color:#555;line-height:1.7;background:#f5f5f5;padding:16px;border-radius:4px;">
      <strong>What happens next:</strong><br/>
      1. Mark reviews and countersigns within 24 hours<br/>
      2. Both you and Mark receive the fully executed PDF<br/>
      3. The agreement is legally binding from that point forward
    </div>
    <div style="border-top:1px solid #e8e8e8;padding-top:16px;margin-top:20px;font-size:12px;color:#999;">
      Questions? <a href="mailto:mark@markcmo.com" style="color:#C6A654;">mark@markcmo.com</a>
    </div>
  </div>
  <div style="background:#0d0d0d;padding:16px 32px;font-size:11px;color:#555;text-align:center;">
    Mark Gabrielli · Fractional CMO · markcmo.com
  </div>
</div></body></html>`;

  const execFilename = (filename || `${docName}.pdf`).replace(/\.pdf$/i, '') + '-signed.pdf';

  const emails = [
    {
      from: 'MarkCMO Documents <forms@markcmo.com>',
      to: ['mark@markcmo.com'],
      reply_to: clientEmail,
      subject: `✍ Countersignature Needed: ${docName} — ${clientName || clientEmail}`,
      html: markHtml,
      click_tracking: false,
      open_tracking: false,
      ...(binId ? {} : { attachments: [{ filename: execFilename, content: pdfBase64 }] }),
    },
    {
      from: 'Mark Gabrielli <mark@markcmo.com>',
      to: [clientEmail],
      subject: `📄 Received: ${docName} — Pending Countersignature`,
      html: clientHtml,
      attachments: [{ filename: execFilename, content: pdfBase64 }],
    },
  ];

  const results = await Promise.allSettled(emails.map(payload =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  ));

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'rejected') { console.error(`Email ${i} error:`, r.reason); }
    else { r.value.clone().json().then(d => { if (d.statusCode >= 400) console.error(`Email ${i}:`, JSON.stringify(d)); }).catch(()=>{}); }
  }

  if (results[0].status === 'rejected') {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to send email: ' + results[0].reason }) };
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ success: true, token, hasBin: !!binId,
      message: `Document submitted. Mark will countersign within 24 hours and you'll receive the executed copy at ${clientEmail}.` }),
  };
};
