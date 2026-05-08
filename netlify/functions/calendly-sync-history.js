// ═══════════════════════════════════════════════════════════════
// calendly-sync-history.js
//
// Admin-gated. Pulls every Calendly invitee created in the last
// N days and upserts mc_clients + creates lead-status mc_engagements
// for any that don't already exist.
//
// Useful for backfilling Wendal-era leads that were booked before
// the live webhook started receiving events.
//
// Auth: x-admin-api-token header OR mcadmin_session cookie.
// Calls Calendly API with CALENDLY_API_TOKEN env var.
//
// POST { days?: 90, limit?: 200 }
// Returns { ok, scanned, created, skipped, errors, sample }
// ═══════════════════════════════════════════════════════════════
const { sbSelect, sbInsert, sbUpdate, isAdminAuthed, corsHeaders } = require('./_lib_supabase');

const CAL_API = 'https://api.calendly.com';

exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  if (!(await isAdminAuthed(event))) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

  const pat = process.env.CALENDLY_API_TOKEN;
  if (!pat) return { statusCode: 500, headers, body: JSON.stringify({ error: 'CALENDLY_API_TOKEN not set' }) };

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}
  const days = Math.min(Math.max(Number(body.days || 90), 1), 365);
  const limit = Math.min(Math.max(Number(body.limit || 200), 1), 500);

  // 1) Resolve user URI
  let user;
  try {
    const r = await callCal('/users/me', pat);
    user = r.resource;
  } catch (e) { return { statusCode: 502, headers, body: JSON.stringify({ error: 'Calendly /users/me failed: ' + e.message }) }; }

  const minStart = new Date(Date.now() - days * 86400000).toISOString();

  // 2) List scheduled events in window
  const events = await listAll(`${CAL_API}/scheduled_events?user=${encodeURIComponent(user.uri)}&min_start_time=${encodeURIComponent(minStart)}&count=100&sort=start_time:desc`, pat, limit);

  let created = 0, skipped = 0, errors = 0;
  const sample = [];

  // 3) For each event, list invitees + upsert client/engagement
  for (const ev of events) {
    try {
      const invs = await listAll(`${CAL_API}/scheduled_events/${ev.uri.split('/').pop()}/invitees?count=100`, pat, 50);
      for (const inv of invs) {
        if (inv.status === 'canceled') continue;  // skip cancellations
        const result = await upsertFromInvitee({ invitee: inv, event: ev });
        if (result.created) { created += 1; sample.push({ slug: result.slug, email: inv.email }); }
        else skipped += 1;
      }
    } catch (e) { console.warn('event sync failed:', e.message); errors += 1; }
  }

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      ok: true, scanned: events.length, created, skipped, errors,
      sample: sample.slice(0, 10),
      window_days: days,
      user_email: user.email,
    }),
  };
};

async function callCal(path, pat) {
  const url = path.startsWith('http') ? path : `${CAL_API}${path}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' } });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Calendly ${path} ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

async function listAll(startUrl, pat, hardLimit) {
  const out = [];
  let url = startUrl;
  while (url && out.length < hardLimit) {
    const data = await callCal(url, pat);
    const collection = data.collection || [];
    out.push(...collection);
    url = data.pagination?.next_page || null;
  }
  return out.slice(0, hardLimit);
}

async function upsertFromInvitee({ invitee, event }) {
  const email = (invitee.email || '').trim().toLowerCase();
  if (!email) return { created: false };
  const existing = await sbSelect(`mc_clients?primary_contact_email=ilike.${encodeURIComponent(email)}&select=id,slug&limit=1`);
  if (existing.length) return { created: false, slug: existing[0].slug };

  const name = invitee.name || email.split('@')[0];
  const qa = {};
  for (const q of (invitee.questions_and_answers || [])) {
    const k = (q.question || '').toLowerCase();
    qa[k] = q.answer || '';
  }
  const company = qa.company || qa.business || qa['business name'] || '';
  const phone = qa.phone || invitee.text_reminder_number || '';
  const website = qa.website || qa.url || '';
  const notes = qa.notes || qa['anything else'] || '';
  const slug = generateSlug(name, company, email);

  const inserted = await sbInsert('mc_clients', {
    slug,
    legal_name: company || name,
    primary_contact_name: name,
    primary_contact_email: email,
    primary_contact_phone: phone || null,
    website: website || null,
    source: 'calendly',
    source_event_id: event.uri,
    status: 'lead',
    notes: notes || null,
  });
  const client = inserted[0];

  await sbInsert('mc_engagements', {
    client_id: client.id,
    doc_prefix: 'TBD',
    name: `Initial consultation: ${event.name || 'Calendly booking'}`,
    description: notes ? `Calendly notes: ${notes.slice(0, 500)}` : '',
    fee_usd: 0,
    delivery_window_hrs: null,
    status: 'lead',
    metadata: {
      calendly_event_uri: event.uri,
      calendly_invitee_uri: invitee.uri,
      scheduled_at: event.start_time,
      questions: qa,
      backfilled_at: new Date().toISOString(),
    },
  });

  await sbInsert('mc_audit_log', {
    client_id: client.id,
    event: 'calendly_booking_backfilled',
    payload: { invitee_email: email, name, event_name: event.name, scheduled_at: event.start_time },
  });

  return { created: true, slug };
}

function generateSlug(name, company, email) {
  const base = (company || name || email.split('@')[0])
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'lead-' + Date.now();
}
