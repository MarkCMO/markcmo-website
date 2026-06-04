// functions/api/daily-content-email.js — native Cloudflare Pages Function.
// Daily 6am-ET content email. No Netlify.
import { handleDaily } from '../_lib/daily-email.mjs';

export async function onRequest(context) {
  const r = await handleDaily(context);
  return new Response(r.body, { status: r.status, headers: r.headers });
}
