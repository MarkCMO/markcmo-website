// TikTok Content Posting API + OAuth helper for Cloudflare Pages / Workers (ESM).
//
// OAuth (Login Kit): user authorizes -> we get a code -> exchange for an access
// token (~24h) + refresh token (~365d). Store the refresh token; mint a fresh
// access token before each post.
//
// Posting reality:
//   - uploadDraft() sends the video to the creator's TikTok inbox as a DRAFT.
//     Works for UNAUDITED apps (scope video.upload). The creator opens TikTok and
//     taps post. This is what we use until the app passes TikTok audit.
//   - directPost() posts straight to the profile. Needs an AUDITED app +
//     video.publish; until audit TikTok forces SELF_ONLY.
//   - PULL_FROM_URL requires the MP4 host domain to be verified as a URL-prefix
//     property in the TikTok dev portal.

const API = "https://open.tiktokapis.com/v2";
const OAUTH = "https://open.tiktokapis.com/v2/oauth/token/";
const AUTHORIZE = "https://www.tiktok.com/v2/auth/authorize/";
const DEFAULT_SCOPES = "user.info.basic,video.upload";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Build the URL we redirect the creator to in order to grant access.
export function buildAuthorizeUrl({ clientKey, redirectUri, state, scopes = DEFAULT_SCOPES }) {
  const qs = new URLSearchParams({
    client_key: clientKey,
    scope: scopes,
    response_type: "code",
    redirect_uri: redirectUri,
    state: state || "",
  });
  return `${AUTHORIZE}?${qs.toString()}`;
}

// Exchange the authorization code for tokens (called on the OAuth callback).
export async function exchangeCode({ clientKey, clientSecret, code, redirectUri }) {
  const res = await fetch(OAUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(`tiktok code exchange: ${data.error_description || data.error || res.status}`);
  }
  return data; // { access_token, refresh_token, open_id, scope, expires_in, refresh_expires_in, ... }
}

// Mint a fresh access token from a stored refresh token.
export async function refreshToken({ clientKey, clientSecret, refreshToken }) {
  if (!clientKey || !clientSecret || !refreshToken) throw new Error("missing client key/secret/refresh token");
  const res = await fetch(OAUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(`tiktok refresh: ${data.error_description || data.error || res.status}`);
  }
  return data; // { access_token, refresh_token, expires_in, refresh_expires_in, ... }
}

// Read the creator's basic profile (open_id, display name, avatar) for the UI.
export async function getCreatorInfo({ accessToken }) {
  const res = await fetch(`${API}/user/info/?fields=open_id,display_name,avatar_url`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (data.error && data.error.code && data.error.code !== "ok") {
    throw new Error(`tiktok user info: ${data.error.message || data.error.code}`);
  }
  return (data.data && data.data.user) || {};
}

// DRAFT to inbox (unaudited-safe). The creator finishes posting in the app.
export async function uploadDraft({ accessToken, videoUrl, caption }) {
  if (!accessToken) throw new Error("missing accessToken");
  if (!videoUrl) throw new Error("missing videoUrl");
  const res = await fetch(`${API}/post/publish/inbox/video/init/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({ source_info: { source: "PULL_FROM_URL", video_url: videoUrl } }),
  });
  const data = await res.json().catch(() => ({}));
  if (data.error && data.error.code && data.error.code !== "ok") {
    throw new Error(`tiktok inbox init: ${data.error.message || data.error.code}`);
  }
  const publishId = data.data && data.data.publish_id;
  return { id: publishId, channel: "tiktok", type: "draft", caption: caption || "", note: "sent to TikTok inbox as draft" };
}

// DIRECT public post. Requires AUDITED app + video.publish. Until audit TikTok
// forces SELF_ONLY regardless of the privacyLevel passed.
export async function directPost({ accessToken, videoUrl, caption, privacyLevel = "SELF_ONLY" }) {
  if (!accessToken) throw new Error("missing accessToken");
  if (!videoUrl) throw new Error("missing videoUrl");
  const res = await fetch(`${API}/post/publish/video/init/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({
      post_info: {
        title: caption || "",
        privacy_level: privacyLevel,
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: { source: "PULL_FROM_URL", video_url: videoUrl },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (data.error && data.error.code && data.error.code !== "ok") {
    throw new Error(`tiktok direct init: ${data.error.message || data.error.code}`);
  }
  const publishId = data.data && data.data.publish_id;
  return { id: publishId, channel: "tiktok", type: privacyLevel === "SELF_ONLY" ? "private" : "public", caption: caption || "" };
}

// Poll publish status (PULL_FROM_URL is async: TikTok downloads then processes).
export async function fetchStatus({ accessToken, publishId, tries = 8, delayMs = 4000 }) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${API}/post/publish/status/fetch/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const data = await res.json().catch(() => ({}));
    const status = data.data && data.data.status;
    if (status === "PUBLISH_COMPLETE" || status === "SEND_TO_USER_INBOX") return data.data;
    if (status === "FAILED") throw new Error(`tiktok publish failed: ${(data.data && data.data.fail_reason) || "unknown"}`);
    await sleep(delayMs);
  }
  return null;
}
