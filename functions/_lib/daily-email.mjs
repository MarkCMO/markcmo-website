// functions/_lib/daily-email.mjs
// Native Cloudflare Pages Function logic for the daily 6am-ET content email.
// No Netlify. Runs on the Workers runtime (uses fetch, btoa, Intl).

import { DAYS, HASHTAGS, AUDIT_LINK } from './daily-content.mjs';

const START_DATE = '2026-05-30'; // Day 1
const TZ = 'America/New_York';
const SEND_HOUR_ET = 6;
const ASSET_DIR = '/daily-assets';

// ── Public entry ────────────────────────────────────────────────────────────────
export async function handleDaily(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const q = Object.fromEntries(url.searchParams);

  if (request.method === 'OPTIONS') return json(200, '');

  // Auth: cron header OR ?key=. Accepts the shared cron secret (used by the
  // cron worker) OR a dedicated manual-trigger key (DAILY_TRIGGER_KEY) so a
  // one-off force-send can run without rotating the site-wide cron secret.
  const secret = env.CRON_SHARED_SECRET || '';
  const altKey = env.DAILY_TRIGGER_KEY || '';
  const provided = request.headers.get('x-cron-secret') || q.key || '';
  const authed = (secret && provided === secret) || (altKey && provided === altKey);
  if ((secret || altKey) && !authed) return json(403, { error: 'forbidden' });

  const force = q.force === '1' || q.force === 'true';
  const test = q.test === '1' || q.test === 'true';
  const dayParam = q.day ? parseInt(q.day, 10) : null;

  // 6am-ET gate (scheduled runs only)
  if (!force && !test && !dayParam) {
    const h = etHour();
    if (h !== SEND_HOUR_ET) return json(200, { skipped: true, reason: `ET hour ${h} != ${SEND_HOUR_ET}` });
  }

  const day = (dayParam && dayParam >= 1 && dayParam <= DAYS.length)
    ? DAYS[dayParam - 1]
    : DAYS[loopIndex()];
  if (!day) return json(500, { error: 'no day resolved' });

  const base = env.PAGES_BASE_URL || 'https://markcmo.com';
  const assets = assetsFor(day).map(a => ({ ...a, url: `${base}${ASSET_DIR}/${a.name}` }));

  const html = renderEmail(day, assets);
  const subject = `Day ${day.day}: ${stripTag(day.title)} — film + post today`;

  if (test) return { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' }, body: html, __raw: true };

  let attachments = [];
  try { attachments = await buildAttachments(assets); }
  catch (err) { console.warn('[daily-email] attachments failed:', err && err.message); }

  let emailed = false;
  try { emailed = await send(env, subject, html, attachments); }
  catch (err) {
    console.error('[daily-email] send failed:', err && err.message);
    return json(502, { error: 'send failed', detail: err && err.message });
  }

  console.log(`[daily-email] sent Day ${day.day} (${day.kind}) emailed=${emailed} attach=${attachments.length}`);
  return json(200, { ok: true, day: day.day, kind: day.kind, emailed, attachments: attachments.length, ranAt: new Date().toISOString() });
}

// ── Asset filenames (deterministic, matches scripts/gen-slides.js) ──────────────
export function assetsFor(day) {
  const dd = String(day.day).padStart(2, '0');
  if (day.kind === 'carousel') {
    return day.slides.map((s, i) => ({
      name: `day${dd}-slide${String(i + 1).padStart(2, '0')}.png`,
      label: `Slide ${i + 1}${s.k ? ' — ' + s.k : ''}`,
    }));
  }
  if (day.kind === 'reel') {
    const out = [{ name: `day${dd}-cover.png`, label: 'Reel cover (grid thumbnail)' }];
    (day.onscreen || []).forEach((t, i) => out.push({
      name: `day${dd}-osd${String(i + 1).padStart(2, '0')}.png`,
      label: `On-screen beat ${i + 1}: ${t}`,
    }));
    return out;
  }
  return [];
}

// ── Day-index math ──────────────────────────────────────────────────────────────
export function etHour() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }).formatToParts(new Date());
  const h = parts.find(p => p.type === 'hour');
  let n = h ? parseInt(h.value, 10) : -1;
  if (n === 24) n = 0;
  return n;
}
function etYMD(d) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
export function loopIndex() {
  return (((daysSinceStart() % DAYS.length) + DAYS.length) % DAYS.length);
}
// Raw, non-negative count of ET days since Day 1 (START_DATE). Used by the
// autoposter to drive a continuous post-slot rotation that does not reset
// every 30-day content loop.
export function daysSinceStart() {
  const [sy, sm, sd] = START_DATE.split('-').map(Number);
  const a = Date.UTC(sy, sm - 1, sd);
  const [ty, tm, td] = etYMD(new Date()).split('-').map(Number);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.max(0, Math.floor((b - a) / 86400000));
}

// ── Email render ────────────────────────────────────────────────────────────────
function renderEmail(day, assets = []) {
  const NAVY = '#0a1532', GOLD = '#C9A84C', INK = '#0a0a0a';
  const isReel = day.kind === 'reel';
  const body = isReel ? renderReel(day) : renderCarousel(day);
  const checklist = renderChecklist(day);
  const assetSection = renderAssets(day, assets);

  return `<div style="font-family:'Helvetica Neue',Arial,sans-serif;background:${INK};padding:28px 14px;">
  <div style="max-width:660px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6e6e6;">
    <div style="background:${NAVY};padding:30px 34px 26px;">
      <div style="font-size:10px;letter-spacing:5px;color:${GOLD};text-transform:uppercase;margin-bottom:10px;">MarkCMO Daily &middot; Week ${day.week}</div>
      <h1 style="color:#fff;margin:0;font-size:26px;line-height:1.2;">Day ${day.day} — ${esc(stripTag(day.title))}</h1>
      <p style="color:#9fb0d8;margin:10px 0 0;font-size:14px;">Theme: <strong style="color:#fff;">${esc(day.theme || '')}</strong></p>
    </div>
    <div style="background:${GOLD};padding:12px 34px;color:${NAVY};font-size:13px;font-weight:700;letter-spacing:.3px;">
      TODAY: film it, post it, then comment-watch for AUDIT.
    </div>
    <div style="padding:28px 34px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:22px;"><tr>
        ${metaCell('FORMAT', day.format)}${metaCell('PILLAR', day.pillar)}
      </tr></table>
      ${assetSection}
      ${day.cover ? block('COVER / FIRST FRAME', esc(day.cover)) : ''}
      ${body}
      <h3 style="color:${NAVY};font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:30px 0 8px;border-top:2px solid ${GOLD};padding-top:18px;">Caption — copy &amp; paste</h3>
      <div style="background:#f6f7fb;border:1px solid #e2e6f0;border-radius:8px;padding:16px 18px;font-size:14px;line-height:1.6;color:#1a1a2a;white-space:pre-wrap;">${esc(day.caption)}</div>
      <h3 style="color:${NAVY};font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:22px 0 8px;">Hashtags — copy &amp; paste</h3>
      <div style="background:#f6f7fb;border:1px solid #e2e6f0;border-radius:8px;padding:14px 18px;font-size:13px;line-height:1.6;color:#3a4a6a;">${esc(HASHTAGS)}</div>
      <div style="background:${NAVY};border-radius:8px;padding:18px 22px;margin:24px 0 8px;">
        <div style="font-size:10px;letter-spacing:3px;color:${GOLD};text-transform:uppercase;margin-bottom:6px;">The one CTA</div>
        <div style="color:#fff;font-size:16px;font-weight:600;line-height:1.4;">${esc(day.cta)}</div>
        <div style="color:#9fb0d8;font-size:12px;margin-top:10px;">Auto-DM keyword <strong style="color:${GOLD};">AUDIT</strong> &rarr; ${esc(AUDIT_LINK)}</div>
      </div>
      ${checklist}
    </div>
    <div style="background:#f3f4f8;padding:18px 34px;color:#8a8a8a;font-size:11px;text-align:center;">
      The only number that pays you: calls booked. &middot; Day ${day.day} of 30
    </div>
  </div>
</div>`;
}

function renderReel(day) {
  const NAVY = '#0a1532', GOLD = '#C9A84C';
  const onscreen = (day.onscreen || []).map(t =>
    `<span style="display:inline-block;background:#101a3a;color:#fff;font-size:12px;font-weight:600;padding:6px 12px;border-radius:20px;margin:0 6px 8px 0;">${esc(t)}</span>`).join('');
  return `
    <h3 style="color:${NAVY};font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:24px 0 8px;">Hook (first 3 seconds — say this exactly)</h3>
    <div style="background:#fff7e6;border-left:4px solid ${GOLD};padding:14px 16px;font-size:15px;line-height:1.5;color:#1a1a2a;font-weight:600;">${esc(day.hook)}</div>
    <h3 style="color:${NAVY};font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:22px 0 8px;">Script</h3>
    <div style="font-size:14px;line-height:1.7;color:#222;white-space:pre-wrap;">${esc(day.script)}</div>
    ${onscreen ? `<h3 style="color:${NAVY};font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:22px 0 10px;">On-screen text beats</h3><div>${onscreen}</div>` : ''}`;
}

function renderCarousel(day) {
  const NAVY = '#0a1532', GOLD = '#C9A84C';
  const slides = (day.slides || []).map((s, i) => `
    <div style="border:1px solid #e2e6f0;border-radius:10px;padding:14px 16px;margin-bottom:12px;background:#fff;">
      <div style="display:flex;align-items:baseline;gap:10px;">
        <span style="background:${NAVY};color:${GOLD};font-size:11px;font-weight:700;padding:3px 9px;border-radius:6px;">SLIDE ${i + 1}</span>
        ${s.k ? `<span style="font-size:10px;letter-spacing:2px;color:${GOLD};text-transform:uppercase;">${esc(s.k)}</span>` : ''}
      </div>
      <div style="font-size:16px;font-weight:700;color:${NAVY};margin:10px 0 6px;line-height:1.3;">${esc(s.h)}</div>
      ${s.b ? `<div style="font-size:13px;line-height:1.6;color:#444;">${esc(s.b)}</div>` : ''}
    </div>`).join('');
  return `<h3 style="color:${NAVY};font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:24px 0 12px;">Carousel slides (${(day.slides || []).length}) — build top to bottom</h3>${slides}`;
}

function renderAssets(day, assets) {
  if (!assets || !assets.length) return '';
  const NAVY = '#0a1532', GOLD = '#C9A84C';
  const isReel = day.kind === 'reel';
  const heading = isReel
    ? `Ready-to-post graphics (${assets.length}) — cover + on-screen text`
    : `Ready-to-post carousel (${assets.length} slides) — attached + below`;
  const tiles = assets.map(a => `
    <td style="padding:6px;vertical-align:top;width:33%;">
      <a href="${esc(a.url)}" style="text-decoration:none;color:${NAVY};">
        <img src="${esc(a.url)}" width="170" alt="${esc(a.label)}" style="width:100%;max-width:200px;border:1px solid #e2e6f0;border-radius:8px;display:block;background:#0a0f2c;" />
        <div style="font-size:10px;color:#6a7390;margin-top:5px;line-height:1.3;">${esc(a.label)}</div>
      </a>
    </td>`);
  const rows = [];
  for (let i = 0; i < tiles.length; i += 3) {
    const cells = tiles.slice(i, i + 3);
    rows.push(`<tr>${cells.join('')}${'<td style="width:33%;"></td>'.repeat(3 - cells.length)}</tr>`);
  }
  return `<div style="background:#fff;border:2px solid ${GOLD};border-radius:10px;padding:18px 18px 8px;margin:0 0 22px;">
      <h3 style="color:${NAVY};font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px;">${heading}</h3>
      <p style="font-size:12px;color:#6a7390;margin:0 0 12px;">Attached as PNGs. Save them and post. ${isReel ? 'The cover is your grid thumbnail; the beat cards are transparent overlays for your footage.' : 'Carousels auto-post for you 3x/day on rotation (9am, 1pm, 5pm ET) - nothing to do here.'}</p>
      <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">${rows.join('')}</table>
    </div>`;
}

function renderChecklist(day) {
  const NAVY = '#0a1532';
  const items = day.kind === 'carousel'
    ? ['Carousels AUTO-POST 3x/day on rotation (9am, 1pm, 5pm ET) — nothing to do unless you want to tweak one',
       'Confirm today\'s posts went live and the AUDIT comment auto-reply is on',
       'Add a Story today with a DM CTA pointing at the audit',
       '20-min engagement: comment on 10 founder / operator accounts',
       'Reply to every comment + DM within the first hour']
    : ['Film this reel (use the hook + script word-for-word; cover + beat cards attached)',
       'Post it with the caption + hashtags above',
       'Turn on the AUDIT comment-to-DM auto-reply for this post',
       'Add a Story today with a DM CTA pointing at the audit',
       '20-min engagement: comment on 10 founder / operator accounts',
       'Reply to every comment + DM within the first hour'];
  const lis = items.map(t => `<tr><td style="vertical-align:top;padding:5px 10px 5px 0;font-size:15px;">☐</td><td style="padding:5px 0;font-size:14px;line-height:1.5;color:#222;">${esc(t)}</td></tr>`).join('');
  return `<h3 style="color:${NAVY};font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:26px 0 8px;border-top:1px solid #e2e6f0;padding-top:18px;">Today's checklist</h3>
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${lis}</table>`;
}

function metaCell(label, val) {
  return `<td width="50%" style="padding:0 8px 0 0;vertical-align:top;">
    <div style="background:#f6f7fb;border:1px solid #e2e6f0;border-radius:8px;padding:12px 14px;">
      <div style="font-size:9px;letter-spacing:2px;color:#8a93a8;text-transform:uppercase;margin-bottom:4px;">${esc(label)}</div>
      <div style="font-size:13px;color:#1a1a2a;font-weight:600;line-height:1.4;">${esc(val || '-')}</div>
    </div></td>`;
}
function block(label, htmlVal) {
  const GOLD = '#C9A84C', NAVY = '#0a1532';
  return `<h3 style="color:${NAVY};font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:6px 0 8px;">${esc(label)}</h3>
    <div style="background:#fff7e6;border-left:4px solid ${GOLD};padding:12px 16px;font-size:14px;line-height:1.5;color:#1a1a2a;">${htmlVal}</div>`;
}

// ── attachments (Workers-safe base64) ───────────────────────────────────────────
async function buildAttachments(assets) {
  const out = [];
  for (const a of assets) {
    try {
      const res = await fetch(a.url, { headers: { 'User-Agent': 'markcmo-daily/1.0' } });
      if (!res.ok) { console.warn(`[daily-email] asset ${a.name} HTTP ${res.status}`); continue; }
      out.push({ filename: a.name, content: abToBase64(await res.arrayBuffer()) });
    } catch (err) { console.warn(`[daily-email] asset ${a.name} fetch failed:`, err && err.message); }
  }
  return out;
}
function abToBase64(buf) {
  let bin = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}

// ── send ────────────────────────────────────────────────────────────────────────
async function send(env, subject, html, attachments = []) {
  const apiKey = env.WEBINAR_RESEND_KEY || env.RESEND_API_KEY;
  if (!apiKey) { console.warn('[daily-email] no Resend key'); return false; }
  const to = (env.DAILY_CONTENT_EMAIL || env.NOTIFY_EMAIL || 'mark@markcmo.com').split(',').map(s => s.trim()).filter(Boolean);
  const payload = { from: 'MarkCMO Daily <mark@markcmo.com>', to, subject, html };
  if (attachments.length) payload.attachments = attachments;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Resend error: ${await res.text()}`);
  return true;
}

// ── helpers ───────────────────────────────────────────────────────────────────────
function stripTag(s) { return String(s == null ? '' : s).replace(/\s*—\s*PIN THIS\s*$/i, '').trim(); }
function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
function json(status, obj) {
  return { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: typeof obj === 'string' ? obj : JSON.stringify(obj) };
}
