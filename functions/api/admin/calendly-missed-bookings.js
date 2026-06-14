// /api/admin/calendly-missed-bookings?token=<MAIL_ADMIN_PASSWORD>&since=2026-06-13T20:00:00Z
// ─────────────────────────────────────────────────────────────────
// Lists Calendly scheduled events created since `since` (default: the
// 2026-06-13T20:43Z webhook-failure start) and cross-references against
// mc_audit_log calendly_booking_created rows to find bookings our
// webhook MISSED while the signing key was mismatched.
//
// Read-only. Returns the missed bookings so confirmation emails can be
// sent (through Mark's approval flow). Does NOT send anything itself.

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const adminToken = url.searchParams.get('token') || '';
  const adminPass = env.MAIL_ADMIN_PASSWORD || env.ADMIN_PASSWORD || env.ADMIN_PASS || '';
  if (!adminPass || adminToken !== adminPass) return j(401, { error: 'unauthorized' });

  const calToken = env.CALENDLY_API_TOKEN;
  if (!calToken) return j(500, { error: 'CALENDLY_API_TOKEN not configured' });
  const since = url.searchParams.get('since') || '2026-06-13T20:00:00Z';

  // user uri
  const me = await cal(calToken, 'https://api.calendly.com/users/me');
  if (!me.ok) return j(502, { error: 'users/me failed', detail: me.body });
  const userUri = me.json.resource.uri;

  // scheduled events created since `since` (use min_start_time to bound;
  // we then filter by created_at client-side via invitee.created_at)
  const evUrl = `https://api.calendly.com/scheduled_events?user=${encodeURIComponent(userUri)}&min_start_time=${encodeURIComponent(since)}&count=100&sort=start_time:asc`;
  const evRes = await cal(calToken, evUrl);
  if (!evRes.ok) return j(502, { error: 'scheduled_events failed', detail: evRes.body });

  const missed = [];
  for (const ev of (evRes.json.collection || [])) {
    const evId = ev.uri.split('/').pop();
    const invRes = await cal(calToken, `https://api.calendly.com/scheduled_events/${evId}/invitees?count=100`);
    if (!invRes.ok) continue;
    for (const inv of (invRes.json.collection || [])) {
      if (inv.status === 'canceled') continue;
      // Was this booking processed by our webhook? Check audit log by email.
      const seen = await sbCount(env, `mc_audit_log?event=eq.calendly_booking_created&payload->>invitee_email=eq.${encodeURIComponent((inv.email || '').toLowerCase())}`);
      if (seen > 0) continue; // already processed
      missed.push({
        invitee_name: inv.name,
        invitee_email: inv.email,
        event_name: ev.name,
        start_time: ev.start_time,
        created_at: inv.created_at,
        location: (ev.location && (ev.location.join_url || ev.location.location)) || null,
        event_uri: ev.uri,
      });
    }
  }

  return j(200, { since, scheduled_events: (evRes.json.collection || []).length, missed_count: missed.length, missed });
}

async function cal(token, url) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await r.text().catch(() => '');
  let parsed = null; try { parsed = JSON.parse(text); } catch (_) {}
  return { ok: r.ok, status: r.status, json: parsed, body: text.slice(0, 600) };
}

async function sbCount(env, pathAndQuery) {
  const key = env.MARKCMO_SUPABASE_SERVICE_KEY;
  const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/${pathAndQuery}&select=id`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact', Range: '0-0' },
  });
  const cr = res.headers.get('content-range') || '0/0';
  const total = parseInt(cr.split('/')[1] || '0', 10);
  return isNaN(total) ? 0 : total;
}

function j(status, body) {
  return new Response(JSON.stringify(body, null, 2), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
