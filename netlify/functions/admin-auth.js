// netlify/functions/admin-auth.js
// POST { user, pass } → validates against env vars, returns signed session cookie
// GET  ?action=verify → checks if current cookie is valid
// POST { action: 'logout' } → clears cookie

const COOKIE_NAME = 'mcadmin_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days (reduces frequent re-login interrupts during long admin sessions)

const ALLOWED_ORIGINS = ['https://markcmo.com', 'https://academy.markcmo.com'];

function getCorsHeaders(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
  };
}

// ── HMAC-SHA256 token sign/verify ─────────────────────────────────────────────
async function signToken(payload, secret) {
  const data = JSON.stringify(payload);
  const dataB64 = btoa(data).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(dataB64));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  return `${dataB64}.${sigB64}`;
}

async function verifyToken(token, secret) {
  try {
    const [dataB64, sigB64] = token.split('.');
    if (!dataB64 || !sigB64) return null;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sig = Uint8Array.from(atob(sigB64.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(dataB64));
    if (!valid) return null;
    const payload = JSON.parse(atob(dataB64.replace(/-/g,'+').replace(/_/g,'/')));
    // Check expiry
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader) {
  const cookies = {};
  (cookieHeader || '').split(';').forEach(pair => {
    const [k, ...v] = pair.trim().split('=');
    if (k) cookies[k.trim()] = decodeURIComponent(v.join('='));
  });
  return cookies;
}

exports.handler = async (event) => {
  const headers = getCorsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: getCorsHeaders(event), body: '' };

  const secret  = process.env.ADMIN_SESSION_SECRET || process.env.TOKEN_SECRET || 'fallback';

  // Multi-user support:
  //   ADMIN_USERS = JSON array, e.g. [{"user":"mark","pass":"..."},{"user":"austinsepulveda","pass":"..."}]
  // Backward-compat: single ADMIN_USER + ADMIN_PASS still works and is appended to the list.
  let users = [];
  try {
    if (process.env.ADMIN_USERS) {
      const parsed = JSON.parse(process.env.ADMIN_USERS);
      if (Array.isArray(parsed)) {
        users = parsed
          .filter(u => u && u.user && u.pass)
          .map(u => ({ user: String(u.user).toLowerCase().trim(), pass: String(u.pass) }));
      }
    }
  } catch { /* fall through to legacy */ }
  if (process.env.ADMIN_USER && process.env.ADMIN_PASS) {
    const legacy = { user: process.env.ADMIN_USER.toLowerCase().trim(), pass: process.env.ADMIN_PASS };
    if (!users.find(u => u.user === legacy.user)) users.push(legacy);
  }

  // ── GET: verify existing session ─────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    const cookies = parseCookies(event.headers.cookie || event.headers.Cookie || '');
    const token = cookies[COOKIE_NAME];
    if (!token) return { statusCode: 401, headers, body: JSON.stringify({ ok: false }) };
    const payload = await verifyToken(token, secret);
    if (!payload) return { statusCode: 401, headers, body: JSON.stringify({ ok: false }) };
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers, body: '{}' }; }

  // Logout
  if (body.action === 'logout') {
    return {
      statusCode: 200,
      headers: {
        ...getCorsHeaders(event),
        'Set-Cookie': `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`
      },
      body: JSON.stringify({ ok: true })
    };
  }

  // Login
  const { user, pass } = body;
  if (!user || !pass) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing credentials' }) };

  if (!users.length) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'Auth not configured' }) };
  }

  const submittedUser = user.trim().toLowerCase();
  const match = users.find(u => u.user === submittedUser && u.pass === pass);

  if (!match) {
    // Small delay to slow brute force
    await new Promise(r => setTimeout(r, 800));
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid credentials' }) };
  }

  // Issue signed session token
  const token = await signToken(
    { sub: match.user, iat: Date.now(), exp: Date.now() + COOKIE_MAX_AGE * 1000 },
    secret
  );

  return {
    statusCode: 200,
    headers: {
      ...headers,
      'Set-Cookie': `${COOKIE_NAME}=${token}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Strict`
    },
    body: JSON.stringify({ ok: true })
  };
};
