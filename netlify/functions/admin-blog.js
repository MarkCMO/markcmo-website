// ═══════════════════════════════════════════════════════════════
// admin-blog.js
// Auth-protected CRUD for mc_blog_posts (the Insights blog).
//
// All endpoints require a valid mcadmin_session cookie OR
// x-admin-api-token header for server-to-server calls.
//
// Endpoints:
//   GET  ?action=list                    → all posts (newest first)
//   GET  ?action=single&id={id}          → one post by id
//   GET  ?action=single&slug={slug}      → one post by slug
//   POST { action: 'create', data: {...} }       → new post (status defaults to draft)
//   POST { action: 'update', id, data: {...} }   → patch existing post
//   POST { action: 'publish', id }                → set status=published, published_at=now()
//   POST { action: 'unpublish', id }              → set status=draft, clear published_at
//   POST { action: 'schedule', id, scheduled_at } → status=scheduled, scheduled_at set
//   POST { action: 'archive', id }                → status=archived
//   POST { action: 'delete', id }                 → hard delete
// ═══════════════════════════════════════════════════════════════

const COOKIE_NAME = 'mcadmin_session';
const ALLOWED_ORIGINS = ['https://markcmo.com', 'http://localhost:8888'];

function corsHeaders(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-api-token',
  };
}

// ─── Auth ─────────────────────────────────────────────────────────
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
  const cookieToken = cookies[COOKIE_NAME];
  if (cookieToken) {
    const secret = process.env.ADMIN_SESSION_SECRET || process.env.TOKEN_SECRET || 'fallback';
    if (await verifyToken(cookieToken, secret)) return true;
  }
  const headerToken = event.headers?.['x-admin-api-token'] || event.headers?.['X-Admin-Api-Token'];
  if (headerToken && process.env.MARKCMO_ADMIN_API_TOKEN && headerToken === process.env.MARKCMO_ADMIN_API_TOKEN) {
    return true;
  }
  return false;
}

// ─── Supabase REST helpers ───────────────────────────────────────
function sbConfig() {
  const url = process.env.MARKCMO_SUPABASE_URL;
  const key = process.env.MARKCMO_SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('MARKCMO_SUPABASE_URL or MARKCMO_SUPABASE_SERVICE_KEY not set');
  return { url, key };
}

async function sbRequest(method, path, body, prefer) {
  const { url, key } = sbConfig();
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${path} failed: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const sbSelect = (path)             => sbRequest('GET', path);
const sbInsert = (path, row)        => sbRequest('POST', path, row, 'return=representation');
const sbUpdate = (path, patch)      => sbRequest('PATCH', path, patch, 'return=representation');
const sbDelete = (path)             => sbRequest('DELETE', path);

// ─── Helpers ─────────────────────────────────────────────────────
function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || `post-${Date.now()}`;
}

function readTimeFromHtml(html) {
  if (!html) return 1;
  const text = String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

const ALLOWED_FIELDS = [
  'slug','title','subtitle','excerpt','content_html','content_md','hero_image_url','hero_image_alt',
  'category','tags','author_name','author_role','meta_title','meta_description','read_time_min',
  'status','scheduled_at','published_at',
];

function sanitize(input) {
  const out = {};
  for (const k of ALLOWED_FIELDS) {
    if (k in (input || {})) out[k] = input[k];
  }
  if (out.tags && typeof out.tags === 'string') {
    out.tags = out.tags.split(',').map(t => t.trim()).filter(Boolean);
  }
  if (out.tags && !Array.isArray(out.tags)) out.tags = [];
  return out;
}

// ─── Handler ─────────────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  if (!(await isAuthed(event))) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'auth required' }) };
  }

  try {
    if (event.httpMethod === 'GET') {
      const q = event.queryStringParameters || {};
      const action = q.action || 'list';

      if (action === 'list') {
        const rows = await sbSelect('mc_blog_posts?select=id,slug,title,subtitle,excerpt,hero_image_url,category,tags,status,scheduled_at,published_at,view_count,read_time_min,created_at,updated_at&order=created_at.desc');
        return { statusCode: 200, headers, body: JSON.stringify({ posts: rows }) };
      }

      if (action === 'single') {
        let path;
        if (q.id)        path = `mc_blog_posts?id=eq.${encodeURIComponent(q.id)}&select=*`;
        else if (q.slug) path = `mc_blog_posts?slug=eq.${encodeURIComponent(q.slug)}&select=*`;
        else return { statusCode: 400, headers, body: JSON.stringify({ error: 'id or slug required' }) };
        const rows = await sbSelect(path);
        if (!rows.length) return { statusCode: 404, headers, body: JSON.stringify({ error: 'not found' }) };
        return { statusCode: 200, headers, body: JSON.stringify({ post: rows[0] }) };
      }

      return { statusCode: 400, headers, body: JSON.stringify({ error: `unknown action: ${action}` }) };
    }

    if (event.httpMethod === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); }
      catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

      const action = body.action;

      // ── create ──
      if (action === 'create') {
        const data = sanitize(body.data || {});
        if (!data.title) return { statusCode: 400, headers, body: JSON.stringify({ error: 'title required' }) };
        if (!data.slug) data.slug = slugify(data.title);
        if (!data.content_html) data.content_html = '';
        if (!data.read_time_min) data.read_time_min = readTimeFromHtml(data.content_html);
        if (!data.status) data.status = 'draft';
        const inserted = await sbInsert('mc_blog_posts', [data]);
        return { statusCode: 200, headers, body: JSON.stringify({ post: inserted[0] }) };
      }

      // ── update ──
      if (action === 'update') {
        if (!body.id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };
        const patch = sanitize(body.data || {});
        if (patch.content_html && !body.data.read_time_min) {
          patch.read_time_min = readTimeFromHtml(patch.content_html);
        }
        const updated = await sbUpdate(`mc_blog_posts?id=eq.${encodeURIComponent(body.id)}`, patch);
        if (!updated.length) return { statusCode: 404, headers, body: JSON.stringify({ error: 'not found' }) };
        return { statusCode: 200, headers, body: JSON.stringify({ post: updated[0] }) };
      }

      // ── publish ──
      if (action === 'publish') {
        if (!body.id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };
        const updated = await sbUpdate(`mc_blog_posts?id=eq.${encodeURIComponent(body.id)}`, {
          status: 'published',
          published_at: new Date().toISOString(),
          scheduled_at: null,
        });
        if (!updated.length) return { statusCode: 404, headers, body: JSON.stringify({ error: 'not found' }) };
        return { statusCode: 200, headers, body: JSON.stringify({ post: updated[0] }) };
      }

      // ── unpublish (back to draft) ──
      if (action === 'unpublish') {
        if (!body.id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };
        const updated = await sbUpdate(`mc_blog_posts?id=eq.${encodeURIComponent(body.id)}`, {
          status: 'draft',
          published_at: null,
        });
        return { statusCode: 200, headers, body: JSON.stringify({ post: updated[0] }) };
      }

      // ── schedule ──
      if (action === 'schedule') {
        if (!body.id || !body.scheduled_at) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'id and scheduled_at required' }) };
        }
        const updated = await sbUpdate(`mc_blog_posts?id=eq.${encodeURIComponent(body.id)}`, {
          status: 'scheduled',
          scheduled_at: body.scheduled_at,
          published_at: null,
        });
        return { statusCode: 200, headers, body: JSON.stringify({ post: updated[0] }) };
      }

      // ── archive ──
      if (action === 'archive') {
        if (!body.id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };
        const updated = await sbUpdate(`mc_blog_posts?id=eq.${encodeURIComponent(body.id)}`, { status: 'archived' });
        return { statusCode: 200, headers, body: JSON.stringify({ post: updated[0] }) };
      }

      // ── delete ──
      if (action === 'delete') {
        if (!body.id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };
        await sbDelete(`mc_blog_posts?id=eq.${encodeURIComponent(body.id)}`);
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
      }

      return { statusCode: 400, headers, body: JSON.stringify({ error: `unknown action: ${action}` }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'method not allowed' }) };
  } catch (err) {
    console.error('admin-blog error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || 'server error' }) };
  }
};
