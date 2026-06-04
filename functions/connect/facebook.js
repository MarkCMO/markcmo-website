// GET /connect/facebook  -> start the Facebook Page OAuth flow (markcmo.com).
import { buildAuthorizeUrl } from "../_lib/social-facebook.mjs";
import { redirectUri, makeState, stateCookie, redirect } from "../_lib/social-oauth.mjs";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.FB_APP_ID) {
    return new Response("FB_APP_ID not configured", { status: 500 });
  }
  const state = makeState();
  const url = buildAuthorizeUrl({
    appId: env.FB_APP_ID,
    redirectUri: redirectUri(env, request, "facebook"),
    state,
    scopes: env.FB_SCOPES || "pages_show_list,pages_manage_posts,pages_read_engagement",
  });
  return redirect(url, { "Set-Cookie": stateCookie("fb_oauth_state", state) });
}
