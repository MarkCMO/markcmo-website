// Facebook Page publishing + OAuth helper for Cloudflare Pages / Workers (ESM).
//
// Page publishing needs a PAGE ACCESS TOKEN with pages_manage_posts +
// pages_read_engagement. We get it via OAuth:
//   1) user authorizes (buildAuthorizeUrl) with scopes incl pages_show_list
//   2) exchange code -> short-lived user token (exchangeCode)
//   3) exchange that -> long-lived user token (exchangeLongLivedUserToken)
//   4) GET /me/accounts -> the Page's never-expiring page access token (listPages)
//
// Posting:
//   publishFacebookReel()  -> 3-phase /{page}/video_reels resumable flow
//   publishFacebookVideo() -> classic /{page}/videos feed upload (file_url) fallback

const GRAPH = "https://graph.facebook.com/v21.0";
const DIALOG = "https://www.facebook.com/v21.0/dialog/oauth";
const DEFAULT_SCOPES = "pages_show_list,pages_manage_posts,pages_read_engagement";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gpost(path, params) {
  const res = await fetch(`${GRAPH}/${path}`, { method: "POST", body: new URLSearchParams(params) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const e = data.error;
    throw new Error(`FB ${path}: ${e ? `${e.message} (code ${e.code}${e.error_subcode ? "/" + e.error_subcode : ""})` : `HTTP ${res.status}`}`);
  }
  return data;
}

// --- OAuth ---
export function buildAuthorizeUrl({ appId, redirectUri, state, scopes = DEFAULT_SCOPES }) {
  const qs = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state: state || "",
    response_type: "code",
    scope: scopes,
  });
  return `${DIALOG}?${qs.toString()}`;
}

export async function exchangeCode({ appId, appSecret, code, redirectUri }) {
  const u = `${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(appId)}`
    + `&client_secret=${encodeURIComponent(appSecret)}`
    + `&redirect_uri=${encodeURIComponent(redirectUri)}`
    + `&code=${encodeURIComponent(code)}`;
  const res = await fetch(u);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`FB code exchange: ${data.error ? data.error.message : res.status}`);
  return data; // { access_token, token_type, expires_in }
}

export async function exchangeLongLivedUserToken({ appId, appSecret, shortToken }) {
  const u = `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token`
    + `&client_id=${encodeURIComponent(appId)}`
    + `&client_secret=${encodeURIComponent(appSecret)}`
    + `&fb_exchange_token=${encodeURIComponent(shortToken)}`;
  const res = await fetch(u);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`FB long-lived exchange: ${data.error ? data.error.message : res.status}`);
  return data; // { access_token, token_type, expires_in }
}

// List the Pages the user manages, each with its (long-lived) page access token.
export async function listPages({ userToken }) {
  const res = await fetch(`${GRAPH}/me/accounts?fields=id,name,access_token,tasks&access_token=${encodeURIComponent(userToken)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`FB list pages: ${data.error ? data.error.message : res.status}`);
  return Array.isArray(data.data) ? data.data : [];
}

// --- Publishing ---
async function waitVideoReady(videoId, token, { tries = 20, delayMs = 4000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${GRAPH}/${videoId}?fields=status&access_token=${encodeURIComponent(token)}`);
    const data = await res.json().catch(() => ({}));
    const vs = data.status && data.status.video_status;
    if (vs === "ready" || vs === "complete") return data.status;
    if (vs === "error") throw new Error(`FB video ${videoId} processing error`);
    await sleep(delayMs);
  }
  return null; // timed out - FB finishes async; treat as posted
}

// REEL: 3-phase resumable upload, pulling the hosted MP4 by URL.
export async function publishFacebookReel({ pageId, token, videoUrl, caption }) {
  if (!pageId || !token) throw new Error("missing pageId or Page token");
  if (!videoUrl) throw new Error("missing videoUrl");

  const start = await gpost(`${pageId}/video_reels`, { upload_phase: "start", access_token: token });
  const videoId = start.video_id;
  const uploadUrl = start.upload_url;
  if (!videoId || !uploadUrl) throw new Error("FB reels start: no video_id/upload_url");

  const up = await fetch(uploadUrl, {
    method: "POST",
    headers: { Authorization: `OAuth ${token}`, file_url: videoUrl },
  });
  const upData = await up.json().catch(() => ({}));
  if (!up.ok || upData.error || upData.success === false) {
    throw new Error(`FB reels upload: ${upData.error ? upData.error.message : "failed (HTTP " + up.status + ")"}`);
  }

  await gpost(`${pageId}/video_reels`, {
    video_id: videoId,
    upload_phase: "finish",
    video_state: "PUBLISHED",
    description: caption || "",
    access_token: token,
  });

  await waitVideoReady(videoId, token).catch(() => {});
  return { id: videoId, permalink: `https://www.facebook.com/reel/${videoId}`, channel: "facebook", type: "reel" };
}

// FEED VIDEO: single-call upload by remote file_url. Reliable fallback.
export async function publishFacebookVideo({ pageId, token, videoUrl, caption }) {
  if (!pageId || !token) throw new Error("missing pageId or Page token");
  if (!videoUrl) throw new Error("missing videoUrl");
  const data = await gpost(`${pageId}/videos`, { file_url: videoUrl, description: caption || "", access_token: token });
  const id = data.id;
  await waitVideoReady(id, token).catch(() => {});
  return { id, permalink: `https://www.facebook.com/${id}`, channel: "facebook", type: "video" };
}

// Plain text / link post (non-video days).
export async function publishFacebookText({ pageId, token, message, link }) {
  if (!pageId || !token) throw new Error("missing pageId or Page token");
  const params = { message: message || "", access_token: token };
  if (link) params.link = link;
  const data = await gpost(`${pageId}/feed`, params);
  return { id: data.id, permalink: `https://www.facebook.com/${data.id}`, channel: "facebook", type: "post" };
}
