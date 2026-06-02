// functions/api/ig-token-refresh.js — native Cloudflare Pages Function.
// Extends a long-lived Instagram-Login token (~60 more days) and stores the
// fresh token in KV so ig-autopost picks it up. @officialmarkcmo uses an
// "Instagram API with Instagram Login" token (IGAA…), which self-refreshes via
// the ig_refresh_token grant on graph.instagram.com — no app id/secret required.
// A token must be at least 24h old and unexpired to refresh.
//
// Invoked daily by the CF cron worker. Manual: GET ?key=<CRON_SHARED_SECRET>
//
// Env: IG_ACCESS_TOKEN (current), AUTOPOST_KV (binding, holds rotated token)

import { refreshLongLivedToken } from '../_lib/ig-poster.mjs';

export async function onRequest(context) {
  const { request, env } = context;
  const q = Object.fromEntries(new URL(request.url).searchParams);
  const secret = env.CRON_SHARED_SECRET || '';
  const provided = request.headers.get('x-cron-secret') || q.key || '';
  if (secret && provided !== secret) return json(403, { error: 'forbidden' });

  const current = (env.AUTOPOST_KV && await env.AUTOPOST_KV.get('ig_token')) || env.IG_ACCESS_TOKEN;
  if (!current) return json(503, { error: 'no current token to refresh' });

  try {
    const data = await refreshLongLivedToken({ token: current });
    if (env.AUTOPOST_KV && data.access_token) {
      await env.AUTOPOST_KV.put('ig_token', data.access_token);
    }
    return json(200, { ok: true, refreshed: !!data.access_token, expiresInDays: data.expires_in ? Math.round(data.expires_in / 86400) : null });
  } catch (err) {
    return json(502, { error: 'refresh failed', detail: err && err.message });
  }
}

function json(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
