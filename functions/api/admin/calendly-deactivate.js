// /api/admin/calendly-deactivate?slug=initial-interview-discussion
// ─────────────────────────────────────────────────────────────────
// One-shot admin endpoint to deactivate a Calendly event type.
// Required: ?token=<MAIL_ADMIN_PASSWORD>&slug=<event-slug>
//
// Mark's directive 2026-06-12: disable the "Initial Interview |
// Discussion" event type after Sujith Kodagoda booked it from his
// public Calendly profile.
//
// Uses env.CALENDLY_API_TOKEN (server-side only; never returned in
// response). Calendly's PATCH endpoint can flip `active: false` to
// hide the event type from the public profile without deleting it.

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const adminToken = url.searchParams.get('token') || '';
  const slug = (url.searchParams.get('slug') || '').toLowerCase();
  const adminPass = env.MAIL_ADMIN_PASSWORD || env.ADMIN_PASSWORD || env.ADMIN_PASS || '';

  if (!adminPass || adminToken !== adminPass) {
    return jsonResponse(401, { error: 'unauthorized', hint: 'pass ?token=<admin_password>' });
  }
  if (!slug) {
    return jsonResponse(400, { error: 'missing_slug' });
  }
  const calToken = env.CALENDLY_API_TOKEN;
  if (!calToken) {
    return jsonResponse(500, { error: 'CALENDLY_API_TOKEN not configured' });
  }

  // 1. Look up Mark's user URI
  const me = await fetchCal(calToken, 'https://api.calendly.com/users/me');
  if (!me.ok) return jsonResponse(502, { error: 'users/me failed', detail: me.body });
  const userUri = me.json.resource.uri;

  // 2. List event types, find by slug match
  const list = await fetchCal(calToken, `https://api.calendly.com/event_types?user=${encodeURIComponent(userUri)}&active=true&count=100`);
  if (!list.ok) return jsonResponse(502, { error: 'list event_types failed', detail: list.body });

  const all = list.json.collection || [];
  const match = all.find(et =>
    (et.slug || '').toLowerCase() === slug ||
    (et.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '') === slug
  );
  if (!match) {
    return jsonResponse(404, {
      error: 'event_type_not_found',
      searched_slug: slug,
      available: all.map(et => ({ slug: et.slug, name: et.name, active: et.active, scheduling_url: et.scheduling_url })),
    });
  }

  // 3. Deactivate via PATCH
  // Calendly's PATCH /event_types/{uuid} with {active: false} hides the
  // event from public booking pages. Existing scheduled bookings unaffected.
  const patchRes = await fetch(`https://api.calendly.com/event_types/${match.uri.split('/').pop()}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${calToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ active: false }),
  });
  const patchBody = await patchRes.text().catch(() => '');

  return jsonResponse(patchRes.ok ? 200 : patchRes.status, {
    ok: patchRes.ok,
    event_type_name: match.name,
    event_type_slug: match.slug,
    scheduling_url: match.scheduling_url,
    deactivated: patchRes.ok,
    calendly_status: patchRes.status,
    calendly_response: patchBody.slice(0, 600),
  });
}

async function fetchCal(token, url) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await r.text().catch(() => '');
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (_) {}
  return { ok: r.ok, status: r.status, json: parsed, body: text.slice(0, 600) };
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
