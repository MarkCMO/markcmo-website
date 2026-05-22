// AUTO-GENERATED catch-all: serves HTML pages from KV
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  let p = url.pathname;
  if (p.startsWith('/')) p = p.slice(1);
  if (p.endsWith('/')) p = p.slice(0, -1);
  if (p.endsWith('.html')) p = p.slice(0, -5);
  if (!p) p = 'index';
  const kv = env.BLOBS_MARKCMO_PAGES_HTML;
  if (!kv) return new Response('Service unavailable', { status: 503 });
  let html = await kv.get(p, { type: 'text' });
  if (html === null) html = await kv.get(p + '.html', { type: 'text' });
  if (html !== null) {
    return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
  }
  const notFound = await kv.get('404', { type: 'text' });
  return new Response(notFound || '<h1>404 Not Found</h1>', { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
