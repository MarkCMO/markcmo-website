// /api/admin/calendly-webhook-status?token=<MAIL_ADMIN_PASSWORD>
// ─────────────────────────────────────────────────────────────────
// Diagnostic: list all Calendly webhook subscriptions for Mark's user
// + organization, with their state (active/disabled), scope, callback
// URL, and which events they fire on.
//
// Built 2026-06-14 to diagnose why Jabin Chambers' WETYR Introduction
// Meeting booking never reached our /api/calendly-webhook (no audit row,
// no confirmation email) while Douglas Schneider's WETYR booking on
// 2026-06-09 did. Suspicion: the webhook subscription stopped delivering
// or was scoped narrowly.
//
// Uses env.CALENDLY_API_TOKEN (server-side only; never returned).

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const adminToken = url.searchParams.get('token') || '';
  const adminPass = env.MAIL_ADMIN_PASSWORD || env.ADMIN_PASSWORD || env.ADMIN_PASS || '';

  if (!adminPass || adminToken !== adminPass) {
    return j(401, { error: 'unauthorized', hint: 'pass ?token=<admin_password>' });
  }
  const calToken = env.CALENDLY_API_TOKEN;
  if (!calToken) return j(500, { error: 'CALENDLY_API_TOKEN not configured' });

  // 1. Who am I + my organization
  const me = await cal(calToken, 'https://api.calendly.com/users/me');
  if (!me.ok) return j(502, { error: 'users/me failed', detail: me.body });
  const userUri = me.json.resource.uri;
  const orgUri = me.json.resource.current_organization;

  // 2. List webhook subscriptions at BOTH scopes
  const out = { user_uri: userUri, organization_uri: orgUri, subscriptions: [] };

  for (const scope of ['user', 'organization']) {
    const params = new URLSearchParams({
      organization: orgUri,
      scope,
      count: '100',
    });
    if (scope === 'user') params.set('user', userUri);
    const list = await cal(calToken, `https://api.calendly.com/webhook_subscriptions?${params}`);
    if (!list.ok) {
      out.subscriptions.push({ scope, error: list.body });
      continue;
    }
    for (const w of (list.json.collection || [])) {
      out.subscriptions.push({
        scope,
        uri: w.uri,
        callback_url: w.callback_url,
        state: w.state,           // 'active' or 'disabled'
        events: w.events,         // ['invitee.created', 'invitee.canceled', ...]
        created_at: w.created_at,
        retry_started_at: w.retry_started_at || null,
      });
    }
  }

  // 3. List the user's event types so we can see WETYR + which are active
  const etList = await cal(calToken, `https://api.calendly.com/event_types?user=${encodeURIComponent(userUri)}&count=100`);
  out.event_types = etList.ok
    ? (etList.json.collection || []).map(e => ({ name: e.name, slug: e.slug, active: e.active, scheduling_url: e.scheduling_url }))
    : { error: etList.body };

  return j(200, out);
}

async function cal(token, url) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await r.text().catch(() => '');
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (_) {}
  return { ok: r.ok, status: r.status, json: parsed, body: text.slice(0, 800) };
}

function j(status, body) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
