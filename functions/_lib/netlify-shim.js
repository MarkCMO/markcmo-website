// netlify-shim.js
// Compatibility shim that lets existing Netlify Functions run unchanged
// on Cloudflare Pages Functions. Each per-route Pages Function file
// imports its single Netlify handler module statically and calls
// `dispatchSingle(mod, context)`. That keeps each Pages bundle small
// (under the 25 MiB Worker cap).

import * as blobsCompat from './blobs.js';

function hydrateProcessEnv(env) {
  try {
    if (typeof process === 'undefined') {
      globalThis.process = { env: {} };
    } else if (!process.env) {
      process.env = {};
    }
    for (const [k, v] of Object.entries(env || {})) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        process.env[k] = String(v);
      }
    }
    blobsCompat._installKvBindings(env);
  } catch (e) {
    console.warn('hydrateProcessEnv failed:', e.message);
  }
}

async function buildNetlifyEvent(context) {
  const { request, params } = context;
  const url = new URL(request.url);
  const headers = {};
  request.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  const queryStringParameters = {};
  url.searchParams.forEach((v, k) => { queryStringParameters[k] = v; });

  let body = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try { body = await request.text(); } catch (_) { body = null; }
  }

  return {
    path: url.pathname,
    rawUrl: request.url,
    httpMethod: request.method,
    headers,
    queryStringParameters,
    body,
    isBase64Encoded: false,
    _cloudflare: { params, request, executionContext: context }
  };
}

// Dispatch a pre-imported Netlify function module.
// Per-route Pages Function files (functions/api/<name>.js etc.) call this.
export async function dispatchSingle(mod, context) {
  hydrateProcessEnv(context.env || {});
  const event = await buildNetlifyEvent(context);

  const handler = (mod && (mod.handler || (mod.default && mod.default.handler)));
  if (typeof handler !== 'function') {
    return new Response(JSON.stringify({ error: 'No exports.handler' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let result;
  try {
    result = await handler(event, {});
  } catch (err) {
    console.error('handler error:', err && err.stack || err);
    return new Response(JSON.stringify({ error: 'Function crashed', detail: String(err && err.message || err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!result) return new Response('', { status: 204 });

  const status = result.statusCode || 200;
  const headers = new Headers(result.headers || {});
  const body = result.body == null ? '' : result.body;
  return new Response(body, { status, headers });
}

// Cron worker invokes scheduled handlers via HTTP /api/<name> with
// X-Netlify-Scheduled: true header, so each handler's existing
// isScheduled check fires the same way it did on Netlify.
