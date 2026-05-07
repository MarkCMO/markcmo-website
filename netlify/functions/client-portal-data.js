// ═══════════════════════════════════════════════════════════════
// client-portal-data.js
//
// PUBLIC endpoint (no admin auth) returning a sanitized snapshot
// of one client's engagement state. Powers /portal/{slug} where
// the client lands without logging in to see proposal status,
// payment status, delivery countdown, and signed/executed docs.
//
// Security model:
//   - Slug is the only token. Slugs are mostly-guessable (legal
//     name) so this is "security through unguessability" only
//     for THIS endpoint. We expose ONLY the fields below — no
//     internal IDs, no IPs, no audit trail, no other clients.
//   - Rate-limited via Netlify edge (~1 req/sec/IP is enough for
//     a human browsing).
//   - Logs every portal load to mc_journey_events as a page_view
//     so Mark sees client engagement in the timeline.
//
// GET ?slug=wendal-enterprise
// Returns:
//   {
//     client: { legal_name, dba, primary_contact_name, status },
//     engagements: [{ name, fee_usd, delivery_window_hrs, status,
//                     proposed_at, accepted_at, paid_at, started_at,
//                     delivery_due_at, hours_to_delivery,
//                     documents: [{ doc_id, doc_type, doc_name, status,
//                                   client_signed_at, executed_at }],
//                     invoice: { status, amount_usd, sent_at, paid_at,
//                                pay_url, square_invoice_url }|null }],
//   }
// ═══════════════════════════════════════════════════════════════
const { sbSelect, sbInsert } = require('./_lib_supabase');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'GET only' }) };

  const q = event.queryStringParameters || {};
  const slug = sanitizeSlug(q.slug);
  if (!slug) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid slug' }) };

  let rows;
  try {
    rows = await sbSelect(
      `mc_clients?slug=eq.${encodeURIComponent(slug)}&select=id,slug,legal_name,dba,primary_contact_name,status,mc_engagements(id,name,fee_usd,delivery_window_hrs,status,proposed_at,accepted_at,paid_at,started_at,delivery_due_at,mc_documents(doc_id,doc_type,doc_name,status,client_signed_at,executed_at,storage_path),mc_invoices(id,status,amount_usd,is_test,sent_at,paid_at,square_invoice_url))&limit=1`
    );
  } catch (e) {
    console.error('client-portal-data lookup failed:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Lookup failed' }) };
  }
  if (!rows.length) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };

  const c = rows[0];
  const now = Date.now();
  const ip = event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || event.headers?.['x-real-ip'] || null;
  const ua = event.headers?.['user-agent'] || null;

  // Sanitize: NEVER ship internal UUIDs, IPs, audit trails, or other clients' data
  const engagements = (c.mc_engagements || [])
    .sort((a, b) => new Date(b.proposed_at || b.paid_at || 0) - new Date(a.proposed_at || a.paid_at || 0))
    .map(e => {
      const dueAt = e.delivery_due_at ? new Date(e.delivery_due_at).getTime() : null;
      const hours_to_delivery = dueAt ? Math.round((dueAt - now) / 3600000) : null;
      const docs = (e.mc_documents || []).sort((a, b) => (a.doc_id || '').localeCompare(b.doc_id || ''))
        .map(d => ({
          doc_id: d.doc_id,
          doc_type: d.doc_type,
          doc_name: d.doc_name,
          status: d.status,
          client_signed_at: d.client_signed_at,
          executed_at: d.executed_at,
          has_pdf: !!d.storage_path,
        }));
      // Find the most recent non-test, non-void invoice
      const inv = (e.mc_invoices || [])
        .filter(i => !i.is_test && i.status !== 'void')
        .sort((a, b) => new Date(b.sent_at || 0) - new Date(a.sent_at || 0))[0] || null;
      const invoiceOut = inv ? {
        status: inv.status,
        amount_usd: inv.amount_usd,
        sent_at: inv.sent_at,
        paid_at: inv.paid_at,
        pay_url: `https://markcmo.com/pay/${inv.id}?src=portal`,
        square_invoice_url: inv.square_invoice_url,
      } : null;
      return {
        name: e.name,
        fee_usd: e.fee_usd,
        delivery_window_hrs: e.delivery_window_hrs,
        status: e.status,
        proposed_at: e.proposed_at,
        accepted_at: e.accepted_at,
        paid_at: e.paid_at,
        started_at: e.started_at,
        delivery_due_at: e.delivery_due_at,
        hours_to_delivery,
        overdue: hours_to_delivery !== null && hours_to_delivery < 0,
        documents: docs,
        invoice: invoiceOut,
        // Direct URLs to the per-client documents (already public via slug)
        urls: {
          proposal: `https://markcmo.com/documents/clients/${c.slug}/proposal`,
          sow: `https://markcmo.com/documents/clients/${c.slug}/sow`,
          timeline: `https://markcmo.com/documents/clients/${c.slug}/timeline`,
          cover: `https://markcmo.com/documents/clients/${c.slug}`,
          sign: `https://markcmo.com/documents/clients/${c.slug}/sign`,
        },
      };
    });

  // Log a portal_view journey event (best-effort)
  try {
    await sbInsert('mc_journey_events', {
      client_id: c.id,
      category: 'page',
      event: 'page_view',
      subject_or_url: 'portal',
      ip, user_agent: ua,
      raw: { source: 'client-portal-data', slug },
    });
  } catch {}

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      client: {
        legal_name: c.legal_name,
        dba: c.dba,
        primary_contact_name: c.primary_contact_name,
        status: c.status,
      },
      engagements,
      generated_at: new Date().toISOString(),
    }),
  };
};

function sanitizeSlug(s) {
  if (typeof s !== 'string') return null;
  const t = s.trim().toLowerCase();
  return /^[a-z0-9-]{1,80}$/.test(t) ? t : null;
}
