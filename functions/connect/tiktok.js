// GET /connect/tiktok  -> start the TikTok OAuth flow (hosted on markcmo.com).
import { buildAuthorizeUrl } from "../_lib/social-tiktok.mjs";
import { redirectUri, makeState, stateCookie, redirect } from "../_lib/social-oauth.mjs";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.TIKTOK_CLIENT_KEY) {
    return new Response("TIKTOK_CLIENT_KEY not configured", { status: 500 });
  }
  const state = makeState();
  const url = buildAuthorizeUrl({
    clientKey: env.TIKTOK_CLIENT_KEY,
    redirectUri: redirectUri(env, request, "tiktok"),
    state,
    scopes: env.TIKTOK_SCOPES || "user.info.basic,video.upload",
  });
  return redirect(url, { "Set-Cookie": stateCookie("tt_oauth_state", state) });
}
