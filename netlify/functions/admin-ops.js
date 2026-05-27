// netlify/functions/admin-ops.js
//
// WETYR Infrastructure Protocol v1 — admin Ops dashboard data feed.
// Returns aggregated system health state for /admin#ops:
//   - /health endpoint result for both properties
//   - All cron heartbeats with staleness flag
//   - Last 20 errors from the central error log
//   - Last 50 webhook events (with idempotency status)
//   - Ops registry state (bin IDs, host bin)
//
// Admin-cookie gated. Read-only. Safe to call frequently from the browser.

const COOKIE_NAME = 'mcadmin_session';
const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://markcmo.com',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
};

// HMAC token verify (mirrors admin-auth.js)
async function verifyToken(token, secret) {
  try {
    const [dataB64, sigB64] = token.split('.');
    if (!dataB64 || !sigB64) return null;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sig = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const ok = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(dataB64));
    if (!ok) return null;
    const payload = JSON.parse(atob(dataB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}

function parseCookies(h) {
  const out = {};
  (h || '').split(';').forEach(p => {
    const [k, ...v] = p.trim().split('=');
    if (k) out[k.trim()] = decodeURIComponent(v.join('='));
  });
  return out;
}

// JSONBin helpers (we read ops bins by ID rather than importing _lib_ops
// because this function lives in the markcmo.com repo, not the academy
// worker. Bin IDs come from the ops registry or env vars).
const JSONBIN_API_BASE = 'https://api.jsonbin.io/v3/b';

async function jbGet(binId) {
  if (!binId || !process.env.JSONBIN_API_KEY) return null;
  try {
    const r = await fetch(`${JSONBIN_API_BASE}/${binId}/latest`, {
      headers: {
        'X-Master-Key': process.env.JSONBIN_API_KEY,
        'X-Bin-Meta': 'false',
        'User-Agent': 'wetyr-ops-admin/1',
      },
    });
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

// Look up ops bin IDs from registry or env. Same logic as _lib_ops.js.
async function getOpsBins() {
  // Direct env var override
  const env = {
    webhook_events: process.env.JSONBIN_WEBHOOK_EVENTS_BIN_ID,
    heartbeats:     process.env.JSONBIN_HEARTBEATS_BIN_ID,
    error_log:      process.env.JSONBIN_ERROR_LOG_BIN_ID,
  };
  if (env.webhook_events && env.heartbeats && env.error_log) return env;

  // Fall back to the ops_registry stored inside the enrollments bin
  const hostBin = process.env.JSONBIN_OPS_REGISTRY_BIN_ID
                || process.env.JSONBIN_ENROLLMENTS_BIN_ID;
  if (!hostBin) return env;
  const data = await jbGet(hostBin);
  const registry = (data && data._ops_registry) || {};
  return {
    webhook_events: env.webhook_events || registry.webhook_events || null,
    heartbeats:     env.heartbeats     || registry.heartbeats     || null,
    error_log:      env.error_log      || registry.error_log      || null,
  };
}

async function checkHealth(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'wetyr-ops-admin/1' } });
    const body = await r.json().catch(() => null);
    return { ok: r.ok, status: r.status, data: body };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  // ── Auth ────────────────────────────────────────────────────────────
  const cookies = parseCookies(event.headers.cookie || event.headers.Cookie || '');
  const token = cookies[COOKIE_NAME];
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.TOKEN_SECRET || 'fallback';
  const payload = token ? await verifyToken(token, secret) : null;
  if (!payload) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Not authenticated' }) };
  }

  try {
    const opsBins = await getOpsBins();

    // Parallel: health checks + ops state
    const [
      markcmoHealth, academyHealth,
      heartbeatsData, errorData, webhookData,
    ] = await Promise.all([
      checkHealth('https://markcmo.com/health'),
      checkHealth('https://academy.markcmo.com/health'),  // may 404 if academy doesn't have health endpoint yet
      jbGet(opsBins.heartbeats),
      jbGet(opsBins.error_log),
      jbGet(opsBins.webhook_events),
    ]);

    const heartbeats = (heartbeatsData && (heartbeatsData.heartbeats || heartbeatsData.record?.heartbeats)) || {};
    const errors     = (errorData && (errorData.errors || errorData.record?.errors)) || [];
    const events     = (webhookData && (webhookData.events || webhookData.record?.events)) || [];

    // Compute staleness flag per heartbeat
    const now = Date.now();
    const heartbeatsAnnotated = Object.entries(heartbeats).map(([name, hb]) => {
      const interval = hb.expected_interval_minutes || 60;
      const ageMin = Math.round((now - new Date(hb.last_run_at).getTime()) / 60000);
      return {
        name,
        last_run_at: hb.last_run_at,
        age_minutes: ageMin,
        expected_interval_minutes: interval,
        stale: ageMin > interval * 2,
        last_status: hb.last_status,
        last_error: hb.last_error || null,
        last_duration_ms: hb.last_duration_ms || null,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    const recentErrors = errors.slice(0, 20).map(e => ({
      id: e.id,
      property: e.property,
      source: e.source,
      error_type: e.error_type,
      error_message: e.error_message,
      created_at: e.created_at,
    }));

    const recentEvents = events.slice(0, 50).map(e => ({
      event_id: e.event_id,
      property: e.property,
      event_type: e.event_type,
      processed_at: e.processed_at,
    }));

    // Error rate windows
    const fiveMinAgo = now - 5 * 60 * 1000;
    const errorsLast5min = errors.filter(e => new Date(e.created_at).getTime() > fiveMinAgo).length;
    const errorsLast24h  = errors.filter(e => new Date(e.created_at).getTime() > now - 24*60*60*1000).length;

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        generated_at: new Date().toISOString(),
        health: {
          markcmo: markcmoHealth,
          academy: academyHealth,
        },
        heartbeats: heartbeatsAnnotated,
        errors: {
          recent: recentErrors,
          count_last_5min: errorsLast5min,
          count_last_24h: errorsLast24h,
        },
        webhook_events: {
          recent: recentEvents,
          count: events.length,
        },
        ops_bins: {
          webhook_events: opsBins.webhook_events ? 'configured' : 'not yet created',
          heartbeats:     opsBins.heartbeats     ? 'configured' : 'not yet created',
          error_log:      opsBins.error_log      ? 'configured' : 'not yet created',
        },
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: String(err.message || err) }) };
  }
};
