// Shared OAuth plumbing for the markcmo.com connect/callback endpoints (ESM).
// CSRF: a random `state` is stored in a short-lived httpOnly cookie and echoed
// in the OAuth redirect; the callback rejects any mismatch.

export function baseUrl(env, request) {
  if (env.PUBLIC_BASE_URL) return env.PUBLIC_BASE_URL.replace(/\/$/, "");
  try { return new URL(request.url).origin; } catch { return "https://markcmo.com"; }
}

export function redirectUri(env, request, platform) {
  return `${baseUrl(env, request)}/auth/${platform}/callback`;
}

export function makeState() {
  return crypto.randomUUID().replace(/-/g, "");
}

export function stateCookie(name, state) {
  return `${name}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`;
}

export function clearStateCookie(name) {
  return `${name}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return "";
}

export function redirect(location, extraHeaders = {}) {
  return new Response(null, { status: 302, headers: { Location: location, ...extraHeaders } });
}

export function resultPage({ ok, platform, detail }) {
  const title = ok ? `${platform} connected` : `${platform} connection failed`;
  const color = ok ? "#16a34a" : "#dc2626";
  const body = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;background:#0A0F2C;color:#FAFAF8;font-family:'Outfit',system-ui,sans-serif;
display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center}
.card{max-width:460px;padding:44px 34px;background:#0D1235;border:1px solid #20264a;border-radius:18px}
.dot{width:56px;height:56px;border-radius:50%;background:${color};margin:0 auto 18px;display:flex;
align-items:center;justify-content:center;font-size:30px;color:#fff}h1{font-size:1.45rem;margin:0 0 8px}
p{color:#B7BCCB;line-height:1.6;margin:0 0 22px}a{display:inline-block;background:#C9A84C;color:#0A0F2C;
font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px}</style></head>
<body><div class="card"><div class="dot">${ok ? "&#10003;" : "&#33;"}</div>
<h1>${title}</h1><p>${detail || ""}</p>
<a href="https://markchat.pages.dev/connections">Back to channels</a></div></body></html>`;
  return new Response(body, { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
