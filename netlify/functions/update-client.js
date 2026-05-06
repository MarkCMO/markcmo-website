// ═══════════════════════════════════════════════════════════════
// update-client.js
//
// Admin-gated. Edit a client profile in mc_clients.
// Used by the "Edit Client" button in /admin#case-files.
//
// POST body (JSON):
//   {
//     id: "<mc_clients.id uuid>",         REQUIRED
//     legal_name: "...",                   optional
//     dba: "...",                          optional (nullable)
//     primary_contact_name: "...",         optional
//     primary_contact_title: "...",        optional (nullable)
//     primary_contact_email: "...",        optional
//     primary_contact_phone: "...",        optional (nullable)
//     website: "...",                      optional (nullable)
//     country: "...",                      optional (nullable)
//     region: "...",                       optional (nullable)
//     notes: "...",                        optional (nullable)
//     cc_emails: ["a@b.com","c@d.com"],    optional (array of strings)
//     status: "lead"|"signed"|"paid"|...,  optional
//   }
//
// Whitelisted fields ONLY. id, slug, source, created_at, square_customer_id
// are NOT editable here (slug change would break document URLs and
// Square customer ID is owned by the Square API).
//
// Returns { ok: true, client: {...updated row} }
// ═══════════════════════════════════════════════════════════════
const { sbSelect, sbUpdate, sbInsert, isAdminAuthed, corsHeaders } = require('./_lib_supabase');

const EDITABLE = [
  'legal_name', 'dba',
  'primary_contact_name', 'primary_contact_title',
  'primary_contact_email', 'primary_contact_phone',
  'website', 'country', 'region',
  'notes', 'status',
  'cc_emails',
];

exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  }
  if (!(await isAdminAuthed(event))) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  if (!body.id) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };
  }

  // ─── Build patch with whitelisted, validated fields only ─────
  const patch = {};
  const before = await sbSelect(`mc_clients?id=eq.${encodeURIComponent(body.id)}&select=*`);
  if (!before.length) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Client not found' }) };
  }
  const existing = before[0];

  for (const k of EDITABLE) {
    if (!(k in body)) continue;
    let v = body[k];

    if (k === 'cc_emails') {
      // Must be an array of valid email strings
      if (!Array.isArray(v)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'cc_emails must be an array' }) };
      }
      const cleaned = [];
      for (const e of v) {
        if (typeof e !== 'string') continue;
        const t = e.trim();
        if (!t) continue;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: `Invalid email in cc_emails: "${t}"` }) };
        }
        cleaned.push(t);
      }
      // Deduplicate (case-insensitive on local part is fine)
      v = Array.from(new Set(cleaned.map(s => s.toLowerCase())));
      patch.cc_emails = v;
      continue;
    }

    if (k === 'primary_contact_email' && v) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim())) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid primary_contact_email' }) };
      }
      v = String(v).trim().toLowerCase();
    }

    if (k === 'status') {
      const allowedStatuses = ['lead', 'draft', 'signed', 'invoiced', 'paid', 'delivering', 'delivered', 'closed', 'archived'];
      if (!allowedStatuses.includes(String(v))) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` }) };
      }
    }

    if (typeof v === 'string') v = v.trim();
    if (v === '') v = null;
    patch[k] = v;
  }

  if (!Object.keys(patch).length) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No editable fields supplied' }) };
  }

  patch.updated_at = new Date().toISOString();

  // ─── Apply ────────────────────────────────────────────────────
  let updated;
  try {
    updated = await sbUpdate('mc_clients', `id=eq.${encodeURIComponent(body.id)}`, patch);
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Update failed: ' + e.message }) };
  }

  // ─── Audit log: capture what changed ──────────────────────────
  const diff = {};
  for (const k of Object.keys(patch)) {
    if (k === 'updated_at') continue;
    if (JSON.stringify(existing[k]) !== JSON.stringify(patch[k])) {
      diff[k] = { from: existing[k], to: patch[k] };
    }
  }
  if (Object.keys(diff).length) {
    try {
      await sbInsert('mc_audit_log', {
        client_id: body.id,
        event: 'client_updated',
        payload: { fields_changed: Object.keys(diff), diff },
      });
    } catch (e) { console.warn('audit log insert failed:', e.message); }
  }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, client: updated[0], changed: Object.keys(diff) }) };
};
