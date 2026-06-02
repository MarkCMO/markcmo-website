// GET /auth/facebook/callback?code=...&state=...  (hosted on markcmo.com)
// Exchanges code -> long-lived user token -> Page's never-expiring page token,
// and stores the connected Facebook Page in the shared social_accounts table.
import { exchangeCode, exchangeLongLivedUserToken, listPages } from "../../_lib/social-facebook.mjs";
import { saveAccount } from "../../_lib/social-tokens.mjs";
import { redirectUri, readCookie, clearStateCookie, resultPage } from "../../_lib/social-oauth.mjs";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error_description") || url.searchParams.get("error");
  const clear = clearStateCookie("fb_oauth_state");
  const html = (r) => new Response(resultPage(r).body, {
    status: r.ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "Set-Cookie": clear },
  });

  if (err) return html({ ok: false, platform: "Facebook", detail: `Facebook returned: ${err}` });
  if (!code) return html({ ok: false, platform: "Facebook", detail: "No authorization code returned." });

  const cookieState = readCookie(request, "fb_oauth_state");
  if (!state || !cookieState || state !== cookieState) {
    return html({ ok: false, platform: "Facebook", detail: "Security check failed (state mismatch). Try again." });
  }

  try {
    const short = await exchangeCode({
      appId: env.FB_APP_ID, appSecret: env.FB_APP_SECRET, code,
      redirectUri: redirectUri(env, request, "facebook"),
    });
    const long = await exchangeLongLivedUserToken({
      appId: env.FB_APP_ID, appSecret: env.FB_APP_SECRET, shortToken: short.access_token,
    });
    const pages = await listPages({ userToken: long.access_token });
    if (!pages.length) {
      return html({ ok: false, platform: "Facebook", detail: "No Pages found. Make sure you are an admin of the Page and granted Page access." });
    }
    // Prefer the exact Page ID (business-owned pages are safest matched by id),
    // then by name, then first.
    const wantId = String(env.FB_PAGE_ID || "").trim();
    const wantName = (env.FB_PAGE_NAME || "").toLowerCase();
    const page = (wantId && pages.find((p) => String(p.id) === wantId))
      || (wantName && pages.find((p) => (p.name || "").toLowerCase() === wantName))
      || pages[0];

    await saveAccount(env, {
      platform: "facebook",
      external_id: page.id,
      username: page.name || null,
      access_token: page.access_token,
      refresh_token: null,
      token_expires_at: null,
      refresh_expires_at: null,
      scope: env.FB_SCOPES || "pages_show_list,pages_manage_posts,pages_read_engagement",
      meta: { user_token_expires_in: long.expires_in || null, pages: pages.map((p) => ({ id: p.id, name: p.name })) },
      status: "connected",
      last_error: null,
    });

    return html({ ok: true, platform: "Facebook", detail: `Connected Page "${page.name}". Scheduled videos will now cross-post to Facebook.` });
  } catch (e) {
    return html({ ok: false, platform: "Facebook", detail: String(e.message || e) });
  }
}
