// functions/_lib/fb-poster.mjs
// Facebook Page publishing via the Graph API (graph.facebook.com). Unlike the IG
// poster (which uses an Instagram-Login token on graph.instagram.com), Page
// publishing needs a PAGE ACCESS TOKEN with pages_manage_posts +
// pages_read_engagement. Native fetch only — runs in Workers and in node.
//
// Two paths:
//   publishFacebookReel()  -> the 3-phase /{page}/video_reels resumable flow
//                             (start -> hosted file pull -> finish/PUBLISHED)
//   publishFacebookVideo() -> the classic /{page}/videos feed upload (file_url),
//                             a reliable fallback when Reels processing is fussy
//
// Both take a publicly reachable videoUrl (e.g. markcmo.com/daily-assets/...mp4).

const GRAPH = 'https://graph.facebook.com/v21.0';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function gpost(path, params) {
  const res = await fetch(`${GRAPH}/${path}`, { method: 'POST', body: new URLSearchParams(params) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const e = data.error;
    throw new Error(`FB ${path}: ${e ? `${e.message} (code ${e.code}${e.error_subcode ? '/' + e.error_subcode : ''})` : `HTTP ${res.status}`}`);
  }
  return data;
}

// Poll a Page video until it finishes processing (best-effort).
async function waitVideoReady(videoId, token, { tries = 30, delayMs = 4000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${GRAPH}/${videoId}?fields=status&access_token=${encodeURIComponent(token)}`);
    const data = await res.json().catch(() => ({}));
    const phase = data.status && (data.status.video_status || (data.status.processing_phase && data.status.processing_phase.status));
    if (phase === 'ready' || phase === 'complete' || data.status?.video_status === 'ready') return data.status;
    if (data.status?.video_status === 'error') throw new Error(`FB video ${videoId} processing error`);
    await sleep(delayMs);
  }
  return null; // timed out — caller can still treat as posted; FB finishes async
}

// REEL: 3-phase resumable upload, pulling the hosted MP4 by URL.
export async function publishFacebookReel({ pageId, token, videoUrl, caption }) {
  if (!pageId || !token) throw new Error('missing pageId or Page token');
  if (!videoUrl) throw new Error('missing videoUrl');

  // 1) start — get a video_id + upload_url
  const start = await gpost(`${pageId}/video_reels`, { upload_phase: 'start', access_token: token });
  const videoId = start.video_id;
  const uploadUrl = start.upload_url;
  if (!videoId || !uploadUrl) throw new Error('FB reels start: no video_id/upload_url');

  // 2) upload — tell FB to fetch the hosted file (header-based "file_url" pull)
  const up = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Authorization': `OAuth ${token}`, 'file_url': videoUrl },
  });
  const upData = await up.json().catch(() => ({}));
  if (!up.ok || upData.error || upData.success === false) {
    throw new Error(`FB reels upload: ${upData.error ? upData.error.message : 'failed (HTTP ' + up.status + ')'}`);
  }

  // 3) finish + publish
  await gpost(`${pageId}/video_reels`, {
    video_id: videoId,
    upload_phase: 'finish',
    video_state: 'PUBLISHED',
    description: caption || '',
    access_token: token,
  });

  await waitVideoReady(videoId, token).catch(() => {});
  return { id: videoId, permalink: `https://www.facebook.com/reel/${videoId}`, channel: 'facebook', type: 'reel' };
}

// FEED VIDEO: single-call upload by remote file_url. Simple + reliable fallback.
export async function publishFacebookVideo({ pageId, token, videoUrl, caption }) {
  if (!pageId || !token) throw new Error('missing pageId or Page token');
  if (!videoUrl) throw new Error('missing videoUrl');
  const data = await gpost(`${pageId}/videos`, {
    file_url: videoUrl,
    description: caption || '',
    access_token: token,
  });
  const id = data.id;
  await waitVideoReady(id, token).catch(() => {});
  return { id, permalink: `https://www.facebook.com/${id}`, channel: 'facebook', type: 'video' };
}

// Plain text / link post — handy for non-video days.
export async function publishFacebookText({ pageId, token, message, link }) {
  if (!pageId || !token) throw new Error('missing pageId or Page token');
  const params = { message: message || '', access_token: token };
  if (link) params.link = link;
  const data = await gpost(`${pageId}/feed`, params);
  return { id: data.id, permalink: `https://www.facebook.com/${data.id}`, channel: 'facebook', type: 'post' };
}

// Exchange a short-lived user token for a long-lived one (helper for setup).
// Needs the app id + secret. Long-lived USER token -> then GET /me/accounts to
// read the never-expiring PAGE token. Used by scripts/post-fb.mjs --exchange.
export async function exchangeLongLivedUserToken({ appId, appSecret, shortToken }) {
  const u = `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token`
    + `&client_id=${encodeURIComponent(appId)}`
    + `&client_secret=${encodeURIComponent(appSecret)}`
    + `&fb_exchange_token=${encodeURIComponent(shortToken)}`;
  const res = await fetch(u);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`exchange: ${data.error ? data.error.message : res.status}`);
  return data; // { access_token, token_type, expires_in }
}
