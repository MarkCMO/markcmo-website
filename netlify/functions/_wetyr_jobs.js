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
const COLUMNS = new Set(['status', 'kind', 'title', 'progress', 'error', 'project_id']);

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

// Generic kickoff helper for background-function-backed pipelines.
// kind = "dissect" | "schedule" | "budget" | "callsheet"
//
// project_id rules:
//   - "dissect" jobs: project_id = own jobId (a dissect IS a project root)
//   - "schedule"/"budget"/"callsheet": project_id = body.projectId (passed by client),
//     which is the dissect's jobId. Falls back to own jobId if not supplied.
async function kickoffJob({ kind, host, proto, body }) {
  const jobId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  const projectId = (kind === 'dissect') ? jobId : (body.projectId || jobId);

  await setJob(jobId, {
    status: 'processing',
    kind,
    project_id: projectId,
    title: body.title || (body.breakdown && body.breakdown.title) || 'Untitled',
    progress: 'queued'
  });

  const bgUrl = `${proto || 'https'}://${host || 'markcmo.com'}/.netlify/functions/script-${kind}-background`;
  const r = await fetch(bgUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jobId, ...body })
  });
  if (r.status !== 202 && !r.ok) {
    throw new Error('Background trigger failed: HTTP ' + r.status);
  }
  return jobId;
}

// Read jobs grouped as projects, newest first.
// Returns: [{ project_id, title, dissect, schedule, budget, callsheet, lastActivity }]
async function listProjects({ limit = 30 } = {}) {
  if (!REST || !SUPABASE_SERVICE_KEY) throw new Error('Supabase env not set');
  const r = await fetch(REST + '?select=*&order=created_at.desc&limit=' + (limit * 4), {
    headers: authHeaders()
  });
  if (!r.ok) throw new Error('Supabase list ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const rows = await r.json();

  const KINDS = ['dissect', 'schedule', 'budget', 'callsheet', 'shotlist', 'orders', 'locations', 'safety', 'post'];

  const projects = new Map();
  for (const row of rows) {
    const pid = row.project_id || row.job_id;
    if (!projects.has(pid)) {
      const blank = { project_id: pid, title: row.title || 'Untitled', lastActivity: row.updated_at || row.created_at };
      for (const k of KINDS) blank[k] = null;
      projects.set(pid, blank);
    }
    const p = projects.get(pid);
    if (row.kind && KINDS.includes(row.kind) && p[row.kind] === null) {
      p[row.kind] = {
        job_id: row.job_id,
        status: row.status,
        progress: row.progress,
        error: row.error,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    }
    if (row.title && row.title !== 'Untitled' && p.title === 'Untitled') p.title = row.title;
    if (row.updated_at > p.lastActivity) p.lastActivity = row.updated_at;
  }

  return [...projects.values()]
    .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity))
    .slice(0, limit);
}

module.exports = { setJob, getJob, kickoffJob, listProjects };
