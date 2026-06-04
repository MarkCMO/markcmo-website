// GET /auth/tiktok/callback?code=...&state=...  (hosted on markcmo.com)
// Validates CSRF state, exchanges the code, stores the connected TikTok account
// in the shared MarkChat social_accounts table.
import { exchangeCode, getCreatorInfo } from "../../_lib/social-tiktok.mjs";
import { saveAccount } from "../../_lib/social-tokens.mjs";
import { redirectUri, readCookie, clearStateCookie, resultPage } from "../../_lib/social-oauth.mjs";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const clear = clearStateCookie("tt_oauth_state");
  const html = (r) => new Response(resultPage(r).body, {
    status: r.ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "Set-Cookie": clear },
  });

  if (err) return html({ ok: false, platform: "TikTok", detail: `TikTok returned: ${err}` });
  if (!code) return html({ ok: false, platform: "TikTok", detail: "No authorization code returned." });

  const cookieState = readCookie(request, "tt_oauth_state");
  if (!state || !cookieState || state !== cookieState) {
    return html({ ok: false, platform: "TikTok", detail: "Security check failed (state mismatch). Try connecting again." });
  }

  try {
    const tok = await exchangeCode({
      clientKey: env.TIKTOK_CLIENT_KEY,
      clientSecret: env.TIKTOK_CLIENT_SECRET,
      code,
      redirectUri: redirectUri(env, request, "tiktok"),
    });

    let username = null, avatar = null;
    try {
      const info = await getCreatorInfo({ accessToken: tok.access_token });
      username = info.display_name || null;
      avatar = info.avatar_url || null;
    } catch { /* non-fatal */ }

    await saveAccount(env, {
      platform: "tiktok",
      external_id: tok.open_id || "self",
      username,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token || null,
      token_expires_at: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000).toISOString() : null,
      refresh_expires_at: tok.refresh_expires_in ? new Date(Date.now() + tok.refresh_expires_in * 1000).toISOString() : null,
      scope: tok.scope || null,
      meta: avatar ? { avatar_url: avatar } : {},
      status: "connected",
      last_error: null,
    });

    return html({ ok: true, platform: "TikTok", detail: `Connected${username ? " as " + username : ""}. Scheduled videos will now post to TikTok.` });
  } catch (e) {
    return html({ ok: false, platform: "TikTok", detail: String(e.message || e) });
  }
}
