// WETYR Studios - Call Sheet KICKOFF
// Async: queues a job, fires the -background worker, returns 202 + jobId.
// Client polls /script-result?jobId=X.

const { kickoffJob } = require('./_wetyr_jobs');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'POST only' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { ok: false, error: 'Invalid JSON' }); }

  if (!body.breakdown) return json(400, { ok: false, error: 'breakdown required' });
  if (!body.schedule || !body.schedule.days?.length) return json(400, { ok: false, error: 'schedule.days required' });

  try {
    const jobId = await kickoffJob({
      kind: 'callsheet',
      proto: event.headers['x-forwarded-proto'] || 'https',
      host: event.headers.host || 'markcmo.com',
      body
    });
    return json(202, { ok: true, jobId, status: 'processing' });
  } catch (e) {
    return json(500, { ok: false, error: String(e.message || e) });
  }
};

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type'
  };
}
function json(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json', ...cors() }, body: JSON.stringify(body) };
}
