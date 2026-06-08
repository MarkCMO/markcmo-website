// /api/bookings-intel
//
// JSON endpoint returning intelligence on upcoming + recent bookings.
// Each booking includes:
//   - invitee name, email, scheduled time
//   - show_probability (0-100 score)
//   - signal timeline (opens, clicks, replies, attendance confirmation)
//   - last reply classification + preview
//   - prep details if invitee sent any
//
// Powers the admin Bookings Intel view + lets external dashboards
// query the same data.
//
// Auth: ADMIN_SECRET header OR Cloudflare Access (when behind it).

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Simple admin secret auth
  const provided = request.headers.get('x-admin-secret') || url.searchParams.get('admin_secret') || '';
  if (env.ADMIN_SECRET && provided !== env.ADMIN_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  // ─── Pull recent calendly_booking_created events from audit log ───
  const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const bookings = await sbSelect(env,
    `mc_audit_log?event=eq.calendly_booking_created&created_at=gte.${encodeURIComponent(sinceIso)}&order=created_at.desc&limit=50&select=created_at,engagement_id,client_id,payload`);

  // ─── For each booking, fetch the engagement to get current metadata ───
  const out = [];
  for (const b of bookings) {
    const engId = b.engagement_id;
    if (!engId) continue;
    let eng = null;
    try {
      const rows = await sbSelect(env,
        `mc_engagements?id=eq.${encodeURIComponent(engId)}&select=id,name,metadata,status&limit=1`);
      eng = rows && rows[0];
    } catch (_) {}
    if (!eng) continue;
    const meta = eng.metadata || {};

    // Recompute show_probability fresh (in case it wasn't computed by webhook yet)
    const showProb = computeShowProbability(meta);

    // Build signal timeline
    const signals = meta.engagement_signals || {};
    const signalSummary = {};
    for (const k of Object.keys(signals)) {
      const s = signals[k];
      signalSummary[k] = {
        sent: !!s.sent_at,
        delivered: !!s.delivered_at,
        opens: s.opened_count || 0,
        clicks: s.clicked_count || 0,
        bounced: !!s.bounced_at,
      };
    }

    out.push({
      engagement_id: eng.id,
      engagement_name: eng.name || '',
      engagement_status: eng.status,
      created_at: b.created_at,
      invitee_name: b.payload?.invitee_name || '',
      invitee_email: b.payload?.invitee_email || '',
      event_name: b.payload?.event_name || '',
      scheduled_at: meta.scheduled_at || b.payload?.scheduled_at || '',
      show_probability: showProb,
      attended_confirmed_at: meta.attended_confirmed_at || null,
      attended_confirmed_via: meta.attended_confirmed_via || null,
      cancel_requested_at: meta.cancel_requested_at || null,
      last_reply_at: meta.last_reply_at || null,
      last_reply_classification: meta.last_reply_classification || null,
      last_reply_preview: meta.last_reply_preview || '',
      prep_details: meta.prep_details || null,
      total_opens: meta.total_opens || 0,
      total_clicks: meta.total_clicks || 0,
      has_bounce: !!meta.has_bounce,
      has_complaint: !!meta.has_complaint,
      signal_summary: signalSummary,
      calendly_invitee_uri: meta.calendly_invitee_uri || '',
      calendly_event_uri: meta.calendly_event_uri || '',
    });
  }

  // Sort by upcoming meeting time (closest first)
  out.sort((a, b) => {
    const at = new Date(a.scheduled_at || 0).getTime();
    const bt = new Date(b.scheduled_at || 0).getTime();
    return at - bt;
  });

  return new Response(JSON.stringify({
    ok: true,
    total: out.length,
    bookings: out,
    generated_at: new Date().toISOString(),
  }, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function computeShowProbability(meta) {
  let score = 50;
  if (meta.attended_confirmed_at) score += 30;
  if (meta.last_reply_classification === 'prep_details') score += 20;
  if (meta.last_reply_classification === 'confirmation') score += 15;
  if (meta.total_clicks > 0) score += Math.min(20, meta.total_clicks * 5);
  if (meta.prep_details && meta.prep_details.length > 100) score += 10;
  if (meta.total_opens > 0) score += Math.min(10, meta.total_opens * 2);
  if (meta.total_opens >= 3) score += 5;
  if (meta.cancel_requested_at) score -= 60;
  if (meta.last_reply_classification === 'cancellation') score -= 40;
  if (meta.has_bounce) score -= 25;
  if (meta.has_complaint) score -= 40;
  return Math.max(0, Math.min(100, score));
}

function sbHeaders(env) {
  const key = env.MARKCMO_SUPABASE_SERVICE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}
async function sbSelect(env, path) {
  const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders(env) });
  if (!res.ok) throw new Error(`sbSelect ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
