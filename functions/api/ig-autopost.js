// functions/api/ig-autopost.js — native Cloudflare Pages Function.
// Auto-publishes CAROUSELS to Instagram 3x/day on a rotation: morning,
// mid-afternoon, and early-evening ET. Reels are skipped (Mark films those),
// so the autoposter draws only from the carousel bank, cycling through it so
// no carousel repeats inside the same day. Fully automatic, with a kill-switch.
//
// Invoked hourly by the CF cron worker (POST, X-Cron-Secret); self-gates to the
// three POST_HOURS_ET slots. Each slot picks the next carousel in a continuous
// rotation keyed to days-since-launch so the sequence never resets.
// Manual: GET ?key=<CRON_SHARED_SECRET>&force=1[&day=N][&slot=0..2][&test=1]
//
// Cloudflare env / secrets:
//   AUTOPOST_ENABLED   must equal "true" or nothing posts (default OFF)
//   IG_USER_ID         Instagram Business/Creator user id (numeric)
//   IG_ACCESS_TOKEN    long-lived access token with instagram_content_publish
//   CRON_SHARED_SECRET auth
//   PAGES_BASE_URL     (default https://markcmo.com) — where /daily-assets live
//   WEBINAR_RESEND_KEY || RESEND_API_KEY + NOTIFY_EMAIL  receipt email
//   AUTOPOST_KV        (optional) KV namespace binding for per-slot dedup

import { DAYS, HASHTAGS } from '../_lib/daily-content.mjs';
import { assetsFor, etHour, daysSinceStart } from '../_lib/daily-email.mjs';
import { publishCarousel } from '../_lib/ig-poster.mjs';

const TZ = 'America/New_York';
// Three daily slots (ET): morning, mid-afternoon, early-evening.
const POST_HOURS_ET = [9, 13, 17];
// Carousels only — reels need filming. This is the pool the rotation draws from.
const CAROUSELS = DAYS.filter(d => d.kind === 'carousel');

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const q = Object.fromEntries(url.searchParams);
  if (request.method === 'OPTIONS') return json(200, '');

  // auth
  const secret = env.CRON_SHARED_SECRET || '';
  const provided = request.headers.get('x-cron-secret') || q.key || '';
  if (secret && provided !== secret) return json(403, { error: 'forbidden' });

  const force = q.force === '1' || q.force === 'true';
  const test = q.test === '1' || q.test === 'true';
  const dayParam = q.day ? parseInt(q.day, 10) : null;
  const slotParam = q.slot != null ? parseInt(q.slot, 10) : null;

  // kill-switch (test mode may still dry-run)
  if (env.AUTOPOST_ENABLED !== 'true' && !test) {
    return json(200, { skipped: true, reason: 'AUTOPOST_ENABLED is not "true"' });
  }

  // Which of the 3 daily slots is this? Scheduled runs match the ET hour to a
  // slot; manual/test/day runs fall back to slot 0 (or an explicit ?slot=N).
  let slot = etHourToSlot(etHour());
  if (slotParam != null && slotParam >= 0 && slotParam < POST_HOURS_ET.length) slot = slotParam;

  // Three-slot ET gate (scheduled runs only — manual/forced/test/day bypass it).
  if (!force && !test && !dayParam && slotParam == null) {
    const h = etHour();
    if (slot < 0) return json(200, { skipped: true, reason: `ET hour ${h} is not a post slot (${POST_HOURS_ET.join(',')})` });
  }
  if (slot < 0) slot = 0; // forced/test runs with no matching hour

  // Resolve which carousel to post.
  //  - ?day=N forces that exact calendar day (manual override).
  //  - otherwise: continuous rotation across the carousel bank, 3 slots/day,
  //    so each day's 3 posts are distinct and the sequence never resets.
  let day;
  if (dayParam && dayParam >= 1 && dayParam <= DAYS.length) {
    day = DAYS[dayParam - 1];
    if (day.kind !== 'carousel') {
      return json(200, { skipped: true, reason: `Day ${day.day} is a ${day.kind}, not a carousel` });
    }
  } else {
    if (!CAROUSELS.length) return json(500, { error: 'no carousels in content bank' });
    const globalSlot = daysSinceStart() * POST_HOURS_ET.length + slot;
    day = CAROUSELS[((globalSlot % CAROUSELS.length) + CAROUSELS.length) % CAROUSELS.length];
  }
  if (!day) return json(500, { error: 'no day resolved' });

  const base = env.PAGES_BASE_URL || 'https://markcmo.com';
  // IG Content Publishing rejects PNG (code 9004) — carousel slides are served as
  // JPEG copies (built by scripts/png-to-jpg.js). This path only runs for carousel
  // days, so every asset is a slide that has a matching .jpg.
  const imageUrls = assetsFor(day).map(a => `${base}/daily-assets/${a.name.replace(/\.png$/i, '.jpg')}`);
  const caption = `${day.caption}\n\n${HASHTAGS}`;

  // per-slot dedup (best-effort, only if a KV binding is provided) — each of the
  // 3 daily slots posts at most once, so a duplicate hourly tick can't double-post.
  const slotKey = `posted:${etYMD()}:${slot}`;
  if (env.AUTOPOST_KV && !test && !force) {
    const already = await env.AUTOPOST_KV.get(slotKey);
    if (already) return json(200, { skipped: true, reason: `slot ${slot} already posted today (${already})` });
  }

  if (test) {
    return json(200, { dryRun: true, slot, slotHourET: POST_HOURS_ET[slot], day: day.day, title: day.title, images: imageUrls.length, imageUrls, captionPreview: caption.slice(0, 160) });
  }

  if (!env.IG_USER_ID || !env.IG_ACCESS_TOKEN) {
    return json(503, { error: 'IG_USER_ID / IG_ACCESS_TOKEN not set' });
  }

  // Prefer a KV-stored token (rotated by the refresh cron) over the env secret.
  let token = env.IG_ACCESS_TOKEN;
  if (env.AUTOPOST_KV) { try { token = (await env.AUTOPOST_KV.get('ig_token')) || token; } catch (_) {} }

  try {
    const result = await publishCarousel({
      igUserId: env.IG_USER_ID, token, imageUrls, caption,
    });
    if (env.AUTOPOST_KV) { try { await env.AUTOPOST_KV.put(slotKey, result.id, { expirationTtl: 172800 }); } catch (_) {} }
    context.waitUntil(notify(env, true, day, result, null, slot));
    console.log(`[ig-autopost] published slot ${slot} Day ${day.day} -> ${result.id}`);
    return json(200, { ok: true, slot, slotHourET: POST_HOURS_ET[slot], day: day.day, postId: result.id, posted: result.posted });
  } catch (err) {
    console.error('[ig-autopost] publish failed:', err && err.message);
    context.waitUntil(notify(env, false, day, null, err && err.message, slot));
    return json(502, { error: 'publish failed', detail: err && err.message });
  }
}

// Map an ET hour to its post-slot index (0..2), or -1 if it is not a slot hour.
function etHourToSlot(h) { return POST_HOURS_ET.indexOf(h); }

// ── receipt email ────────────────────────────────────────────────────────────────
async function notify(env, ok, day, result, errMsg, slot) {
  const apiKey = env.WEBINAR_RESEND_KEY || env.RESEND_API_KEY;
  if (!apiKey) return;
  const to = (env.NOTIFY_EMAIL || 'mark@markcmo.com').split(',').map(s => s.trim()).filter(Boolean);
  const GOLD = '#C9A84C', NAVY = '#0a1532';
  const SLOT_NAMES = ['morning', 'mid-afternoon', 'early-evening'];
  const slotLabel = `${SLOT_NAMES[slot] || `slot ${slot}`} (${POST_HOURS_ET[slot]}:00 ET)`;
  const html = `<div style="font-family:Arial,sans-serif;background:#0a0a0a;padding:28px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-top:3px solid ${ok ? '#3fb950' : '#d9534f'};border-radius:10px;padding:24px 28px;">
      <div style="font-size:10px;letter-spacing:4px;color:${GOLD};text-transform:uppercase;">MarkCMO Autoposter &middot; ${esc(slotLabel)}</div>
      <h2 style="color:${NAVY};margin:6px 0 10px;font-size:19px;">${ok ? `Posted the ${esc(slotLabel)} carousel to Instagram` : `Autopost FAILED (${esc(slotLabel)})`}</h2>
      <p style="color:#444;font-size:14px;margin:0 0 6px;">${ok ? `${result.posted} slides live. Post id: ${esc(result.id)}` : esc(errMsg || 'unknown error')}</p>
      <p style="color:#888;font-size:12px;margin:10px 0 0;">Day ${day.day} &middot; ${esc(day.title)} &middot; ${new Date().toUTCString()}</p>
    </div></div>`;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'MarkCMO Autoposter <mark@markcmo.com>', to, subject: ok ? `IG posted: ${slotLabel} (Day ${day.day})` : `IG autopost FAILED: ${slotLabel}`, html }),
    });
  } catch (_) { /* best-effort */ }
}

function etYMD() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
function json(status, obj) {
  return new Response(typeof obj === 'string' ? obj : JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
