// ═══════════════════════════════════════════════════════════════
// execute-engagement-doc.js
// Mark uploads countersigned PDF + sig. We:
//   1. Upload executed PDF + Mark sig PNG to Supabase Storage.
//   2. Update mc_documents (executed_at, consultant_signed_at, status).
//   3. Update mc_engagements (status='signed' if not already).
//   4. Insert mc_audit_log event 'executed'.
//   5. Email both parties the executed PDF via Resend.
// ═══════════════════════════════════════════════════════════════
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const STORAGE_BUCKET = 'markcmo-engagement-docs';

function sb() {
  // Namespaced to avoid collision with existing SUPABASE_* vars (different project)
  const url = process.env.MARKCMO_SUPABASE_URL;
  const key = process.env.MARKCMO_SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('MARKCMO_SUPABASE_URL or MARKCMO_SUPABASE_SERVICE_KEY not set');
  return { url, key };
}

async function sbSelect(path) {
  const { url, key } = sb();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Supabase select ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbUpdate(table, filter, body) {
  const { url, key } = sb();
  const res = await fetch(`${url}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase update ${table} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbInsert(table, body) {
  const { url, key } = sb();
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase insert ${table} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbStorageUpload(path, buffer, contentType) {
  const { url, key } = sb();
  const res = await fetch(`${url}/storage/v1/object/${STORAGE_BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!res.ok) throw new Error(`Supabase storage upload ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch (e) { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const {
    docUuid,                    // mc_documents.id (UUID)
    engagementId,               // mc_engagements.id
    docName,
    docId,
    filename,
    fields,
    clientName,
    clientEmail,
    executedPdfBase64,
    consultantSigBase64,        // optional, PNG of Mark's signature
    testMode,
  } = body;

  if (!executedPdfBase64) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing executedPdfBase64' }) };
  if (!docUuid)           return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing docUuid' }) };
  if (!clientEmail)       return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing clientEmail' }) };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey)                return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'RESEND_API_KEY not set' }) };
  if (!process.env.MARKCMO_SUPABASE_URL || !process.env.MARKCMO_SUPABASE_SERVICE_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'MARKCMO_SUPABASE_URL or MARKCMO_SUPABASE_SERVICE_KEY env var not set' }) };
  }

  const executedAt = new Date().toISOString();
  const ts         = Date.now();
  const ipAddr     = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || event.headers['x-real-ip'] || 'unknown';

  try {
    // ─── 1. Upload executed PDF + (optional) Mark sig PNG ───────
    const pdfBuf = Buffer.from(executedPdfBase64, 'base64');
    const execPath = `engagements/${engagementId}/${docId}-EXECUTED-${ts}.pdf`;
    await sbStorageUpload(execPath, pdfBuf, 'application/pdf');

    let consultantSigPath = null;
    if (consultantSigBase64) {
      consultantSigPath = `engagements/${engagementId}/${docId}-mark-sig-${ts}.png`;
      await sbStorageUpload(consultantSigPath, Buffer.from(consultantSigBase64, 'base64'), 'image/png');
    }

    // ─── 2. Update mc_documents ──────────────────────────────────
    await sbUpdate('mc_documents', `id=eq.${docUuid}`, {
      status: 'executed',
      consultant_signed_at: executedAt,
      executed_at: executedAt,
      consultant_ip: ipAddr,
      consultant_signature_path: consultantSigPath,
      storage_path: execPath,                 // overwrite path with executed version
    });

    // ─── 3. Update mc_engagements (signed → ready for invoice) ──
    if (engagementId) {
      await sbUpdate('mc_engagements', `id=eq.${engagementId}`, {
        status: 'accepted',                    // accepted + executed; payment is next
      });
    }

    // ─── 4. Audit log ────────────────────────────────────────────
    await sbInsert('mc_audit_log', {
      engagement_id: engagementId,
      document_id: docUuid,
      event: 'executed',
      payload: { docId, docName, executedPath: execPath, testMode: !!testMode },
      ip: ipAddr,
    });

    // ─── 4b. Auto-create DRAFT Square invoice if this is a paid engagement ──
    // Only kicks in for proposal-type docs (the engagement-acceptance trigger);
    // SOW / NDA executions don't create invoices.
    let draftInvoice = null;
    try {
      const docType = (docName || '').toLowerCase();
      const isProposalAcceptance = /proposal|acceptance|engagement.{0,20}acceptance/i.test(docName || '') || /AUD-001|PROP-001|ENG-001/i.test(docId || '');
      if (isProposalAcceptance && engagementId) {
        // Check if invoice already exists
        const existingInvs = await fetch(
          `${process.env.MARKCMO_SUPABASE_URL}/rest/v1/mc_invoices?engagement_id=eq.${engagementId}&status=neq.void&limit=1`,
          { headers: { apikey: process.env.MARKCMO_SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.MARKCMO_SUPABASE_SERVICE_KEY}` } }
        ).then(r => r.json()).catch(() => []);

        if (!existingInvs?.length) {
          // In-process invocation of square-invoice-action. Cloudflare Pages
          // can't reliably do same-zone fetch loopbacks (returns 405 on POST),
          // so we require + invoke the handler directly.
          let draftRes, draftData;
          try {
            const sqHandler = require('./square-invoice-action').handler;
            const sqResult = await sqHandler({
              httpMethod: 'POST',
              headers: {
                'content-type': 'application/json',
                'x-admin-api-token': process.env.MARKCMO_ADMIN_API_TOKEN || ''
              },
              body: JSON.stringify({ action: 'create-draft', engagementId, isTest: !!testMode })
            });
            draftRes = { ok: (sqResult.statusCode || 0) >= 200 && (sqResult.statusCode || 0) < 300 };
            try { draftData = JSON.parse(sqResult.body || '{}'); } catch { draftData = {}; }
          } catch (e) {
            draftRes = { ok: false };
            draftData = { error: e.message };
          }
          if (draftRes.ok && draftData.success) {
            draftInvoice = draftData.invoice;
            console.log('Draft invoice auto-created:', draftInvoice?.id);
          } else {
            console.warn('Draft invoice auto-create failed (non-fatal):', JSON.stringify(draftData));
          }
        } else {
          console.log('Invoice already exists for engagement, skipping auto-draft.');
        }
      }
    } catch (e) {
      // Auto-draft is best-effort; never block the executed-doc flow on it.
      console.warn('Auto-draft invoice error (non-fatal):', e.message);
    }

    // ─── 5. Build email content ─────────────────────────────────
    const executedDateStr = new Date(executedAt).toLocaleString('en-US', {
      timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short',
    });
    const fieldRows = Object.entries(fields || {})
      .filter(([, v]) => v && String(v).trim())
      .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#94A3B8;font-size:13px;">${k}</td><td style="padding:4px 0;color:#1E293B;font-size:13px;">${String(v).substring(0, 200)}</td></tr>`)
      .join('');

    const makeHtml = (recipientName) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="background:#F8FAFC;margin:0;padding:0;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;">
  <div style="background:#0A1628;padding:24px 32px;border-top:4px solid #2563EB;border-radius:12px 12px 0 0;">
    <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#3B82F6;margin-bottom:6px;">MarkCMO &middot; Document Executed</div>
    <h1 style="font-size:22px;font-weight:700;color:#fff;margin:0;">${docName}</h1>
  </div>
  <div style="padding:28px 32px;background:#fff;border:1px solid #E2E8F0;border-top:none;">
    <div style="background:#ECFDF5;border:1px solid rgba(16,185,129,.3);border-radius:8px;padding:14px 18px;margin-bottom:24px;font-size:14px;color:#065F46;">
      <strong>This document is fully executed.</strong> Both parties have signed.<br/>
      <span style="font-size:12px;color:#64748B;margin-top:4px;display:block;">Executed: ${executedDateStr} ET &middot; ${docId || ''}</span>
    </div>
    <p style="font-size:14px;color:#1E293B;line-height:1.6;margin:0 0 20px;">Hi ${recipientName}, the executed copy of <strong>${docName}</strong> is attached. Please retain it for your records.</p>
    <table style="border-collapse:collapse;width:100%;margin-bottom:20px;">${fieldRows}</table>
    <div style="border-top:1px solid #E2E8F0;padding-top:16px;font-size:12px;color:#94A3B8;">
      Questions? <a href="mailto:mark@markcmo.com" style="color:#2563EB;">mark@markcmo.com</a>
    </div>
  </div>
  <div style="background:#0A1628;padding:16px 32px;font-size:11px;color:#64748B;text-align:center;border-radius:0 0 12px 12px;">
    Mark Gabrielli &middot; Fractional CMO &middot; markcmo.com
  </div>
</div></body></html>`;

    const execFilename = (filename || `${docName}.pdf`).replace(/\.pdf$/i, '') + '-EXECUTED.pdf';
    const recipientForClientCopy = testMode ? 'mark@markcmo.com' : clientEmail;

    // CC list = Mark's gmail + any cc_emails configured on mc_clients (via /admin Edit Client)
    let clientCcCustom = [];
    try {
      const clientRows = await sbSelect(
        `mc_engagements?id=eq.${encodeURIComponent(engagementId)}&select=mc_clients(cc_emails)`
      );
      const ccRaw = clientRows?.[0]?.mc_clients?.cc_emails;
      if (Array.isArray(ccRaw)) {
        clientCcCustom = ccRaw.filter(e => typeof e === 'string' && e.includes('@'));
      }
    } catch (e) { console.warn('cc_emails lookup failed:', e.message); }
    const clientCC = Array.from(new Set([
      'marklgabriellijr@gmail.com',
      ...clientCcCustom,
    ])).filter(e => e !== clientEmail);

    const results = await Promise.allSettled([
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Mark Gabrielli <mark@markcmo.com>',
          to: [recipientForClientCopy],
          cc: clientCC,
          reply_to: 'mark@markcmo.com',
          subject: `${testMode ? '[TEST] ' : ''}Executed: ${docName}`,
          html: makeHtml(clientName || 'there'),
          attachments: [{ filename: execFilename, content: executedPdfBase64 }],
        }),
      }),
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'MarkCMO Documents <forms@markcmo.com>',
          to: ['mark@markcmo.com'],
          reply_to: clientEmail,
          subject: `${testMode ? '[TEST] ' : ''}Executed: ${docName}, ${clientName || clientEmail}`,
          html: makeHtml('Mark'),
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
      body: JSON.stringify({
        success: true,
        executedAt,
        executedPath: execPath,
        filename: execFilename,
        draftInvoice: draftInvoice ? { id: draftInvoice.id, square_invoice_id: draftInvoice.square_invoice_id, status: draftInvoice.status } : null,
      }),
    };
  } catch (err) {
    console.error('execute-engagement-doc error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message || 'Internal error' }) };
  }
};
