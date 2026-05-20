// functions/blog/[[path]].js
// Handles all /blog/* requests.
//
// Browser navigation (no ?action= param):
//   /blog          → serve blog.html from KV
//   /blog/:slug    → serve blog-post.html template from KV
//                    (template reads slug from window.location.pathname)
//
// API calls (?action=list or ?action=single):
//   /blog?action=list              → public-blog API (JSON)
//   /blog?action=single&slug=...   → public-blog API (JSON)
//
import { dispatchSingle } from '../_lib/netlify-shim.js';
import * as mod from '../../netlify/functions/public-blog.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // API request — has ?action= query param → dispatch to public-blog function
  if (url.searchParams.has('action')) {
    return dispatchSingle(mod, context);
  }

  // Browser navigation — serve HTML from KV
  const kv = env.BLOBS_MARKCMO_PAGES_HTML;
  if (!kv) {
    return new Response('KV not configured', { status: 503 });
  }

  let p = url.pathname;
  if (p.startsWith('/')) p = p.slice(1);   // "blog" or "blog/some-slug"
  if (p.endsWith('/'))   p = p.slice(0, -1);

  // Try exact KV key (e.g. "blog" → blog.html)
  let html = await kv.get(p, { type: 'text' });

  // /blog/:slug — not a pre-generated key; fall back to blog-post template
  // Template reads slug from window.location.pathname
  if (html === null && p.startsWith('blog/') && p.length > 5) {
    html = await kv.get('blog-post', { type: 'text' });
  }

  if (html !== null) {
    return new Response(html, {
      status: 200,
      headers: {
        'content-type':  'text/html; charset=utf-8',
        'cache-control': 'public, max-age=3600',
      },
    });
  }

  // 404
  const notFound = await kv.get('404', { type: 'text' });
  return new Response(notFound || '<h1>404 Not Found</h1>', {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
