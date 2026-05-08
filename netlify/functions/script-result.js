// WETYR Studios - Job result poller
// GET /.netlify/functions/script-result?jobId=X
// -> { status: 'processing'|'complete'|'error', progress, breakdown?, error? }

const { getStore } = require('@netlify/blobs');

function openStore() {
  try {
    return getStore({ name: 'wetyr-jobs', consistency: 'strong' });
  } catch (e) {
    const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID || '609d74ca-5f2a-4caa-aa7c-3f6922a7bcb4';
    const token = process.env.NETLIFY_TOKEN || process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
    if (!token) throw new Error('Blobs unavailable; set NETLIFY_TOKEN PAT on site');
    return getStore({ name: 'wetyr-jobs', siteID, token, consistency: 'strong' });
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'GET only' });

  const jobId = (event.queryStringParameters || {}).jobId;
  if (!jobId) return json(400, { ok: false, error: 'jobId query param required' });

  try {
    const store = openStore();
    const data = await store.get(jobId, { type: 'json' });
    if (!data) return json(404, { ok: false, error: 'job not found', jobId });
    return json(200, { ok: true, jobId, ...data });
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
