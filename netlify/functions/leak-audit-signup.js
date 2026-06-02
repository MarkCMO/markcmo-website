// netlify/functions/leak-audit-signup.js
// POST { firstName, email, revenue, source, company_url(honeypot) }
// → stores lead in JSONBin, sends instant audit delivery, queues nurture drip, notifies Mark
//
// Reuses the same infra as webinar-signup.js:
//   JSONBIN_API_KEY, JSONBIN_BIN_ID (leads), JSONBIN_DRIP_BIN_ID (drip queue)
//   WEBINAR_RESEND_KEY || RESEND_API_KEY (Resend send key)
//   NOTIFY_EMAIL (comma-separated, defaults to mark@markcmo.com,marklgabriellijr@gmail.com)

const AUDIT_URL = 'https://markcmo.com/leak-audit-report.html';
const BOOK_URL = 'https://markcmo.com/book.html';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders() };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: corsHeaders(), body: 'Method Not Allowed' };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { firstName, email, revenue, source, company_url } = body;
  if (!firstName || !email) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'Missing required fields' }) };

  // ── Bot defense (mirrors webinar-signup.js) ───────────────────────────────
  const looksBot =
    (company_url && company_url.trim()) ||
    /^[A-Za-z0-9]{15,}$/.test((firstName || '').trim());
  if (looksBot) {
    console.warn('[leak-audit-signup] bot rejected:', { email, honeypot: !!company_url });
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: true, name: firstName }) };
  }

  const registeredAt = new Date().toISOString();
  const lead = { firstName, email, revenue: revenue || '', registeredAt, source: source || 'instagram-leak-audit' };

  try {
    await storeLead(lead);
    await sendAuditEmail(lead);
    await queueNurtureSequence(lead, registeredAt);
    await sendNotificationEmail(lead);
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: true, name: firstName }) };
  } catch (err) {
    console.error('[leak-audit-signup] error:', err);
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'Signup failed. Please try again.' }) };
  }
};

async function storeLead(lead) {
  const { JSONBIN_API_KEY, JSONBIN_BIN_ID } = process.env;
  if (!JSONBIN_API_KEY || !JSONBIN_BIN_ID) return; // skip if not configured
  const getRes = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
    headers: { 'X-Master-Key': JSONBIN_API_KEY, 'Content-Type': 'application/json' }
  });
  const getData = await getRes.json();
  const existing = getData.record?.leads || [];
  await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_API_KEY },
    body: JSON.stringify({ ...getData.record, leads: [...existing, lead] })
  });
}

// Day 0 instant delivery handled here; days 2/4/6/8 queued into the drip cron.
async function queueNurtureSequence(lead, registeredAt) {
  const { JSONBIN_API_KEY, JSONBIN_DRIP_BIN_ID } = process.env;
  if (!JSONBIN_DRIP_BIN_ID) return; // skip if not configured
  const base = new Date(registeredAt).getTime();
  const DAY = 86400000;
  const at = d => new Date(base + d * DAY).toISOString();
  // Days 0-8: instant audit (sent now) + 4 leak-audit nurture emails.
  // Days 11-90: the 90-day nurture sequence (keys match email-drip.js SEQUENCE).
  const schedule = [
    { emailType: 'la_value',      sendAt: at(2) },
    { emailType: 'la_story',      sendAt: at(4) },
    { emailType: 'la_proof',      sendAt: at(6) },
    { emailType: 'la_offer',      sendAt: at(8) },
    { emailType: 'd90_biz1',      sendAt: at(11) },
    { emailType: 'd90_sys1',      sendAt: at(14) },
    { emailType: 'd90_method1',   sendAt: at(18) },
    { emailType: 'd90_checkin1',  sendAt: at(22) },
    { emailType: 'd90_sys2',      sendAt: at(26) },
    { emailType: 'd90_story1',    sendAt: at(30) },
    { emailType: 'd90_method2',   sendAt: at(34) },
    { emailType: 'd90_biz2',      sendAt: at(38) },
    { emailType: 'd90_proof1',    sendAt: at(42) },
    { emailType: 'd90_checkin2',  sendAt: at(46) },
    { emailType: 'd90_sys3',      sendAt: at(50) },
    { emailType: 'd90_method3',   sendAt: at(54) },
    { emailType: 'd90_story2',    sendAt: at(58) },
    { emailType: 'd90_biz3',      sendAt: at(62) },
    { emailType: 'd90_value1',    sendAt: at(66) },
    { emailType: 'd90_checkin3',  sendAt: at(70) },
    { emailType: 'd90_proof2',    sendAt: at(74) },
    { emailType: 'd90_method4',   sendAt: at(78) },
    { emailType: 'd90_offer1',    sendAt: at(82) },
    { emailType: 'd90_checkin4',  sendAt: at(86) },
    { emailType: 'd90_recap',     sendAt: at(90) },
  ];
  const getRes = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_DRIP_BIN_ID}`, {
    headers: { 'X-Master-Key': JSONBIN_API_KEY, 'Content-Type': 'application/json' }
  });
  const getData = await getRes.json();
  const existing = getData.record?.queue || [];
  const newEntries = schedule.map(s => ({
    ...s, email: lead.email, firstName: lead.firstName,
    sent: false, registeredAt: lead.registeredAt
  }));
  await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_DRIP_BIN_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_API_KEY },
    body: JSON.stringify({ queue: [...existing, ...newEntries] })
  });
}

async function sendAuditEmail(lead) {
  await resendSend({
    to: lead.email,
    subject: `${lead.firstName}, here's your 9-Point Marketing Leak Audit`,
    html: auditEmailHTML(lead)
  });
}

async function sendNotificationEmail(lead) {
  await resendSend({
    to: (process.env.NOTIFY_EMAIL || 'mark@markcmo.com,marklgabriellijr@gmail.com').split(',').map(s => s.trim()).filter(Boolean),
    subject: `🎯 New Leak Audit lead: ${lead.firstName} (${lead.source})`,
    html: `<div style="font-family:monospace;padding:24px;background:#0a0a0a;color:#e8e8e8;">
      <h2 style="color:#C9A84C;">New Leak Audit Lead</h2>
      <p><b>Name:</b> ${lead.firstName}</p>
      <p><b>Email:</b> ${lead.email}</p>
      <p><b>Revenue:</b> ${lead.revenue || '-'}</p>
      <p><b>Source:</b> ${lead.source}</p>
      <p><b>Captured:</b> ${new Date(lead.registeredAt).toLocaleString()}</p>
    </div>`
  });
}

async function resendSend(payload) {
  const apiKey = process.env.WEBINAR_RESEND_KEY || process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('Resend key not configured');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Mark Gabrielli <mark@markcmo.com>', ...payload })
  });
  if (!res.ok) throw new Error(`Resend error: ${await res.text()}`);
  return res.json();
}

function auditEmailHTML(lead) {
  const leaks = [
    ['1. The Offer Leak', "A stranger can't tell what you sell, who it's for, and why it beats the alternative, in one sentence."],
    ['2. The Tracking Leak', "You can't say, with numbers, where your last 10 customers came from."],
    ['3. The Capture Leak', "Visitors who aren't ready to buy leave with no way for you to follow up."],
    ['4. The Follow-Up Leak', "Leads come in and sit in your inbox until they go cold."],
    ['5. The Proof Leak', "Prospects have to decide before they ever see undeniable results."],
    ['6. The Channel Leak', "You're spread thin across five channels and winning on none of them."],
    ['7. The Retargeting Leak', "Warm visitors who already engaged never see your offer a second time."],
    ['8. The Speed Leak', "Leads raise their hand and wait hours, or days, for a reply."],
    ['9. The Consistency Leak', "Your marketing stops the week client work gets busy."],
  ];
  const rows = leaks.map(([t, d]) => `
    <div style="padding:14px 0;border-bottom:1px solid #1a1a1a;">
      <div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:4px;">${t}</div>
      <div style="font-size:13px;color:#999;line-height:1.6;">${d}</div>
    </div>`).join('');
  return emailWrap(`
    <p style="font-size:20px;font-weight:700;color:#fff;margin:0 0 12px;">${lead.firstName}, here it is.</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 20px;">This is the same 9-point check I run before taking on any founder as their fractional CMO. Go through all 9. For each, mark <b style="color:#fff;">PASS</b> or <b style="color:#C9A84C;">LEAK</b>. Most founders fail 4 to 6 and have no idea.</p>
    <div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:8px;padding:8px 20px;margin:0 0 24px;">${rows}</div>
    ${goldBtn(AUDIT_URL, 'Open The Full Audit (with the 1-week fixes) →')}
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:24px 0 0;">Run through it and hit reply with one thing: <b style="color:#fff;">which leak hit hardest?</b> Genuinely curious, and I read every reply.</p>
    <hr style="border:none;border-top:1px solid #222;margin:28px 0 24px;">
    <p style="font-size:16px;font-weight:700;color:#fff;margin:0 0 8px;">Want me to find your biggest leak with you?</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 4px;">Grab a free 20-minute call and I'll tell you the first leak I'd fix in your specific business. No pitch deck, no obligation, just a straight answer.</p>
    ${goldBtn(BOOK_URL, 'Book A Free 20-Min Call With Mark →')}
    <p style="font-size:14px;color:#666;margin:18px 0 0;">Mark</p>
  `);
}

function emailWrap(content) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
<tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="background:#111;border-bottom:2px solid #C9A84C;padding:24px 40px;">
    <div style="font-family:Georgia,serif;font-size:10px;letter-spacing:4px;color:#C9A84C;text-transform:uppercase;margin-bottom:6px;">MARK GABRIELLI</div>
    <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">MARKCMO.COM</div>
  </td></tr>
  <tr><td style="background:#111;padding:40px;">
    ${content}
    <hr style="border:none;border-top:1px solid #222;margin:32px 0;">
    <p style="font-size:12px;color:#444;margin:0;">You requested the Marketing Leak Audit at markcmo.com.<br>
    <a href="https://markcmo.com" style="color:#C9A84C;text-decoration:none;">markcmo.com</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function goldBtn(href, text) {
  return `<div style="text-align:center;margin:24px 0;">
    <a href="${href}" style="display:inline-block;background:#C9A84C;color:#0a0a0a;font-weight:700;font-size:12px;letter-spacing:2px;text-transform:uppercase;padding:14px 28px;text-decoration:none;">${text}</a>
  </div>`;
}

function corsHeaders() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
}
