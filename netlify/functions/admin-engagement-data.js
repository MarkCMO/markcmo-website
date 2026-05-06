// ═══════════════════════════════════════════════════════════════
// admin-engagement-data.js
// Auth-protected reader for MarkCMO engagement data (mc_* tables in
// the CLIPOS Supabase project). Powers /admin/vdr/.
//
// Endpoints (all require valid mcadmin_session cookie):
//   GET ?type=clients              — list of mc_clients with engagement summary
//   GET ?type=case&slug={slug}     — full case file: client + engagements + docs + audit
//   GET ?type=signed-url&path={p}  — short-lived signed URL for a Storage object
//   GET ?type=audit&engagementId   — last 50 audit events for an engagement
// ═══════════════════════════════════════════════════════════════

const COOKIE_NAME = 'mcadmin_session';
const STORAGE_BUCKET = 'markcmo-engagement-docs';

const ALLOWED_ORIGINS = ['https://markcmo.com', 'http://localhost:8888'];

function corsHeaders(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// ─── Auth: verify the mcadmin_session cookie ────────────────────
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

function parseCookies(h) {
  const out = {};
  (h || '').split(';').forEach(p => {
    const [k, ...v] = p.trim().split('=');
    if (k) out[k.trim()] = decodeURIComponent(v.join('='));
  });
  return out;
}

async function isAuthed(event) {
  const cookies = parseCookies(event.headers?.cookie || event.headers?.Cookie || '');
  const token = cookies[COOKIE_NAME];
  if (!token) return false;
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.TOKEN_SECRET || 'fallback';
  const payload = await verifyToken(token, secret);
  return !!payload;
}

// ─── Supabase REST helpers ──────────────────────────────────────
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

async function sbStorageSignedUrl(path, expiresIn = 60 * 10) {
  const { url, key } = sb();
  const res = await fetch(`${url}/storage/v1/object/sign/${STORAGE_BUCKET}/${path}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) throw new Error(`Supabase signed URL ${path} failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const tail = data.signedURL || data.signedUrl;
  return `${url}/storage/v1${tail}`;
}

// ─── Handler ────────────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  // Gate every endpoint on admin session
  if (!(await isAuthed(event))) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const q = event.queryStringParameters || {};
  const type = q.type || 'clients';

  try {
    if (!process.env.MARKCMO_SUPABASE_URL || !process.env.MARKCMO_SUPABASE_SERVICE_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase env vars not set' }) };
    }

    // ─── /clients: list all clients with engagement+doc counts ──
    if (type === 'clients') {
      const clients = await sbSelect(
        'mc_clients?select=id,slug,legal_name,dba,primary_contact_name,primary_contact_email,country,region,status,created_at,updated_at,mc_engagements(id,name,fee_usd,delivery_window_hrs,status,proposed_at,accepted_at,paid_at,delivered_at,mc_documents(id,doc_id,doc_type,status))&order=updated_at.desc'
      );
      // Compact summary
      const summary = clients.map(c => ({
        id: c.id,
        slug: c.slug,
        legal_name: c.legal_name,
        dba: c.dba,
        primary_contact_name: c.primary_contact_name,
        primary_contact_email: c.primary_contact_email,
        country: c.country,
        region: c.region,
        status: c.status,
        engagements_count: (c.mc_engagements || []).length,
        engagement_total_usd: (c.mc_engagements || []).reduce((s, e) => s + Number(e.fee_usd || 0), 0),
        documents_count: (c.mc_engagements || []).reduce((s, e) => s + (e.mc_documents?.length || 0), 0),
        latest_engagement_status: c.mc_engagements?.[0]?.status || null,
        updated_at: c.updated_at,
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ clients: summary }) };
    }

    // ─── /case: full case file for one client ───────────────────
    if (type === 'case') {
      const slug = q.slug;
      if (!slug) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing slug' }) };

      const clients = await sbSelect(
        `mc_clients?slug=eq.${encodeURIComponent(slug)}&select=*,mc_engagements(*,mc_documents(*),mc_invoices(*))`
      );
      if (!clients.length) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: `Client ${slug} not found` }) };
      }
      const client = clients[0];
      const engagementIds = (client.mc_engagements || []).map(e => `id.eq.${e.id}`).join(',');
      const auditFilter = engagementIds ? `engagement_id=in.(${(client.mc_engagements || []).map(e => e.id).join(',')})` : null;
      const audit = auditFilter
        ? await sbSelect(`mc_audit_log?${auditFilter}&order=created_at.desc&limit=100`)
        : [];

      return { statusCode: 200, headers, body: JSON.stringify({ client, audit }) };
    }

    // ─── /signed-url: short-lived signed URL for a stored doc ───
    if (type === 'signed-url') {
      const path = q.path;
      if (!path) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing path' }) };
      // Safety: only allow paths under engagements/
      if (!path.startsWith('engagements/')) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid path prefix' }) };
      }
      const url = await sbStorageSignedUrl(path, 60 * 15); // 15-minute window
      return { statusCode: 200, headers, body: JSON.stringify({ url, expires_in: 900 }) };
    }

    // ─── /audit: events for one engagement ──────────────────────
    if (type === 'audit') {
      const engagementId = q.engagementId;
      if (!engagementId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing engagementId' }) };
      const audit = await sbSelect(
        `mc_audit_log?engagement_id=eq.${encodeURIComponent(engagementId)}&order=created_at.desc&limit=100`
      );
      return { statusCode: 200, headers, body: JSON.stringify({ audit }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown type: ${type}` }) };
  } catch (err) {
    console.error('admin-engagement-data error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || 'Internal error' }) };
  }
};
