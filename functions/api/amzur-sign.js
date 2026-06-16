// functions/api/amzur-sign.js
// Native Cloudflare Pages Function (registered in scripts/build-pages-functions.js NATIVE_ROUTES).
// Handles the Amzur engagement e-signature flow:
//   party=client   -> store client signature, email Mark a countersign link, return ok (frontend redirects to welcome page)
//   party=provider -> store Mark's countersignature, email the client payment instructions (ACH/wire) for the engagement fee
//
// Storage: BLOBS_DOCUMENTS KV, keys signatures/amzur-engagement/<party>/<ref> + latest-<party> pointer.
// Email: Resend (env.RESEND_API_KEY), best-effort (never fails the request if email errors).
// Same-origin only. No secrets hardcoded.

const DOC = 'amzur-engagement';
const ENGAGEMENT_FEE = '$25,000';
const MONTHLY = '$15,000';
const MARK_EMAIL = 'mark@markcmo.com';
const FROM = 'MarkCMO <mark@markcmo.com>';
const PROPOSAL_URL = 'https://markcmo.com/documents/clients/amzur/proposal';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

async function sendEmail(env, { to, subject, html, replyTo }) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'no RESEND_API_KEY' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: Array.isArray(to) ? to : [to], subject, html, reply_to: replyTo || MARK_EMAIL }),
    });
    return { sent: res.ok, status: res.status };
  } catch (err) {
    return { sent: false, reason: String(err && err.message || err) };
  }
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: { 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' } });
  }
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const { party, signerName, signerEmail, signerTitle, consent, signedAt, clientRef } = body || {};

  if (party !== 'client' && party !== 'provider') return json({ error: 'Unknown party' }, 400);
  if (!signerName || String(signerName).trim().length < 2) return json({ error: 'Full name required' }, 400);
  if (consent !== true) return json({ error: 'You must confirm the electronic-signature consent' }, 400);

  const kv = env.BLOBS_DOCUMENTS;
  if (!kv) return json({ error: 'Storage unavailable' }, 503);

  const reference = (crypto.randomUUID && crypto.randomUUID()) || `sig_${Math.random().toString(36).slice(2)}`;
  const serverTime = new Date().toISOString();
  const ip = request.headers.get('cf-connecting-ip') || null;
  const ua = request.headers.get('user-agent') || null;
  const country = (request.cf && request.cf.country) || null;

  const record = {
    reference, doc: DOC, party,
    signerName: String(signerName).trim().slice(0, 200),
    signerEmail: signerEmail ? String(signerEmail).trim().slice(0, 200) : null,
    signerTitle: signerTitle ? String(signerTitle).trim().slice(0, 200) : null,
    signatureType: 'type',
    consent: true,
    clientSignedAt: signedAt || null,
    serverSignedAt: serverTime,
    ip, country, userAgent: ua,
  };

  try {
    await kv.put(`signatures/${DOC}/${party}/${reference}`, JSON.stringify(record), {
      metadata: { doc: DOC, party, signerName: record.signerName, serverSignedAt: serverTime },
    });
    await kv.put(`signatures/${DOC}/latest-${party}`, reference);
  } catch (err) {
    return json({ error: 'Could not record signature', detail: String(err && err.message || err) }, 500);
  }

  // ── Client signs → notify Mark with a countersign link ────────────
  if (party === 'client') {
    const countersignUrl = `${PROPOSAL_URL}?countersign=${encodeURIComponent(reference)}`;
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;color:#0D0D12;line-height:1.6">
        <h2 style="color:#BB4CF0;margin:0 0 8px">Amzur signed the engagement</h2>
        <p><strong>${esc(record.signerName)}</strong>${record.signerTitle ? ', ' + esc(record.signerTitle) : ''} just approved and signed the Amzur engagement proposal.</p>
        <table style="border-collapse:collapse;font-size:14px;margin:12px 0">
          <tr><td style="padding:4px 12px 4px 0;color:#6B6B76">Name</td><td><strong>${esc(record.signerName)}</strong></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6B6B76">Email</td><td>${esc(record.signerEmail || 'not provided')}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6B6B76">Signed at</td><td>${esc(serverTime)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6B6B76">Reference</td><td>${esc(reference)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6B6B76">Engagement</td><td>${ENGAGEMENT_FEE} engagement fee + ${MONTHLY}/mo</td></tr>
        </table>
        <p style="margin:18px 0">
          <a href="${countersignUrl}" style="background:#BB4CF0;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:100px;display:inline-block">Countersign the engagement</a>
        </p>
        <p style="font-size:13px;color:#6B6B76">After you countersign, the client is emailed payment instructions for the ${ENGAGEMENT_FEE} engagement fee (ACH or wire) to get started.</p>
      </div>`;
    const mail = await sendEmail(env, { to: MARK_EMAIL, subject: `Amzur signed the engagement — ${record.signerName}`, html, replyTo: record.signerEmail || MARK_EMAIL });
    return json({ ok: true, reference, signedAt: serverTime, emailed: mail.sent, redirect: '/documents/clients/amzur/welcome' });
  }

  // ── Mark countersigns → email the client payment instructions ─────
  let clientRecord = null;
  if (clientRef) {
    try { const raw = await kv.get(`signatures/${DOC}/client/${String(clientRef)}`, { type: 'text' }); if (raw) clientRecord = JSON.parse(raw); } catch (_) {}
  }
  if (!clientRecord) {
    try { const latest = await kv.get(`signatures/${DOC}/latest-client`, { type: 'text' }); if (latest) { const raw = await kv.get(`signatures/${DOC}/client/${latest}`, { type: 'text' }); if (raw) clientRecord = JSON.parse(raw); } } catch (_) {}
  }

  let clientMail = { sent: false, reason: 'no client email on file' };
  if (clientRecord && clientRecord.signerEmail) {
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;color:#0D0D12;line-height:1.6">
        <h2 style="color:#BB4CF0;margin:0 0 8px">We are getting started</h2>
        <p>Thank you, ${esc(clientRecord.signerName)}. The Amzur engagement is now signed by both parties. Here is what is due to begin.</p>
        <table style="border-collapse:collapse;font-size:15px;margin:14px 0;width:100%;max-width:460px">
          <tr><td style="padding:8px 0;border-bottom:1px solid #E3E6EC">Engagement fee (one-time, to begin)</td><td style="padding:8px 0;border-bottom:1px solid #E3E6EC;text-align:right"><strong>${ENGAGEMENT_FEE}</strong></td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #E3E6EC">Monthly retainer (first invoice on the 1st of next month)</td><td style="padding:8px 0;border-bottom:1px solid #E3E6EC;text-align:right">${MONTHLY}/mo</td></tr>
          <tr><td style="padding:8px 0"><strong>Total to begin</strong></td><td style="padding:8px 0;text-align:right"><strong>${ENGAGEMENT_FEE}</strong></td></tr>
        </table>
        <p><strong>Payment by ACH or wire.</strong> An invoice with remittance details follows from Mark. Card is accepted with a 3 percent processing fee.</p>
        <p style="font-size:13px;color:#6B6B76">Countersigned by ${esc(record.signerName)} on ${esc(serverTime)}. Reference ${esc(reference)}.</p>
      </div>`;
    clientMail = await sendEmail(env, { to: clientRecord.signerEmail, subject: 'Amzur engagement countersigned — payment to begin', html });
  }

  // Also confirm to Mark that an invoice now needs to go out.
  const markHtml = `
    <div style="font-family:Inter,Arial,sans-serif;color:#0D0D12;line-height:1.6">
      <h2 style="color:#BB4CF0;margin:0 0 8px">Countersigned — send the invoice</h2>
      <p>You countersigned the Amzur engagement. ${clientMail.sent ? 'The client was emailed the payment summary.' : 'No client email on file, send details manually.'}</p>
      <p>Now generate and send the invoice: <strong>${ENGAGEMENT_FEE} engagement fee</strong>, ACH or wire.</p>
      <p style="font-size:13px;color:#6B6B76">Client: ${esc(clientRecord ? clientRecord.signerName : 'unknown')} (${esc(clientRecord ? clientRecord.signerEmail : 'no email')}).</p>
    </div>`;
  await sendEmail(env, { to: MARK_EMAIL, subject: 'Amzur countersigned — generate the ACH/wire invoice', html: markHtml });

  return json({ ok: true, reference, signedAt: serverTime, clientEmailed: clientMail.sent });
}
