// WETYR Studios - Script Dissect KICKOFF
//
// Generates a jobId, fires the background function (which has up to 15 min
// to complete), returns 202 + jobId immediately. Client polls /script-result
// for status.
//
// POST { scriptText, title?, format? }
// -> { ok: true, jobId, status: 'processing' }

const { getStore } = require('@netlify/blobs');

function openStore() {
  try {
    return getStore({ name: 'wetyr-jobs', consistency: 'strong' });
  } catch (e) {
    const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID || '609d74ca-5f2a-4caa-aa7c-3f6922a7bcb4';
    const token = process.env.NETLIFY_TOKEN || process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
    if (!token) throw new Error('Blobs unavailable; set NETLIFY_TOKEN PAT on site or upgrade context');
    return getStore({ name: 'wetyr-jobs', siteID, token, consistency: 'strong' });
  }
}

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
    const store = openStore();
    await store.setJSON(jobId, {
      status: 'processing',
      kind: 'dissect',
      title: body.title || 'Untitled',
      createdAt: new Date().toISOString(),
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

  // Don't await - fire and forget. Background fn picks up the work.
  fetch(bgUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jobId, ...body })
  }).catch(() => { /* logged on Netlify side, job state will reflect failure */ });

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
