// ═══════════════════════════════════════════════════════════════
// send-engagement-proposal-email.js
//
// Sends the engagement-proposal package email (cover, proposal, SOW,
// timeline, sign URL) to the client. Pulls live data from Supabase
// (mc_clients + mc_engagements + mc_documents). Logs the send event
// to mc_audit_log. Email rendered via Resend.
//
// Auth (one of):
//   1. Cookie: mcadmin_session (existing admin login)
//   2. Header: x-admin-api-token: <MARKCMO_ADMIN_API_TOKEN env var>
//
// POST body:
//   {
//     "clientSlug": "wendal-enterprise",            // required
//     "testRecipient": "mark@markcmo.com",          // optional - if set, sends here instead of client
//     "siteUrl": "https://markcmo.com"              // optional - for absolute links (defaults to URL env)
//   }
//
// Env vars used:
//   MARKCMO_SUPABASE_URL
//   MARKCMO_SUPABASE_SERVICE_KEY
//   RESEND_API_KEY
//   MARKCMO_ADMIN_API_TOKEN
//   ADMIN_SESSION_SECRET (or TOKEN_SECRET)
//   URL                                  (Netlify-provided)
// ═══════════════════════════════════════════════════════════════

const COOKIE_NAME = 'mcadmin_session';

const ALLOWED_ORIGINS = ['https://markcmo.com', 'http://localhost:8888'];

function corsHeaders(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-api-token',
  };
}

// ─── Auth helpers ───────────────────────────────────────────────
async function verifyToken(token, secret) {
  try {
    const [dataB64, sigB64] = token.split('.');
    if (!dataB64 || !sigB64) return null;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sig = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(dataB64));
    if (!valid) return null;
    const payload = JSON.parse(atob(dataB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}

function parseCookies(h) {
  const out = {};
  (h || '').split(';').forEach(p => {
    const [k, ...v] = p.trim().split('=');
    if (k) out[k.trim()] = decodeURIComponent(v.join('='));
  });
  return out;
}

async function isAuthed(event) {
  // 1) Admin session cookie
  const cookies = parseCookies(event.headers?.cookie || event.headers?.Cookie || '');
  const cookieToken = cookies[COOKIE_NAME];
  if (cookieToken) {
    const secret = process.env.ADMIN_SESSION_SECRET || process.env.TOKEN_SECRET || 'fallback';
    if (await verifyToken(cookieToken, secret)) return true;
  }
  // 2) Admin API token header
  const headerToken = event.headers?.['x-admin-api-token'] || event.headers?.['X-Admin-Api-Token'];
  if (headerToken && process.env.MARKCMO_ADMIN_API_TOKEN && headerToken === process.env.MARKCMO_ADMIN_API_TOKEN) {
    return true;
  }
  return false;
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

async function sbInsert(table, body) {
  const { url, key } = sb();
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase insert ${table} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// ─── Email template ─────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function buildEmailHtml({ client, engagement, docs, siteUrl, testMode, testRecipient }) {
  const slug = client.slug;
  const proposalUrl = `${siteUrl}/documents/clients/${slug}/proposal`;
  const sowUrl      = `${siteUrl}/documents/clients/${slug}/sow`;
  const timelineUrl = `${siteUrl}/documents/clients/${slug}/timeline`;
  const coverUrl    = `${siteUrl}/documents/clients/${slug}`;
  const signUrl     = `${siteUrl}/documents/clients/${slug}/sign${testMode ? '?test=1' : ''}`;

  const docByType = {};
  (docs || []).forEach(d => { docByType[d.doc_type] = d; });
  const docId = (t) => docByType[t]?.doc_id || '';

  const greetingName = (client.primary_contact_name || '').split(' ')[0] || 'there';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1E293B;">
${testMode ? `
<div style="max-width:680px;margin:0 auto;background:#FFF7ED;border:1px solid rgba(249,115,22,0.4);color:#9A3412;padding:12px 20px;font-size:13px;text-align:center;font-family:'DM Mono',Menlo,monospace;">
  <strong>TEST MODE</strong> &middot; This email would have gone to <strong>${esc(client.primary_contact_email)}</strong>. Routed to <strong>${esc(testRecipient)}</strong> for review.
</div>
` : ''}
<div style="max-width:680px;margin:0 auto;background:#fff;">

  <!-- Hero -->
  <div style="background:linear-gradient(135deg,#0A1628 0%,#0F2040 50%,#162A4A 100%);color:#fff;padding:36px 32px 32px;border-top:4px solid #2563EB;">
    <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#3B82F6;margin-bottom:10px;font-family:'DM Mono',Menlo,monospace;">${esc(engagement.name)} &middot; Proposal</div>
    <h1 style="font-family:'Bebas Neue',Impact,sans-serif;font-size:32px;font-weight:400;letter-spacing:0.02em;line-height:1.1;color:#fff;margin:0 0 8px;">
      ${esc(client.legal_name)},<br/>your audit package is ready.
    </h1>
    <p style="font-size:15px;color:rgba(248,250,252,0.78);margin:0;line-height:1.5;">
      Three documents. One signature. ${engagement.delivery_window_hrs}-hour delivery once we kick off.
    </p>
  </div>

  <!-- Greeting + intro -->
  <div style="padding:32px;">
    <p style="font-size:16px;line-height:1.65;margin:0 0 16px;">${esc(greetingName)},</p>
    <p style="font-size:15px;line-height:1.65;margin:0 0 16px;color:#1E293B;">
      Thanks for the conversation. As promised, the full <strong>${esc(engagement.name)}</strong> package is below. It's a fixed-fee engagement designed to give you an honest, evidence-based picture of what's working at <strong>${esc(client.dba || client.legal_name)}</strong>, where the bottlenecks are, and a sequenced 30 / 90 / 6-month / 12-month roadmap to execute against, including the West Palm Beach and Atlanta expansion analysis.
    </p>
    <p style="font-size:15px;line-height:1.65;margin:0;color:#1E293B;">
      Below are the three documents that make up the engagement, plus a one-click acceptance link.
    </p>
  </div>

  <!-- Investment + Delivery summary -->
  <div style="margin:0 32px 24px;background:#EFF6FF;border:1px solid rgba(37,99,235,0.25);border-radius:12px;padding:20px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td style="vertical-align:top;padding:0;">
          <div style="font-family:'DM Mono',Menlo,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#2563EB;margin-bottom:4px;font-weight:600;">Investment</div>
          <div style="font-family:'Bebas Neue',Impact,sans-serif;font-size:30px;color:#0A1628;letter-spacing:0.02em;line-height:1;">$${Number(engagement.fee_usd).toLocaleString('en-US')}</div>
          <div style="font-size:12px;color:#64748B;margin-top:4px;">USD &middot; one-time</div>
        </td>
        <td style="vertical-align:top;padding:0;text-align:right;">
          <div style="font-family:'DM Mono',Menlo,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#2563EB;margin-bottom:4px;font-weight:600;">Delivery</div>
          <div style="font-family:'Bebas Neue',Impact,sans-serif;font-size:30px;color:#0A1628;letter-spacing:0.02em;line-height:1;">${engagement.delivery_window_hrs} HRS</div>
          <div style="font-size:12px;color:#64748B;margin-top:4px;">from payment + intake</div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Three documents -->
  <div style="padding:0 32px;">
    <div style="font-family:'DM Mono',Menlo,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#2563EB;font-weight:600;margin-bottom:14px;">Engagement Documents</div>

    <a href="${proposalUrl}" style="display:block;text-decoration:none;margin-bottom:10px;background:#fff;border:1px solid rgba(15,32,64,0.08);border-radius:14px;padding:18px 22px;color:#1E293B;box-shadow:0 1px 2px rgba(15,32,64,0.04), 0 8px 24px rgba(37,99,235,0.10), 0 24px 48px -16px rgba(37,99,235,0.08);">
      <div style="font-family:'DM Mono',Menlo,monospace;font-size:11px;letter-spacing:0.15em;color:#2563EB;font-weight:600;margin-bottom:4px;">DOC ${esc(docId('proposal'))} &middot; PROPOSAL</div>
      <div style="font-size:16px;font-weight:700;color:#0A1628;margin-bottom:4px;">Audit Proposal</div>
      <div style="font-size:13px;color:#64748B;">Why this audit, what's covered, what's delivered, the $${Number(engagement.fee_usd).toLocaleString('en-US')} fee, and the 14-day acceptance window.</div>
    </a>

    <a href="${sowUrl}" style="display:block;text-decoration:none;margin-bottom:10px;background:#fff;border:1px solid rgba(15,32,64,0.08);border-radius:14px;padding:18px 22px;color:#1E293B;box-shadow:0 1px 2px rgba(15,32,64,0.04), 0 8px 24px rgba(37,99,235,0.10), 0 24px 48px -16px rgba(37,99,235,0.08);">
      <div style="font-family:'DM Mono',Menlo,monospace;font-size:11px;letter-spacing:0.15em;color:#2563EB;font-weight:600;margin-bottom:4px;">DOC ${esc(docId('sow'))} &middot; SCOPE OF WORK</div>
      <div style="font-size:16px;font-weight:700;color:#0A1628;margin-bottom:4px;">Scope of Work</div>
      <div style="font-size:13px;color:#64748B;">Six modules, activities, inputs, outputs, out-of-scope items, and your obligations during the 72-hour window.</div>
    </a>

    <a href="${timelineUrl}" style="display:block;text-decoration:none;margin-bottom:10px;background:#fff;border:1px solid rgba(15,32,64,0.08);border-radius:14px;padding:18px 22px;color:#1E293B;box-shadow:0 1px 2px rgba(15,32,64,0.04), 0 8px 24px rgba(37,99,235,0.10), 0 24px 48px -16px rgba(37,99,235,0.08);">
      <div style="font-family:'DM Mono',Menlo,monospace;font-size:11px;letter-spacing:0.15em;color:#2563EB;font-weight:600;margin-bottom:4px;">DOC ${esc(docId('timeline'))} &middot; TIMELINE</div>
      <div style="font-size:16px;font-weight:700;color:#0A1628;margin-bottom:4px;">${engagement.delivery_window_hrs}-Hour Deliverable Timeline</div>
      <div style="font-size:13px;color:#64748B;">Hour-by-hour: 4 phases, 16 milestones, who owns what, what causes the timeline to slip.</div>
    </a>

    <p style="font-size:13px;color:#64748B;margin:14px 0 0;">
      Or open everything from the package cover: <a href="${coverUrl}" style="color:#2563EB;">${esc(coverUrl.replace('https://',''))}</a>
    </p>
  </div>

  <!-- Sign CTA -->
  <div style="padding:28px 32px 8px;">
    <div style="font-family:'DM Mono',Menlo,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#2563EB;font-weight:600;margin-bottom:12px;">Ready to Move?</div>
    <a href="${signUrl}" style="display:block;background:#F97316;color:#fff;font-weight:700;font-size:15px;letter-spacing:0.02em;text-transform:uppercase;text-decoration:none;padding:18px 24px;border-radius:10px;text-align:center;box-shadow:0 4px 14px rgba(249,115,22,0.3);">
      &check; Accept &amp; Sign Electronically
    </a>
    <p style="font-size:13px;color:#64748B;margin:14px 0 0;line-height:1.6;">
      One signature, one click. I'll countersign within 24 hours and the Square invoice for $${Number(engagement.fee_usd).toLocaleString('en-US')} USD goes out immediately. The 72-hour delivery clock starts when payment clears and the intake worksheet is returned.
    </p>
  </div>

  <!-- Sign-off -->
  <div style="padding:24px 32px 32px;">
    <p style="font-size:15px;line-height:1.65;margin:0 0 4px;">Looking forward to digging in,</p>
    <p style="font-size:15px;line-height:1.65;margin:0;font-weight:700;color:#0A1628;">Mark Gabrielli</p>
    <p style="font-size:13px;line-height:1.55;margin:2px 0 0;color:#64748B;">Fractional CMO &amp; COO &middot; WETYR Corp<br/><a href="mailto:mark@markcmo.com" style="color:#2563EB;">mark@markcmo.com</a> &middot; <a href="https://markcmo.com" style="color:#2563EB;">markcmo.com</a></p>
  </div>

  <!-- Footer -->
  <div style="background:#0A1628;padding:18px 32px;font-size:11px;color:rgba(255,255,255,0.5);text-align:center;border-top:4px solid #2563EB;">
    Confidential &middot; prepared for ${esc(client.legal_name)} &middot; valid 14 days from issue
  </div>
</div>
</body></html>`;
}

// ─── Handler ────────────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!(await isAuthed(event))) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized (need admin cookie or x-admin-api-token header)' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { clientSlug, testRecipient, cc: ccArg, siteUrl: siteUrlArg } = body;
  if (!clientSlug) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing clientSlug' }) };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'RESEND_API_KEY not set' }) };

  const siteUrl = siteUrlArg || process.env.URL || 'https://markcmo.com';

  try {
    // Look up client + most recent engagement + its documents
    const clients = await sbSelect(
      `mc_clients?slug=eq.${encodeURIComponent(clientSlug)}&select=*,mc_engagements(*,mc_documents(id,doc_id,doc_type,doc_name,status))`
    );
    if (!clients.length) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: `Client ${clientSlug} not found` }) };
    }
    const client = clients[0];
    const engagements = (client.mc_engagements || []).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    if (!engagements.length) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: `Client ${clientSlug} has no engagements` }) };
    }
    const engagement = engagements[0];
    const docs = engagement.mc_documents || [];

    const testMode = !!testRecipient;
    const recipientEmail = testRecipient || client.primary_contact_email;
    if (!recipientEmail) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No recipient email (client has no primary_contact_email and no testRecipient provided)' }) };
    }

    const html = buildEmailHtml({ client, engagement, docs, siteUrl, testMode, testRecipient });

    const subject = (testMode ? '[TEST] ' : '') + `${client.legal_name} — ${engagement.name} (Proposal)`.replace(/—/g, '-');

    // CC: defaults to marklgabriellijr@gmail.com so Mark always has a copy.
    // Pass cc:[] (empty array) explicitly to suppress, or cc:['custom@x'] to override.
    const ccList = Array.isArray(ccArg) ? ccArg : (ccArg === null ? [] : ['marklgabriellijr@gmail.com']);

    const resendPayload = {
      from: 'Mark Gabrielli <mark@markcmo.com>',
      to: [recipientEmail],
      ...(ccList.length ? { cc: ccList } : {}),
      reply_to: 'mark@markcmo.com',
      subject,
      html,
    };

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(resendPayload),
    });
    const resendData = await resendRes.json().catch(() => ({}));
    if (!resendRes.ok) {
      console.error('Resend send failed:', resendRes.status, JSON.stringify(resendData));
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Resend send failed', detail: resendData }) };
    }

    // Audit log
    try {
      await sbInsert('mc_audit_log', {
        engagement_id: engagement.id,
        client_id: client.id,
        event: testMode ? 'proposal_email_test_sent' : 'proposal_email_sent',
        payload: {
          recipient: recipientEmail,
          cc: ccList,
          subject,
          resend_id: resendData?.id,
          siteUrl,
          docCount: docs.length,
          testMode,
        },
      });
    } catch (e) { console.warn('audit_log insert failed:', e.message); }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        sentTo: recipientEmail,
        cc: ccList,
        testMode,
        subject,
        resend_id: resendData?.id,
      }),
    };
  } catch (err) {
    console.error('send-engagement-proposal-email error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || 'Internal error' }) };
  }
};
