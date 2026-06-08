// /api/resend-webhook
//
// Receives Resend webhook events (email.sent, email.delivered, email.opened,
// email.clicked, email.bounced, email.complained, email.delivery_delayed) and
// translates them into engagement signals on the matching mc_engagements row.
//
// Each event includes the email message id. We match it against the
// metadata fields confirmation_resend_id / reminder_24h_resend_id /
// reminder_6h_resend_id / reminder_1h_resend_id / confirm_15min_resend_id /
// followup_resend_id / rebook_cta_resend_id to find the engagement.
//
// Then we accumulate counters in metadata.engagement_signals AND recompute
// metadata.show_probability so the system always knows how likely the
// invitee is to attend.
//
// Native CF Pages function (not a Netlify shim). Self-contained.
//
// Configure in Resend dashboard:
//   Settings > Webhooks > Add endpoint
//     URL: https://markcmo.com/api/resend-webhook
//     Events: email.sent, email.delivered, email.opened, email.clicked,
//             email.bounced, email.complained, email.delivery_delayed
//     Secret: store value in RESEND_WEBHOOK_SECRET env var

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let bodyText;
  try { bodyText = await request.text(); }
  catch (_) { return new Response('Could not read body', { status: 400 }); }

  // ─── Verify Svix signature (Resend uses Svix for webhook signing) ───
  const svixId = request.headers.get('svix-id') || '';
  const svixTimestamp = request.headers.get('svix-timestamp') || '';
  const svixSignature = request.headers.get('svix-signature') || '';
  const secret = env.RESEND_WEBHOOK_SECRET || '';
  if (secret && svixId && svixTimestamp && svixSignature) {
    const ok = await verifySvixSignature(secret, `${svixId}.${svixTimestamp}.${bodyText}`, svixSignature);
    if (!ok) {
      console.warn('Resend webhook: invalid signature');
      return new Response('Invalid signature', { status: 401 });
    }
  }

  let evt;
  try { evt = JSON.parse(bodyText); }
  catch (_) { return new Response('Bad JSON', { status: 400 }); }

  const type = evt.type || '';
  const data = evt.data || {};
  const emailId = data.email_id || data.id || '';
  const recipient = (Array.isArray(data.to) ? data.to[0] : data.to) || '';
  const tags = data.tags || [];
  const categoryTag = (tags.find(t => t.name === 'category') || {}).value || '';

  if (!emailId) {
    return new Response(JSON.stringify({ ok: true, skip: 'no email_id' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ─── Find which engagement owns this email ───
  const META_KEYS = [
    'confirmation_resend_id', 'reminder_24h_resend_id',
    'reminder_6h_resend_id', 'reminder_1h_resend_id',
    'confirm_15min_resend_id', 'followup_resend_id',
    'rebook_cta_resend_id',
  ];

  let engagement = null, matchedKey = null;
  for (const k of META_KEYS) {
    try {
      const rows = await sbSelect(env,
        `mc_engagements?metadata->>${k}=eq.${encodeURIComponent(emailId)}&select=id,client_id,metadata&limit=1`);
      if (rows && rows[0]) {
        engagement = rows[0];
        matchedKey = k;
        break;
      }
    } catch (_) {}
  }

  // ─── Update engagement signals + recompute show probability ───
  if (engagement) {
    const meta = engagement.metadata || {};
    const signals = meta.engagement_signals || {};
    const nowIso = new Date().toISOString();
    const emailType = matchedKey.replace('_resend_id', '');

    const bucket = signals[emailType] || {
      sent_at: null, delivered_at: null,
      opened_at: null, opened_count: 0,
      clicked_at: null, clicked_count: 0,
      bounced_at: null, complained_at: null,
    };

    switch (type) {
      case 'email.sent':
        bucket.sent_at = bucket.sent_at || nowIso; break;
      case 'email.delivered':
        bucket.delivered_at = bucket.delivered_at || nowIso; break;
      case 'email.opened':
        bucket.opened_at = bucket.opened_at || nowIso;
        bucket.opened_count = (bucket.opened_count || 0) + 1;
        meta.last_open_at = nowIso;
        meta.total_opens = (meta.total_opens || 0) + 1;
        break;
      case 'email.clicked':
        bucket.clicked_at = bucket.clicked_at || nowIso;
        bucket.clicked_count = (bucket.clicked_count || 0) + 1;
        meta.last_click_at = nowIso;
        meta.total_clicks = (meta.total_clicks || 0) + 1;
        break;
      case 'email.bounced':
        bucket.bounced_at = nowIso;
        bucket.bounce_reason = data.bounce?.reason || data.reason || 'unknown';
        meta.has_bounce = true;
        break;
      case 'email.complained':
        bucket.complained_at = nowIso;
        meta.has_complaint = true;
        break;
      case 'email.delivery_delayed':
        bucket.delayed_at = nowIso;
        break;
    }

    signals[emailType] = bucket;
    meta.engagement_signals = signals;
    meta.show_probability = computeShowProbability(meta);
    meta.show_probability_updated_at = nowIso;

    try {
      await sbUpdate(env, 'mc_engagements',
        `id=eq.${encodeURIComponent(engagement.id)}`, { metadata: meta });
    } catch (e) {
      console.warn('resend-webhook: metadata update failed', e && e.message);
    }
  }

  // ─── Audit log ───
  try {
    await sbInsert(env, 'mc_audit_log', {
      client_id: engagement?.client_id || null,
      engagement_id: engagement?.id || null,
      event: `email_${type.replace('email.', '')}`,
      payload: {
        email_id: emailId,
        recipient,
        email_type: matchedKey ? matchedKey.replace('_resend_id', '') : null,
        category_tag: categoryTag,
        handler_version: 'resend-webhook-v1',
      },
    });
  } catch (_) {}

  return new Response(JSON.stringify({
    ok: true,
    matched: !!engagement,
    engagement_id: engagement?.id || null,
    event_type: type,
    show_probability: engagement?.metadata?.show_probability || null,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

// ───── Svix signature verification ────────────────────────────
async function verifySvixSignature(secret, signedContent, signatureHeader) {
  try {
    const secretBytes = secret.startsWith('whsec_')
      ? Uint8Array.from(atob(secret.substring(6)), c => c.charCodeAt(0))
      : new TextEncoder().encode(secret);
    const key = await crypto.subtle.importKey('raw', secretBytes,
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key,
      new TextEncoder().encode(signedContent));
    const expectedB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
    for (const sigPart of signatureHeader.split(/\s+/)) {
      const [, b64] = sigPart.split(',');
      if (b64 && b64 === expectedB64) return true;
    }
    return false;
  } catch (e) {
    console.warn('verifySvixSignature crashed', e && e.message);
    return false;
  }
}

// ───── computeShowProbability ─────────────────────────────────
// 0-100 score based on collected signals. Higher = more likely to attend.
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

// ───── Supabase REST helpers ──────────────────────────────────
function sbHeaders(env) {
  const key = env.MARKCMO_SUPABASE_SERVICE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}
async function sbSelect(env, path) {
  const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders(env) });
  if (!res.ok) throw new Error(`sbSelect ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
async function sbInsert(env, table, body) {
  const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...sbHeaders(env), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`sbInsert ${table} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
async function sbUpdate(env, table, filter, body) {
  const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(env), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`sbUpdate ${table} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
