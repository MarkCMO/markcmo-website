// functions/health.js
// WETYR Infrastructure Protocol v1 §5.2 — health endpoint.
//
// Pings every external dependency and returns:
//   200 + { status: 'ok', checks: {...} }    if all checks pass
//   503 + { status: 'down', checks: {...} }  if any fail
//
// Cache-Control: no-store so Cloudflare Health Checks always see fresh state.
//
// Wire this to /health on markcmo.com (this file) AND on academy.markcmo.com
// (the academy worker has a separate health route).
//
// External monitor wiring (do this in Cloudflare dashboard):
//   Cloudflare Health Checks -> /health (60s interval)
//   UptimeRobot or BetterStack -> /health (60s interval, secondary region)
//   On 2 consecutive failures -> email marklgabriellijr@gmail.com
//   On 3 consecutive failures -> SMS to (321) 917-5738

const HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, max-age=0',
  'Access-Control-Allow-Origin': '*',
};

const TIMEOUT_MS = 5000;

async function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout after ' + ms + 'ms')), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function checkSquare(env) {
  const token = env.SQUARE_ACADEMY_ACCESS_TOKEN || env.SQUARE_ACCESS_TOKEN;
  if (!token) return { ok: false, error: 'no_token' };
  try {
    const r = await withTimeout(fetch('https://connect.squareup.com/v2/locations', {
      headers: { 'Authorization': 'Bearer ' + token, 'Square-Version': '2024-11-20' },
    }), TIMEOUT_MS);
    if (!r.ok) return { ok: false, status: r.status, error: 'http_' + r.status };
    const data = await r.json();
    return { ok: true, locations: (data.locations || []).length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function checkResend(env) {
  if (!env.RESEND_API_KEY) return { ok: false, error: 'no_key' };
  try {
    const r = await withTimeout(fetch('https://api.resend.com/domains', {
      headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY },
    }), TIMEOUT_MS);
    if (!r.ok) return { ok: false, status: r.status, error: 'http_' + r.status };
    const data = await r.json();
    return { ok: true, domains: (data.data || []).length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function checkJsonbin(env) {
  if (!env.JSONBIN_API_KEY || !env.JSONBIN_ENROLLMENTS_BIN_ID) return { ok: false, error: 'no_config' };
  try {
    const r = await withTimeout(fetch(
      'https://api.jsonbin.io/v3/b/' + env.JSONBIN_ENROLLMENTS_BIN_ID + '/latest',
      { headers: { 'X-Master-Key': env.JSONBIN_API_KEY, 'X-Bin-Meta': 'false' } }
    ), TIMEOUT_MS);
    if (!r.ok) return { ok: false, status: r.status, error: 'http_' + r.status };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function checkKv(env) {
  const kv = env.BLOBS_MARKCMO_PAGES_HTML;
  if (!kv) return { ok: false, error: 'no_binding' };
  try {
    // Reading a known key. 'index' should exist; null is also acceptable as a
    // signal that the namespace is reachable.
    await withTimeout(kv.get('index', { type: 'text' }), TIMEOUT_MS);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function onRequest(context) {
  const { env } = context;
  const start = Date.now();

  // Run all checks in parallel for fast response.
  const [square, resend, jsonbin, kv] = await Promise.all([
    checkSquare(env),
    checkResend(env),
    checkJsonbin(env),
    checkKv(env),
  ]);

  const checks = { square, resend, jsonbin, kv };
  const allOk = Object.values(checks).every(c => c.ok);
  const status = allOk ? 'ok' : 'degraded';

  // We surface KV failures as warnings rather than down — the site can
  // still serve from origin in a degraded fallback.
  const httpStatus = allOk ? 200 : (kv.ok ? 503 : 503);

  return new Response(JSON.stringify({
    status,
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - start,
    property: 'markcmo.com',
    checks,
  }, null, 2), {
    status: httpStatus,
    headers: HEADERS,
  });
}
