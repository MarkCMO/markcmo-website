/**
 * functions/scheduled.js
 * Handles Cloudflare cron triggers (wrangler.toml [triggers].crons).
 * Mirrors the four Netlify scheduled functions from netlify.toml.
 *
 * Cron schedule mapping:
 *   "0 * * * *"     → email-drip              (every hour)
 *   "0 *\/6 * * *"  → engagement-payment-followups + film-rolodex-cron (every 6 hrs)
 *   "0 9 * * *"     → film-rolodex-deep-cron  (daily 09:00 UTC)
 */

import emailDripMod                  from '../netlify/functions/email-drip.js';
import engagementFollowupsMod        from '../netlify/functions/engagement-payment-followups.js';
import filmRolodexCronMod            from '../netlify/functions/film-rolodex-cron.js';
import filmRolodexDeepCronMod        from '../netlify/functions/film-rolodex-deep-cron.js';

function h(mod) {
  return mod && (mod.handler || mod.default?.handler);
}

function bridgeEnv(cfEnv) {
  for (const [k, v] of Object.entries(cfEnv)) {
    if (typeof v === 'string') process.env[k] = v;
  }
}

function makeEvent(httpMethod = 'GET') {
  return {
    httpMethod,
    path: '/',
    queryStringParameters: {},
    multiValueQueryStringParameters: {},
    headers: {},
    body: null,
    isBase64Encoded: false,
  };
}

function makeContext(fnName) {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: fnName,
    functionVersion: '$LATEST',
    invokedFunctionArn: '',
    memoryLimitInMB: '1024',
    awsRequestId: crypto.randomUUID(),
    logGroupName: `/cron/${fnName}`,
    logStreamName: '',
    getRemainingTimeInMillis: () => 26000,
  };
}

async function runHandler(mod, name, env) {
  bridgeEnv(env);
  const handler = h(mod);
  if (!handler) { console.error(`[scheduled] No handler found in ${name}`); return; }
  try {
    const result = await new Promise((resolve, reject) => {
      const ret = handler(makeEvent(), makeContext(name), (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
      if (ret && typeof ret.then === 'function') ret.then(resolve).catch(reject);
    });
    console.log(`[scheduled][${name}] done`, JSON.stringify(result).slice(0, 200));
  } catch (err) {
    console.error(`[scheduled][${name}] error:`, err.message);
  }
}

export async function scheduled(event, env, ctx) {
  const cron = event.cron;
  console.log(`[scheduled] cron="${cron}"`);

  if (cron === '0 * * * *') {
    // Every hour: email-drip
    await runHandler(emailDripMod, 'email-drip', env);
  } else if (cron === '0 */6 * * *') {
    // Every 6 hours: engagement followups + film rolodex sync
    await Promise.allSettled([
      runHandler(engagementFollowupsMod, 'engagement-payment-followups', env),
      runHandler(filmRolodexCronMod,     'film-rolodex-cron',            env),
    ]);
  } else if (cron === '0 9 * * *') {
    // Daily 09:00 UTC: deep website crawl
    await runHandler(filmRolodexDeepCronMod, 'film-rolodex-deep-cron', env);
  } else {
    console.warn(`[scheduled] Unknown cron: ${cron}`);
  }
}
