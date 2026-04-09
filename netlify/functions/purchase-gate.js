// netlify/functions/purchase-gate.js
//
// Square redirects every buyer here after payment.
// This function auto-generates a unique single-use token per buyer
// and immediately redirects them to their protected delivery page.
//
// Square redirect URLs to set (one per product):
//   https://markcmo.com/.netlify/functions/purchase-gate?product=audit
//   https://markcmo.com/.netlify/functions/purchase-gate?product=kit
//   https://markcmo.com/.netlify/functions/purchase-gate?product=vip
//   https://markcmo.com/.netlify/functions/purchase-gate?product=playbook

const crypto = require("crypto");

// ── PRODUCT CONFIG ────────────────────────────────────────────────────────────
// targetUrl: where the buyer lands after token validation
// label: shown in admin Access Links tab
// expiryDays: how long the token is valid (null = never)
// singleUse: true = link dies after first click

const PRODUCTS = {
  // ── COURSE PRODUCTS ────────────────────────────────────────────────────────
  founding_course: {
    label: "Founding Class - Single Course ($48)",
    targetUrl: "https://academy.markcmo.com/welcome?ref=purchase&tier=founding",
    expiryDays: null,   // never expires - they own it
    singleUse: true,
    price: 48,
    type: 'course',
    tier: 'founding'
  },
  course: {
    label: "Single Course ($248)",
    targetUrl: "https://academy.markcmo.com/welcome?ref=purchase&tier=regular",
    expiryDays: null,
    singleUse: true,
    price: 248,
    type: 'course',
    tier: 'regular'
  },

  retake: {
    label: "Exam Retake ($28)",
    targetUrl: "https://academy.markcmo.com/exam?ref=retake",
    expiryDays: 7,      // must use retake within 7 days
    singleUse: true,
    price: 28,
    type: 'retake',
    tier: 'standard'
  },

  // ── MAIN SITE PRODUCTS (kept for markcmo.com) ─────────────────────────────
  audit: {
    label: "CMO Audit & Sprint - Purchase",
    targetUrl: "https://markcmo.com/book.html?ref=purchase-audit",
    expiryDays: 30,
    singleUse: false
  },
  kit: {
    label: "CMO Accelerator Kit - Purchase",
    targetUrl: "https://markcmo.com/webinar-playbook-delivery.html?ref=purchase-kit",
    expiryDays: 365,
    singleUse: false
  },
  vip: {
    label: "VIP Strategy Day - Purchase",
    targetUrl: "https://markcmo.com/book.html?ref=purchase-vip",
    expiryDays: 60,
    singleUse: false
  },
  playbook: {
    label: "Revenue Leak Playbook - Purchase",
    targetUrl: "https://markcmo.com/webinar-playbook-delivery.html?ref=purchase-playbook",
    expiryDays: 365,
    singleUse: false
  }
};

exports.handler = async (event) => {
  const qs     = event.queryStringParameters || {};
  const product = qs.product;
  const courseId = (qs.course || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const config  = PRODUCTS[product];

  if (!config) {
    return errorPage("Invalid product link. Please contact mark@markcmo.com.", "Invalid Link");
  }

  // ── Build target URL with course ID ────────────────────────────────────────
  // For course products, append course ID so student lands in the right course
  let targetUrl = config.targetUrl;
  if (config.type === 'course' && courseId) {
    targetUrl = `https://academy.markcmo.com/learn?course=${courseId}&ref=purchase`;
  } else if (config.type === 'retake' && courseId) {
    targetUrl = `https://academy.markcmo.com/exam?course=${courseId}&ref=retake`;
  }

  const { JSONBIN_API_KEY, JSONBIN_ENROLLMENTS_BIN_ID } = process.env;

  // ── Log enrollment to JSONBin ───────────────────────────────────────────────
  if (JSONBIN_API_KEY && JSONBIN_ENROLLMENTS_BIN_ID && courseId) {
    try {
      const getRes = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_ENROLLMENTS_BIN_ID}/latest`, {
        headers: { "X-Master-Key": JSONBIN_API_KEY }
      });
      const getData = await getRes.json();
      const existing = getData.record || { enrollments: [] };

      const enrollment = {
        id: crypto.randomUUID(),
        courseId,
        product,
        price: config.price,
        tier: config.tier || 'standard',
        purchasedAt: new Date().toISOString(),
        ip: event.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown"
      };

      existing.enrollments.unshift(enrollment);

      await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_ENROLLMENTS_BIN_ID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Master-Key": JSONBIN_API_KEY },
        body: JSON.stringify(existing)
      });

      console.log(`purchase-gate: enrolled ${courseId} / ${product}`);
    } catch(err) {
      // Don't block redirect on storage error
      console.error("purchase-gate: enrollment log error", err);
    }
  }

  // ── Redirect to course ──────────────────────────────────────────────────────
  return {
    statusCode: 302,
    headers: { Location: targetUrl }
  };
};

function errorPage(message, title) {
  return {
    statusCode: 400,
    headers: { "Content-Type": "text/html" },
    body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title} - MarkCMO</title>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;600&display=swap" rel="stylesheet">
<style>
  body { background:#0a0a0a; color:#e8e8e0; font-family:'Barlow',sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:20px; box-sizing:border-box; }
  .box { max-width:440px; width:100%; text-align:center; }
  .logo { font-family:'Bebas Neue',sans-serif; font-size:28px; letter-spacing:3px; margin-bottom:32px; }
  .logo span { color:#C9A84C; }
  .icon { font-size:48px; margin-bottom:16px; }
  h1 { font-family:'Bebas Neue',sans-serif; font-size:32px; letter-spacing:2px; color:#fff; margin:0 0 12px; }
  p { font-size:15px; color:#888; line-height:1.6; margin:0 0 24px; }
  a { display:inline-block; background:#C9A84C; color:#0a0a0a; font-weight:700; font-size:12px; letter-spacing:2px; text-transform:uppercase; padding:12px 24px; text-decoration:none; margin-top:8px; }
</style>
</head>
<body>
<div class="box">
  <div class="logo">MARK<span>CMO</span></div>
  <div class="icon">⚠️</div>
  <h1>${title}</h1>
  <p>${message}</p>
  <a href="mailto:mark@markcmo.com">CONTACT MARK →</a>
</div>
</body>
</html>`
  };
}
