// course-enroll.js, Enrollment CRUD + welcome email + CRM write
// GET  ?email=&courseId=                   → check enrollment / validate token
// POST { name, email, courseId, isRetake } → new enrollment, welcome email, CRM
// PUT  { email, courseId, progress, token} → save progress

const https   = require('https');
const crypto  = require('crypto');

const ENROLL_BIN = process.env.JSONBIN_ENROLLMENTS_BIN_ID;
const LEADS_BIN  = process.env.JSONBIN_BIN_ID;
const API_KEY    = process.env.JSONBIN_API_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const NOTIFY     = process.env.NOTIFY_EMAIL || 'mark@markcmo.com';

const COURSE_META = {
  // ── TOP 5 FLAGSHIP ──────────────────────────────────────────
  cfo:         { title:'Fractional CFO Mastery',               price:1497, retake:497, tier:1 },
  cmo:         { title:'Fractional CMO Mastery',               price:1497, retake:497, tier:1 },
  ae:          { title:'Account Executive Excellence',         price:997,  retake:397, tier:1 },
  growth:      { title:'Growth Manager Mastery',               price:997,  retake:397, tier:1 },
  vpsales:     { title:'VP of Sales Mastery',                  price:1297, retake:497, tier:1 },
  // ── EXTENDED LIBRARY ────────────────────────────────────────
  coo:         { title:'Fractional COO Mastery',               price:1497, retake:497, tier:2 },
  digital:     { title:'Digital Marketing Mastery',            price:997,  retake:397, tier:2 },
  linkedin:    { title:'LinkedIn Growth Machine',              price:797,  retake:297, tier:2 },
  instagram:   { title:'Instagram for Business',               price:597,  retake:197, tier:2 },
  revenue:     { title:'Revenue Architecture & GTM',           price:1297, retake:497, tier:2 },
  category:    { title:'Category Design & Market Leadership',  price:997,  retake:397, tier:2 },
  aimarketing: { title:'AI-Powered Marketing',                 price:797,  retake:297, tier:2 },
  b2bdemand:   { title:'B2B Demand Generation',                price:897,  retake:297, tier:2 },
  leadership:  { title:'Executive Leadership for Consultants', price:697,  retake:247, tier:2 },
};

function jbReq(method, binId, data) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const req = https.request({
      hostname:'api.jsonbin.io', path:`/v3/b/${binId}`, method,
      headers:{ 'X-Master-Key':API_KEY, 'Content-Type':'application/json',
        ...(body ? {'Content-Length':Buffer.byteLength(body)} : {}) }
    }, res => {
      let d=''; res.on('data',c=>d+=c);
      res.on('end',()=>{ try{resolve(JSON.parse(d))}catch(e){reject(e)} });
    });
    req.on('error',reject);
    if(body) req.write(body);
    req.end();
  });
}

async function sendEmail(to, subject, html) {
  if (!RESEND_KEY) return;
  const res = await fetch('https://api.resend.com/emails', {
    method:'POST',
    headers:{ 'Authorization':`Bearer ${RESEND_KEY}`, 'Content-Type':'application/json' },
    body:JSON.stringify({ from:'Mark Donnigan <mark@markcmo.com>', to, subject, html })
  });
  if (!res.ok) console.error('Resend:', await res.text());
}

function welcomeEmail(name, courseTitle, accessUrl) {
  const first = (name||'').split(' ')[0] || 'there';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="background:#0a0a0a;margin:0;padding:0;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;">
  <div style="background:linear-gradient(135deg,#0d0d0d,#1a1400);padding:48px 40px;text-align:center;border-bottom:2px solid #C9A84C;">
    <div style="font-size:11px;letter-spacing:5px;text-transform:uppercase;color:#C9A84C;margin-bottom:12px;">MarkCMO Academy</div>
    <div style="font-size:48px;">🎓</div>
    <h1 style="font-size:32px;font-weight:900;color:#fff;margin:16px 0 8px;letter-spacing:2px;">YOU'RE ENROLLED</h1>
    <p style="font-size:16px;color:#C9A84C;margin:0;">${courseTitle}</p>
  </div>
  <div style="background:#111;padding:40px;">
    <p style="font-size:17px;color:#e8e8e0;line-height:1.7;margin:0 0 20px;">
      ${first}, your spot is confirmed. This is the highest-intensity course on the market for fractional executives. You earned it. Now go use it.
    </p>
    <div style="background:#0d0d0d;border:1px solid #2a2a2a;border-left:3px solid #C9A84C;padding:24px;margin:28px 0;">
      <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;margin-bottom:8px;">Your Course Access</div>
      <div style="font-size:18px;font-weight:700;color:#fff;">${courseTitle}</div>
    </div>
    <div style="text-align:center;margin:32px 0;">
      <a href="${accessUrl}" style="display:inline-block;background:#C9A84C;color:#000;font-weight:900;font-size:13px;letter-spacing:3px;text-transform:uppercase;padding:18px 40px;text-decoration:none;">
        START YOUR COURSE NOW →
      </a>
    </div>
    <p style="font-size:12px;color:#555;margin:0 0 4px;">Your personal access link (bookmark this):</p>
    <div style="background:#0d0d0d;border:1px solid #1e1e1e;padding:12px 16px;font-size:11px;color:#C9A84C;font-family:monospace;word-break:break-all;">${accessUrl}</div>
    <div style="border-top:1px solid #222;margin-top:32px;padding-top:20px;">
      <p style="font-size:13px;color:#555;margin:0;">Questions? Reply here or email <a href="mailto:mark@markcmo.com" style="color:#C9A84C;">mark@markcmo.com</a></p>
      <p style="font-size:12px;color:#444;margin:8px 0 0;">Mark Donnigan · Fractional CMO · markcmo.com</p>
    </div>
  </div>
</div></body></html>`;
}

function notifyEmail(name, email, courseTitle, isRetake) {
  return `<div style="font-family:monospace;padding:24px;background:#0a0a0a;color:#e8e8e0;">
    <h2 style="color:#C9A84C;">🎓 Course ${isRetake?'Retake':'Enrollment'}</h2>
    <table style="font-size:13px;border-collapse:collapse;">
      <tr><td style="padding:6px 16px 6px 0;color:#888;">Name</td><td style="color:#fff;">${name}</td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#888;">Email</td><td style="color:#C9A84C;">${email}</td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#888;">Course</td><td style="color:#fff;">${courseTitle}</td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#888;">Type</td><td style="color:#fff;">${isRetake?'Retake':'New Enrollment'}</td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#888;">Time</td><td style="color:#fff;">${new Date().toLocaleString('en-US',{timeZone:'America/New_York'})} ET</td></tr>
    </table></div>`;
}

exports.handler = async (event) => {
  const h = {
    'Content-Type':'application/json','Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS'
  };
  if (event.httpMethod==='OPTIONS') return {statusCode:200,headers:h,body:''};

  const qs = event.queryStringParameters || {};

  // ── GET: validate enrollment/token ─────────────────────────────────────────
  if (event.httpMethod==='GET') {
    try {
      const data = await jbReq('GET', ENROLL_BIN);
      const enrollments = (data.record||{enrollments:[]}).enrollments;

      // Admin bulk fetch
      if (qs.secret === process.env.ADMIN_SECRET) {
        return {statusCode:200,headers:h,body:JSON.stringify({enrollments})};
      }

      if (!qs.email || !qs.courseId) {
        return {statusCode:400,headers:h,body:JSON.stringify({error:'Missing email or courseId'})};
      }

      const found = enrollments.find(e=>
        e.email.toLowerCase()===qs.email.toLowerCase() && e.courseId===qs.courseId
      );

      if (found && qs.token && found.accessToken !== qs.token) {
        return {statusCode:200,headers:h,body:JSON.stringify({enrolled:false,reason:'invalid_token'})};
      }

      return {statusCode:200,headers:h,body:JSON.stringify({enrolled:!!found,enrollment:found||null})};
    } catch(e) {
      return {statusCode:200,headers:h,body:JSON.stringify({enrolled:false})};
    }
  }

  // ── POST: new enrollment ────────────────────────────────────────────────────
  if (event.httpMethod==='POST') {
    try {
      const {name, email, courseId, isRetake} = JSON.parse(event.body||'{}');
      if (!email || !courseId) return {statusCode:400,headers:h,body:JSON.stringify({error:'Missing email or courseId'})};

      const meta = COURSE_META[courseId];
      if (!meta) return {statusCode:400,headers:h,body:JSON.stringify({error:'Unknown course'})};

      // Generate unique access token
      const accessToken = crypto.randomBytes(20).toString('base64url');
      const accessUrl = `https://markcmo.com/courses/learn?course=${courseId}&email=${encodeURIComponent(email.toLowerCase())}&token=${accessToken}`;
      const now = new Date().toISOString();

      // Load + update enrollments bin
      let enrollData;
      try { const r = await jbReq('GET',ENROLL_BIN); enrollData = r.record||{enrollments:[]}; }
      catch(e) { enrollData = {enrollments:[]}; }

      const idx = enrollData.enrollments.findIndex(
        e=>e.email.toLowerCase()===email.toLowerCase() && e.courseId===courseId
      );

      let isNew = true;
      if (idx>=0) {
        isNew = false;
        // Re-issue token (retake or re-access)
        enrollData.enrollments[idx] = {
          ...enrollData.enrollments[idx],
          name: name||enrollData.enrollments[idx].name,
          accessToken, updatedAt:now,
          ...(isRetake ? {retakeAt:now, attempts:(enrollData.enrollments[idx].attempts||1)+1} : {})
        };
      } else {
        enrollData.enrollments.unshift({
          name:name||email.split('@')[0], email:email.toLowerCase(),
          courseId, courseTitle:meta.title,
          accessToken, enrolledAt:now, updatedAt:now,
          isRetake:!!isRetake, attempts:1,
          progress:{completedLessons:[],quizScores:{},moduleScores:{},finalScore:null}
        });
      }
      await jbReq('PUT', ENROLL_BIN, enrollData);

      // Write to CRM leads bin
      if (LEADS_BIN) {
        try {
          const ld = await jbReq('GET', LEADS_BIN);
          const leads = (ld.record||{leads:[]}).leads;
          const li = leads.findIndex(l=>l.email&&l.email.toLowerCase()===email.toLowerCase());
          if (li<0) {
            leads.unshift({ name:name||email.split('@')[0], email:email.toLowerCase(),
              source:`course-${courseId}`, tags:['course-buyer',courseId],
              courseTitle:meta.title, registeredAt:now, status:'customer' });
          } else {
            leads[li] = { ...leads[li],
              tags:[...new Set([...(leads[li].tags||[]),'course-buyer',courseId])], updatedAt:now };
          }
          await jbReq('PUT', LEADS_BIN, {leads});
        } catch(e) { console.warn('CRM write failed:',e.message); }
      }

      // Send emails
      try {
        await sendEmail(email, `Your ${meta.title} course is ready, MarkCMO Academy`, welcomeEmail(name||email.split('@')[0], meta.title, accessUrl));
        await sendEmail(NOTIFY, `🎓 New Course ${isRetake?'Retake':'Enrollment'}: ${name||email}, ${meta.title}`, notifyEmail(name||email, email, meta.title, isRetake));
      } catch(e) { console.warn('Email failed:',e.message); }

      return {statusCode:200,headers:h,body:JSON.stringify({ok:true, isNew, accessUrl, accessToken, courseTitle:meta.title})};
    } catch(e) {
      console.error('course-enroll POST error:',e);
      return {statusCode:500,headers:h,body:JSON.stringify({error:e.message})};
    }
  }

  // ── PUT: save progress ──────────────────────────────────────────────────────
  if (event.httpMethod==='PUT') {
    try {
      const {email, courseId, progress, token} = JSON.parse(event.body||'{}');
      if (!email || !courseId) return {statusCode:400,headers:h,body:JSON.stringify({error:'Missing email or courseId'})};

      const r = await jbReq('GET', ENROLL_BIN);
      const enrollData = r.record||{enrollments:[]};
      const idx = enrollData.enrollments.findIndex(
        e=>e.email.toLowerCase()===email.toLowerCase() && e.courseId===courseId
      );
      if (idx<0) return {statusCode:404,headers:h,body:JSON.stringify({error:'Not found'})};
      if (token && enrollData.enrollments[idx].accessToken!==token)
        return {statusCode:403,headers:h,body:JSON.stringify({error:'Invalid token'})};

      enrollData.enrollments[idx] = {
        ...enrollData.enrollments[idx],
        ...(progress?{progress}:{}),
        updatedAt:new Date().toISOString()
      };
      await jbReq('PUT', ENROLL_BIN, enrollData);
      return {statusCode:200,headers:h,body:JSON.stringify({ok:true})};
    } catch(e) {
      return {statusCode:500,headers:h,body:JSON.stringify({error:e.message})};
    }
  }

  return {statusCode:405,headers:h,body:'Method not allowed'};
};
