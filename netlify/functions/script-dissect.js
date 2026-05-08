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

  // Fire background function. Netlify auto-routes -background functions
  // and returns 202 to caller; the function then runs up to 15 min.
  const proto = event.headers['x-forwarded-proto'] || 'https';
  const host = event.headers.host || 'markcmo.com';
  const bgUrl = `${proto}://${host}/.netlify/functions/script-dissect-background`;

  // Netlify returns 202 immediately for -background functions, so awaiting
  // is fast (~50ms). Without await, lambda shutdown kills the in-flight fetch.
  try {
    const r = await fetch(bgUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jobId, ...body })
    });
    if (r.status !== 202 && !r.ok) {
      return json(500, { ok: false, error: 'Background trigger failed: HTTP ' + r.status });
    }
  } catch (e) {
    return json(500, { ok: false, error: 'Background trigger error: ' + e.message });
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
