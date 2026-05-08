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

async function sbUpdate(table, filter, body) {
  const { url, key } = sb();
  const res = await fetch(`${url}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase update ${table} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// ─── Email template ─────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function buildEmailHtml({ client, engagement, docs, siteUrl, testMode, testRecipient }) {
  const slug = client.slug;
  // Real destination URLs
  const proposalUrl = `${siteUrl}/documents/clients/${slug}/proposal`;
  const sowUrl      = `${siteUrl}/documents/clients/${slug}/sow`;
  const timelineUrl = `${siteUrl}/documents/clients/${slug}/timeline`;
  const coverUrl    = `${siteUrl}/documents/clients/${slug}`;
  const signUrl     = `${siteUrl}/documents/clients/${slug}/sign${testMode ? '?test=1' : ''}`;

  // Wrap each link in our /track click redirect so we can attribute every
  // open + click to a specific touchpoint (which CTA, which client) in
  // mc_journey_events. Falls back gracefully if the tracker is down (Resend
  // delivery completes either way; tracker logs are best-effort).
  //
  // EXCEPTION: when testMode is true (testRecipient set, e.g. mark@markcmo.com),
  // we DO NOT wrap links in /track. Test sends should never write to
  // mc_journey_events because they would skew open / click / conversion metrics
  // for the actual client engagements. Real client touches stay clean.
  const trk = (kind, target) => {
    if (testMode) return target;
    const u = Buffer.from(target).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const eid = engagement?.id ? `&eid=${encodeURIComponent(engagement.id)}` : '';
    return `${siteUrl}/track?t=click&c=${encodeURIComponent(slug)}&k=${encodeURIComponent(kind)}${eid}&u=${u}`;
  };
  const tProposalUrl = trk('proposal', proposalUrl);
  const tSowUrl      = trk('sow', sowUrl);
  const tTimelineUrl = trk('timeline', timelineUrl);
  const tCoverUrl    = trk('cover', coverUrl);
  const tSignUrl     = trk('sign', signUrl);

  const docByType = {};
  (docs || []).forEach(d => { docByType[d.doc_type] = d; });
  const docId = (t) => docByType[t]?.doc_id || '';

  // Per-engagement copy overrides via mc_engagements.metadata.email.
  // This lets each client get tailored messaging without forking the function
  // (Wendal is the legacy hardcoded "audit" tone; SLCPL gets a public-sector
  // tone via metadata; future clients drop their own metadata keys to override).
  const em = (engagement?.metadata?.email) || {};
  const hrs = engagement.delivery_window_hrs;
  const fee = Number(engagement.fee_usd).toLocaleString('en-US');
  const subjectPhrase    = em.subject_phrase    || 'audit package';
  const deliveryPhrase   = em.delivery_phrase   || `${hrs}-hour`;
  const deliveryShort    = em.delivery_phrase_short || `${hrs} HRS`;
  const heroH1Line2      = em.hero_h1_line2    || `your ${subjectPhrase} is ready.`;
  const heroH1Line1      = em.hero_h1_line1    || `${esc(client.legal_name)},`;
  const heroSub          = em.hero_sub          || `Three documents. One signature. ${deliveryPhrase} delivery once we kick off.`;
  const greetingFirstName = em.greeting_first_name || (client.primary_contact_name || '').split(' ')[0] || 'there';
  const introHtml        = em.intro_html        || `Thanks for the conversation. As promised, the full <strong>${esc(engagement.name)}</strong> package is below. It's a fixed-fee engagement designed to give you an honest, evidence-based picture of what's working at <strong>${esc(client.dba || client.legal_name)}</strong>, where the bottlenecks are, and a sequenced 30 / 90 / 6-month / 12-month roadmap to execute against.`;
  const signOutroHtml    = em.sign_outro_html   || `One signature, one click. I'll countersign within 24 hours and the Square invoice for $${fee} USD goes out immediately. The ${deliveryPhrase} delivery clock starts when payment clears and the intake worksheet is returned.`;
  const signoffLine      = em.signoff_line      || 'Looking forward to digging in,';
  const docProposalDesc  = em.doc_proposal_desc || `Why this engagement, what's covered, what's delivered, the $${fee} fee, and the 60-day acceptance window.`;
  const docSowDesc       = em.doc_sow_desc      || `Modules, activities, inputs, outputs, out-of-scope items, and your obligations during the ${deliveryPhrase} window.`;
  const docTimelineDesc  = em.doc_timeline_desc || `Phase by phase, milestone by milestone. Who owns what, when, and what slips the timeline.`;
  const docTimelineTitle = em.doc_timeline_title || `${deliveryShort.replace(/\s+/g,'-')} Deliverable Timeline`;

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

  <!-- Hero (bulletproof: bgcolor + background-color + gradient fallback for Outlook/Gmail) -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0A1628" style="background-color:#0A1628;border-collapse:collapse;border-top:4px solid #2563EB;">
    <tr>
      <td bgcolor="#0A1628" style="background-color:#0A1628;background-image:linear-gradient(135deg,#0A1628 0%,#0F2040 50%,#162A4A 100%);padding:36px 32px 32px;color:#FFFFFF;">
        <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#93C5FD;margin-bottom:10px;font-family:'DM Mono',Menlo,monospace;">${esc(engagement.name)} &middot; Proposal</div>
        <h1 style="font-family:'Bebas Neue',Impact,sans-serif;font-size:32px;font-weight:400;letter-spacing:0.02em;line-height:1.1;color:#FFFFFF;margin:0 0 8px;">
          <span style="color:#FFFFFF;">${esc(heroH1Line1)}</span><br/>
          <span style="color:#FFFFFF;">${esc(heroH1Line2)}</span>
        </h1>
        <p style="font-size:15px;color:#E2E8F0;margin:0;line-height:1.5;">
          ${esc(heroSub)}
        </p>
      </td>
    </tr>
  </table>

  <!-- Greeting + intro -->
  <div style="padding:32px;">
    <p style="font-size:16px;line-height:1.65;margin:0 0 16px;">${esc(greetingFirstName)},</p>
    <p style="font-size:15px;line-height:1.65;margin:0 0 16px;color:#1E293B;">
      ${introHtml}
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
          <div style="font-family:'DM Mono',Menlo,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#2563EB;margin-bottom:4px;font-weight:600;">${deliveryShort === 'TBD' ? 'Pace' : 'Delivery'}</div>
          ${deliveryShort === 'TBD'
            ? `<div style="font-family:'Bebas Neue',Impact,sans-serif;font-size:22px;color:#0A1628;letter-spacing:0.02em;line-height:1.1;">Set at kickoff</div>
               <div style="font-size:12px;color:#64748B;margin-top:4px;">matched to your calendar</div>`
            : `<div style="font-family:'Bebas Neue',Impact,sans-serif;font-size:30px;color:#0A1628;letter-spacing:0.02em;line-height:1;">${esc(deliveryShort)}</div>
               <div style="font-size:12px;color:#64748B;margin-top:4px;">from payment + intake</div>`}
        </td>
      </tr>
    </table>
  </div>

  <!-- Three documents -->
  <div style="padding:0 32px;">
    <div style="font-family:'DM Mono',Menlo,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#2563EB;font-weight:600;margin-bottom:14px;">Engagement Documents</div>

    <a href="${tProposalUrl}" style="display:block;text-decoration:none;margin-bottom:10px;background:#fff;border:1px solid rgba(15,32,64,0.08);border-radius:14px;padding:18px 22px;color:#1E293B;box-shadow:0 1px 2px rgba(15,32,64,0.04), 0 8px 24px rgba(37,99,235,0.10), 0 24px 48px -16px rgba(37,99,235,0.08);">
      <div style="font-family:'DM Mono',Menlo,monospace;font-size:11px;letter-spacing:0.15em;color:#2563EB;font-weight:600;margin-bottom:4px;">DOC ${esc(docId('proposal'))} &middot; PROPOSAL</div>
      <div style="font-size:16px;font-weight:700;color:#0A1628;margin-bottom:4px;">Proposal</div>
      <div style="font-size:13px;color:#64748B;">${docProposalDesc}</div>
    </a>

    <a href="${tSowUrl}" style="display:block;text-decoration:none;margin-bottom:10px;background:#fff;border:1px solid rgba(15,32,64,0.08);border-radius:14px;padding:18px 22px;color:#1E293B;box-shadow:0 1px 2px rgba(15,32,64,0.04), 0 8px 24px rgba(37,99,235,0.10), 0 24px 48px -16px rgba(37,99,235,0.08);">
      <div style="font-family:'DM Mono',Menlo,monospace;font-size:11px;letter-spacing:0.15em;color:#2563EB;font-weight:600;margin-bottom:4px;">DOC ${esc(docId('sow'))} &middot; SCOPE OF WORK</div>
      <div style="font-size:16px;font-weight:700;color:#0A1628;margin-bottom:4px;">Scope of Work</div>
      <div style="font-size:13px;color:#64748B;">${docSowDesc}</div>
    </a>

    <a href="${tTimelineUrl}" style="display:block;text-decoration:none;margin-bottom:10px;background:#fff;border:1px solid rgba(15,32,64,0.08);border-radius:14px;padding:18px 22px;color:#1E293B;box-shadow:0 1px 2px rgba(15,32,64,0.04), 0 8px 24px rgba(37,99,235,0.10), 0 24px 48px -16px rgba(37,99,235,0.08);">
      <div style="font-family:'DM Mono',Menlo,monospace;font-size:11px;letter-spacing:0.15em;color:#2563EB;font-weight:600;margin-bottom:4px;">DOC ${esc(docId('timeline'))} &middot; TIMELINE</div>
      <div style="font-size:16px;font-weight:700;color:#0A1628;margin-bottom:4px;">${esc(docTimelineTitle)}</div>
      <div style="font-size:13px;color:#64748B;">${docTimelineDesc}</div>
    </a>

    <p style="font-size:13px;color:#64748B;margin:14px 0 0;">
      Or open everything from the package cover: <a href="${tCoverUrl}" style="color:#2563EB;">${esc(coverUrl.replace('https://',''))}</a>
    </p>
  </div>

  <!-- Sign CTA (table-based for bulletproof button rendering) -->
  <div style="padding:28px 32px 8px;">
    <div style="font-family:'DM Mono',Menlo,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#2563EB;font-weight:600;margin-bottom:12px;">Ready to Move?</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      <tr>
        <td bgcolor="#F97316" align="center" style="background-color:#F97316;border-radius:10px;">
          <a href="${tSignUrl}" style="display:block;background-color:#F97316;color:#FFFFFF;font-weight:700;font-size:15px;letter-spacing:0.02em;text-transform:uppercase;text-decoration:none;padding:18px 24px;border-radius:10px;text-align:center;">
            <span style="color:#FFFFFF;">Accept &amp; Sign Electronically &rarr;</span>
          </a>
        </td>
      </tr>
    </table>
    <p style="font-size:13px;color:#64748B;margin:14px 0 0;line-height:1.6;">
      ${signOutroHtml}
    </p>
  </div>

  <!-- Sign-off -->
  <div style="padding:24px 32px 32px;">
    <p style="font-size:15px;line-height:1.65;margin:0 0 4px;">${esc(signoffLine)}</p>
    <p style="font-size:15px;line-height:1.65;margin:0;font-weight:700;color:#0A1628;">Mark Gabrielli</p>
    <p style="font-size:13px;line-height:1.55;margin:2px 0 0;color:#64748B;">Fractional CMO &amp; COO &middot; WETYR Corp<br/><a href="mailto:mark@markcmo.com" style="color:#2563EB;">mark@markcmo.com</a> &middot; <a href="https://markcmo.com" style="color:#2563EB;">markcmo.com</a></p>
  </div>

  <!-- Footer (table-based for Outlook/Gmail) -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0A1628" style="background-color:#0A1628;border-collapse:collapse;border-top:4px solid #2563EB;">
    <tr>
      <td bgcolor="#0A1628" align="center" style="background-color:#0A1628;padding:18px 32px;font-size:11px;color:#94A3B8;">
        Confidential &middot; prepared for ${esc(client.legal_name)} &middot; valid 60 days from issue
      </td>
    </tr>
  </table>
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

    const subject = (testMode ? '[TEST] ' : '') + `${client.legal_name}, ${engagement.name} (Proposal)`.replace(/-/g, '-');

    // CC list logic:
    //   - If caller passes ccArg explicitly (array or null), honor it.
    //   - Otherwise, default = Mark's gmail + any cc_emails configured on the client record
    //     (set via /admin Edit Client -> CC Emails). Filtered to never CC the primary recipient.
    let ccList;
    if (Array.isArray(ccArg)) {
      ccList = ccArg;
    } else if (ccArg === null) {
      ccList = [];
    } else {
      const customCc = Array.isArray(client?.cc_emails)
        ? client.cc_emails.filter(e => typeof e === 'string' && e.includes('@'))
        : [];
      ccList = Array.from(new Set(['marklgabriellijr@gmail.com', ...customCc]))
        .filter(e => e !== recipientEmail);
    }

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

    // Customer-journey: seed an email_sent row so subsequent Resend
    // open/click webhooks can correlate by resend_email_id.
    try {
      await sbInsert('mc_journey_events', {
        client_id: client.id,
        engagement_id: engagement.id,
        category: 'email',
        event: 'email_sent',
        subject_or_url: subject,
        recipient_email: recipientEmail,
        resend_email_id: resendData?.id || null,
        raw: { template: 'proposal-package', testMode, cc: ccList },
      });
    } catch (e) { console.warn('mc_journey_events insert failed:', e.message); }

    // ─── Auto-advance pipeline status on LIVE sends ─────────────
    // Move engagement out of 'lead'/'draft' to 'proposal_sent' so the
    // kanban + dashboard reflect reality without manual cleanup.
    // Test sends do NOT advance status (deliberate, testMode means
    // we're QA-ing the email, not progressing the pipeline).
    if (!testMode) {
      try {
        if (['lead','draft',null,undefined].includes(engagement.status)) {
          await sbUpdate('mc_engagements', `id=eq.${engagement.id}`, {
            status: 'proposal_sent',
            proposed_at: engagement.proposed_at || new Date().toISOString(),
          });
        }
        // Bump the client too, but only if they were sitting at 'lead'
        if (client.status === 'lead') {
          await sbUpdate('mc_clients', `id=eq.${client.id}`, { status: 'proposal_sent' });
        }
      } catch (e) { console.warn('auto-advance status failed:', e.message); }
    }

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
