// functions/api/post-dashboard.js — native Cloudflare Pages Function.
// A hosted, branded dashboard that shows EVERY post going out across channels so
// Mark can see them at a glance and compare A/B/C engagement.
//
//   GET  /api/post-dashboard                -> the dashboard HTML shell
//   GET  /api/post-dashboard?data=1         -> JSON feed (auth required)
//   GET  /api/post-dashboard?insights=<id>  -> per-post reach/saves (auth required)
//   POST /api/post-dashboard?tag=1          -> append a variant tag / ledger row (auth)
//
// Data sources:
//   - Instagram: live from graph.instagram.com /me/media (caption, thumbnail,
//     permalink, like_count, comments_count) — always the source of truth.
//   - Facebook Page / TikTok: from a KV ledger (kv key "pd:ledger") that the
//     fb/tiktok posters append to, since those live outside the IG graph.
//   - Variant tags: KV "pd:tag:<mediaId>" (written by the posters) PLUS a
//     caption-prefix match against the A/B/C bank, so the 3 hook-test reels are
//     labelled even before any tag is written.
//
// Auth (any one):
//   - a valid admin session cookie (mcadmin_session, same HMAC as admin-auth), or
//   - ?key=<DASHBOARD_KEY | CRON_SHARED_SECRET>.
// The HTML shell is public (it holds no data); every data path is gated.
//
// Cloudflare env: IG_USER_ID, IG_ACCESS_TOKEN, AUTOPOST_KV (or BLOBS_DOCUMENTS),
//   DASHBOARD_KEY (optional), CRON_SHARED_SECRET, ADMIN_SESSION_SECRET|TOKEN_SECRET.

import { ABCTEST } from '../_lib/shorts-content.mjs';

const IG_GRAPH = 'https://graph.instagram.com/v21.0';
const LEDGER_KEY = 'pd:ledger';
const TAG_PREFIX = 'pd:tag:';

// ── small helpers ─────────────────────────────────────────────────────────────
function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      'access-control-allow-origin': '*',
    },
  });
}
function kvFor(env) { return env.AUTOPOST_KV || env.BLOBS_DOCUMENTS || null; }

// Verify the admin HMAC session cookie (mirrors netlify/functions/admin-auth.js).
async function cookieAuthed(request, env) {
  const secret = env.ADMIN_SESSION_SECRET || env.TOKEN_SECRET || '';
  if (!secret) return false;
  const raw = request.headers.get('cookie') || '';
  const m = raw.match(/(?:^|;\s*)mcadmin_session=([^;]+)/);
  if (!m) return false;
  try {
    const token = decodeURIComponent(m[1]);
    const [dataB64, sigB64] = token.split('.');
    if (!dataB64 || !sigB64) return false;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sig = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const ok = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(dataB64));
    if (!ok) return false;
    const payload = JSON.parse(atob(dataB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && Date.now() > payload.exp) return false;
    return true;
  } catch { return false; }
}
async function authed(request, env, q) {
  const want = env.DASHBOARD_KEY || env.CRON_SHARED_SECRET || '';
  if (want && (q.key === want || request.headers.get('x-dashboard-key') === want)) return true;
  return cookieAuthed(request, env);
}

// Match a caption against the A/B/C hook-test bank by its opener line.
function abcMatch(caption) {
  if (!caption) return null;
  const c = caption.trim();
  for (const it of ABCTEST) {
    if (it.take && c.startsWith(it.take.trim())) {
      return { variant: it.id, angle: it.angle, test: 'hook-angle' };
    }
  }
  return null;
}

async function igToken(env) {
  const kv = kvFor(env);
  if (kv) { try { const t = await kv.get('ig_token'); if (t) return t; } catch {} }
  return env.IG_ACCESS_TOKEN || '';
}

// ── data: assemble the cross-channel feed ─────────────────────────────────────
async function buildFeed(env) {
  const kv = kvFor(env);
  const out = [];
  const errors = [];

  // Instagram (live)
  const token = await igToken(env);
  if (token) {
    const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,username';
    let url = `${IG_GRAPH}/me/media?fields=${encodeURIComponent(fields)}&limit=50&access_token=${encodeURIComponent(token)}`;
    try {
      let res = await fetch(url);
      let data = await res.json().catch(() => ({}));
      if (data.error) {
        // retry without the count fields (older permission scopes reject them)
        const f2 = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username';
        url = `${IG_GRAPH}/me/media?fields=${encodeURIComponent(f2)}&limit=50&access_token=${encodeURIComponent(token)}`;
        res = await fetch(url);
        data = await res.json().catch(() => ({}));
      }
      if (data.error) {
        errors.push(`instagram: ${data.error.message || 'fetch failed'}`);
      } else {
        for (const m of (data.data || [])) {
          let tag = abcMatch(m.caption);
          if (kv) {
            try {
              const stored = await kv.get(TAG_PREFIX + m.id, { type: 'json' });
              if (stored) tag = { ...(tag || {}), ...stored };
            } catch {}
          }
          out.push({
            channel: 'instagram',
            id: m.id,
            type: (m.media_type || '').toLowerCase(),
            caption: m.caption || '',
            thumb: m.thumbnail_url || m.media_url || '',
            permalink: m.permalink || '',
            ts: m.timestamp ? Date.parse(m.timestamp) : 0,
            likes: typeof m.like_count === 'number' ? m.like_count : null,
            comments: typeof m.comments_count === 'number' ? m.comments_count : null,
            variant: tag ? tag.variant : null,
            angle: tag ? tag.angle : null,
            test: tag ? tag.test : null,
          });
        }
      }
    } catch (e) { errors.push(`instagram: ${e.message}`); }
  } else {
    errors.push('instagram: no token configured');
  }

  // Facebook Page / TikTok (from KV ledger)
  if (kv) {
    try {
      const ledger = (await kv.get(LEDGER_KEY, { type: 'json' })) || [];
      for (const row of ledger) {
        if (row.channel === 'instagram') continue; // IG already comes from graph
        out.push({
          channel: row.channel || 'unknown',
          id: row.id || '',
          type: row.type || 'video',
          caption: row.caption || '',
          thumb: row.thumb || '',
          permalink: row.permalink || '',
          ts: row.ts || 0,
          likes: row.likes ?? null,
          comments: row.comments ?? null,
          variant: row.variant || abcMatch(row.caption)?.variant || null,
          angle: row.angle || abcMatch(row.caption)?.angle || null,
          test: row.test || (abcMatch(row.caption) ? 'hook-angle' : null),
        });
      }
    } catch (e) { errors.push(`ledger: ${e.message}`); }
  }

  out.sort((a, b) => b.ts - a.ts);

  // A/B/C roll-up: group the hook-test variants and compute engagement
  const abc = ABCTEST.map(it => {
    const posts = out.filter(p => p.variant === it.id);
    const likes = posts.reduce((s, p) => s + (p.likes || 0), 0);
    const comments = posts.reduce((s, p) => s + (p.comments || 0), 0);
    return { variant: it.id, angle: it.angle, hook: it.take, posts: posts.length, likes, comments, engagement: likes + comments };
  });

  return { ok: true, count: out.length, errors, posts: out, abc, generatedAt: Date.now() };
}

// ── per-post insights (reach / saves / plays) ─────────────────────────────────
async function insights(env, mediaId) {
  const token = await igToken(env);
  if (!token) return json(503, { error: 'no token' });
  const tryMetrics = async (metric) => {
    const u = `${IG_GRAPH}/${mediaId}/insights?metric=${metric}&access_token=${encodeURIComponent(token)}`;
    const r = await fetch(u);
    return r.json().catch(() => ({}));
  };
  // reels report different metric names than feed posts; try the rich set, fall back
  let d = await tryMetrics('reach,saved,total_interactions,plays');
  if (d.error) d = await tryMetrics('reach,saved');
  if (d.error) return json(200, { mediaId, metrics: {}, note: d.error.message });
  const metrics = {};
  for (const row of (d.data || [])) {
    metrics[row.name] = row.values && row.values[0] ? row.values[0].value : null;
  }
  return json(200, { mediaId, metrics });
}

// ── tag write (posters call this after publishing) ────────────────────────────
async function writeTag(request, env) {
  const kv = kvFor(env);
  if (!kv) return json(503, { error: 'no kv' });
  let body;
  try { body = await request.json(); } catch { return json(400, { error: 'bad json' }); }
  const { id, channel, variant, angle, test, caption, permalink, thumb, type } = body || {};
  if (!id) return json(400, { error: 'missing id' });
  // store the variant tag keyed by media id
  try {
    await kv.put(TAG_PREFIX + id, JSON.stringify({ variant: variant || null, angle: angle || null, test: test || null }), { expirationTtl: 60 * 60 * 24 * 120 });
  } catch (e) { return json(502, { error: e.message }); }
  // non-IG channels also go into the ledger so the dashboard can show them
  if (channel && channel !== 'instagram') {
    try {
      const ledger = (await kv.get(LEDGER_KEY, { type: 'json' })) || [];
      const row = { channel, id, variant: variant || null, angle: angle || null, test: test || null, caption: caption || '', permalink: permalink || '', thumb: thumb || '', type: type || 'video', ts: Date.now() };
      const next = ledger.filter(r => !(r.channel === channel && r.id === id));
      next.unshift(row);
      await kv.put(LEDGER_KEY, JSON.stringify(next.slice(0, 200)));
    } catch (e) { return json(502, { error: e.message }); }
  }
  return json(200, { ok: true });
}

// ── HTML shell (no secrets, no server interpolation) ──────────────────────────
const PAGE = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>MarkCMO Posts</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root{--ink:#0A0F2C;--ink2:#0D1235;--gold:#C9A84C;--off:#FAFAF8;--muted:#B7BCCB;--line:rgba(255,255,255,.10);}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:radial-gradient(120% 80% at 50% -10%,#11183f 0%,var(--ink) 60%);color:var(--off);font-family:'Outfit',sans-serif;min-height:100vh;padding:28px 18px 80px;}
  .wrap{max-width:1180px;margin:0 auto;}
  header{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:8px;}
  h1{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:30px;letter-spacing:-.01em;}
  h1 span{color:var(--gold);}
  .sub{color:var(--muted);font-size:14px;margin-bottom:24px;}
  button{font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:14px;color:var(--ink);background:var(--gold);border:0;border-radius:40px;padding:10px 20px;cursor:pointer;}
  button.ghost{background:transparent;color:var(--gold);border:1px solid var(--gold);}
  .panel{background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:18px;padding:20px;margin-bottom:26px;}
  .panel h2{font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.16em;color:var(--gold);margin-bottom:16px;}
  .abc{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;}
  .abccard{background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:14px;padding:16px;position:relative;}
  .abccard.win{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold) inset;}
  .abccard .angle{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:var(--gold);margin-bottom:8px;}
  .abccard .hook{font-size:15px;line-height:1.4;color:var(--off);min-height:62px;}
  .abccard .nums{display:flex;gap:18px;margin-top:14px;font-family:'Space Grotesk',sans-serif;}
  .abccard .nums b{font-size:24px;font-weight:700;display:block;}
  .abccard .nums small{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.08em;}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px;}
  .card{background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;}
  .card .thumb{aspect-ratio:1/1;background:#0b1030 center/cover no-repeat;position:relative;}
  .card .thumb .badge{position:absolute;top:10px;left:10px;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;border-radius:30px;background:rgba(10,15,44,.78);color:var(--gold);border:1px solid var(--gold);}
  .card .thumb .vtag{position:absolute;top:10px;right:10px;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:10px;letter-spacing:.06em;text-transform:uppercase;padding:5px 9px;border-radius:30px;background:var(--gold);color:var(--ink);}
  .card .body{padding:14px 15px 16px;display:flex;flex-direction:column;gap:10px;flex:1;}
  .card .cap{font-size:13.5px;line-height:1.45;color:#e9ecf6;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;}
  .card .meta{display:flex;align-items:center;justify-content:space-between;margin-top:auto;color:var(--muted);font-size:12px;}
  .card .eng{display:flex;gap:14px;font-family:'Space Grotesk',sans-serif;font-weight:600;color:var(--off);}
  .card a.view{color:var(--gold);text-decoration:none;font-weight:600;font-size:12px;}
  .empty,.err{color:var(--muted);font-size:14px;padding:30px 0;text-align:center;}
  .err{color:#ff9b9b;}
  .when{font-variant-numeric:tabular-nums;}
</style></head>
<body><div class="wrap">
  <header>
    <div><h1>MarkCMO <span>Posts</span></h1></div>
    <div style="display:flex;gap:10px;">
      <button class="ghost" id="refresh">Refresh</button>
    </div>
  </header>
  <div class="sub" id="status">Loading...</div>
  <div class="panel" id="abcPanel" style="display:none">
    <h2>A / B / C hook test &middot; same offer, same CTA, only the hook changes</h2>
    <div class="abc" id="abc"></div>
  </div>
  <div class="grid" id="grid"></div>
</div>
<script>
(function(){
  var KEY = new URLSearchParams(location.search).get('key') || '';
  function qs(p){ return KEY ? (p + (p.indexOf('?')>-1?'&':'?') + 'key=' + encodeURIComponent(KEY)) : p; }
  function ago(ts){
    if(!ts) return '';
    var s = Math.floor((Date.now()-ts)/1000);
    if(s<60) return s+'s ago';
    var m=Math.floor(s/60); if(m<60) return m+'m ago';
    var h=Math.floor(m/60); if(h<24) return h+'h ago';
    var d=Math.floor(h/24); if(d<30) return d+'d ago';
    return new Date(ts).toLocaleDateString();
  }
  function chBadge(ch){ return ch==='instagram'?'Instagram':ch==='facebook'?'Facebook':ch==='tiktok'?'TikTok':ch; }
  function el(tag, cls, txt){ var e=document.createElement(tag); if(cls)e.className=cls; if(txt!=null)e.textContent=txt; return e; }

  function renderAbc(abc){
    var panel=document.getElementById('abcPanel'), host=document.getElementById('abc');
    host.innerHTML='';
    var live = abc.filter(function(a){return a.posts>0;});
    if(!live.length){ panel.style.display='none'; return; }
    panel.style.display='block';
    var max=Math.max.apply(null, live.map(function(a){return a.engagement;}));
    abc.forEach(function(a){
      var c=el('div','abccard'+(a.posts>0 && a.engagement===max && max>0?' win':''));
      c.appendChild(el('div','angle', a.angle));
      c.appendChild(el('div','hook', a.hook));
      var nums=el('div','nums');
      [['likes',a.likes],['comments',a.comments],['total',a.engagement]].forEach(function(p){
        var col=el('div'); var b=el('b',null, a.posts?String(p[1]):'-'); var s=el('small',null,p[0]);
        col.appendChild(b); col.appendChild(s); nums.appendChild(col);
      });
      c.appendChild(nums);
      host.appendChild(c);
    });
  }

  function renderGrid(posts){
    var grid=document.getElementById('grid'); grid.innerHTML='';
    if(!posts.length){ grid.appendChild(el('div','empty','No posts yet.')); return; }
    posts.forEach(function(p){
      var card=el('div','card');
      var th=el('div','thumb');
      if(p.thumb) th.style.backgroundImage='url("'+p.thumb+'")';
      th.appendChild(el('span','badge', chBadge(p.channel)));
      if(p.angle) th.appendChild(el('span','vtag', p.angle));
      card.appendChild(th);
      var body=el('div','body');
      body.appendChild(el('div','cap', p.caption || '(no caption)'));
      var meta=el('div','meta');
      var eng=el('div','eng');
      eng.appendChild(el('span',null,(p.likes==null?'-':p.likes)+' likes'));
      eng.appendChild(el('span',null,(p.comments==null?'-':p.comments)+' comments'));
      meta.appendChild(eng);
      if(p.permalink){ var a=el('a','view','View'); a.href=p.permalink; a.target='_blank'; a.rel='noopener'; meta.appendChild(a); }
      else { meta.appendChild(el('span','when', ago(p.ts))); }
      body.appendChild(meta);
      var when=el('div','meta'); when.appendChild(el('span','when', ago(p.ts))); when.appendChild(el('span',null, p.type||'')); body.appendChild(when);
      card.appendChild(body);
      grid.appendChild(card);
    });
  }

  function load(){
    var st=document.getElementById('status'); st.textContent='Loading...';
    fetch(qs(location.pathname + '?data=1'), { credentials:'same-origin' })
      .then(function(r){ if(r.status===401) throw new Error('Not authorized. Log in at /admin or open this page with ?key=YOUR_KEY'); return r.json(); })
      .then(function(d){
        if(!d.ok) throw new Error(d.error||'failed');
        renderAbc(d.abc||[]);
        renderGrid(d.posts||[]);
        var bits=[ (d.count||0)+' posts' ];
        if(d.errors && d.errors.length) bits.push(d.errors.join(' | '));
        bits.push('updated '+new Date(d.generatedAt).toLocaleTimeString());
        st.textContent=bits.join('  ·  ');
      })
      .catch(function(e){ st.innerHTML='<span style="color:#ff9b9b">'+e.message+'</span>'; });
  }
  document.getElementById('refresh').addEventListener('click', load);
  load();
})();
</script>
</body></html>`;

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const q = Object.fromEntries(url.searchParams);

  if (request.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,x-dashboard-key' } });
  }

  // tag write (POST)
  if (request.method === 'POST' && (q.tag === '1' || q.tag === 'true')) {
    if (!(await authed(request, env, q))) return json(401, { error: 'unauthorized' });
    return writeTag(request, env);
  }

  // JSON feed
  if (q.data === '1' || q.data === 'true') {
    if (!(await authed(request, env, q))) return json(401, { error: 'unauthorized' });
    try { return json(200, await buildFeed(env)); }
    catch (e) { return json(500, { ok: false, error: e.message }); }
  }

  // per-post insights
  if (q.insights) {
    if (!(await authed(request, env, q))) return json(401, { error: 'unauthorized' });
    return insights(env, q.insights);
  }

  // default: the dashboard shell (public; data paths are gated)
  return new Response(PAGE, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
