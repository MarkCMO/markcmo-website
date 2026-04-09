// netlify/functions/email-drip.js
// Netlify scheduled function, runs every hour, fires drip emails at scheduled times
// Add to netlify.toml:
//   [functions.email-drip]
//     schedule = "0 * * * *"

const WEBINAR_CONFIG = {
  riversideLink: "https://riverside.fm/studio/REPLACE_WITH_REAL_LINK",
  title: "The Revenue Leak Audit: Fix What's Killing Growth",
  playbookUrl: "https://markcmo.com/webinar-playbook-delivery.html",
  displayDate: "April 1, 2026 at 2:00 PM ET",
};

exports.handler = async () => {
  console.log("[email-drip] Running drip check:", new Date().toISOString());

  try {
    const { queue, binData } = await getDripQueue();
    const now = new Date();
    const toSend = queue.filter(item => !item.sent && new Date(item.sendAt) <= now);

    console.log(`[email-drip] Found ${toSend.length} emails to send`);

    for (const item of toSend) {
      try {
        await sendDripEmail(item);
        item.sent = true;
        item.sentAt = now.toISOString();
        console.log(`[email-drip] Sent ${item.emailType} to ${item.email}`);
      } catch (err) {
        console.error(`[email-drip] Failed to send ${item.emailType} to ${item.email}:`, err.message);
        item.error = err.message;
      }
    }

    // Save updated queue
    await saveDripQueue({ ...binData, queue });

    return { statusCode: 200, body: JSON.stringify({ sent: toSend.length }) };
  } catch (err) {
    console.error("[email-drip] Fatal error:", err);
    return { statusCode: 500, body: err.message };
  }
};

// ─── QUEUE MANAGEMENT ────────────────────────────────────────────────────────

async function getDripQueue() {
  const { JSONBIN_API_KEY, JSONBIN_DRIP_BIN_ID } = process.env;
  const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_DRIP_BIN_ID}/latest`, {
    headers: { "X-Master-Key": JSONBIN_API_KEY }
  });
  const data = await res.json();
  return { queue: data.record?.queue || [], binData: data.record || {} };
}

async function saveDripQueue(data) {
  const { JSONBIN_API_KEY, JSONBIN_DRIP_BIN_ID } = process.env;
  await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_DRIP_BIN_ID}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Master-Key": JSONBIN_API_KEY },
    body: JSON.stringify(data)
  });
}

// ─── EMAIL DISPATCHER ────────────────────────────────────────────────────────

async function sendDripEmail(item) {
  const templates = {
    reminder_2day: {
      subject: "📊 2 days away, the revenue leak most CMOs never find",
      html: reminder2DayHTML(item)
    },
    reminder_1day: {
      subject: "⏰ Tomorrow: Your Revenue Leak Audit Webinar + prep checklist",
      html: reminder1DayHTML(item)
    },
    reminder_2hr: {
      subject: "🔴 Starting in 2 hours, here's your Riverside link",
      html: reminder2HrHTML(item)
    },
    playbook: {
      subject: "🎁 Your Revenue Leak Playbook is ready (+ replay coming soon)",
      html: playbookHTML(item)
    },
    case_study: {
      subject: "How one CMO found $800K in pipeline in 48 hours",
      html: caseStudyHTML(item)
    },
    followup_check: {
      subject: "Did you run the audit yet? (quick check-in)",
      html: followupHTML(item)
    },
    last_chance: {
      subject: "Last chance: The CMO Revenue Audit offer expires Friday",
      html: lastChanceHTML(item)
    }
  };

  const template = templates[item.emailType];
  if (!template) throw new Error(`Unknown email type: ${item.emailType}`);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.WEBINAR_RESEND_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Mark Donnigan <mark@markcmo.com>",
      to: item.email,
      subject: template.subject,
      html: template.html
    })
  });

  if (!res.ok) throw new Error(await res.text());
}

// ─── EMAIL WRAPPER ────────────────────────────────────────────────────────────

function emailWrap(content) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
<tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="background:#111;border-bottom:2px solid #C9A84C;padding:24px 40px;">
    <div style="font-family:Georgia,serif;font-size:10px;letter-spacing:4px;color:#C9A84C;text-transform:uppercase;margin-bottom:6px;">MARK DONNIGAN</div>
    <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">MARKCMO.COM</div>
  </td></tr>
  <tr><td style="background:#111;padding:40px;">
    ${content}
    <hr style="border:none;border-top:1px solid #222;margin:32px 0;">
    <p style="font-size:12px;color:#444;margin:0;">Questions? Reply to this email.<br>
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

// ─── TEMPLATES ────────────────────────────────────────────────────────────────

function reminder2DayHTML(item) {
  return emailWrap(`
    <p style="font-size:18px;font-weight:700;color:#fff;margin:0 0 16px;">${item.firstName}, it starts in 2 days.</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 24px;">Most CMOs know their pipeline is leaking. Few know <em>where</em>.</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 24px;">On Wednesday I'm going to show you the 7 specific places revenue disappears between marketing and closed-won, and the exact framework I use to find them in a single afternoon.</p>
    <div style="background:#0a0a0a;border-left:3px solid #C9A84C;padding:20px 24px;margin:0 0 24px;">
      <div style="font-size:13px;color:#C9A84C;font-weight:700;margin-bottom:8px;">THE REVENUE LEAK AUDIT WEBINAR</div>
      <div style="font-size:14px;color:#ccc;">${WEBINAR_CONFIG.displayDate}</div>
      <div style="font-size:13px;color:#666;margin-top:4px;">Live on Riverside.fm • 75 min + Q&A</div>
    </div>
    <p style="font-size:14px;color:#888;margin:0 0 24px;">No slides. No fluff. Just a live audit walkthrough and a framework you can use next week.</p>
    ${goldBtn("https://markcmo.com/webinar-confirmation.html", "VIEW YOUR REGISTRATION →")}
    <p style="font-size:14px;color:#666;">See you Wednesday,<br><strong style="color:#aaa;">Mark</strong></p>
  `);
}

function reminder1DayHTML(item) {
  return emailWrap(`
    <p style="font-size:18px;font-weight:700;color:#fff;margin:0 0 16px;">${item.firstName}, it's tomorrow. Here's how to prep.</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 24px;">To get the most out of tomorrow's session, spend 10 minutes before we start:</p>
    <div style="margin:0 0 24px;">
      ${['Pull your last 90 days of pipeline data (even rough numbers)', 'Know your average deal cycle length', 'Have 1-2 stuck deals in mind to use as examples', 'Come with your biggest GTM question ready for Q&A'].map((t,i) => `
      <div style="display:flex;align-items:flex-start;margin-bottom:12px;padding:12px 16px;background:#0a0a0a;border:1px solid #1a1a1a;">
        <div style="color:#C9A84C;font-weight:900;font-size:16px;margin-right:12px;min-width:24px;">${i+1}</div>
        <div style="font-size:14px;color:#ccc;line-height:1.5;">${t}</div>
      </div>`).join('')}
    </div>
    <p style="font-size:14px;color:#aaa;margin:0 0 8px;">You'll get the Riverside link in tomorrow's 2-hour reminder email. Mark your calendar.</p>
    ${goldBtn("https://markcmo.com/webinar-confirmation.html", "YOUR REGISTRATION DETAILS →")}
    <p style="font-size:14px;color:#666;">Tomorrow,<br><strong style="color:#aaa;">Mark</strong></p>
  `);
}

function reminder2HrHTML(item) {
  return emailWrap(`
    <div style="background:#C9A84C;padding:12px 20px;margin:0 0 28px;">
      <div style="font-size:12px;font-weight:700;letter-spacing:3px;color:#0a0a0a;text-transform:uppercase;">🔴 STARTING IN 2 HOURS</div>
    </div>
    <p style="font-size:18px;font-weight:700;color:#fff;margin:0 0 16px;">${item.firstName}, here's your access link.</p>
    <div style="background:#0a0a0a;border:1px solid #222;border-left:3px solid #C9A84C;padding:24px;margin:0 0 24px;text-align:center;">
      <div style="font-size:13px;color:#666;margin-bottom:8px;">JOIN THE WEBINAR HERE</div>
      <a href="${WEBINAR_CONFIG.riversideLink}" style="font-size:16px;color:#C9A84C;font-weight:700;word-break:break-all;">${WEBINAR_CONFIG.riversideLink}</a>
      <div style="font-size:13px;color:#666;margin-top:12px;">${WEBINAR_CONFIG.displayDate}</div>
    </div>
    <p style="font-size:13px;color:#888;">Open the link 5 minutes early to make sure audio/video is working. The playbook is only sent to live attendees.</p>
    ${goldBtn(WEBINAR_CONFIG.riversideLink, "JOIN NOW →")}
  `);
}

function playbookHTML(item) {
  return emailWrap(`
    <p style="font-size:18px;font-weight:700;color:#fff;margin:0 0 16px;">${item.firstName}, your playbook is waiting.</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 24px;">Thank you for attending today. As promised, here's everything you need to run your first Revenue Leak Audit.</p>
    <div style="background:#0a0a0a;border:1px solid #1a1a1a;padding:24px;margin:0 0 24px;">
      <div style="font-size:11px;letter-spacing:3px;color:#C9A84C;text-transform:uppercase;margin-bottom:16px;">WHAT'S INSIDE THE PLAYBOOK</div>
      ${['The 7 Revenue Leak Framework (printable)', 'GTM Audit Scorecard (Excel + PDF)', 'The 90-Day Sprint Planner', '3 real-world case study walkthroughs', 'Board presentation template', 'The Revenue Leak Calculator'].map(t => `
      <div style="display:flex;align-items:center;margin-bottom:8px;">
        <div style="color:#C9A84C;margin-right:10px;">✓</div>
        <div style="font-size:14px;color:#ccc;">${t}</div>
      </div>`).join('')}
    </div>
    ${goldBtn(WEBINAR_CONFIG.playbookUrl, "DOWNLOAD YOUR PLAYBOOK →")}
    <p style="font-size:14px;color:#888;margin:0 0 16px;">The replay will be available within 48 hours. I'll send it directly to your inbox.</p>
    <p style="font-size:14px;color:#666;">If you want to go deeper, run a full audit with my support, reply to this email with "audit" and I'll send you details on a strategy session.</p>
    <p style="font-size:14px;color:#666;">Mark</p>
  `);
}

function caseStudyHTML(item) {
  return emailWrap(`
    <p style="font-size:18px;font-weight:700;color:#fff;margin:0 0 16px;">${item.firstName}, this took 48 hours.</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 20px;">A client came to me frustrated. Their pipeline looked healthy on paper, but deals kept stalling at the same stage. Sales was blaming marketing. Marketing had the leads. Nobody knew where the leak was.</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 20px;">We ran the Revenue Leak Audit in two working sessions.</p>
    <div style="background:#0a0a0a;border-left:3px solid #C9A84C;padding:20px 24px;margin:0 0 24px;">
      <div style="font-size:28px;font-weight:900;color:#C9A84C;margin-bottom:8px;">$800K</div>
      <div style="font-size:14px;color:#aaa;">in dormant pipeline reactivated within 30 days of plugging two leaks we identified in the audit.</div>
    </div>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 24px;">The playbook you downloaded has the full framework. If you want me to run it on your business, that's the CMO Audit & Sprint.</p>
    ${goldBtn("https://square.link/u/kLKYt0W3", "BOOK A CMO AUDIT →")}
    <p style="font-size:13px;color:#666;">Starts at $1,000 · Typically 2-3 working sessions · Deliverable: full audit report + 90-day sprint plan</p>
    <p style="font-size:14px;color:#666;">Mark</p>
  `);
}

function followupHTML(item) {
  return emailWrap(`
    <p style="font-size:18px;font-weight:700;color:#fff;margin:0 0 16px;">Quick check-in, ${item.firstName}.</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 20px;">It's been a week since the webinar. Did you get a chance to open the playbook?</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 24px;">If you ran any part of the audit, I'd genuinely love to hear what you found. Reply and tell me, which of the 7 leaks showed up in your business?</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 24px;">And if you haven't had time yet, the playbook download page is still live:</p>
    ${goldBtn(WEBINAR_CONFIG.playbookUrl, "ACCESS YOUR PLAYBOOK →")}
    <p style="font-size:14px;color:#aaa;">If you want help running the audit, or want to know what this would look like as a facilitated engagement, reply with "tell me more" and I'll send details.</p>
    <p style="font-size:14px;color:#666;">Mark</p>
  `);
}

function lastChanceHTML(item) {
  return emailWrap(`
    <div style="background:#C9A84C;padding:12px 20px;margin:0 0 28px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:3px;color:#0a0a0a;text-transform:uppercase;">⚠️ OFFER EXPIRES FRIDAY</div>
    </div>
    <p style="font-size:18px;font-weight:700;color:#fff;margin:0 0 16px;">${item.firstName}, last call.</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 20px;">I've been offering webinar attendees a CMO Audit & Sprint starting at $1,000. That offer closes this Friday.</p>
    <div style="background:#0a0a0a;border:1px solid #222;padding:24px;margin:0 0 24px;">
      <div style="font-size:11px;letter-spacing:3px;color:#C9A84C;text-transform:uppercase;margin-bottom:16px;">CMO AUDIT & SPRINT, WHAT YOU GET</div>
      ${['Full 7-lever Revenue Leak Audit of your business', 'Written audit report with leak prioritization', '90-Day Sprint Blueprint customized to your stage', 'Presentation-ready board deck', '60-minute follow-up session 30 days out'].map(t => `
      <div style="display:flex;align-items:center;margin-bottom:8px;">
        <div style="color:#C9A84C;margin-right:10px;">→</div>
        <div style="font-size:14px;color:#ccc;">${t}</div>
      </div>`).join('')}
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid #1a1a1a;">
        <span style="font-size:22px;font-weight:900;color:#fff;">$1,000</span>
        <span style="font-size:14px;color:#666;margin-left:8px;text-decoration:line-through;">$1,500+</span>
        <span style="font-size:12px;color:#C9A84C;margin-left:8px;">WEBINAR ATTENDEE RATE</span>
      </div>
    </div>
    ${goldBtn("https://square.link/u/kLKYt0W3", "BOOK YOUR AUDIT, FROM $1,000 →")}
    <p style="font-size:13px;color:#666;text-align:center;">Offer expires Friday. Limited to 3 spots this month.</p>
    <p style="font-size:14px;color:#666;">Mark</p>
  `);
}
