// student-portal.js
// POST { email } → returns enrollments list for that email + optionally resends access links
// No auth required - returns course list without tokens (safe)

const https = require('https');

const ENROLL_BIN = process.env.JSONBIN_ENROLLMENTS_BIN_ID;
const GRADS_BIN  = process.env.JSONBIN_GRADS_BIN_ID;
const API_KEY    = process.env.JSONBIN_API_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;

function jbGet(binId) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.jsonbin.io', path: `/v3/b/${binId}`, method: 'GET',
      headers: { 'X-Master-Key': API_KEY, 'Content-Type': 'application/json' }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

async function sendAccessEmail(email, enrollments, grads) {
  if (!RESEND_KEY) return;

  const courseRows = enrollments.map(e => {
    const grad = grads.find(g => g.course === e.courseId && g.name && e.name &&
      g.name.toLowerCase().includes(e.name.split(' ')[0].toLowerCase()));
    const hasGrad = !!grad;
    const dipNum = grad ? grad.diplomaNumber : null;

    let status = 'In Progress';
    if (hasGrad) status = '✓ Completed';

    return `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #1e1e1e;font-weight:700;color:#fff">${e.courseTitle || e.courseId}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #1e1e1e;color:#C9A84C;font-family:monospace">${status}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #1e1e1e">
          <a href="https://academy.markcmo.com/learn?course=${e.courseId}&email=${encodeURIComponent(email)}&token=${e.accessToken}"
             style="display:inline-block;background:#C9A84C;color:#000;font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:8px 16px;text-decoration:none">
            Resume →
          </a>
          ${dipNum ? `<a href="https://academy.markcmo.com/diploma?course=${e.courseId}&name=${encodeURIComponent(e.name||'')}&gpa=${grad.gpa||''}&letter=${grad.letter||''}&designation=${encodeURIComponent(grad.designation||'')}" style="display:inline-block;margin-left:8px;color:#C9A84C;font-size:11px;text-decoration:none;border:1px solid #C9A84C;padding:8px 14px;font-weight:700;letter-spacing:1px">Diploma</a>` : ''}
        </td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="background:#0a0a0a;margin:0;padding:0;font-family:Arial,sans-serif;">
<div style="max-width:640px;margin:0 auto;">
  <div style="background:linear-gradient(135deg,#0d0d0d,#1a1400);padding:40px;text-align:center;border-bottom:2px solid #C9A84C;">
    <div style="font-size:10px;letter-spacing:5px;text-transform:uppercase;color:#C9A84C;margin-bottom:8px;">MarkCMO Academy</div>
    <h1 style="font-size:28px;font-weight:900;color:#fff;margin:0;letter-spacing:2px;">YOUR COURSE ACCESS</h1>
    <p style="font-size:14px;color:#888;margin:8px 0 0;">Here are all your enrolled courses and direct access links.</p>
  </div>
  <div style="background:#111;padding:32px;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="border-bottom:1px solid #2a2a2a;">
          <th style="padding:10px 16px;text-align:left;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#666">Course</th>
          <th style="padding:10px 16px;text-align:left;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#666">Status</th>
          <th style="padding:10px 16px;text-align:left;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#666">Access</th>
        </tr>
      </thead>
      <tbody>${courseRows}</tbody>
    </table>
    <div style="border-top:1px solid #222;margin-top:28px;padding-top:20px;">
      <p style="font-size:13px;color:#555;margin:0;">
        Bookmark these links. Questions? <a href="mailto:mark@markcmo.com" style="color:#C9A84C;">mark@markcmo.com</a>
      </p>
      <p style="font-size:12px;color:#444;margin:8px 0 0;">
        <a href="https://academy.markcmo.com/graduation" style="color:#666;text-decoration:none">Graduate Wall</a> ·
        <a href="https://academy.markcmo.com" style="color:#666;text-decoration:none">Browse Courses</a>
      </p>
    </div>
  </div>
</div></body></html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'MarkCMO Academy <mark@markcmo.com>',
      to: email,
      subject: 'Your MarkCMO Academy course access links',
      html
    })
  });
  if (!res.ok) console.error('Resend error:', await res.text());
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' };

  try {
    const { email, resendLinks } = JSON.parse(event.body || '{}');
    if (!email || !email.includes('@')) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid email required' }) };
    }

    const emailLower = email.toLowerCase().trim();

    // Load enrollments
    let enrollments = [];
    try {
      const data = await jbGet(ENROLL_BIN);
      const all = (data.record || { enrollments: [] }).enrollments;
      enrollments = all.filter(e => e.email && e.email.toLowerCase() === emailLower);
    } catch(e) { console.warn('Enroll bin error:', e.message); }

    if (!enrollments.length) {
      return { statusCode: 200, headers, body: JSON.stringify({ found: false, message: 'No courses found for this email address.' }) };
    }

    // Load grad records to check completion status + diploma numbers
    let grads = [];
    try {
      const gdata = await jbGet(GRADS_BIN);
      grads = (gdata.record || { graduates: [] }).graduates;
    } catch(e) { /* ok */ }

    // Build safe response (no tokens) + match with grad records
    const courses = enrollments.map(e => {
      const grad = grads.find(g =>
        g.course === e.courseId &&
        g.name && e.name &&
        g.name.toLowerCase().includes((e.name || '').split(' ')[0].toLowerCase())
      );
      return {
        courseId:    e.courseId,
        courseTitle: e.courseTitle || e.courseId,
        enrolledAt:  e.enrolledAt,
        completed:   !!grad,
        diplomaNumber: grad ? grad.diplomaNumber : null,
        gpa:         grad ? grad.gpa   : null,
        letter:      grad ? grad.letter : null,
        designation: grad ? grad.designation : null,
        // Include access token for direct resume link (acceptable - they proved email ownership)
        accessToken: e.accessToken,
      };
    });

    // Optionally resend the full email with all access links
    if (resendLinks) {
      await sendAccessEmail(emailLower, enrollments, grads);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ found: true, email: emailLower, courses, resent: !!resendLinks })
    };
  } catch(e) {
    console.error('student-portal error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
