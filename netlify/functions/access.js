// netlify/functions/access.js
// Validates a one-time or tracked access token and redirects to the target resource
// URL: /access?token=abc123

exports.handler = async (event) => {
  const token = event.queryStringParameters?.token;

  if (!token) {
    return errorPage("No access token provided.", "Missing Token");
  }

  const { JSONBIN_API_KEY, JSONBIN_LINKS_BIN_ID } = process.env;

  if (!JSONBIN_API_KEY || !JSONBIN_LINKS_BIN_ID) {
    return errorPage("Server configuration error. Please contact mark@markcmo.com.", "Configuration Error");
  }

  try {
    // Load link store
    const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_LINKS_BIN_ID}/latest`, {
      headers: { "X-Master-Key": JSONBIN_API_KEY }
    });
    const data = await res.json();
    const links = data.record?.links || [];

    // Find matching token
    const linkIdx = links.findIndex(l => l.token === token);

    if (linkIdx === -1) {
      return errorPage("This link is invalid or has been removed.", "Invalid Link");
    }

    const link = links[linkIdx];

    // Check expiry
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return errorPage("This link has expired. Please request a new one from Mark.", "Link Expired");
    }

    // Check single-use
    if (link.singleUse && link.usedAt) {
      return errorPage("This link has already been used. Please request a new link.", "Link Already Used");
    }

    // Record click
    const ip = event.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
    const userAgent = event.headers["user-agent"] || "";
    const now = new Date().toISOString();

    links[linkIdx] = {
      ...link,
      usedAt: link.usedAt || now,
      lastClickedAt: now,
      clicks: (link.clicks || 0) + 1,
      clickLog: [
        ...(link.clickLog || []),
        { at: now, ip, userAgent: userAgent.slice(0, 120) }
      ].slice(-20) // keep last 20 clicks
    };

    // Save updated record
    await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_LINKS_BIN_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Master-Key": JSONBIN_API_KEY },
      body: JSON.stringify({ links })
    });

    // Redirect to target
    return {
      statusCode: 302,
      headers: { Location: link.targetUrl }
    };

  } catch (err) {
    console.error("Access function error:", err);
    return errorPage("Something went wrong. Please contact mark@markcmo.com.", "Error");
  }
};

function errorPage(message, title) {
  return {
    statusCode: 403,
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
  .box { max-width:420px; width:100%; text-align:center; }
  .logo { font-family:'Bebas Neue',sans-serif; font-size:28px; letter-spacing:3px; margin-bottom:32px; }
  .logo span { color:#C9A84C; }
  .icon { font-size:48px; margin-bottom:16px; }
  h1 { font-family:'Bebas Neue',sans-serif; font-size:32px; letter-spacing:2px; color:#fff; margin:0 0 12px; }
  p { font-size:15px; color:#888; line-height:1.6; margin:0 0 24px; }
  a { display:inline-block; background:#C9A84C; color:#0a0a0a; font-weight:700; font-size:12px; letter-spacing:2px; text-transform:uppercase; padding:12px 24px; text-decoration:none; }
</style>
</head>
<body>
<div class="box">
  <div class="logo">MARK<span>CMO</span></div>
  <div class="icon">🔒</div>
  <h1>${title}</h1>
  <p>${message}</p>
  <a href="https://markcmo.com">BACK TO MARKCMO.COM</a>
</div>
</body>
</html>`
  };
}
