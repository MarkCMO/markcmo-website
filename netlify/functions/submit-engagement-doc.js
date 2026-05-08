// ═══════════════════════════════════════════════════════════════
// submit-engagement-doc.js
// Supabase-backed signing pipeline for MarkCMO engagement documents.
// Replaces submit-document.js for the new mc_* engagement schema.
//
// Flow:
//  1. Look up client by slug, engagement by id, document by doc_id.
//  2. Upload the client-signed PDF + signature PNG to Supabase Storage.
//  3. Update mc_documents (status, paths, IP, signed_at).
//  4. Insert mc_audit_log event.
//  5. Send Resend emails: Mark countersign request + client signed copy.
//  6. Return an HMAC token for the countersign step.
//
// Required env vars (Netlify):
//   MARKCMO_SUPABASE_URL          e.g. https://saoomfwycegflxelggxv.supabase.co (CLIPOS project)
//   MARKCMO_SUPABASE_SERVICE_KEY  service-role key (NOT the anon key)
//   RESEND_API_KEY                Resend API key
//   TOKEN_SECRET                  any random secret for HMAC
//
// Note: vars are namespaced (MARKCMO_) so they don't collide with the
// existing SUPABASE_URL/SUPABASE_SERVICE_KEY which point at a different
// Supabase project used by other systems on this site.
// ═══════════════════════════════════════════════════════════════
const crypto = require('crypto');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const STORAGE_BUCKET = 'markcmo-engagement-docs';

function makeToken(payload, secret) {
  const data = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return Buffer.from(JSON.stringify({ ...payload, hmac })).toString('base64url');
}

// ─── Supabase REST helpers ──────────────────────────────────────
function sb() {
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

async function sbStorageSignedUrl(path, expiresIn = 60 * 60 * 24 * 14) {
  const { url, key } = sb();
  const res = await fetch(`${url}/storage/v1/object/sign/${STORAGE_BUCKET}/${path}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) throw new Error(`Supabase signed URL ${path} failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return `${url}/storage/v1${data.signedURL || data.signedUrl}`;
}

// ─── Handler ────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch (e) { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const {
    clientSlug,                 // e.g. 'wendal-enterprise'
    docId,                      // e.g. 'WE-AUD-001'
    docName,                    // human-readable for emails
    filename,
    fields,
    pdfBase64,
    clientName, clientEmail, clientTitle, clientCompany, clientPhone,
    clientSigBase64,
    markSig,                    // coords for countersign overlay
    testMode,                   // bool, re-routes "client" emails to mark@markcmo.com
  } = body;

  if (!clientSlug)       return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing clientSlug' }) };
  if (!docId)            return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing docId' }) };
  if (!pdfBase64)        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing pdfBase64' }) };
  if (!clientSigBase64)  return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing clientSigBase64' }) };
  if (!clientEmail)      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing clientEmail' }) };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey)                return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'RESEND_API_KEY not set' }) };
  if (!process.env.MARKCMO_SUPABASE_URL || !process.env.MARKCMO_SUPABASE_SERVICE_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'MARKCMO_SUPABASE_URL or MARKCMO_SUPABASE_SERVICE_KEY env var not set' }) };
  }

  const submittedAt = new Date().toISOString();
  const ts          = Date.now();
  const ipAddr      = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || event.headers['x-real-ip'] || 'unknown';
  const userAgent   = event.headers['user-agent'] || 'unknown';
  const secret      = process.env.TOKEN_SECRET || 'markcmo-signing-secret-change-me';

  try {
    // ─── 1. Look up document by slug + docId ─────────────────────
    const docs = await sbSelect(
      `mc_documents?doc_id=eq.${encodeURIComponent(docId)}&select=id,engagement_id,doc_id,doc_type,doc_name,status,storage_bucket,mc_engagements(id,client_id,name,fee_usd,delivery_window_hrs,doc_prefix,status,mc_clients(id,slug,legal_name,primary_contact_name,primary_contact_email,cc_emails,status))`
    );
    const doc = docs.find(d => d.mc_engagements?.mc_clients?.slug === clientSlug);
    if (!doc) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: `Document ${docId} not found for client ${clientSlug}. Run the seed migration.` }) };
    }
    const docUuid       = doc.id;
    const engagementId  = doc.engagement_id;
    const clientId      = doc.mc_engagements.mc_clients.id;

    // ─── 2. Upload signed PDF + signature PNG to Storage ─────────
    const pdfBuf = Buffer.from(pdfBase64, 'base64');
    const sigBuf = Buffer.from(clientSigBase64, 'base64');
    const pdfPath = `engagements/${engagementId}/${docId}-client-signed-${ts}.pdf`;
    const sigPath = `engagements/${engagementId}/${docId}-client-sig-${ts}.png`;
    await sbStorageUpload(pdfPath, pdfBuf, 'application/pdf');
    await sbStorageUpload(sigPath, sigBuf, 'image/png');

    // ─── 3. Update mc_documents ──────────────────────────────────
    await sbUpdate('mc_documents', `id=eq.${docUuid}`, {
      status: 'client_signed',
      storage_path: pdfPath,
      client_signature_path: sigPath,
      client_signed_at: submittedAt,
      client_ip: ipAddr,
      client_user_agent: userAgent,
      filename: filename || `${docName || docId}.pdf`,
      fields: fields || {},
      metadata: {
        ...(doc.metadata || {}),
        markSig: markSig || null,
        testMode: !!testMode,
        clientName, clientTitle, clientCompany, clientEmail, clientPhone,
      },
    });

    // ─── 4. Auto-advance pipeline status: → signed ──────────────
    // The pipeline kanban uses 'signed' as the stage key. Don't
    // overwrite later statuses (invoiced, paid, delivering, delivered).
    const TERMINAL = ['invoiced','paid','delivering','delivered','closed'];
    if (!TERMINAL.includes(doc.mc_engagements?.status)) {
      await sbUpdate('mc_engagements', `id=eq.${engagementId}`, {
        status: 'signed',
        accepted_at: submittedAt,
      });
    }
    // Bump client status the same way (only if they're earlier in pipeline)
    if (clientId && !['paid','delivering','delivered','closed'].includes(doc.mc_engagements?.mc_clients?.status)) {
      await sbUpdate('mc_clients', `id=eq.${clientId}`, { status: 'signed' });
    }

    // ─── 5. Insert audit log ─────────────────────────────────────
    await sbInsert('mc_audit_log', {
      engagement_id: engagementId,
      document_id: docUuid,
      client_id: clientId,
      event: 'client_signed',
      payload: { docId, docName, clientName, clientEmail, testMode: !!testMode },
      ip: ipAddr,
      user_agent: userAgent,
    });

    // ─── 6. Build countersign URL + signed PDF URL for Mark ──────
    const tokenPayload = {
      v: 2,                                          // v2 = Supabase-backed
      docUuid,
      engagementId,
      clientId,
      docId,
      docName: docName || `${doc.doc_type} ${doc.doc_id}`,
      filename: filename || `${docName || docId}.pdf`,
      fields: fields || {},
      clientName: clientName || '',
      clientEmail,
      submittedAt,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      pdfPath,
      markSig: markSig || null,
      testMode: !!testMode,
    };
    const token = makeToken(tokenPayload, secret);
    const siteUrl = process.env.URL || 'https://markcmo.com';
    const countersignUrl = `${siteUrl}/sign?token=${token}`;

    // ─── 7. Build email content ──────────────────────────────────
    const submittedDateStr = new Date(submittedAt).toLocaleString('en-US', {
      timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short',
    });
    const fieldRows = Object.entries(fields || {})
      .filter(([, v]) => v && String(v).trim())
      .map(([k, v]) => `<tr><td style="padding:5px 16px 5px 0;color:#888;font-size:13px;white-space:nowrap;">${k}</td><td style="padding:5px 0;color:#1E293B;font-size:13px;">${String(v).substring(0, 200)}</td></tr>`)
      .join('');

    // Mark's email, light/blue branded
    const markHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="background:#F8FAFC;margin:0;padding:0;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 24px;">
  <div style="background:#0A1628;color:#fff;padding:24px 28px;border-radius:12px 12px 0 0;border-top:4px solid #2563EB;">
    <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#3B82F6;margin-bottom:8px;">MarkCMO, Countersignature Needed</div>
    <h1 style="font-size:22px;font-weight:700;color:#fff;margin:0 0 6px;">${docName || doc.doc_name}</h1>
    <div style="font-size:12px;color:#94A3B8;">${doc.doc_id} &middot; ${submittedDateStr} ET ${testMode ? '&middot; <span style="color:#FB923C;">TEST</span>' : ''}</div>
  </div>
  <div style="background:#fff;border:1px solid #E2E8F0;border-top:none;padding:24px;">
    <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#2563EB;margin-bottom:12px;font-weight:600;">Submitted By</div>
    <table style="border-collapse:collapse;width:100%;">${fieldRows}</table>
  </div>
  <a href="${countersignUrl}" style="display:block;background:#F97316;color:#fff;font-weight:700;font-size:14px;letter-spacing:.06em;text-transform:uppercase;text-decoration:none;padding:16px 24px;border-radius:0 0 12px 12px;text-align:center;">
    Review &amp; Countersign &rarr;
  </a>
  <div style="font-size:11px;color:#94A3B8;line-height:1.6;margin-top:16px;text-align:center;">
    The PDF loads automatically on the countersign page from Supabase Storage.<br/>
    Link expires: ${new Date(tokenPayload.expiresAt).toLocaleDateString('en-US', { dateStyle: 'long' })}
  </div>
</div></body></html>`;

    // Client email, light branded
    const clientHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="background:#F8FAFC;margin:0;padding:0;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;">
  <div style="background:#0A1628;padding:24px 32px;border-top:4px solid #2563EB;">
    <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#3B82F6;margin-bottom:6px;">MarkCMO, Document Received</div>
    <h1 style="font-size:22px;font-weight:700;color:#fff;margin:0;">${docName || doc.doc_name}</h1>
  </div>
  <div style="padding:28px 32px;background:#fff;border:1px solid #E2E8F0;border-top:none;">
    <div style="background:#EFF6FF;border:1px solid rgba(37,99,235,.25);border-radius:8px;padding:14px 18px;margin-bottom:24px;font-size:14px;color:#1E3A8A;">
      <strong>Your signed document has been received.</strong><br/>
      <span style="font-size:12px;color:#64748B;margin-top:4px;display:block;">Mark countersigns within 24 hours. You will receive the fully executed copy by email.</span>
    </div>
    <p style="font-size:14px;color:#1E293B;line-height:1.6;margin:0 0 16px;">Hi ${clientName || 'there'}, your signed copy of <strong>${docName || doc.doc_name}</strong> is attached for your records.</p>
    <table style="border-collapse:collapse;width:100%;margin-bottom:20px;">${fieldRows}</table>
    <div style="font-size:13px;color:#1E293B;line-height:1.7;background:#F1F5F9;padding:16px;border-radius:8px;">
      <strong>What happens next:</strong><br/>
      1. Mark reviews and countersigns within 24 hours<br/>
      2. Both you and Mark receive the fully executed PDF<br/>
      3. The Square invoice for the engagement fee follows immediately<br/>
      4. The 72-hour delivery clock starts when payment clears
    </div>
    <div style="border-top:1px solid #E2E8F0;padding-top:16px;margin-top:20px;font-size:12px;color:#94A3B8;">
      Questions? <a href="mailto:mark@markcmo.com" style="color:#2563EB;">mark@markcmo.com</a>
    </div>
  </div>
  <div style="background:#0A1628;padding:16px 32px;font-size:11px;color:#64748B;text-align:center;border-radius:0 0 12px 12px;">
    Mark Gabrielli &middot; Fractional CMO &middot; markcmo.com
  </div>
</div></body></html>`;

    const execFilename = (filename || `${docName || docId}.pdf`).replace(/\.pdf$/i, '') + '-signed.pdf';
    const recipientForClientCopy = testMode ? 'mark@markcmo.com' : clientEmail;
    // Always CC Mark's Gmail + any custom cc_emails configured on the client record
    // (set via /admin#case-files Edit Client). In test mode the client copy goes to
    // mark@markcmo.com but we still send the per-client CC list to confirm delivery.
    const clientCcCustom = Array.isArray(doc.mc_engagements?.mc_clients?.cc_emails)
      ? doc.mc_engagements.mc_clients.cc_emails.filter(e => typeof e === 'string' && e.includes('@'))
      : [];
    const clientCC = Array.from(new Set([
      'marklgabriellijr@gmail.com',
      ...clientCcCustom,
    ])).filter(e => e !== clientEmail); // never CC the primary recipient

    const emailPayloads = [
      {
        from: 'MarkCMO Documents <forms@markcmo.com>',
        to: ['mark@markcmo.com'],
        reply_to: clientEmail,
        subject: `${testMode ? '[TEST] ' : ''}Countersignature Needed: ${docName || doc.doc_name}, ${clientName || clientEmail}`,
        html: markHtml,
      },
      {
        from: 'Mark Gabrielli <mark@markcmo.com>',
        to: [recipientForClientCopy],
        cc: clientCC,
        subject: `${testMode ? '[TEST] ' : ''}Received: ${docName || doc.doc_name}, Pending Countersignature`,
        html: clientHtml,
        attachments: [{ filename: execFilename, content: pdfBase64 }],
      },
    ];

    const results = await Promise.allSettled(emailPayloads.map(payload =>
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    ));
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'rejected') console.error(`Email ${i} error:`, r.reason);
      else r.value.clone().json().then(d => { if (d.statusCode >= 400) console.error(`Email ${i}:`, JSON.stringify(d)); }).catch(()=>{});
    }
    if (results[0].status === 'rejected') {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to send countersign email: ' + results[0].reason }) };
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        success: true,
        token,
        docUuid,
        engagementId,
        message: `Document submitted. Mark countersigns within 24 hours; executed copy goes to ${recipientForClientCopy}.`,
      }),
    };
  } catch (err) {
    console.error('submit-engagement-doc error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message || 'Internal error' }) };
  }
};
