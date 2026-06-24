// functions/_lib/funnel-db.js
// Thin Supabase REST + response helpers shared by the funnel API functions.
// Mirrors the inline helpers used in functions/api/lead.js so behaviour and
// env var names stay identical across the codebase.

export function sbHeaders(env) {
  const key = env.MARKCMO_SUPABASE_SERVICE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

export async function sbInsert(env, table, body) {
  const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...sbHeaders(env), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`sbInsert ${table} ${res.status}: ${(await res.text()).slice(0, 240)}`);
  return res.json();
}

export async function sbPatch(env, table, filter, body) {
  const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(env), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`sbPatch ${table} ${res.status}: ${(await res.text()).slice(0, 240)}`);
  return res.json();
}

export async function sbSelect(env, table, query) {
  const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'GET',
    headers: sbHeaders(env),
  });
  if (!res.ok) throw new Error(`sbSelect ${table} ${res.status}: ${(await res.text()).slice(0, 240)}`);
  return res.json();
}

export async function logEvent(env, prospectId, eventType, payload, actor = 'system') {
  try {
    await sbInsert(env, 'mcf_events', { prospect_id: prospectId || null, actor, event_type: eventType, payload: payload || {} });
  } catch (_) {
    // never block the request on the audit write
  }
}

export async function safeAudit(env, event, payload) {
  try {
    await sbInsert(env, 'mc_audit_log', { event, payload });
  } catch (_) {}
}

export async function parseBody(request) {
  const ct = (request.headers.get('content-type') || '').toLowerCase();
  try {
    if (ct.includes('application/json')) return await request.json();
    if (ct.includes('x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
      const fd = await request.formData();
      const out = {};
      for (const [k, v] of fd.entries()) out[k] = typeof v === 'string' ? v : v.name || '';
      return out;
    }
    const text = await request.text();
    if (!text) return {};
    try { return JSON.parse(text); }
    catch (_) {
      const out = {};
      for (const [k, v] of new URLSearchParams(text).entries()) out[k] = v;
      return out;
    }
  } catch (_) {
    return null;
  }
}

export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  });
}

export function cors() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export function clientMeta(request) {
  return {
    ip: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '',
    user_agent: request.headers.get('user-agent') || '',
    referer: request.headers.get('referer') || '',
  };
}

// URL-safe token for the resume link (crypto-strong, no deps).
export function makeToken(len = 24) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

export function validEmail(e) {
  return typeof e === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
}
