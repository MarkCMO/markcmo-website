// WETYR Studios - Script Dissect KICKOFF
//
// Generates a jobId, fires the background function (which has up to 15 min
// to complete), returns 202 + jobId immediately. Client polls /script-result
// for status.
//
// POST { scriptText, title?, format? }
// -> { ok: true, jobId, status: 'processing' }

const { setJob } = require('./_wetyr_jobs');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'POST only' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { ok: false, error: 'Invalid JSON' }); }

  const scriptText = (body.scriptText || '').trim();
  if (!scriptText) return json(400, { ok: false, error: 'scriptText required' });
  if (scriptText.length > 1500000) return json(413, { ok: false, error: 'Script too large (>1.5M chars).' });

  const jobId = randomId();

  // Mark job as queued so polling sees it immediately.
  try {
    await setJob(jobId, {
      status: 'processing',
      kind: 'dissect',
      title: body.title || 'Untitled',
      progress: 'queued'
    });
  } catch (e) {
    return json(500, { ok: false, error: 'Failed to queue job: ' + e.message });
  }

  // Cloudflare Pages can't reliably do inter-function fetch loopbacks (returns
  // 405 to the kickoff's POST against /.netlify/functions/X-background).
  // Directly invoke the background handler in-process via require(). Await to
  // keep the function alive for the work duration; bg writes progress + final
  // status to Supabase. Client polls /script-result for the same jobId.
  try {
    const bgHandler = require('./script-dissect-background').handler;
    await bgHandler({
      httpMethod: 'POST',
      body: JSON.stringify({ jobId, ...body }),
      headers: { 'content-type': 'application/json' }
    });
  } catch (e) {
    return json(500, { ok: false, error: 'Background invocation failed: ' + (e.message || e) });
  }

  return json(202, { ok: true, jobId, status: 'processing' });
};

function randomId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

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
