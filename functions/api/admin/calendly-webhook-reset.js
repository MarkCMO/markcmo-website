// /api/admin/calendly-webhook-reset?token=<MAIL_ADMIN_PASSWORD>
// ─────────────────────────────────────────────────────────────────
// Deletes existing Calendly webhook subscriptions pointing at our
// callback, then creates a FRESH user-scope subscription for
// invitee.created + invitee.canceled. Returns the new signing key
// ONCE (Calendly only reveals it at creation time).
//
// Built 2026-06-14: the existing subscription started failing delivery
// at 2026-06-13T20:43Z (retry_started_at set), so booking confirmation
// emails stopped going out (Jabin Chambers' WETYR booking never reached
// the handler). Recreating issues a fresh signing key + clears the
// failed-delivery retry state.
//
// After calling this, set CALENDLY_SIGNING_KEY (CF Pages secret) to the
// returned signing_key so the handler's HMAC verification matches.
//
// Uses env.CALENDLY_API_TOKEN (server-side only).

const CALLBACK_URL = 'https://markcmo.com/api/calendly-webhook';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const adminToken = url.searchParams.get('token') || '';
  const adminPass = env.MAIL_ADMIN_PASSWORD || env.ADMIN_PASSWORD || env.ADMIN_PASS || '';
  const dryRun = url.searchParams.get('dry') === '1';

  if (!adminPass || adminToken !== adminPass) {
    return j(401, { error: 'unauthorized', hint: 'pass ?token=<admin_password>' });
  }
  const calToken = env.CALENDLY_API_TOKEN;
  if (!calToken) return j(500, { error: 'CALENDLY_API_TOKEN not configured' });

  const me = await cal(calToken, 'https://api.calendly.com/users/me');
  if (!me.ok) return j(502, { error: 'users/me failed', detail: me.body });
  const userUri = me.json.resource.uri;
  const orgUri = me.json.resource.current_organization;

  const log = { user_uri: userUri, organization_uri: orgUri, deleted: [], created: null };

  // 1. List existing user-scope subscriptions
  const params = new URLSearchParams({ organization: orgUri, user: userUri, scope: 'user', count: '100' });
  const list = await cal(calToken, `https://api.calendly.com/webhook_subscriptions?${params}`);
  if (!list.ok) return j(502, { error: 'list subscriptions failed', detail: list.body });

  const existing = (list.json.collection || []).filter(w => w.callback_url === CALLBACK_URL);
  log.found = existing.map(w => ({ uri: w.uri, state: w.state, retry_started_at: w.retry_started_at || null }));

  if (dryRun) {
    log.dry_run = true;
    return j(200, log);
  }

  // 2. Delete each existing subscription at our callback
  for (const w of existing) {
    const del = await calRaw(calToken, w.uri, 'DELETE');
    log.deleted.push({ uri: w.uri, status: del.status });
  }

  // 3. Create a fresh subscription
  const createRes = await fetch('https://api.calendly.com/webhook_subscriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${calToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: CALLBACK_URL,
      events: ['invitee.created', 'invitee.canceled'],
      organization: orgUri,
      user: userUri,
      scope: 'user',
    }),
  });
  const createText = await createRes.text().catch(() => '');
  let createJson = null;
  try { createJson = JSON.parse(createText); } catch (_) {}

  if (!createRes.ok) {
    log.create_error = { status: createRes.status, body: createText.slice(0, 600) };
    return j(502, log);
  }

  const resource = createJson.resource || {};
  log.created = {
    uri: resource.uri,
    state: resource.state,
    events: resource.events,
    callback_url: resource.callback_url,
  };
  // signing_key is returned ONCE at creation
  log.signing_key = resource.signing_key || null;
  log.next_step = 'Set CALENDLY_SIGNING_KEY (CF Pages secret) to signing_key, then redeploy is not needed (secrets are read at runtime).';

  return j(200, log);
}

async function cal(token, url) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await r.text().catch(() => '');
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (_) {}
  return { ok: r.ok, status: r.status, json: parsed, body: text.slice(0, 800) };
}

async function calRaw(token, url, method) {
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` } });
  return { ok: r.ok, status: r.status };
}

function j(status, body) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
