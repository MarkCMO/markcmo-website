// ═══════════════════════════════════════════════════════════════
// admin-engagement-data.js
// Auth-protected reader for MarkCMO engagement data (mc_* tables in
// the CLIPOS Supabase project). Powers /admin#case-files plus all
// the other CRM/engagement panels in /admin.
//
// Endpoints (all require valid mcadmin_session cookie):
//   GET ?type=clients              — list of mc_clients with engagement summary
//   GET ?type=case&slug={slug}     — full case file: client + engagements + docs + audit
//   GET ?type=signed-url&path={p}  — short-lived signed URL for a Storage object
//   GET ?type=audit&engagementId   — last 50 audit events for an engagement
//   GET ?type=contacts             — every mc_clients row (CRM contacts panel)
//   GET ?type=active-clients       — clients with at least one non-lead engagement
//   GET ?type=pipeline             — all engagements grouped by status (kanban)
//   GET ?type=projects             — engagements paid/delivering with delivery clock
//   GET ?type=proposals            — mc_documents where doc_type='proposal'
//   GET ?type=contracts            — mc_documents where doc_type IN (sow,agreement,nda,msa,timeline)
//   GET ?type=invoices             — mc_invoices
//   GET ?type=activity&limit=30    — last N audit_log events across all engagements
//   GET ?type=summary              — counts for the dashboard tiles
//   GET ?type=notes&clientId=X     — mc_notes (all or per-client, per-engagement)
//   GET ?type=products             — mc_products service catalog
//   GET ?type=templates&category=X — mc_email_templates
//   GET ?type=webinars             — mc_webinar_events
//   GET ?type=submissions          — every signed/executed mc_documents row
//   GET ?type=transactions         — paid mc_invoices with Square payment IDs
//   GET ?type=revenue-report       — monthly revenue from paid invoices
//   GET ?type=funnel               — lead -> proposal -> signed -> paid conversion rates
//   GET ?type=lead-sources         — mc_clients grouped by source with conversion %
//   GET ?type=journey&clientId=X   — full customer journey timeline for a client
//                                    (emails sent/opened/clicked, page views,
//                                     payment-link clicks, all in chronological order)
//   GET ?type=email-stats          — open/click/bounce rates rolled up
// ═══════════════════════════════════════════════════════════════

const COOKIE_NAME = 'mcadmin_session';
const STORAGE_BUCKET = 'markcmo-engagement-docs';

const ALLOWED_ORIGINS = ['https://markcmo.com', 'http://localhost:8888'];

function corsHeaders(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// ─── Auth: verify the mcadmin_session cookie ────────────────────
async function verifyToken(token, secret) {
  try {
    const [dataB64, sigB64] = token.split('.');
    if (!dataB64 || !sigB64) return null;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sig = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(dataB64));
    if (!valid) return null;
    const payload = JSON.parse(atob(dataB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}

function parseCookies(h) {
  const out = {};
  (h || '').split(';').forEach(p => {
    const [k, ...v] = p.trim().split('=');
    if (k) out[k.trim()] = decodeURIComponent(v.join('='));
  });
  return out;
}

async function isAuthed(event) {
  // Accept either the mcadmin_session cookie OR the x-admin-api-token header
  // (latter is for server-to-server / smoke tests / cron-style triggers).
  const cookies = parseCookies(event.headers?.cookie || event.headers?.Cookie || '');
  const cookieToken = cookies[COOKIE_NAME];
  if (cookieToken) {
    const secret = process.env.ADMIN_SESSION_SECRET || process.env.TOKEN_SECRET || 'fallback';
    const payload = await verifyToken(cookieToken, secret);
    if (payload) return true;
  }
  const headerToken = event.headers?.['x-admin-api-token'] || event.headers?.['X-Admin-Api-Token'];
  if (headerToken && process.env.MARKCMO_ADMIN_API_TOKEN && headerToken === process.env.MARKCMO_ADMIN_API_TOKEN) {
    return true;
  }
  return false;
}

// ─── Supabase REST helpers ──────────────────────────────────────
function sb() {
  const url = process.env.MARKCMO_SUPABASE_URL;
  const key = process.env.MARKCMO_SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('MARKCMO_SUPABASE_URL or MARKCMO_SUPABASE_SERVICE_KEY not set');
  return { url, key };
}

async function sbSelect(path) {
  const { url, key } = sb();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Supabase select ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbStorageSignedUrl(path, expiresIn = 60 * 10) {
  const { url, key } = sb();
  const res = await fetch(`${url}/storage/v1/object/sign/${STORAGE_BUCKET}/${path}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) throw new Error(`Supabase signed URL ${path} failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const tail = data.signedURL || data.signedUrl;
  return `${url}/storage/v1${tail}`;
}

// ─── Handler ────────────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  // Gate every endpoint on admin session
  if (!(await isAuthed(event))) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const q = event.queryStringParameters || {};
  const type = q.type || 'clients';

  try {
    if (!process.env.MARKCMO_SUPABASE_URL || !process.env.MARKCMO_SUPABASE_SERVICE_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase env vars not set' }) };
    }

    // ─── /clients: list all clients with engagement+doc counts ──
    if (type === 'clients') {
      const clients = await sbSelect(
        'mc_clients?select=id,slug,legal_name,dba,primary_contact_name,primary_contact_email,country,region,status,created_at,updated_at,mc_engagements(id,name,fee_usd,delivery_window_hrs,status,proposed_at,accepted_at,paid_at,delivered_at,mc_documents(id,doc_id,doc_type,status))&order=updated_at.desc'
      );
      // Compact summary
      const summary = clients.map(c => ({
        id: c.id,
        slug: c.slug,
        legal_name: c.legal_name,
        dba: c.dba,
        primary_contact_name: c.primary_contact_name,
        primary_contact_email: c.primary_contact_email,
        country: c.country,
        region: c.region,
        status: c.status,
        engagements_count: (c.mc_engagements || []).length,
        engagement_total_usd: (c.mc_engagements || []).reduce((s, e) => s + Number(e.fee_usd || 0), 0),
        documents_count: (c.mc_engagements || []).reduce((s, e) => s + (e.mc_documents?.length || 0), 0),
        latest_engagement_status: c.mc_engagements?.[0]?.status || null,
        updated_at: c.updated_at,
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ clients: summary }) };
    }

    // ─── /case: full case file for one client ───────────────────
    if (type === 'case') {
      const slug = q.slug;
      if (!slug) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing slug' }) };

      const clients = await sbSelect(
        `mc_clients?slug=eq.${encodeURIComponent(slug)}&select=*,mc_engagements(*,mc_documents(*),mc_invoices(*))`
      );
      if (!clients.length) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: `Client ${slug} not found` }) };
      }
      const client = clients[0];
      const engagementIds = (client.mc_engagements || []).map(e => `id.eq.${e.id}`).join(',');
      const auditFilter = engagementIds ? `engagement_id=in.(${(client.mc_engagements || []).map(e => e.id).join(',')})` : null;
      const audit = auditFilter
        ? await sbSelect(`mc_audit_log?${auditFilter}&order=created_at.desc&limit=100`)
        : [];

      return { statusCode: 200, headers, body: JSON.stringify({ client, audit }) };
    }

    // ─── /signed-url: short-lived signed URL for a stored doc ───
    if (type === 'signed-url') {
      const path = q.path;
      if (!path) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing path' }) };
      // Safety: only allow paths under engagements/
      if (!path.startsWith('engagements/')) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid path prefix' }) };
      }
      const url = await sbStorageSignedUrl(path, 60 * 15); // 15-minute window
      return { statusCode: 200, headers, body: JSON.stringify({ url, expires_in: 900 }) };
    }

    // ─── /audit: events for one engagement ──────────────────────
    if (type === 'audit') {
      const engagementId = q.engagementId;
      if (!engagementId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing engagementId' }) };
      const audit = await sbSelect(
        `mc_audit_log?engagement_id=eq.${encodeURIComponent(engagementId)}&order=created_at.desc&limit=100`
      );
      return { statusCode: 200, headers, body: JSON.stringify({ audit }) };
    }

    // ─── /contacts: every mc_clients row, with engagement summary ──
    if (type === 'contacts') {
      const rows = await sbSelect(
        'mc_clients?select=id,slug,legal_name,dba,primary_contact_name,primary_contact_title,primary_contact_email,primary_contact_phone,country,region,source,status,cc_emails,notes,created_at,updated_at,mc_engagements(id,name,fee_usd,status,paid_at)&order=updated_at.desc'
      );
      const contacts = rows.map(c => {
        const eng = c.mc_engagements || [];
        return {
          id: c.id,
          slug: c.slug,
          legal_name: c.legal_name,
          dba: c.dba,
          primary_contact_name: c.primary_contact_name,
          primary_contact_title: c.primary_contact_title,
          primary_contact_email: c.primary_contact_email,
          primary_contact_phone: c.primary_contact_phone,
          country: c.country,
          region: c.region,
          source: c.source || 'manual',
          status: c.status,
          cc_emails: Array.isArray(c.cc_emails) ? c.cc_emails : [],
          engagements_count: eng.length,
          engagement_total_usd: eng.reduce((s,e) => s + Number(e.fee_usd || 0), 0),
          engagement_paid_usd: eng.filter(e => e.paid_at).reduce((s,e) => s + Number(e.fee_usd || 0), 0),
          latest_engagement_status: eng[0]?.status || null,
          created_at: c.created_at,
          updated_at: c.updated_at,
        };
      });
      return { statusCode: 200, headers, body: JSON.stringify({ contacts }) };
    }

    // ─── /active-clients: clients with at least one non-lead engagement ──
    if (type === 'active-clients') {
      const rows = await sbSelect(
        'mc_clients?select=id,slug,legal_name,dba,primary_contact_name,primary_contact_email,country,region,status,mc_engagements(id,name,fee_usd,delivery_window_hrs,status,proposed_at,accepted_at,paid_at,started_at,delivery_due_at,mc_invoices(id,status,amount_usd,paid_at))&order=updated_at.desc'
      );
      const active = rows
        .map(c => {
          const engs = (c.mc_engagements || []).filter(e => e.status && e.status !== 'lead' && e.status !== 'archived');
          return { ...c, mc_engagements: engs };
        })
        .filter(c => c.mc_engagements.length > 0)
        .map(c => ({
          id: c.id,
          slug: c.slug,
          legal_name: c.legal_name,
          dba: c.dba,
          primary_contact_name: c.primary_contact_name,
          primary_contact_email: c.primary_contact_email,
          country: c.country,
          region: c.region,
          status: c.status,
          engagements: c.mc_engagements.map(e => ({
            id: e.id,
            name: e.name,
            fee_usd: e.fee_usd,
            status: e.status,
            paid_at: e.paid_at,
            started_at: e.started_at,
            delivery_due_at: e.delivery_due_at,
            invoices_paid: (e.mc_invoices || []).filter(i => i.status === 'paid').length,
            amount_paid_usd: (e.mc_invoices || []).filter(i => i.status === 'paid').reduce((s,i) => s + Number(i.amount_usd || 0), 0),
          })),
          total_fee_usd: c.mc_engagements.reduce((s,e) => s + Number(e.fee_usd || 0), 0),
          total_paid_usd: c.mc_engagements.reduce((s,e) => s + (e.mc_invoices || []).filter(i => i.status === 'paid').reduce((ss,i) => ss + Number(i.amount_usd || 0), 0), 0),
        }));
      return { statusCode: 200, headers, body: JSON.stringify({ clients: active }) };
    }

    // ─── /pipeline: all engagements with client info, grouped client-side ──
    if (type === 'pipeline') {
      const rows = await sbSelect(
        'mc_engagements?select=id,name,fee_usd,delivery_window_hrs,status,proposed_at,accepted_at,paid_at,started_at,delivery_due_at,created_at,updated_at,mc_clients(id,slug,legal_name,dba,primary_contact_name,primary_contact_email)&order=updated_at.desc'
      );
      const items = rows.map(e => ({
        id: e.id,
        name: e.name,
        fee_usd: e.fee_usd,
        status: e.status || 'draft',
        proposed_at: e.proposed_at,
        accepted_at: e.accepted_at,
        paid_at: e.paid_at,
        started_at: e.started_at,
        delivery_due_at: e.delivery_due_at,
        delivery_window_hrs: e.delivery_window_hrs,
        updated_at: e.updated_at,
        client_id: e.mc_clients?.id,
        client_slug: e.mc_clients?.slug,
        client_name: e.mc_clients?.legal_name,
        client_dba: e.mc_clients?.dba,
        client_contact: e.mc_clients?.primary_contact_name,
        client_email: e.mc_clients?.primary_contact_email,
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ engagements: items }) };
    }

    // ─── /projects: engagements paid or delivering ──────────────
    if (type === 'projects') {
      // Status flexibility: any of these means "active project"
      const activeStatuses = ['paid', 'delivering', 'invoiced'];
      const filter = activeStatuses.map(s => `status.eq.${s}`).join(',');
      const rows = await sbSelect(
        `mc_engagements?or=(${filter})&select=id,name,fee_usd,delivery_window_hrs,status,paid_at,started_at,delivery_due_at,proposed_at,accepted_at,mc_clients(id,slug,legal_name,dba,primary_contact_name,primary_contact_email),mc_documents(id,doc_id,doc_type,status),mc_invoices(id,status,amount_usd,paid_at)&order=delivery_due_at.asc`
      );
      const now = Date.now();
      const projects = rows.map(e => {
        const due = e.delivery_due_at ? new Date(e.delivery_due_at).getTime() : null;
        const hoursToDelivery = due ? Math.round((due - now) / 36e5) : null;
        const docCounts = (e.mc_documents || []).reduce((acc, d) => { acc[d.status || 'unknown'] = (acc[d.status || 'unknown'] || 0) + 1; return acc; }, {});
        const paidInvoice = (e.mc_invoices || []).find(i => i.status === 'paid');
        return {
          id: e.id,
          name: e.name,
          fee_usd: e.fee_usd,
          status: e.status,
          paid_at: e.paid_at,
          started_at: e.started_at,
          delivery_due_at: e.delivery_due_at,
          delivery_window_hrs: e.delivery_window_hrs,
          hours_to_delivery: hoursToDelivery,
          overdue: hoursToDelivery !== null && hoursToDelivery < 0,
          client_slug: e.mc_clients?.slug,
          client_name: e.mc_clients?.legal_name,
          client_contact: e.mc_clients?.primary_contact_name,
          client_email: e.mc_clients?.primary_contact_email,
          docs_total: (e.mc_documents || []).length,
          docs_executed: docCounts['executed'] || 0,
          docs_pending: ((e.mc_documents || []).length - (docCounts['executed'] || 0)),
          paid_invoice_amount: paidInvoice?.amount_usd || 0,
        };
      });
      return { statusCode: 200, headers, body: JSON.stringify({ projects }) };
    }

    // ─── /proposals: mc_documents where doc_type='proposal' ─────
    if (type === 'proposals') {
      return await listDocsByType(headers, ['proposal']);
    }

    // ─── /contracts: SOWs, agreements, NDAs, MSAs, timelines ────
    if (type === 'contracts') {
      return await listDocsByType(headers, ['sow', 'agreement', 'msa', 'nda', 'timeline', 'engagement']);
    }

    // ─── /invoices: every mc_invoices row ───────────────────────
    if (type === 'invoices') {
      const rows = await sbSelect(
        'mc_invoices?select=id,square_invoice_id,square_invoice_url,status,amount_usd,is_test,draft_at,sent_at,paid_at,void_at,reminder_count,last_reminder_at,escalated_at,mc_engagements(id,name,fee_usd,delivery_window_hrs,mc_clients(id,slug,legal_name,primary_contact_name,primary_contact_email))&order=draft_at.desc'
      );
      const invoices = rows.map(i => ({
        id: i.id,
        square_invoice_id: i.square_invoice_id,
        square_invoice_url: i.square_invoice_url,
        status: i.status,
        amount_usd: i.amount_usd,
        is_test: i.is_test,
        draft_at: i.draft_at,
        sent_at: i.sent_at,
        paid_at: i.paid_at,
        void_at: i.void_at,
        reminder_count: i.reminder_count || 0,
        last_reminder_at: i.last_reminder_at,
        escalated_at: i.escalated_at,
        engagement_id: i.mc_engagements?.id,
        engagement_name: i.mc_engagements?.name,
        client_slug: i.mc_engagements?.mc_clients?.slug,
        client_name: i.mc_engagements?.mc_clients?.legal_name,
        client_contact: i.mc_engagements?.mc_clients?.primary_contact_name,
        client_email: i.mc_engagements?.mc_clients?.primary_contact_email,
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ invoices }) };
    }

    // ─── /activity: recent mc_audit_log across ALL engagements ──
    if (type === 'activity') {
      const limit = Math.min(Number(q.limit || 30), 100);
      const rows = await sbSelect(
        `mc_audit_log?select=id,event,payload,ip,created_at,engagement_id,client_id&order=created_at.desc&limit=${limit}`
      );
      // Resolve client + engagement names (one extra fetch each, lookup map)
      const clientIds = Array.from(new Set(rows.map(r => r.client_id).filter(Boolean)));
      const engIds = Array.from(new Set(rows.map(r => r.engagement_id).filter(Boolean)));
      const [clients, engs] = await Promise.all([
        clientIds.length ? sbSelect(`mc_clients?id=in.(${clientIds.join(',')})&select=id,slug,legal_name`) : Promise.resolve([]),
        engIds.length ? sbSelect(`mc_engagements?id=in.(${engIds.join(',')})&select=id,name,client_id,mc_clients(id,slug,legal_name)`) : Promise.resolve([]),
      ]);
      const cMap = Object.fromEntries(clients.map(c => [c.id, c]));
      const eMap = Object.fromEntries(engs.map(e => [e.id, e]));
      const events = rows.map(r => {
        const eng = r.engagement_id ? eMap[r.engagement_id] : null;
        const cli = (r.client_id ? cMap[r.client_id] : null) || eng?.mc_clients || null;
        return {
          id: r.id,
          event: r.event,
          created_at: r.created_at,
          ip: r.ip,
          recipient: r.payload?.recipient || null,
          subject: r.payload?.subject || null,
          amount_usd: r.payload?.amount_usd || null,
          is_test: r.payload?.is_test === true || r.payload?.testMode === true,
          doc_id: r.payload?.docId || r.payload?.doc_id || null,
          client_slug: cli?.slug || null,
          client_name: cli?.legal_name || null,
          engagement_name: eng?.name || null,
        };
      });
      return { statusCode: 200, headers, body: JSON.stringify({ events }) };
    }

    // ─── /notes: list mc_notes, optionally filtered ─────────────
    if (type === 'notes') {
      const filters = [];
      if (q.clientId) filters.push(`client_id=eq.${encodeURIComponent(q.clientId)}`);
      if (q.engagementId) filters.push(`engagement_id=eq.${encodeURIComponent(q.engagementId)}`);
      const path = `mc_notes?${filters.join('&')}${filters.length ? '&' : ''}select=*,mc_clients(slug,legal_name)&order=pinned.desc,created_at.desc&limit=200`;
      const rows = await sbSelect(path);
      const notes = rows.map(n => ({
        id: n.id, client_id: n.client_id, engagement_id: n.engagement_id,
        author: n.author, category: n.category, body: n.body, pinned: n.pinned,
        created_at: n.created_at, updated_at: n.updated_at,
        client_slug: n.mc_clients?.slug, client_name: n.mc_clients?.legal_name,
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ notes }) };
    }

    // ─── /products: service catalog ─────────────────────────────
    if (type === 'products') {
      const rows = await sbSelect('mc_products?select=*&order=display_order.asc,name.asc');
      return { statusCode: 200, headers, body: JSON.stringify({ products: rows }) };
    }

    // ─── /templates: mc_email_templates ─────────────────────────
    if (type === 'templates') {
      const filter = q.category ? `category=eq.${encodeURIComponent(q.category)}&` : '';
      const rows = await sbSelect(`mc_email_templates?${filter}select=id,slug,name,category,subject,preheader,variables,is_active,last_sent_at,send_count,created_at,updated_at&order=updated_at.desc`);
      return { statusCode: 200, headers, body: JSON.stringify({ templates: rows }) };
    }

    // ─── /webinars: mc_webinar_events ───────────────────────────
    if (type === 'webinars') {
      const rows = await sbSelect('mc_webinar_events?select=*&order=scheduled_at.desc,created_at.desc');
      return { statusCode: 200, headers, body: JSON.stringify({ webinars: rows }) };
    }

    // ─── /submissions: every signed or executed document ────────
    if (type === 'submissions') {
      const rows = await sbSelect(
        'mc_documents?or=(status.eq.client_signed,status.eq.executed,status.eq.submitted)&select=id,doc_id,doc_type,doc_name,status,storage_path,client_signed_at,executed_at,client_ip,fields,mc_engagements(id,name,fee_usd,mc_clients(id,slug,legal_name,primary_contact_name,primary_contact_email))&order=client_signed_at.desc.nullslast,executed_at.desc.nullslast'
      );
      const submissions = rows.map(d => ({
        id: d.id, doc_id: d.doc_id, doc_type: d.doc_type, doc_name: d.doc_name,
        status: d.status, storage_path: d.storage_path,
        client_signed_at: d.client_signed_at, executed_at: d.executed_at,
        client_ip: d.client_ip, fields: d.fields,
        engagement_name: d.mc_engagements?.name, engagement_fee_usd: d.mc_engagements?.fee_usd,
        client_slug: d.mc_engagements?.mc_clients?.slug,
        client_name: d.mc_engagements?.mc_clients?.legal_name,
        client_contact: d.mc_engagements?.mc_clients?.primary_contact_name,
        client_email: d.mc_engagements?.mc_clients?.primary_contact_email,
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ submissions }) };
    }

    // ─── /transactions: paid invoices, Square-transaction view ──
    if (type === 'transactions') {
      const rows = await sbSelect(
        'mc_invoices?status=eq.paid&select=id,square_invoice_id,square_invoice_url,square_payment_id,amount_usd,is_test,paid_at,mc_engagements(id,name,mc_clients(id,slug,legal_name,primary_contact_name))&order=paid_at.desc'
      );
      const transactions = rows.map(i => ({
        id: i.id, square_invoice_id: i.square_invoice_id,
        square_invoice_url: i.square_invoice_url,
        square_payment_id: i.square_payment_id,
        amount_usd: i.amount_usd, is_test: i.is_test, paid_at: i.paid_at,
        engagement_name: i.mc_engagements?.name,
        client_slug: i.mc_engagements?.mc_clients?.slug,
        client_name: i.mc_engagements?.mc_clients?.legal_name,
        client_contact: i.mc_engagements?.mc_clients?.primary_contact_name,
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ transactions }) };
    }

    // ─── /revenue-report: monthly buckets from paid invoices ────
    if (type === 'revenue-report') {
      const invoices = await sbSelect('mc_invoices?status=eq.paid&select=amount_usd,paid_at,is_test');
      const buckets = {};
      const live = invoices.filter(i => !i.is_test);
      for (const i of live) {
        if (!i.paid_at) continue;
        const d = new Date(i.paid_at);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        if (!buckets[key]) buckets[key] = { month: key, count: 0, revenue: 0 };
        buckets[key].count += 1;
        buckets[key].revenue += Number(i.amount_usd || 0);
      }
      const months = Object.values(buckets).sort((a, b) => a.month.localeCompare(b.month));
      const totalRevenue = months.reduce((s, m) => s + m.revenue, 0);
      const totalCount = months.reduce((s, m) => s + m.count, 0);
      const avgInvoice = totalCount ? totalRevenue / totalCount : 0;
      return { statusCode: 200, headers, body: JSON.stringify({
        months, total_revenue: totalRevenue, total_count: totalCount,
        avg_invoice: avgInvoice, test_count: invoices.length - live.length,
      }) };
    }

    // ─── /funnel: lead → proposal_sent → signed → paid % ────────
    if (type === 'funnel') {
      const [clients, engs, docs, invoices] = await Promise.all([
        sbSelect('mc_clients?select=id,source,status,created_at'),
        sbSelect('mc_engagements?select=id,client_id,status,proposed_at,accepted_at,paid_at'),
        sbSelect('mc_documents?select=id,engagement_id,status,client_signed_at,executed_at'),
        sbSelect('mc_invoices?select=id,engagement_id,status,paid_at,is_test'),
      ]);
      const liveInvoices = invoices.filter(i => !i.is_test);
      const totalContacts = clients.length;
      const totalEngagements = engs.length;
      const proposalSent = engs.filter(e => e.proposed_at || ['proposal_sent','signed','invoiced','paid','delivering','delivered'].includes(e.status)).length;
      const clientSigned = docs.filter(d => d.client_signed_at).length;
      const executed = docs.filter(d => d.executed_at).length;
      const paid = liveInvoices.filter(i => i.status === 'paid').length;
      const funnel = [
        { stage: 'Contact Created', count: totalContacts, pct: 100 },
        { stage: 'Engagement Drafted', count: totalEngagements, pct: totalContacts ? +(totalEngagements / totalContacts * 100).toFixed(1) : 0 },
        { stage: 'Proposal Sent', count: proposalSent, pct: totalContacts ? +(proposalSent / totalContacts * 100).toFixed(1) : 0 },
        { stage: 'Client Signed', count: clientSigned, pct: totalContacts ? +(clientSigned / totalContacts * 100).toFixed(1) : 0 },
        { stage: 'Executed', count: executed, pct: totalContacts ? +(executed / totalContacts * 100).toFixed(1) : 0 },
        { stage: 'Paid', count: paid, pct: totalContacts ? +(paid / totalContacts * 100).toFixed(1) : 0 },
      ];
      return { statusCode: 200, headers, body: JSON.stringify({ funnel }) };
    }

    // ─── /lead-sources: mc_clients grouped by source ────────────
    if (type === 'lead-sources') {
      const rows = await sbSelect('mc_clients?select=id,source,status,created_at,mc_engagements(id,status,fee_usd,paid_at,mc_invoices(id,status,amount_usd,is_test))');
      const groups = {};
      for (const c of rows) {
        const key = c.source || 'unknown';
        if (!groups[key]) groups[key] = { source: key, contacts: 0, engagements: 0, paid: 0, revenue: 0 };
        groups[key].contacts += 1;
        const engs = c.mc_engagements || [];
        groups[key].engagements += engs.length;
        for (const e of engs) {
          const inv = (e.mc_invoices || []).filter(i => !i.is_test);
          for (const i of inv) {
            if (i.status === 'paid') {
              groups[key].paid += 1;
              groups[key].revenue += Number(i.amount_usd || 0);
            }
          }
        }
      }
      const sources = Object.values(groups)
        .map(g => ({ ...g, conversion_pct: g.contacts ? +(g.paid / g.contacts * 100).toFixed(1) : 0 }))
        .sort((a, b) => b.contacts - a.contacts);
      return { statusCode: 200, headers, body: JSON.stringify({ sources }) };
    }

    // ─── /journey: customer-journey timeline for one client ────
    if (type === 'journey') {
      const clientId = q.clientId;
      const slug = q.slug;
      let cId = clientId;
      if (!cId && slug) {
        const c = await sbSelect(`mc_clients?slug=eq.${encodeURIComponent(slug)}&select=id&limit=1`);
        cId = c[0]?.id;
      }
      if (!cId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Provide clientId or slug' }) };

      const limit = Math.min(Number(q.limit || 200), 500);
      const events = await sbSelect(
        `mc_journey_events?client_id=eq.${encodeURIComponent(cId)}&select=*&order=created_at.asc&limit=${limit}`
      );

      // Roll-up stats per email (group by resend_email_id)
      const byEmail = {};
      for (const e of events) {
        if (e.category !== 'email' || !e.resend_email_id) continue;
        const k = e.resend_email_id;
        if (!byEmail[k]) byEmail[k] = {
          resend_email_id: k,
          subject: e.subject_or_url,
          recipient: e.recipient_email,
          first_seen: e.created_at,
          last_seen: e.created_at,
          sent_at: null, delivered_at: null, opened_at: null, clicked_at: null,
          bounced_at: null, complained_at: null,
          open_count: 0, click_count: 0,
        };
        const slot = byEmail[k];
        slot.last_seen = e.created_at;
        if (e.event === 'email_sent' && !slot.sent_at) slot.sent_at = e.created_at;
        if (e.event === 'email_delivered' && !slot.delivered_at) slot.delivered_at = e.created_at;
        if (e.event === 'email_opened') { slot.opened_at = slot.opened_at || e.created_at; slot.open_count++; }
        if (e.event === 'email_clicked') { slot.clicked_at = slot.clicked_at || e.created_at; slot.click_count++; }
        if (e.event === 'email_bounced' && !slot.bounced_at) slot.bounced_at = e.created_at;
        if (e.event === 'email_complained' && !slot.complained_at) slot.complained_at = e.created_at;
      }

      // Page-view rollup
      const pageViews = events.filter(e => e.category === 'page');
      const pageStats = {};
      for (const v of pageViews) {
        const p = v.subject_or_url || 'unknown';
        pageStats[p] = (pageStats[p] || 0) + 1;
      }

      const summary = {
        emails_sent: Object.values(byEmail).filter(e => e.sent_at).length,
        emails_opened: Object.values(byEmail).filter(e => e.opened_at).length,
        emails_clicked: Object.values(byEmail).filter(e => e.clicked_at).length,
        emails_bounced: Object.values(byEmail).filter(e => e.bounced_at).length,
        page_views_total: pageViews.length,
        page_views_by_kind: pageStats,
        payment_link_clicks: events.filter(e => e.event === 'payment_link_click').length,
        first_touch: events[0]?.created_at || null,
        last_touch: events[events.length - 1]?.created_at || null,
      };

      return { statusCode: 200, headers, body: JSON.stringify({
        events,
        emails: Object.values(byEmail).sort((a, b) => new Date(b.first_seen) - new Date(a.first_seen)),
        summary,
      }) };
    }

    // ─── /email-stats: rolled-up open/click/bounce rates ───────
    if (type === 'email-stats') {
      const events = await sbSelect('mc_journey_events?category=eq.email&select=event,resend_email_id,client_id,recipient_email,created_at&limit=2000');
      const byEmail = {};
      for (const e of events) {
        if (!e.resend_email_id) continue;
        if (!byEmail[e.resend_email_id]) byEmail[e.resend_email_id] = { sent: false, opened: false, clicked: false, bounced: false };
        const k = byEmail[e.resend_email_id];
        if (e.event === 'email_sent') k.sent = true;
        if (e.event === 'email_delivered') k.sent = true; // count delivered as sent for rate calc
        if (e.event === 'email_opened') k.opened = true;
        if (e.event === 'email_clicked') k.clicked = true;
        if (e.event === 'email_bounced') k.bounced = true;
      }
      const all = Object.values(byEmail);
      const sent = all.filter(e => e.sent).length;
      const opened = all.filter(e => e.opened).length;
      const clicked = all.filter(e => e.clicked).length;
      const bounced = all.filter(e => e.bounced).length;
      return { statusCode: 200, headers, body: JSON.stringify({
        emails_total: all.length,
        sent, opened, clicked, bounced,
        open_rate: sent ? +(opened / sent * 100).toFixed(1) : 0,
        click_rate: sent ? +(clicked / sent * 100).toFixed(1) : 0,
        click_through_rate: opened ? +(clicked / opened * 100).toFixed(1) : 0,
        bounce_rate: sent ? +(bounced / sent * 100).toFixed(1) : 0,
      }) };
    }

    // ─── /summary: dashboard tile counts ────────────────────────
    if (type === 'summary') {
      const [clients, engs, docs, invoices] = await Promise.all([
        sbSelect('mc_clients?select=id,status'),
        sbSelect('mc_engagements?select=id,status,fee_usd,paid_at,delivery_due_at,mc_invoices(id,status,amount_usd)'),
        sbSelect('mc_documents?select=id,doc_type,status'),
        sbSelect('mc_invoices?select=id,status,amount_usd,is_test'),
      ]);
      const now = Date.now();
      const sum = {
        contacts_total: clients.length,
        clients_lead: clients.filter(c => c.status === 'lead').length,
        engagements_total: engs.length,
        engagements_active: engs.filter(e => ['paid','delivering','invoiced'].includes(e.status)).length,
        engagements_overdue: engs.filter(e => e.delivery_due_at && new Date(e.delivery_due_at).getTime() < now && e.status !== 'delivered').length,
        proposals_total: docs.filter(d => d.doc_type === 'proposal').length,
        contracts_total: docs.filter(d => ['sow','agreement','msa','nda','timeline','engagement'].includes(d.doc_type)).length,
        invoices_total: invoices.filter(i => !i.is_test).length,
        invoices_outstanding: invoices.filter(i => i.status === 'sent' && !i.is_test).length,
        invoices_paid: invoices.filter(i => i.status === 'paid' && !i.is_test).length,
        revenue_paid_usd: invoices.filter(i => i.status === 'paid' && !i.is_test).reduce((s,i) => s + Number(i.amount_usd || 0), 0),
        revenue_outstanding_usd: invoices.filter(i => i.status === 'sent' && !i.is_test).reduce((s,i) => s + Number(i.amount_usd || 0), 0),
      };
      return { statusCode: 200, headers, body: JSON.stringify({ summary: sum }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown type: ${type}` }) };
  } catch (err) {
    console.error('admin-engagement-data error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || 'Internal error' }) };
  }
};

// ─── Helper: list mc_documents filtered by doc_type list ─────────
async function listDocsByType(headers, types) {
  const filter = types.map(t => `doc_type.eq.${encodeURIComponent(t)}`).join(',');
  const rows = await sbSelect(
    `mc_documents?or=(${filter})&select=id,doc_id,doc_type,doc_name,status,storage_path,client_signed_at,executed_at,client_ip,created_at,updated_at,mc_engagements(id,name,fee_usd,status,mc_clients(id,slug,legal_name,primary_contact_name,primary_contact_email))&order=updated_at.desc`
  );
  const items = rows.map(d => ({
    id: d.id,
    doc_id: d.doc_id,
    doc_type: d.doc_type,
    doc_name: d.doc_name,
    status: d.status,
    storage_path: d.storage_path,
    client_signed_at: d.client_signed_at,
    executed_at: d.executed_at,
    client_ip: d.client_ip,
    created_at: d.created_at,
    updated_at: d.updated_at,
    engagement_id: d.mc_engagements?.id,
    engagement_name: d.mc_engagements?.name,
    engagement_fee_usd: d.mc_engagements?.fee_usd,
    engagement_status: d.mc_engagements?.status,
    client_slug: d.mc_engagements?.mc_clients?.slug,
    client_name: d.mc_engagements?.mc_clients?.legal_name,
    client_contact: d.mc_engagements?.mc_clients?.primary_contact_name,
    client_email: d.mc_engagements?.mc_clients?.primary_contact_email,
  }));
  return { statusCode: 200, headers, body: JSON.stringify({ documents: items }) };
}

