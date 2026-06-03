// cloudflare/cron-worker.js - MarkCMO cron fan-out worker
const CRON_TO_FUNCTIONS = {
  '0 */6 * * *': ['engagement-payment-followups', 'film-rolodex-cron'],
  '0 * * * *':   ['email-drip', 'daily-content-email', 'ig-autopost'],
  '0 9 * * *':   ['film-rolodex-deep-cron', 'health-check', 'ig-token-refresh'],
};

export default {
  async scheduled(event, env, ctx) {
    const fns = CRON_TO_FUNCTIONS[event.cron] || [];
    if (!fns.length) { console.warn('No functions mapped to cron', event.cron); return; }
    const base = env.PAGES_BASE_URL || 'https://markcmo.com';
    const secret = env.CRON_SHARED_SECRET || '';
    const tasks = fns.map(async (fn) => {
      try {
        const res = await fetch(`${base}/api/${fn}`, {
          method: 'POST',
          headers: { 'X-Cron-Secret': secret, 'X-Netlify-Scheduled': 'true', 'Content-Type': 'application/json', 'User-Agent': 'markcmo-cron-worker/1.0' },
          body: JSON.stringify({ cron: event.cron, scheduledTime: event.scheduledTime })
        });
        console.log(`cron ${event.cron} -> ${fn}: ${res.status}`);
      } catch (err) { console.error(`cron -> ${fn} failed:`, err && err.message); }
    });
    ctx.waitUntil(Promise.all(tasks));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname.startsWith('/run/')) {
      const provided = request.headers.get('X-Cron-Secret') || '';
      if (!env.CRON_SHARED_SECRET || provided !== env.CRON_SHARED_SECRET) return new Response('forbidden', { status: 403 });
      const fn = url.pathname.replace('/run/', '');
      const res = await fetch(`${env.PAGES_BASE_URL || 'https://markcmo.com'}/api/${fn}`, { method: 'POST', headers: { 'X-Cron-Secret': env.CRON_SHARED_SECRET, 'X-Netlify-Scheduled': 'true', 'Content-Type': 'application/json' }, body: '{"manual":true}' });
      return new Response(`${fn}: ${res.status}\n`);
    }
    return new Response('markcmo-cron-worker - POST /run/<funcname> with X-Cron-Secret\n');
  }
};
