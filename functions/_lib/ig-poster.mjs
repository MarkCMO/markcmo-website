// functions/_lib/ig-poster.mjs
// Instagram Graph "Content Publishing" API helper. Publishes a carousel of
// hosted images to an IG Business/Creator account. Native Workers fetch only.
//
// Flow (per Meta docs):
//   1. Create a child media container per image (is_carousel_item=true)
//   2. Create the parent CAROUSEL container referencing the children + caption
//   3. media_publish the parent container
//
// Requires: igUserId, token (long-lived), publicly reachable image URLs.
// IG limits: 2-10 images per carousel, caption <= 2200 chars, <= 30 hashtags.

// @officialmarkcmo uses an "Instagram API with Instagram Login" token (IGAA…),
// which authenticates against graph.instagram.com — NOT the Facebook graph.
const GRAPH = 'https://graph.instagram.com/v21.0';
const MAX_ITEMS = 10;

async function graph(path, params) {
  const url = `${GRAPH}/${path}`;
  const body = new URLSearchParams(params);
  const res = await fetch(url, { method: 'POST', body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const msg = data.error ? `${data.error.message} (code ${data.error.code})` : `HTTP ${res.status}`;
    throw new Error(`IG ${path}: ${msg}`);
  }
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Poll a media container until IG finishes processing it. A freshly-created
// container (especially a multi-child CAROUSEL) is not immediately publishable —
// media_publish then fails with code 9007 "Media ID is not available". We wait
// for status_code=FINISHED before publishing.
async function waitReady(containerId, token, { tries = 12, delayMs = 2500 } = {}) {
  for (let i = 0; i < tries; i++) {
    const url = `${GRAPH}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    const code = data.status_code;
    if (code === 'FINISHED') return;
    if (code === 'ERROR' || code === 'EXPIRED') {
      throw new Error(`container ${containerId} ${code}: ${data.status || 'processing failed'}`);
    }
    await sleep(delayMs);
  }
  throw new Error(`container ${containerId} not ready after ${tries} polls`);
}

export async function publishCarousel({ igUserId, token, imageUrls, caption }) {
  if (!igUserId || !token) throw new Error('missing igUserId or token');
  let urls = (imageUrls || []).filter(Boolean);
  if (urls.length < 2) throw new Error(`carousel needs >= 2 images, got ${urls.length}`);
  if (urls.length > MAX_ITEMS) urls = urls.slice(0, MAX_ITEMS); // IG hard cap

  // 1. child containers
  const childIds = [];
  for (const image_url of urls) {
    const child = await graph(`${igUserId}/media`, {
      image_url, is_carousel_item: 'true', access_token: token,
    });
    childIds.push(child.id);
  }

  // wait for every child to finish processing (IG fetches each image_url)
  for (const id of childIds) await waitReady(id, token);

  // 2. parent carousel container
  const parent = await graph(`${igUserId}/media`, {
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption: caption || '',
    access_token: token,
  });

  // wait for the parent to be publishable (else media_publish -> code 9007)
  await waitReady(parent.id, token);

  // 3. publish
  const published = await graph(`${igUserId}/media_publish`, {
    creation_id: parent.id, access_token: token,
  });

  return { id: published.id, children: childIds.length, posted: urls.length };
}

// Publish a REEL (vertical MP4) to the account. Same 3-step shape as a carousel
// but the container is media_type=REELS with a hosted video_url. IG has to fetch
// and transcode the video, so processing is slower than an image — we poll longer.
// share_to_feed=true also surfaces the reel on the main grid (more reach).
export async function publishReel({ igUserId, token, videoUrl, caption, coverUrl }) {
  if (!igUserId || !token) throw new Error('missing igUserId or token');
  if (!videoUrl) throw new Error('missing videoUrl');

  // 1. create the REELS container
  const params = {
    media_type: 'REELS',
    video_url: videoUrl,
    caption: caption || '',
    share_to_feed: 'true',
    access_token: token,
  };
  if (coverUrl) params.cover_url = coverUrl;
  const container = await graph(`${igUserId}/media`, params);

  // 2. wait for transcode to finish (reels need more time than images)
  await waitReady(container.id, token, { tries: 30, delayMs: 4000 });

  // 3. publish
  const published = await graph(`${igUserId}/media_publish`, {
    creation_id: container.id, access_token: token,
  });
  return { id: published.id, container: container.id };
}

// Single-image post (e.g. a reel cover used as a static post) — handy fallback.
export async function publishImage({ igUserId, token, imageUrl, caption }) {
  if (!igUserId || !token) throw new Error('missing igUserId or token');
  const container = await graph(`${igUserId}/media`, {
    image_url: imageUrl, caption: caption || '', access_token: token,
  });
  await waitReady(container.id, token);
  const published = await graph(`${igUserId}/media_publish`, {
    creation_id: container.id, access_token: token,
  });
  return { id: published.id };
}

// Refresh a long-lived Instagram-Login token (extends another ~60 days).
// IG Login tokens refresh with just the token via the ig_refresh_token grant on
// graph.instagram.com — no app id/secret needed (unlike the Facebook fb_exchange flow).
export async function refreshLongLivedToken({ token }) {
  const url = 'https://graph.instagram.com/refresh_access_token'
    + '?grant_type=ig_refresh_token'
    + `&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`token refresh: ${data.error ? data.error.message : res.status}`);
  return data; // { access_token, token_type, expires_in }
}
