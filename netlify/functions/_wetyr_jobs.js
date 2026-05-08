// Shared Supabase-backed job store for WETYR Studios async pipelines.
// Used by script-dissect (kickoff), script-dissect-background (worker),
// and script-result (poller). Avoids Netlify Blobs entirely so we don't
// need a NETLIFY_TOKEN PAT on this site.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const REST = SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/wetyr_jobs` : null;

function authHeaders() {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'content-type': 'application/json',
    Prefer: 'return=representation'
  };
}

// Known top-level columns; everything else gets folded into the JSONB payload.
const COLUMNS = new Set(['status', 'kind', 'title', 'progress', 'error']);

async function setJob(jobId, patch) {
  if (!REST || !SUPABASE_SERVICE_KEY) throw new Error('Supabase env not set (SUPABASE_URL/SUPABASE_SERVICE_KEY)');

  // Fetch existing payload so we can MERGE, not replace, the JSONB.
  const existing = await getJob(jobId);
  const existingPayload = (existing && existing.payload) || {};

  const row = { job_id: jobId, updated_at: new Date().toISOString() };
  const payloadPatch = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (COLUMNS.has(k)) row[k] = v;
    else payloadPatch[k] = v;
  }
  if (Object.keys(payloadPatch).length || existing) {
    row.payload = { ...existingPayload, ...payloadPatch };
  }

  const r = await fetch(REST + '?on_conflict=job_id', {
    method: 'POST',
    headers: { ...authHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row)
  });
  if (!r.ok) throw new Error('Supabase upsert ' + r.status + ': ' + (await r.text()).slice(0, 200));
}

async function getJob(jobId) {
  if (!REST || !SUPABASE_SERVICE_KEY) throw new Error('Supabase env not set');
  const r = await fetch(REST + '?job_id=eq.' + encodeURIComponent(jobId) + '&select=*', {
    headers: authHeaders()
  });
  if (!r.ok) throw new Error('Supabase get ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const rows = await r.json();
  return rows[0] || null;
}

module.exports = { setJob, getJob };
