// WETYR Studio - Admin Jobs Library
// Lists all script-tool jobs (dissect / schedule / budget / callsheet) grouped
// as projects, newest first. Admin-only - requires the same mcadmin_session
// cookie as /admin and the rolodex.
//
// GET ?limit=30  ->  { ok: true, projects: [{ project_id, title, dissect, schedule, budget, callsheet, lastActivity }] }

const { listProjects } = require('./_wetyr_jobs');

const COOKIE_NAME = 'mcadmin_session';

function parseCookies(cookieHeader) {
  const cookies = {};
  (cookieHeader || '').split(';').forEach(pair => {
    const [k, ...v] = pair.trim().split('=');
    if (k) cookies[k.trim()] = decodeURIComponent(v.join('='));
  });
  return cookies;
}

async function verifyToken(token, secret) {
  try {
    const [dataB64, sigB64] = token.split('.');
    if (!dataB64 || !sigB64) return null;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sig = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(dataB64));
    if (!valid) return null;
    const payload = JSON.parse(atob(dataB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}

const ALLOWED_ORIGINS = ['https://markcmo.com', 'https://academy.markcmo.com', 'http://localhost:8888'];
function corsHeaders(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'GET only' }) };

  // Admin auth required.
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.TOKEN_SECRET || 'fallback';
  const cookies = parseCookies(event.headers.cookie || event.headers.Cookie || '');
  const token = cookies[COOKIE_NAME];
  if (!token) return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: 'admin auth required' }) };
  const payload = await verifyToken(token, secret);
  if (!payload) return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: 'invalid session' }) };

  const limit = Math.min(100, Math.max(1, parseInt(event.queryStringParameters?.limit, 10) || 30));

  try {
    const projects = await listProjects({ limit });
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, projects, user: payload.user || payload.sub || null }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: String(e.message || e) }) };
  }
};
