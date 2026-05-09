// cloudflare/cron-worker.js
// Cron-trigger fan-out worker for MarkCMO.
//
// Maps each Netlify scheduled function to its cron expression. On each
// scheduled tick, fetches the corresponding Pages function URL with a
// shared secret header. The function handlers don't need to know they
// were cron-fired vs HTTP-fired - they just do their work.

const CRON_TO_FUNCTIONS = {
  '0 * * * *':     ['email-drip'],
  '0 */6 * * *':   ['engagement-payment-followups', 'film-rolodex-cron'],
  '0 9 * * *':     ['film-rolodex-deep-cron'],
};

export default {
  async scheduled(event, env, ctx) {
    const fns = CRON_TO_FUNCTIONS[event.cron] || [];
    if (!fns.length) {
      console.warn('No functions mapped to cron', event.cron);
      return;
    }
    const base = env.PAGES_BASE_URL || 'https://markcmo.com';
    const secret = env.CRON_SHARED_SECRET || '';

    const tasks = fns.map(async (fn) => {
      // Both /api/<fn> and /.netlify/functions/<fn> work; using the
      // legacy path for max compat with existing handlers.
      const url = `${base}/.netlify/functions/${fn}`;
      const start = Date.now();
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'X-Cron-Secret': secret,
            'X-Netlify-Scheduled': 'true',
            'Content-Type': 'application/json',
            'User-Agent': 'markcmo-cron-worker/1.0'
          },
          body: JSON.stringify({ cron: event.cron, scheduledTime: event.scheduledTime })
        });
        const ms = Date.now() - start;
        console.log(`cron ${event.cron} -> ${fn}: ${res.status} ${ms}ms`);
      } catch (err) {
        console.error(`cron ${event.cron} -> ${fn} failed:`, err && err.message || err);
      }
    });
    ctx.waitUntil(Promise.all(tasks));
  },

  // Manual trigger for testing:
  //   curl -X POST -H "X-Cron-Secret: $S" https://markcmo-cron.<acct>.workers.dev/run/email-drip
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname.startsWith('/run/')) {
      const provided = request.headers.get('X-Cron-Secret') || '';
      if (!env.CRON_SHARED_SECRET || provided !== env.CRON_SHARED_SECRET) {
        return new Response('forbidden', { status: 403 });
      }
      const fn = url.pathname.replace('/run/', '');
      const target = `${env.PAGES_BASE_URL || 'https://markcmo.com'}/.netlify/functions/${fn}`;
      const res = await fetch(target, {
        method: 'POST',
        headers: {
          'X-Cron-Secret': env.CRON_SHARED_SECRET,
          'X-Netlify-Scheduled': 'true',
          'Content-Type': 'application/json'
        },
        body: '{"manual":true}'
      });
      return new Response(`${fn}: ${res.status}\n`, { status: 200 });
    }
    return new Response('markcmo-cron-worker - POST /run/<funcname> with X-Cron-Secret\n', { status: 200 });
  }
};
