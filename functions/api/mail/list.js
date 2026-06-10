// /api/mail/list?folder=inbox|sent&limit=50
// ─────────────────────────────────────────────────────────────────
// Returns recent messages from mc_mailbox_messages, filtered by
// direction. Used by the /mail webmail UI to render the inbox/sent
// lists.

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') {
    return jsonResponse(405, { error: 'method_not_allowed' });
  }
  if (!(await checkAuth(request, env))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Basic realm="MarkCMO Mail"' },
    });
  }

  const url = new URL(request.url);
  const folder = (url.searchParams.get('folder') || 'inbox').toLowerCase();
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200);
  const direction = folder === 'sent' ? 'outbound' : 'inbound';

  try {
    const rows = await sbSelect(env,
      `mc_mailbox_messages?direction=eq.${direction}&order=created_at.desc&limit=${limit}&select=id,created_at,from_addr,from_name,to_addrs,subject,body_preview,read_at,starred,resend_status`);
    return jsonResponse(200, { folder, items: rows || [] });
  } catch (e) {
    return jsonResponse(500, { error: (e && e.message) || String(e) });
  }
}

async function checkAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.toLowerCase().startsWith('basic ')) return false;
  let decoded;
  try { decoded = atob(auth.slice(6).trim()); } catch (_) { return false; }
  const idx = decoded.indexOf(':');
  if (idx < 0) return false;
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  const expectedUser = env.MAIL_ADMIN_USER || 'mark@markcmo.com';
  const expectedPass = env.MAIL_ADMIN_PASSWORD || env.ADMIN_PASSWORD || '';
  if (!expectedPass) return false;
  if (user !== expectedUser) return false;
  if (pass.length !== expectedPass.length) return false;
  let diff = 0;
  for (let i = 0; i < pass.length; i++) diff |= pass.charCodeAt(i) ^ expectedPass.charCodeAt(i);
  return diff === 0;
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function sbHeaders(env) {
  const key = env.MARKCMO_SUPABASE_SERVICE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}` };
}

async function sbSelect(env, path) {
  const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders(env) });
  if (!res.ok) throw new Error(`sbSelect ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
