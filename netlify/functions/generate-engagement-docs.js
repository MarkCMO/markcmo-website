// ═══════════════════════════════════════════════════════════════
// generate-engagement-docs.js
//
// Admin-gated. Takes a client slug + engagement details and writes
// the engagement record + 3 placeholder documents (proposal, SOW,
// timeline) into Supabase. After this, Mark either:
//   1. Clones documents/clients/wendal-enterprise/ to a new folder
//      and customizes (current quickest path), OR
//   2. (Future) The system renders dynamic templates from storage.
//
// POST body:
//   {
//     "clientSlug": "acme-corp",         // required, must already exist
//     "name": "Business Discovery Audit", // optional, default 'Business Discovery Audit'
//     "docPrefix": "AC-AUD",             // required, used for doc IDs (AC-AUD-001 etc.)
//     "feeUsd": 2500,
//     "deliveryWindowHrs": 72,
//     "description": "..."               // optional
//   }
// ═══════════════════════════════════════════════════════════════
const { sbSelect, sbUpdate, sbInsert, isAdminAuthed, corsHeaders } = require('./_lib_supabase');

exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  if (!(await isAdminAuthed(event))) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const {
    clientSlug,
    name = 'Business Discovery Audit',
    docPrefix,
    feeUsd = 2500,
    deliveryWindowHrs = 72,
    description = '',
  } = body;

  if (!clientSlug) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing clientSlug' }) };
  if (!docPrefix)  return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing docPrefix (e.g. AC-AUD)' }) };
  if (!/^[A-Z0-9]{2,8}-[A-Z0-9]{2,8}$/.test(docPrefix)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'docPrefix must look like XX-YYY (uppercase letters/digits)' }) };
  }

  try {
    // Look up client
    const clients = await sbSelect(`mc_clients?slug=eq.${encodeURIComponent(clientSlug)}&select=*&limit=1`);
    if (!clients.length) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: `Client ${clientSlug} not found` }) };
    }
    const client = clients[0];

    // Find or create the engagement (if a 'lead' status engagement exists, upgrade it)
    let engagement;
    const leads = await sbSelect(`mc_engagements?client_id=eq.${client.id}&status=eq.lead&select=*&limit=1`);
    if (leads.length) {
      // Upgrade the lead to a real engagement
      const updated = await sbUpdate('mc_engagements', `id=eq.${leads[0].id}`, {
        doc_prefix: docPrefix,
        name,
        description,
        fee_usd: feeUsd,
        delivery_window_hrs: deliveryWindowHrs,
        status: 'draft',
      });
      engagement = updated[0];
    } else {
      // Create fresh
      const inserted = await sbInsert('mc_engagements', {
        client_id: client.id,
        doc_prefix: docPrefix,
        name,
        description,
        fee_usd: feeUsd,
        delivery_window_hrs: deliveryWindowHrs,
        status: 'draft',
      });
      engagement = inserted[0];
    }

    // Create the 3 standard documents (proposal, sow, timeline) if they don't exist
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const docs = [
      { doc_id: `${docPrefix}-001`, doc_type: 'proposal', doc_name: `${name} Proposal` },
      { doc_id: `${docPrefix}-002`, doc_type: 'sow',      doc_name: `${name} Scope of Work` },
      { doc_id: `${docPrefix}-003`, doc_type: 'timeline', doc_name: `${deliveryWindowHrs}-Hour Deliverable Timeline` },
    ];

    const createdDocs = [];
    for (const d of docs) {
      const existing = await sbSelect(`mc_documents?doc_id=eq.${d.doc_id}&select=id&limit=1`);
      if (existing.length) {
        createdDocs.push({ ...d, status: 'already exists' });
        continue;
      }
      const inserted = await sbInsert('mc_documents', {
        engagement_id: engagement.id,
        doc_id: d.doc_id,
        doc_type: d.doc_type,
        doc_name: d.doc_name,
        status: 'draft',
        expires_at: expiresAt,
      });
      createdDocs.push({ ...d, status: 'created', id: inserted[0].id });
    }

    // Audit log
    await sbInsert('mc_audit_log', {
      client_id: client.id,
      engagement_id: engagement.id,
      event: 'engagement_docs_generated',
      payload: { docPrefix, name, feeUsd, deliveryWindowHrs, docs: createdDocs },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        client: { id: client.id, slug: client.slug, legal_name: client.legal_name },
        engagement,
        docs: createdDocs,
        next_steps: [
          `Engagement records created in Supabase (status='draft').`,
          `To make the document URLs render, clone documents/clients/wendal-enterprise/ to documents/clients/${clientSlug}/ and customize.`,
          `Then send the proposal email via the VDR's Send Proposal Email button.`,
        ],
      }),
    };
  } catch (err) {
    console.error('generate-engagement-docs error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
