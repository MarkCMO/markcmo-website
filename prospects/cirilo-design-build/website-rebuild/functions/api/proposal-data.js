// GET /api/proposal-data?c=slug - public read of a single proposal by its
// (secret) slug, so a prospect can view their proposal at /proposal?c=slug.
// Returns ok:false when not found or Supabase unset (page falls back to demo).
import { sbSelect, sbUpdate, json } from './_lib.js';
import { isSlug } from './_lib_security.js';

export async function onRequestGet(context) {
  var env = context.env;
  var url = new URL(context.request.url);
  var slug = url.searchParams.get('c');
  if (!slug || !isSlug(slug)) return json({ ok: false, error: 'no slug' }, 400);
  try {
    var rows = await sbSelect(env, 'cdb_proposals?select=*&slug=eq.' + encodeURIComponent(slug) + '&limit=1');
    var p = rows && rows[0];
    if (!p) return json({ ok: false, error: 'not_found' }, 200);
    // Mark first view (sent -> viewed) so the admin sees engagement.
    if (p.status === 'sent') {
      try { await sbUpdate(env, 'cdb_proposals', 'slug=eq.' + encodeURIComponent(slug), { status: 'viewed', viewed_at: new Date().toISOString() }); p.status = 'viewed'; } catch (e) {}
    }
    return json({
      ok: true, proposal: {
        slug: p.slug, client_name: p.client_name || '', client_email: p.client_email || '',
        neighborhood: p.neighborhood || '', title: p.title || '', project_type: p.project_type || '',
        pool_type: p.pool_type || '', contract_value: +p.contract_value || 0, vision: p.vision || '',
        inclusions: p.inclusions || [], draws: p.draws || [], status: p.status || 'sent'
      }
    }, 200);
  } catch (e) { return json({ ok: false, error: 'unavailable' }, 200); }
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}
