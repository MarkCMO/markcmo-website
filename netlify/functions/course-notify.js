// course-notify.js
// POST { name, email, courseId }          → save notification signup
// POST { action:'launch', courseId, adminSecret } → send launch emails to all subscribers
// GET  { action:'list', adminSecret }     → return all signups (admin)

const https = require('https');

const COURSE_TITLES = {
  ceo:             'CEO Mastery: Building & Leading a $50M Company',
  cto:             'CTO Mastery: Engineering Organizations at Scale',
  cpo:             'Chief Product Officer Mastery',
  vpsales:         'VP of Sales Mastery',
  vpmarketing:     'VP of Marketing Mastery',
  ae:              'Account Executive Excellence',
  enterprise:      'Enterprise Sales: Closing 7-Figure Deals',
  salesops:        'Sales Operations & Revenue Intelligence',
  sdr:             'SDR Excellence: From Cold Outreach to Pipeline',
  negotiation:     'Advanced Negotiation for Executives',
  growth:          'Growth Manager Mastery',
  revenue:         'Revenue Architecture & GTM',
  category:        'Category Design & Market Leadership',
  digital:         'Digital Marketing Mastery',
  b2bdemand:       'B2B Demand Generation',
  aimarketing:     'AI-Powered Marketing & Sales',
  contentbrand:    'Content Marketing & Brand Authority',
  pricing:         'B2B Pricing Strategy & Monetization',
  seo:             'SEO Mastery: Rank #1 & Own Organic Traffic',
  sem:             'SEM & Paid Search Mastery',
  emailmarketing:  'Email Marketing & Automation Mastery',
  linkedin:        'LinkedIn Growth Machine',
  youtube:         'YouTube for Business: Authority at Scale',
  tiktok:          'TikTok & Short-Form Video for B2B',
  instagram:       'Instagram for Business',
  podcast:         'Podcast & Thought Leadership Strategy',
  saasbuilder:     'Building SaaS: Zero to $1M ARR',
  saasmetrics:     'SaaS Metrics Mastery: MRR, Churn, NRR & CAC',
  productstrategy: 'Product Strategy & Roadmap Leadership',
  aiimplementation:'AI Implementation for Business Leaders',
  engteam:         'Engineering Team Leadership for Non-Technical Execs',
  vendormgmt:      'Vendor Management & Procurement Mastery',
  softwareselection:'Enterprise Software Selection & Evaluation',
  martech:         'MarTech Stack Mastery: Build Your Revenue Engine',
  leadership:      'Executive Leadership for Consultants',
  fractional:      'Fractional Executive Playbook',
  boardpresent:    'Board Presentations & Investor Relations',
};

function jbReq(method, binId, apiKey, data) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const req = https.request({
      hostname: 'api.jsonbin.io',
      path: `/v3/b/${binId}`,
      method,
      headers: {
        'X-Master-Key': apiKey,
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {})
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function sendEmail(apiKey, to, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Mark Gabrielli <mark@markcmo.com>', to, subject, html })
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('Resend error:', err);
    throw new Error('Email failed: ' + err);
  }
  return res.json();
}

function confirmationEmail(name, courseTitle, courseId) {
  const firstName = name.split(' ')[0];
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif}
  .wrap{max-width:600px;margin:0 auto;background:#0d0d0d;border:1px solid #1e1e1e}
  .header{background:#0a0a0a;padding:32px 40px;border-bottom:1px solid #1e1e1e;text-align:center}
  .logo{font-size:22px;font-weight:900;letter-spacing:4px;color:#C9A84C;text-transform:uppercase}
  .body{padding:40px}
  .gold{color:#C9A84C}
  .h1{font-size:26px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#fff;margin:0 0 16px}
  .p{font-size:15px;color:#888;line-height:1.7;margin:0 0 20px}
  .course-box{background:#111;border:1px solid rgba(201,168,76,0.2);padding:20px 24px;margin:24px 0}
  .course-box-label{font-size:9px;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;margin-bottom:8px}
  .course-box-title{font-size:17px;font-weight:700;color:#fff;line-height:1.3}
  .footer{padding:24px 40px;border-top:1px solid #1e1e1e;text-align:center}
  .footer-text{font-size:11px;color:#333;letter-spacing:1px;line-height:1.8}
  .footer-text a{color:#444;text-decoration:none}
</style>
</head><body>
<div class="wrap">
  <div class="header">
    <div class="logo">MarkCMO Academy</div>
  </div>
  <div class="body">
    <div class="h1">You're on the list, ${firstName}.</div>
    <p class="p">We've saved your spot. When <strong style="color:#fff">${courseTitle}</strong> goes live, you'll be the first to know, and the first to get Founding Class pricing.</p>
    <div class="course-box">
      <div class="course-box-label">Course you voted for</div>
      <div class="course-box-title">${courseTitle}</div>
    </div>
    <p class="p">In the meantime, three courses are live right now, CMO, CFO, and COO Mastery. Each one earns you a verifiable diploma. Each one is built for leaders who are serious about operating at the C-suite level.</p>
    <p class="p" style="margin-bottom:32px">We're building what you voted for. The courses with the most votes get built first.</p>
    <a href="https://academy.markcmo.com" style="display:inline-block;background:#C9A84C;color:#000;font-weight:900;font-size:11px;letter-spacing:3px;text-transform:uppercase;padding:14px 28px;text-decoration:none">Browse Live Courses →</a>
  </div>
  <div class="footer">
    <div class="footer-text">
      MarkCMO Academy · <a href="https://markcmo.com">markcmo.com</a><br>
      Mark Gabrielli, Founder &amp; Dean<br>
      <a href="mailto:mark@markcmo.com">mark@markcmo.com</a>
    </div>
  </div>
</div>
</body></html>`;
}

function launchEmail(name, courseTitle, courseId, previewUrl) {
  const firstName = name.split(' ')[0];
  const enrollUrl = previewUrl || `https://academy.markcmo.com/preview?course=${courseId}`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif}
  .wrap{max-width:600px;margin:0 auto;background:#0d0d0d;border:1px solid #1e1e1e}
  .header{background:#0a0a0a;padding:32px 40px;border-bottom:2px solid #C9A84C;text-align:center}
  .logo{font-size:22px;font-weight:900;letter-spacing:4px;color:#C9A84C;text-transform:uppercase}
  .launch-badge{display:inline-block;background:#C9A84C;color:#000;font-size:9px;font-weight:900;letter-spacing:3px;text-transform:uppercase;padding:4px 14px;margin-top:10px}
  .body{padding:40px}
  .h1{font-size:28px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#fff;margin:0 0 8px;line-height:1.1}
  .eyebrow{font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;margin-bottom:16px}
  .p{font-size:15px;color:#888;line-height:1.7;margin:0 0 20px}
  .course-box{background:#111;border:1px solid rgba(201,168,76,0.3);border-left:3px solid #C9A84C;padding:20px 24px;margin:24px 0}
  .course-box-title{font-size:18px;font-weight:700;color:#fff;line-height:1.3;margin-bottom:6px}
  .course-box-meta{font-size:12px;color:#555;letter-spacing:1px}
  .cta{display:inline-block;background:#C9A84C;color:#000;font-weight:900;font-size:12px;letter-spacing:3px;text-transform:uppercase;padding:16px 32px;text-decoration:none;margin:8px 0}
  .footer{padding:24px 40px;border-top:1px solid #1e1e1e;text-align:center}
  .footer-text{font-size:11px;color:#333;letter-spacing:1px;line-height:1.8}
  .footer-text a{color:#444;text-decoration:none}
</style>
</head><body>
<div class="wrap">
  <div class="header">
    <div class="logo">MarkCMO Academy</div>
    <div class="launch-badge">🚀 Now Live</div>
  </div>
  <div class="body">
    <div class="eyebrow">You voted for this. We built it.</div>
    <div class="h1">It's here, ${firstName}.</div>
    <div class="course-box">
      <div class="course-box-title">${courseTitle}</div>
      <div class="course-box-meta">Now live · Founding Class pricing active</div>
    </div>
    <p class="p">You voted for this course. We built it. As a founding voter you get first access and the best price we'll ever offer.</p>
    <p class="p">10 modules. 50 lessons. 50-question final exam. A verifiable diploma with your name on it. This is the real thing.</p>
    <a href="${enrollUrl}" class="cta">Enroll Now, Founding Price →</a>
    <p class="p" style="margin-top:24px;font-size:13px">Founding Class pricing won't last. Once 250 students enroll, the price goes to full rate.</p>
  </div>
  <div class="footer">
    <div class="footer-text">
      You're receiving this because you voted for this course on MarkCMO Academy.<br>
      MarkCMO Academy · <a href="https://markcmo.com">markcmo.com</a><br>
      <a href="mailto:mark@markcmo.com">mark@markcmo.com</a>
    </div>
  </div>
</div>
</body></html>`;
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const {
    JSONBIN_API_KEY,
    JSONBIN_BIN_ID,
    RESEND_API_KEY,
    ADMIN_SECRET
  } = process.env;

  // Use a dedicated notify key within the general bin, or a separate bin if provided
  const NOTIFY_BIN = process.env.JSONBIN_NOTIFY_BIN_ID || JSONBIN_BIN_ID;

  // ── GET: admin list all signups ─────────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    const qs = event.queryStringParameters || {};
    if (qs.adminSecret !== ADMIN_SECRET) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
    try {
      const data = await jbReq('GET', NOTIFY_BIN, JSONBIN_API_KEY);
      const record = data.record || {};
      const signups = record.courseNotifySignups || [];
      const summary = {};
      signups.forEach(s => { summary[s.courseId] = (summary[s.courseId] || 0) + 1; });
      return { statusCode: 200, headers, body: JSON.stringify({ total: signups.length, byCourse: summary, signups }) };
    } catch(e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: '' };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch(e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad request' }) };
  }

  // ── POST action:launch, admin fires launch emails ──────────────────────────
  if (body.action === 'launch') {
    if (body.adminSecret !== ADMIN_SECRET) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
    const { courseId, previewUrl } = body;
    const courseTitle = COURSE_TITLES[courseId];
    if (!courseTitle) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown courseId' }) };
    }

    try {
      const data = await jbReq('GET', NOTIFY_BIN, JSONBIN_API_KEY);
      const record = data.record || {};
      const signups = record.courseNotifySignups || [];
      const targets = signups.filter(s => s.courseId === courseId || s.notifyAll);

      let sent = 0, failed = 0;
      for (const signup of targets) {
        try {
          await sendEmail(
            RESEND_API_KEY,
            signup.email,
            `🚀 It's live, ${courseTitle} | MarkCMO Academy`,
            launchEmail(signup.name, courseTitle, courseId, previewUrl)
          );
          sent++;
          // Small delay to avoid rate limits
          await new Promise(r => setTimeout(r, 120));
        } catch(e) {
          console.error('Failed email to', signup.email, e.message);
          failed++;
        }
      }

      // Mark as notified
      const now = new Date().toISOString();
      record.courseNotifySignups = signups.map(s =>
        (s.courseId === courseId) ? { ...s, launchNotifiedAt: now } : s
      );
      record.launchLog = record.launchLog || [];
      record.launchLog.push({ courseId, courseTitle, sentAt: now, sent, failed });
      await jbReq('PUT', NOTIFY_BIN, JSONBIN_API_KEY, record);

      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, sent, failed, courseId, courseTitle }) };
    } catch(e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  // ── POST: save a notification signup ───────────────────────────────────────
  const { name, email, courseId, notifyAll } = body;

  if (!name || !email || !courseId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'name, email, and courseId are required' }) };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email' }) };
  }

  const courseTitle = COURSE_TITLES[courseId];
  if (!courseTitle) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown course' }) };
  }

  try {
    // Load existing record
    let record;
    try {
      const data = await jbReq('GET', NOTIFY_BIN, JSONBIN_API_KEY);
      record = data.record || {};
    } catch(e) { record = {}; }

    const signups = record.courseNotifySignups || [];
    const emailLower = email.toLowerCase().trim();

    // Check for duplicate (same email + same course)
    const alreadySignedUp = signups.some(
      s => s.email.toLowerCase() === emailLower && s.courseId === courseId
    );

    if (!alreadySignedUp) {
      signups.push({
        name: name.trim(),
        email: emailLower,
        courseId,
        notifyAll: !!notifyAll,
        signedUpAt: new Date().toISOString()
      });
      record.courseNotifySignups = signups;
      await jbReq('PUT', NOTIFY_BIN, JSONBIN_API_KEY, record);
    }

    // Send confirmation email (always, even if duplicate, they may have forgotten)
    try {
      await sendEmail(
        RESEND_API_KEY,
        emailLower,
        `You're on the list, ${courseTitle} | MarkCMO Academy`,
        confirmationEmail(name.trim(), courseTitle, courseId)
      );
    } catch(e) {
      console.error('Confirmation email failed:', e.message);
      // Don't fail the whole request if email fails
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, alreadySignedUp, courseTitle })
    };

  } catch(e) {
    console.error('course-notify error:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error. Try again or email mark@markcmo.com' }) };
  }
};
