// netlify/functions/webinar-signup.js
// POST { firstName, lastName, email, company, revenue, challenge }
// → stores lead in JSONBin, queues drip, sends confirmation + ICS, notifies Mark
//
// To update webinar date/title WITHOUT redeploying:
//   Set these Netlify env vars:
//   WEBINAR_DATE       e.g. "20260501T180000Z"
//   WEBINAR_END_DATE   e.g. "20260501T193000Z"  
//   WEBINAR_DISPLAY    e.g. "May 1, 2026 at 2:00 PM ET"
//   WEBINAR_TIME       e.g. "2:00 PM - 3:30 PM ET"
//   WEBINAR_TITLE      e.g. "The Revenue Leak Audit"
//   WEBINAR_LINK       e.g. "https://riverside.fm/studio/YOURLINK"

function getConfig() {
  return {
    date:        process.env.WEBINAR_DATE        || '20260501T180000Z',
    endDate:     process.env.WEBINAR_END_DATE    || '20260501T193000Z',
    displayDate: process.env.WEBINAR_DISPLAY     || 'Coming Soon, check back for the next date',
    displayTime: process.env.WEBINAR_TIME        || 'TBD',
    riversideLink: process.env.WEBINAR_LINK      || 'https://markcmo.com/webinar-confirmation.html',
    title:       process.env.WEBINAR_TITLE       || 'The Revenue Leak Audit: Fix What\'s Killing Growth',
    location:    'Live on Riverside.fm (link sent 2 hours before)',
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders() };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { firstName, lastName, email, company, revenue, challenge, company_url } = body;
  if (!firstName || !email) return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };

  // ── Bot defense ─────────────────────────────────────────────────────────
  // 1) Honeypot: hidden field `company_url` is invisible to humans. If a bot
  //    fills it, silently 200-OK so the bot thinks it succeeded. Don't store.
  // 2) Gibberish detection: 15+ char alphanumeric string with no whitespace
  //    in firstName/lastName is the bot pattern observed in spam records.
  const looksBot =
    (company_url && company_url.trim()) ||
    /^[A-Za-z0-9]{15,}$/.test((firstName || '').trim()) ||
    (lastName && /^[A-Za-z0-9]{15,}$/.test(lastName.trim()));
  if (looksBot) {
    console.warn('[webinar-signup] bot rejected:', { email, firstName: (firstName||'').slice(0,20), honeypot: !!company_url });
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: true, name: firstName }) };
  }

  const WEBINAR_CONFIG = getConfig();
  const registeredAt = new Date().toISOString();
  const lead = { firstName, lastName, email, company, revenue, challenge, registeredAt, source: 'webinar-landing' };

  try {
    await storeLead(lead);
    await queueDripSequence(lead, registeredAt, WEBINAR_CONFIG);
    await sendConfirmationEmail(lead, WEBINAR_CONFIG);
    await sendNotificationEmail(lead, WEBINAR_CONFIG);
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: true, name: firstName }) };
  } catch (err) {
    console.error('Signup error:', err);
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'Registration failed. Please try again.' }) };
  }
};

async function storeLead(lead) {
  const { JSONBIN_API_KEY, JSONBIN_BIN_ID } = process.env;
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

async function queueDripSequence(lead, registeredAt, cfg) {
  const { JSONBIN_API_KEY, JSONBIN_DRIP_BIN_ID } = process.env;
  if (!JSONBIN_DRIP_BIN_ID) return; // skip if not configured
  const webinarDate = new Date(cfg.date);
  const schedule = [
    { emailType: 'reminder_2day', sendAt: new Date(webinarDate.getTime() - 2*86400000).toISOString() },
    { emailType: 'reminder_1day', sendAt: new Date(webinarDate.getTime() - 1*86400000).toISOString() },
    { emailType: 'reminder_2hr',  sendAt: new Date(webinarDate.getTime() - 2*3600000).toISOString() },
    { emailType: 'playbook',      sendAt: new Date(webinarDate.getTime() + 2*3600000).toISOString() },
    { emailType: 'case_study',    sendAt: new Date(webinarDate.getTime() + 3*86400000).toISOString() },
    { emailType: 'followup',      sendAt: new Date(webinarDate.getTime() + 7*86400000).toISOString() },
    { emailType: 'last_chance',   sendAt: new Date(webinarDate.getTime() + 14*86400000).toISOString() },
  ];
  const getRes = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_DRIP_BIN_ID}`, {
    headers: { 'X-Master-Key': JSONBIN_API_KEY, 'Content-Type': 'application/json' }
  });
  const getData = await getRes.json();
  const existing = getData.record?.queue || [];
  const newEntries = schedule.map(s => ({
    ...s, email: lead.email, firstName: lead.firstName, company: lead.company,
    sent: false, registeredAt: lead.registeredAt
  }));
  await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_DRIP_BIN_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_API_KEY },
    body: JSON.stringify({ queue: [...existing, ...newEntries] })
  });
}

async function sendConfirmationEmail(lead, cfg) {
  const ics = generateICS(lead, cfg);
  await resendSend({
    to: lead.email,
    subject: `You're registered: ${cfg.title}`,
    html: confirmationEmailHTML(lead, cfg),
    attachments: [{ filename: 'webinar-invite.ics', content: Buffer.from(ics).toString('base64') }]
  });
}

async function sendNotificationEmail(lead, cfg) {
  await resendSend({
    to: (process.env.NOTIFY_EMAIL || 'mark@markcmo.com,marklgabriellijr@gmail.com').split(',').map(s => s.trim()).filter(Boolean),
    subject: `🎯 New Webinar Registration: ${lead.firstName} ${lead.lastName}, ${lead.company || 'No company'}`,
    html: `<div style="font-family:monospace;padding:24px;background:#0a0a0a;color:#e8e8e8;">
      <h2 style="color:#C9A84C;">New Webinar Registration</h2>
      <p><b>Name:</b> ${lead.firstName} ${lead.lastName || ''}</p>
      <p><b>Email:</b> ${lead.email}</p>
      <p><b>Company:</b> ${lead.company || '-'}</p>
      <p><b>Revenue:</b> ${lead.revenue || '-'}</p>
      <p><b>Challenge:</b> ${lead.challenge || '-'}</p>
      <p><b>Registered:</b> ${new Date(lead.registeredAt).toLocaleString()}</p>
      <p><b>Webinar:</b> ${cfg.title}, ${cfg.displayDate}</p>
    </div>`
  });
}

async function resendSend(payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.WEBINAR_RESEND_KEY || process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Mark Gabrielli <mark@markcmo.com>', ...payload })
  });
  if (!res.ok) throw new Error(`Resend error: ${await res.text()}`);
  return res.json();
}

function generateICS(lead, cfg) {
  return `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//MarkCMO//Webinar//EN\nMETHOD:REQUEST\nBEGIN:VEVENT\nUID:webinar-${lead.email}-${Date.now()}@markcmo.com\nDTSTART:${cfg.date}\nDTEND:${cfg.endDate}\nSUMMARY:${cfg.title}\nDESCRIPTION:Join Mark Gabrielli live.\\nLink: ${cfg.riversideLink}\nLOCATION:${cfg.location}\nORGANIZER;CN=Mark Gabrielli:mailto:mark@markcmo.com\nATTENDEE;CN=${lead.firstName} ${lead.lastName||''}:mailto:${lead.email}\nEND:VEVENT\nEND:VCALENDAR`;
}

function confirmationEmailHTML(lead, cfg) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;"><tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="background:#111;border-bottom:2px solid #C9A84C;padding:32px 40px;">
    <div style="font-size:11px;letter-spacing:4px;color:#C9A84C;text-transform:uppercase;margin-bottom:8px;">MARK GABRIELLI</div>
    <div style="font-size:28px;font-weight:900;color:#fff;">MARKCMO.COM</div>
  </td></tr>
  <tr><td style="background:#C9A84C;padding:14px 40px;">
    <div style="font-size:12px;font-weight:700;letter-spacing:3px;color:#000;text-transform:uppercase;">YOU'RE IN, REGISTRATION CONFIRMED</div>
  </td></tr>
  <tr><td style="background:#111;padding:40px;">
    <p style="font-size:22px;font-weight:700;color:#fff;margin:0 0 8px;">${lead.firstName},</p>
    <p style="font-size:15px;color:#888;margin:0 0 28px;">Your spot is locked in. Here's everything you need.</p>
    <div style="background:#0a0a0a;border:1px solid #222;border-left:3px solid #C9A84C;padding:20px 24px;margin:0 0 28px;">
      <div style="font-size:10px;letter-spacing:3px;color:#C9A84C;margin-bottom:10px;">EVENT DETAILS</div>
      <div style="font-size:19px;font-weight:700;color:#fff;margin-bottom:8px;">${cfg.title}</div>
      <div style="font-size:14px;color:#aaa;margin-bottom:4px;">📅 ${cfg.displayDate}</div>
      <div style="font-size:14px;color:#aaa;">⏱ ${cfg.displayTime}</div>
    </div>
    <p style="font-size:14px;color:#555;margin:0 0 24px;">A calendar invite (.ics) is attached to this email, open it to add directly to your calendar.</p>
    <div style="background:#0a0a0a;border:1px solid #1e1e1e;padding:16px 20px;margin:0 0 28px;">
      <div style="font-size:13px;color:#aaa;">🎁 <strong style="color:#fff;">Bonus:</strong> Show up live and receive the <span style="color:#C9A84C;font-weight:600;">Revenue Leak Playbook</span>, free.</div>
    </div>
    <div style="margin:0 0 28px;">
      <a href="https://academy.markcmo.com" style="display:inline-block;background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);color:#C9A84C;font-size:12px;font-weight:700;letter-spacing:2px;padding:12px 24px;text-decoration:none;text-transform:uppercase;">🎓 Also: Explore MarkCMO Academy →</a>
    </div>
    <p style="font-size:14px;color:#555;margin:0;">See you there,<br><strong style="color:#aaa;">Mark Gabrielli</strong></p>
  </td></tr>
  <tr><td style="background:#0a0a0a;border-top:1px solid #1a1a1a;padding:20px 40px;">
    <p style="font-size:11px;color:#333;margin:0;">You registered at markcmo.com · <a href="https://markcmo.com" style="color:#C9A84C;">markcmo.com</a></p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

function corsHeaders() {
  return { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS' };
}
