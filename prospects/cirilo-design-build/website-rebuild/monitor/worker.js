// Cirilo uptime monitor - a scheduled Cloudflare Worker (separate from Pages,
// because Pages Functions cannot self-schedule). On its cron it pings the live
// /api/health endpoint, records the result to /api/uptime-record, and posts an
// alert to an optional webhook when the check fails.
//
// Deploy from this folder:
//   cd monitor
//   set -a && . ~/.cloudflare-global.env && set +a
//   npx wrangler deploy
//   npx wrangler secret put CDB_MONITOR_SECRET     # same value set on the Pages project
//   npx wrangler secret put CDB_ALERT_WEBHOOK      # optional Slack/Discord/webhook URL
//
// Manual test after deploy: open the worker's URL in a browser (the fetch
// handler runs the same check on demand and returns JSON).

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCheck(env));
  },
  async fetch(request, env) {
    var result = await runCheck(env);
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  }
};

async function runCheck(env) {
  var base = (env.CDB_HEALTH_URL || 'https://cirilodb-rebuild.pages.dev').replace(/\/$/, '');
  var url = base + '/api/health';
  var t0 = Date.now();
  var ok = false, mode = null, status = 0, body = null;
  try {
    var r = await fetch(url, { cf: { cacheTtl: 0 } });
    status = r.status;
    body = await r.json().catch(function () { return null; });
    ok = r.ok && body && body.ok !== false;
    mode = body && body.mode;
  } catch (e) { ok = false; body = { error: String(e) }; }
  var latency = Date.now() - t0;

  // Record the result (best effort).
  try {
    await fetch(base + '/api/uptime-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cdb-monitor': env.CDB_MONITOR_SECRET || '' },
      body: JSON.stringify({ ok: ok, mode: mode, latency_ms: latency, detail: { status: status, checks: body && body.checks } })
    });
  } catch (e) { /* best effort */ }

  // Alert on failure (best effort).
  if (!ok && env.CDB_ALERT_WEBHOOK) {
    try {
      await fetch(env.CDB_ALERT_WEBHOOK, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Cirilo site health check FAILED. status=' + status + ' url=' + url + ' latency=' + latency + 'ms' })
      });
    } catch (e) { /* best effort */ }
  }

  return { ok: ok, status: status, latency_ms: latency, mode: mode };
}
