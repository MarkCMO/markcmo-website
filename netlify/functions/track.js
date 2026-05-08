// ═══════════════════════════════════════════════════════════════
// track.js, public tracker endpoint
//
// Logs touchpoints to mc_journey_events. Public so client documents
// + email links can hit it without auth. Validates inputs strictly
// so it can't be abused to inject arbitrary rows.
//
// USAGE
// 1) Page views (called by inline JS on document pages):
//    POST /.netlify/functions/track
//    { t: 'view', client: 'wendal-enterprise', page: 'proposal',
//      doc_id?: 'WE-AUD-001', engagement_id?: 'uuid', session_id?: 's_...' }
//    Returns 200 JSON.
//
// 2) Outbound link click (used by tracking redirect from emails):
//    GET /.netlify/functions/track?t=click&c=wendal-enterprise
//      &k=sign|proposal|sow|timeline|cover&u=<base64-url>
//      &eid=<engagement_id>&doc=<doc_id>
//    Logs the event then 302s to the decoded URL.
//
// 3) 1x1 pixel beacon (for HTML email opens that don't go through
//    Resend's tracker, e.g. server-rendered receipts):
//    GET /.netlify/functions/track?t=pixel&c=<slug>&eid=<eng_id>
//    Returns transparent 1x1 GIF, status 200.
// ═══════════════════════════════════════════════════════════════
const { sbSelect, sbInsert } = require('./_lib_supabase');

// 1x1 transparent GIF
const PIXEL_GIF = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');

const VALID_PAGE_KINDS = ['proposal','sow','timeline','sign','cover','intake','followup','receipt'];
const VALID_CLICK_KINDS = ['sign','proposal','sow','timeline','cover','payment','followup','calendly','custom'];

exports.handler = async (event) => {
  const method = event.httpMethod;
  const q = event.queryStringParameters || {};
  const ip = pickIp(event);
  const ua = event.headers?.['user-agent'] || event.headers?.['User-Agent'] || null;
  const referrer = event.headers?.referer || event.headers?.Referer || null;

  // ─── INTERNAL VISITOR DETECTION ─────────────────────────────────
  // Any request that carries the admin session cookie is Mark himself
  // previewing his own client docs. Don't pollute mc_journey_events with
  // his views, we only want real client touches in analytics.
  // Also short-circuit when ?test=1 / ?preview=1 query params are set,
  // which lets Mark share a doc URL for review without recording a touch.
  const cookieHeader = event.headers?.cookie || event.headers?.Cookie || '';
  const hasAdminCookie = /(?:^|;\s*)mcadmin_session=/.test(cookieHeader);
  const isPreviewParam = q.test === '1' || q.preview === '1';
  if (hasAdminCookie || isPreviewParam) {
    // Honor pixel/redirect contracts for non-tracking callers so the user
    // experience is unchanged. Just don't write to mc_journey_events.
    if (method === 'GET' && q.t === 'click') {
      const target = decodeUrl(q.u);
      if (target) {
        const finalUrl = target.includes('?') ? target : target + '?_mc=' + Date.now().toString(36);
        return { statusCode: 302, headers: { Location: finalUrl, 'Cache-Control': 'no-store' }, body: '' };
      }
    }
    if (method === 'GET' && q.t === 'pixel') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        body: PIXEL_GIF.toString('base64'),
        isBase64Encoded: true,
      };
    }
    if (method === 'POST') return json(200, { ok: true, ignored: 'internal' });
  }

  // ─── POST: page view from a document page ────────────────────
  if (method === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return json(400, { error: 'Invalid JSON' }); }

    if (body.t !== 'view') return json(400, { error: 'Unknown POST type' });
    const slug = sanitizeSlug(body.client);
    const page = sanitizeKind(body.page, VALID_PAGE_KINDS);
    if (!slug || !page) return json(400, { error: 'Missing/invalid client or page' });

    const client = await resolveClient(slug);
    if (!client) return json(200, { ok: true, ignored: true });

    let engagementId = sanitizeUuid(body.engagement_id);
    let documentId = null;
    if (body.doc_id) {
      const docs = await sbSelect(`mc_documents?doc_id=eq.${encodeURIComponent(body.doc_id)}&mc_engagements.client_id=eq.${client.id}&select=id,engagement_id&limit=1`).catch(() => []);
      if (docs.length) { documentId = docs[0].id; engagementId = engagementId || docs[0].engagement_id; }
    }
    // If no engagement passed in, attach to the most recent engagement for that client
    if (!engagementId) {
      const engs = await sbSelect(`mc_engagements?client_id=eq.${client.id}&select=id&order=updated_at.desc&limit=1`).catch(() => []);
      engagementId = engs[0]?.id || null;
    }

    await safeInsert({
      client_id: client.id,
      engagement_id: engagementId,
      document_id: documentId,
      category: 'page',
      event: 'page_view',
      subject_or_url: page,
      ip, user_agent: ua, referrer,
      session_id: typeof body.session_id === 'string' ? body.session_id.slice(0, 64) : null,
      raw: { url: body.url || null, title: body.title || null },
    });
    return json(200, { ok: true });
  }

  // ─── GET: click redirect or pixel beacon ─────────────────────
  if (method === 'GET') {
    const t = q.t || '';

    if (t === 'click') {
      const slug = sanitizeSlug(q.c);
      const kind = sanitizeKind(q.k, VALID_CLICK_KINDS);
      const target = decodeUrl(q.u);
      if (!target) return json(400, { error: 'Missing/invalid url' });

      let clientId = null, engagementId = sanitizeUuid(q.eid), documentId = null;
      if (slug) {
        const c = await resolveClient(slug);
        clientId = c?.id || null;
      }
      if (q.doc) {
        const docs = await sbSelect(`mc_documents?doc_id=eq.${encodeURIComponent(q.doc)}&select=id,engagement_id&limit=1`).catch(() => []);
        if (docs.length) { documentId = docs[0].id; engagementId = engagementId || docs[0].engagement_id; }
      }
      if (!engagementId && clientId) {
        const engs = await sbSelect(`mc_engagements?client_id=eq.${clientId}&select=id&order=updated_at.desc&limit=1`).catch(() => []);
        engagementId = engs[0]?.id || null;
      }

      await safeInsert({
        client_id: clientId,
        engagement_id: engagementId,
        document_id: documentId,
        category: 'cta_click',
        event: 'cta_click',
        subject_or_url: target,
        ip, user_agent: ua, referrer,
        raw: { kind },
      });
      // Netlify merges the source request's query string into the
      // response Location when the destination has no query string.
      // Prevent that by always appending a no-op param if needed.
      const finalUrl = target.includes('?') ? target : target + '?_mc=' + Date.now().toString(36);
      return { statusCode: 302, headers: { Location: finalUrl, 'Cache-Control': 'no-store' }, body: '' };
    }

    if (t === 'pixel') {
      const slug = sanitizeSlug(q.c);
      let clientId = null, engagementId = sanitizeUuid(q.eid);
      if (slug) {
        const c = await resolveClient(slug);
        clientId = c?.id || null;
      }
      await safeInsert({
        client_id: clientId,
        engagement_id: engagementId,
        category: 'email',
        event: 'email_opened',
        ip, user_agent: ua, referrer,
        raw: { source: 'pixel-beacon' },
      });
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        body: PIXEL_GIF.toString('base64'),
        isBase64Encoded: true,
      };
    }

    return json(400, { error: `Unknown tracker type: ${t}` });
  }

  return json(405, { error: 'Method not allowed' });
};

// ─── Helpers ────────────────────────────────────────────────────
function json(status, obj) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
    body: JSON.stringify(obj),
  };
}

function pickIp(event) {
  const xff = event.headers?.['x-forwarded-for'] || event.headers?.['X-Forwarded-For'];
  if (xff) return String(xff).split(',')[0].trim();
  return event.headers?.['x-real-ip'] || event.headers?.['X-Real-IP'] || null;
}

function sanitizeSlug(s) {
  if (typeof s !== 'string') return null;
  const t = s.trim().toLowerCase();
  if (!/^[a-z0-9-]{1,80}$/.test(t)) return null;
  return t;
}
function sanitizeKind(s, allowed) {
  if (typeof s !== 'string') return null;
  const t = s.trim().toLowerCase();
  return allowed.includes(t) ? t : null;
}
function sanitizeUuid(s) {
  if (typeof s !== 'string') return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : null;
}
function decodeUrl(b64) {
  if (typeof b64 !== 'string') return null;
  try {
    const decoded = Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    if (!/^https?:\/\//i.test(decoded)) return null;
    if (decoded.length > 2000) return null;
    return decoded;
  } catch { return null; }
}

async function resolveClient(slug) {
  try {
    const rows = await sbSelect(`mc_clients?slug=eq.${encodeURIComponent(slug)}&select=id,slug,legal_name&limit=1`);
    return rows[0] || null;
  } catch { return null; }
}

async function safeInsert(payload) {
  try { await sbInsert('mc_journey_events', payload); }
  catch (e) { console.warn('mc_journey_events insert failed:', e.message); }
}
