// ═══════════════════════════════════════════════════════════════
// _lib_supabase.js
// Shared Supabase REST + Storage helpers for the engagement pipeline.
// Uses MARKCMO_SUPABASE_URL + MARKCMO_SUPABASE_SERVICE_KEY env vars.
// ═══════════════════════════════════════════════════════════════
function sb() {
  const url = process.env.MARKCMO_SUPABASE_URL;
  const key = process.env.MARKCMO_SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('MARKCMO_SUPABASE_URL or MARKCMO_SUPABASE_SERVICE_KEY not set');
  return { url, key };
}

async function sbSelect(path) {
  const { url, key } = sb();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Supabase select ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbUpdate(table, filter, body) {
  const { url, key } = sb();
  const res = await fetch(`${url}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase update ${table} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbInsert(table, body, opts = {}) {
  const { url, key } = sb();
  const res = await fetch(`${url}/rest/v1/${table}${opts.upsert ? '?on_conflict=' + opts.upsert : ''}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: opts.upsert ? 'resolution=merge-duplicates,return=representation' : 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase insert ${table} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// ─── Auth helpers: shared verify + isAuthed for admin-gated endpoints ──
async function verifyAdminToken(token, secret) {
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

function parseCookies(h) {
  const out = {};
  (h || '').split(';').forEach(p => {
    const [k, ...v] = p.trim().split('=');
    if (k) out[k.trim()] = decodeURIComponent(v.join('='));
  });
  return out;
}

async function isAdminAuthed(event) {
  const cookies = parseCookies(event.headers?.cookie || event.headers?.Cookie || '');
  const cookieToken = cookies['mcadmin_session'];
  if (cookieToken) {
    const secret = process.env.ADMIN_SESSION_SECRET || process.env.TOKEN_SECRET || 'fallback';
    if (await verifyAdminToken(cookieToken, secret)) return true;
  }
  const headerToken = event.headers?.['x-admin-api-token'] || event.headers?.['X-Admin-Api-Token'];
  if (headerToken && process.env.MARKCMO_ADMIN_API_TOKEN && headerToken === process.env.MARKCMO_ADMIN_API_TOKEN) {
    return true;
  }
  return false;
}

const corsHeaders = (event, allowed = ['https://markcmo.com']) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-api-token',
  };
};

// ─── Build the CC recipient list for client-facing emails ──────
// Always includes Mark's Gmail (marklgabriellijr@gmail.com) so he has
// a personal copy of every customer touchpoint. Then merges in
// mc_clients.cc_emails (which the admin can edit per-client to loop in
// CFO, partner, EA, etc).
//
// Pass null/undefined client to get just Mark's Gmail.
// Pass [] for cc_emails to suppress all per-client CCs but keep Mark.
function buildClientCcList(client) {
  const out = new Set(['marklgabriellijr@gmail.com']);
  if (Array.isArray(client?.cc_emails)) {
    for (const e of client.cc_emails) {
      if (typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())) {
        out.add(e.trim().toLowerCase());
      }
    }
  }
  // Don't CC the primary recipient
  if (client?.primary_contact_email) {
    out.delete(String(client.primary_contact_email).trim().toLowerCase());
  }
  return Array.from(out);
}

module.exports = {
  sb, sbSelect, sbUpdate, sbInsert,
  verifyAdminToken, parseCookies, isAdminAuthed, corsHeaders,
  buildClientCcList,
};
