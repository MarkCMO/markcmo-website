// ═══════════════════════════════════════════════════════════════
// pf-setup-square.js  (WETYR Arena)  -- admin-gated, one-time setup
// Creates the Square subscription plan + one weekly variation per division and
// writes each variation id back to pf_plans.square_plan_id.
// Respects SQUARE_ENV (run with SQUARE_ENV=sandbox first).
//
// POST (admin-gated). Idempotent-ish: re-running upserts the same catalog objects.
// Verify field names against the live Square Catalog API at wiring time.
// ═══════════════════════════════════════════════════════════════
const crypto = require('crypto');
const { sbSelect, sbUpdate, isAdminAuthed, corsHeaders } = require('./_lib_supabase');
const { sqCall, sqBaseUrl } = require('./_lib_square');

exports.handler = async (event) => {
  const headers = corsHeaders(event, ['https://wetyr.com', 'https://markcmo.com']);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return resp(headers, 405, { error: 'POST only' });
  if (!(await isAdminAuthed(event))) return resp(headers, 401, { error: 'unauthorized' });

  try {
    const plans = await sbSelect('pf_plans?active=eq.true&select=*&order=weekly_price_cents.asc');
    if (!plans.length) return resp(headers, 400, { error: 'no active plans; apply schema.sql first' });

    // Build a catalog batch: one SUBSCRIPTION_PLAN + a weekly variation per division.
    const planTempId = '#wetyr-arena-plan';
    const objects = [{
      type: 'SUBSCRIPTION_PLAN', id: planTempId,
      subscription_plan_data: { name: 'WETYR Arena' },
    }];
    const tempBySlug = {};
    for (const p of plans) {
      const tid = `#var-${p.slug}`;
      tempBySlug[p.slug] = tid;
      objects.push({
        type: 'SUBSCRIPTION_PLAN_VARIATION', id: tid,
        subscription_plan_variation_data: {
          name: p.name,
          subscription_plan_id: planTempId,
          phases: [{ cadence: 'WEEKLY', pricing: { type: 'STATIC', price_money: { amount: p.weekly_price_cents, currency: 'USD' } } }],
        },
      });
    }

    const res = await sqCall('POST', '/catalog/batch-upsert', {
      idempotency_key: crypto.randomUUID(),
      batches: [{ objects }],
    });

    // Map our temp ids to the real Square object ids and persist the variation ids.
    const map = {};
    (res.id_mappings || []).forEach((m) => { map[m.client_object_id] = m.object_id; });

    const updated = [];
    for (const p of plans) {
      const variationId = map[tempBySlug[p.slug]];
      if (variationId) {
        await sbUpdate('pf_plans', `slug=eq.${encodeURIComponent(p.slug)}`, { square_plan_id: variationId });
        updated.push({ slug: p.slug, square_plan_id: variationId });
      }
    }

    return resp(headers, 200, {
      ok: true,
      env: (process.env.SQUARE_ENV || 'production').toLowerCase(),
      base: sqBaseUrl(),
      plan_id: map[planTempId] || null,
      updated,
    });
  } catch (e) {
    return resp(headers, 500, { error: e.message, squareErrors: e.squareErrors });
  }
};

function resp(headers, statusCode, obj) {
  return { statusCode, headers, body: JSON.stringify(obj) };
}
