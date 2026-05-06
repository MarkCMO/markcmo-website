// ═══════════════════════════════════════════════════════════════
// admin-mc-write.js
//
// Single admin-gated write endpoint. Handles create/update/delete
// for all the admin-panel auxiliary tables that don't have
// their own dedicated function.
//
// POST { table: 'notes', op: 'create', data: {...} }
// POST { table: 'products', op: 'upsert', data: {...} }
// POST { table: 'templates', op: 'upsert', data: {...} }
// POST { table: 'webinars', op: 'upsert', data: {...} }
// POST { table: 'engagements', op: 'update', id, data: {status,...} }
// POST { table: '<any>', op: 'delete', id }
//
// Auth: cookie OR x-admin-api-token header.
// ═══════════════════════════════════════════════════════════════
const { sbSelect, sbInsert, sbUpdate, isAdminAuthed, corsHeaders } = require('./_lib_supabase');

const TABLE_MAP = {
  notes:       { name: 'mc_notes',           editable: ['client_id','engagement_id','author','category','body','pinned'] },
  products:    { name: 'mc_products',        editable: ['slug','name','category','description','fee_usd','fee_type','delivery_window_hrs','doc_prefix','is_active','display_order'] },
  templates:   { name: 'mc_email_templates', editable: ['slug','name','category','subject','preheader','html_body','variables','is_active'] },
  webinars:    { name: 'mc_webinar_events',  editable: ['slug','title','topic','scheduled_at','registration_open_at','registration_close_at','duration_minutes','host','live_url','replay_url','replay_password','status','registrant_count','attendee_count','replay_view_count','notes'] },
  engagements: { name: 'mc_engagements',     editable: ['status','name','fee_usd','delivery_window_hrs','proposed_at','accepted_at','paid_at','started_at','delivery_due_at'] },
};

async function sbDelete(table, filter) {
  const url = process.env.MARKCMO_SUPABASE_URL;
  const key = process.env.MARKCMO_SUPABASE_SERVICE_KEY;
  const res = await fetch(`${url}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=representation' },
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status} ${await res.text()}`);
  return res.json();
}

exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  if (!(await isAdminAuthed(event))) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { table, op, id, data } = body;
  const map = TABLE_MAP[table];
  if (!map) return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown table: ${table}. Allowed: ${Object.keys(TABLE_MAP).join(', ')}` }) };

  try {
    // ─── DELETE ───────────────────────────────────────────────
    if (op === 'delete') {
      if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required for delete' }) };
      const removed = await sbDelete(map.name, `id=eq.${encodeURIComponent(id)}`);
      try {
        await sbInsert('mc_audit_log', { event: `${table}_deleted`, payload: { id, table: map.name } });
      } catch {}
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, removed }) };
    }

    // ─── Build whitelisted patch from data ────────────────────
    const patch = {};
    for (const k of map.editable) {
      if (data && k in data) patch[k] = data[k];
    }
    if (!Object.keys(patch).length) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No editable fields supplied', allowed: map.editable }) };
    }

    // ─── CREATE ───────────────────────────────────────────────
    if (op === 'create') {
      const created = await sbInsert(map.name, patch);
      try {
        await sbInsert('mc_audit_log', {
          client_id: patch.client_id || null,
          engagement_id: patch.engagement_id || null,
          event: `${table}_created`,
          payload: { id: created?.[0]?.id, fields: Object.keys(patch) },
        });
      } catch {}
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, row: created?.[0] || null }) };
    }

    // ─── UPDATE ───────────────────────────────────────────────
    if (op === 'update') {
      if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required for update' }) };
      const before = await sbSelect(`${map.name}?id=eq.${encodeURIComponent(id)}&select=*`);
      if (!before.length) return { statusCode: 404, headers, body: JSON.stringify({ error: `${table}#${id} not found` }) };
      const updated = await sbUpdate(map.name, `id=eq.${encodeURIComponent(id)}`, patch);
      const diff = {};
      for (const k of Object.keys(patch)) {
        if (JSON.stringify(before[0][k]) !== JSON.stringify(patch[k])) diff[k] = { from: before[0][k], to: patch[k] };
      }
      try {
        await sbInsert('mc_audit_log', {
          client_id: before[0].client_id || patch.client_id || null,
          engagement_id: before[0].engagement_id || patch.engagement_id || (table === 'engagements' ? id : null),
          event: `${table}_updated`,
          payload: { id, fields_changed: Object.keys(diff), diff },
        });
      } catch {}
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, row: updated?.[0] || null, changed: Object.keys(diff) }) };
    }

    // ─── UPSERT (by slug for products/templates/webinars, by id otherwise) ───
    if (op === 'upsert') {
      if (id) {
        const updated = await sbUpdate(map.name, `id=eq.${encodeURIComponent(id)}`, patch);
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, row: updated?.[0] || null }) };
      }
      // Try by slug if available
      if (patch.slug && ['products','templates','webinars'].includes(table)) {
        const existing = await sbSelect(`${map.name}?slug=eq.${encodeURIComponent(patch.slug)}&select=id`);
        if (existing.length) {
          const updated = await sbUpdate(map.name, `id=eq.${encodeURIComponent(existing[0].id)}`, patch);
          return { statusCode: 200, headers, body: JSON.stringify({ ok: true, row: updated?.[0] || null, mode: 'updated' }) };
        }
      }
      const created = await sbInsert(map.name, patch);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, row: created?.[0] || null, mode: 'created' }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown op: ${op}. Allowed: create | update | upsert | delete` }) };
  } catch (err) {
    console.error('admin-mc-write error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || 'Internal error' }) };
  }
};
