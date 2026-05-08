// ═══════════════════════════════════════════════════════════════
// public-blog.js
// Public, NO-auth read endpoint for published mc_blog_posts.
// Used by markcmo.com/blog and individual blog post pages.
//
// Endpoints:
//   GET ?action=list                    → published posts only (newest first)
//   GET ?action=single&slug={slug}      → one published post by slug
//                                          (also bumps view_count)
//
// Returns ONLY status='published' posts. Drafts/scheduled/archived
// are filtered out server-side regardless of what the client asks for.
// ═══════════════════════════════════════════════════════════════

const ALLOWED_ORIGINS = ['https://markcmo.com', 'https://academy.markcmo.com'];

function corsHeaders(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowed,
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600',
  };
}

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

exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'method not allowed' }) };

  const q = event.queryStringParameters || {};
  const action = q.action || 'list';

  try {
    if (action === 'list') {
      // Published only, newest first. Limit defaults to 50.
      const limit = Math.min(Number(q.limit || 50), 100);
      const rows = await sbRequest(
        'GET',
        `mc_blog_posts?status=eq.published&select=id,slug,title,subtitle,excerpt,hero_image_url,hero_image_alt,category,tags,author_name,read_time_min,published_at,view_count&order=published_at.desc.nullslast&limit=${limit}`
      );
      return { statusCode: 200, headers, body: JSON.stringify({ posts: rows }) };
    }

    if (action === 'single') {
      if (!q.slug) return { statusCode: 400, headers, body: JSON.stringify({ error: 'slug required' }) };
      const rows = await sbRequest(
        'GET',
        `mc_blog_posts?slug=eq.${encodeURIComponent(q.slug)}&status=eq.published&select=*`
      );
      if (!rows.length) return { statusCode: 404, headers, body: JSON.stringify({ error: 'not found' }) };
      const post = rows[0];

      // Bump view count (best-effort, don't block the response)
      try {
        await sbRequest(
          'PATCH',
          `mc_blog_posts?id=eq.${encodeURIComponent(post.id)}`,
          { view_count: (post.view_count || 0) + 1 }
        );
      } catch (e) { console.warn('view_count bump failed:', e.message); }

      return { statusCode: 200, headers, body: JSON.stringify({ post }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: `unknown action: ${action}` }) };
  } catch (err) {
    console.error('public-blog error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || 'server error' }) };
  }
};
