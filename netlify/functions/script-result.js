// WETYR Studios - Job result poller
// GET /.netlify/functions/script-result?jobId=X
// -> { status: 'processing'|'complete'|'error', progress, breakdown?, error? }

const { getJob } = require('./_wetyr_jobs');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'GET only' });

  const jobId = (event.queryStringParameters || {}).jobId;
  if (!jobId) return json(400, { ok: false, error: 'jobId query param required' });

  try {
    const row = await getJob(jobId);
    if (!row) return json(404, { ok: false, error: 'job not found', jobId });
    // Flatten payload JSONB onto the response so callers see top-level fields.
    const { payload, ...rest } = row;
    return json(200, { ok: true, jobId, ...rest, ...(payload || {}) });
  } catch (e) {
    return json(500, { ok: false, error: String(e.message || e) });
  }
};

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type'
  };
}
function json(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json', ...cors() }, body: JSON.stringify(body) };
}
