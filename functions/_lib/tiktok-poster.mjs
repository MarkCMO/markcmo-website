// functions/_lib/tiktok-poster.mjs
// TikTok Content Posting API helper. Native fetch only.
//
// Reality of TikTok posting (read before wiring to auto-publish):
//   - You must register an app at developers.tiktok.com and add the
//     "Content Posting API" product, with scopes video.upload (drafts) and/or
//     video.publish (direct public post).
//   - PULL_FROM_URL (hosting the MP4 on markcmo.com) requires verifying that
//     domain as a "URL prefix" property in the dev portal. Otherwise use
//     FILE_UPLOAD (multipart) instead.
//   - UNAUDITED apps can ONLY post privately: drafts to the creator's inbox
//     (uploadDraft below) or SELF_ONLY direct posts. PUBLIC auto-posting needs
//     the app to pass TikTok's audit. So: ship drafts now, flip to public after
//     audit by switching the function + privacy level.
//
// Tokens: OAuth user access token (short, ~24h) + refresh token (~365d). Store the
// refresh token; call refreshToken() to mint a fresh access token before posting.

const API = 'https://open.tiktokapis.com/v2';
const OAUTH = 'https://open.tiktokapis.com/v2/oauth/token/';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Mint a fresh access token from the stored refresh token.
export async function refreshToken({ clientKey, clientSecret, refreshToken }) {
  if (!clientKey || !clientSecret || !refreshToken) throw new Error('missing client key/secret/refresh token');
  const res = await fetch(OAUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`tiktok refresh: ${data.error_description || data.error || res.status}`);
  return data; // { access_token, refresh_token, expires_in, ... }
}

// Send the video to the creator's TikTok inbox as a DRAFT (works for unaudited
// apps with video.upload). The creator opens TikTok and finishes posting.
export async function uploadDraft({ accessToken, videoUrl, caption }) {
  if (!accessToken) throw new Error('missing accessToken');
  if (!videoUrl) throw new Error('missing videoUrl');
  const res = await fetch(`${API}/post/publish/inbox/video/init/`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      source_info: { source: 'PULL_FROM_URL', video_url: videoUrl },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (data.error && data.error.code && data.error.code !== 'ok') {
    throw new Error(`tiktok inbox init: ${data.error.message || data.error.code}`);
  }
  const publishId = data.data && data.data.publish_id;
  return { id: publishId, channel: 'tiktok', type: 'draft', caption: caption || '', note: 'sent to TikTok inbox as draft' };
}

// DIRECT POST (public). Requires an AUDITED app + video.publish. Until audit,
// privacyLevel is forced to SELF_ONLY by TikTok regardless of what you pass.
export async function directPost({ accessToken, videoUrl, caption, privacyLevel = 'SELF_ONLY' }) {
  if (!accessToken) throw new Error('missing accessToken');
  if (!videoUrl) throw new Error('missing videoUrl');
  const res = await fetch(`${API}/post/publish/video/init/`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      post_info: {
        title: caption || '',
        privacy_level: privacyLevel,
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: { source: 'PULL_FROM_URL', video_url: videoUrl },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (data.error && data.error.code && data.error.code !== 'ok') {
    throw new Error(`tiktok direct init: ${data.error.message || data.error.code}`);
  }
  const publishId = data.data && data.data.publish_id;
  return { id: publishId, channel: 'tiktok', type: privacyLevel === 'SELF_ONLY' ? 'private' : 'public', caption: caption || '' };
}

// Poll publish status (PULL_FROM_URL is async — TikTok downloads then processes).
export async function fetchStatus({ accessToken, publishId, tries = 20, delayMs = 4000 }) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${API}/post/publish/status/fetch/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const data = await res.json().catch(() => ({}));
    const status = data.data && data.data.status;
    if (status === 'PUBLISH_COMPLETE' || status === 'SEND_TO_USER_INBOX') return data.data;
    if (status === 'FAILED') throw new Error(`tiktok publish failed: ${(data.data && data.data.fail_reason) || 'unknown'}`);
    await sleep(delayMs);
  }
  return null;
}
