#!/usr/bin/env node
/*
 * seed-cirilo.js
 *
 * One-time seed script for the Cirilo Design + Build prospect engagement.
 * Creates the client, engagement, and four document records in Supabase
 * so admin.html / admin/vdr/ / the sign form all wire up correctly.
 *
 * Idempotent: safe to re-run. Skips any record that already exists.
 *
 * Run locally:
 *   netlify env:get MARKCMO_SUPABASE_URL          (verify set)
 *   netlify env:get MARKCMO_SUPABASE_SERVICE_KEY  (verify set)
 *   netlify env:exec -- node scripts/seed-cirilo.js
 *
 * Or with explicit env vars:
 *   MARKCMO_SUPABASE_URL=https://saoomfwycegflxelggxv.supabase.co \
 *   MARKCMO_SUPABASE_SERVICE_KEY=... \
 *   node scripts/seed-cirilo.js
 */

const SUPABASE_URL = process.env.MARKCMO_SUPABASE_URL;
const SERVICE_KEY  = process.env.MARKCMO_SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('FATAL: MARKCMO_SUPABASE_URL and MARKCMO_SUPABASE_SERVICE_KEY must be set.');
  console.error('Try: netlify env:exec -- node scripts/seed-cirilo.js');
  process.exit(1);
}

// ─── Supabase REST helpers ──────────────────────────────────────────
async function sbSelect(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`SELECT ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbInsert(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`INSERT ${table} -> ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows[0];
}

async function sbUpdate(table, filter, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`UPDATE ${table} -> ${res.status} ${await res.text()}`);
  return res.json();
}

// ─── Seed config ────────────────────────────────────────────────────
const SLUG = 'cirilo-design-build';
const DOC_PREFIX = 'CDB';

const CLIENT_DATA = {
  slug: SLUG,
  legal_name: 'Cirilo Design + Build',
  dba: 'Cirilo Design + Build',
  primary_contact_name: 'Tiffany Cirilo',
  primary_contact_title: 'Owner',
  primary_contact_email: 'Tiffany@CiriloDB.com',
  primary_contact_phone: '(910) 409-0648',
  website: 'https://www.cirilodb.com',
  country: 'US',
  region: 'NC',
  source: 'inbound-referral',
  status: 'prospect',
  notes: 'Charlotte luxury pool builder. Owners Ramon and Tiffany Cirilo. Greenfield digital footprint, design-led modern luxury positioning. Engagement scoped at Tier 2 Growth ($487K Y1).',
  tags: ['luxury-pool', 'charlotte-nc', 'design-build', 'prospect-2026'],
  cc_emails: [],
};

const ENGAGEMENT_DATA = {
  doc_prefix: DOC_PREFIX,
  name: 'Marketing & Growth Engagement (Tier 2 Recommended)',
  description: '12-month fractional CMO engagement to take Cirilo Design + Build to category leader in Charlotte luxury pool market. Three tier options (Foundation $230K, Growth $487K, Dominate $802K). Recommended tier: Growth.',
  fee_usd: 486500,
  delivery_window_hrs: 8760, // 12 months in hours, used as engagement length signal
  status: 'lead',
  metadata: {
    tier_recommended: 2,
    tier_options: {
      '1': { name: 'Foundation', total_y1: 230500, build: 38500, retainer_mo: 8500, media_mo: 7500 },
      '2': { name: 'Growth',     total_y1: 486500, build: 72500, retainer_mo: 14500, media_mo: 18000 },
      '3': { name: 'Dominate',   total_y1: 801840, build: 118000, retainer_mo: 22000, media_mo: 36000 },
    },
    cover_url: '/documents/clients/cirilo-design-build/',
    sign_url: '/forms/cirilo-design-build-sign.html',
    blended_aov: 225000,
    target_signed_contracts_y1: '22 to 32',
    target_y1_revenue: '$4.95M to $7.20M',
  },
};

const DOCS = [
  {
    doc_id: `${DOC_PREFIX}-AUD-001`,
    doc_type: 'audit',
    doc_name: 'Discovery Audit',
    file_url: '/documents/clients/cirilo-design-build/audit.html',
    sort_order: 1,
  },
  {
    doc_id: `${DOC_PREFIX}-PRO-001`,
    doc_type: 'proposal',
    doc_name: 'Marketing & Growth Proposal',
    file_url: '/documents/clients/cirilo-design-build/proposal.html',
    requires_signature: true,
    sort_order: 2,
  },
  {
    doc_id: `${DOC_PREFIX}-RDM-001`,
    doc_type: 'roadmap',
    doc_name: '12-Month Roadmap',
    file_url: '/documents/clients/cirilo-design-build/roadmap.html',
    sort_order: 3,
  },
  {
    doc_id: `${DOC_PREFIX}-PLY-001`,
    doc_type: 'playbook',
    doc_name: 'Partnership & PR Playbook',
    file_url: '/documents/clients/cirilo-design-build/partnerships.html',
    sort_order: 4,
  },
];

// ─── Main ───────────────────────────────────────────────────────────
(async () => {
  console.log('━━━ Cirilo Design + Build engagement seed ━━━');
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log();

  // 1. Client
  console.log('1. mc_clients');
  let client;
  const existingClients = await sbSelect(`mc_clients?slug=eq.${SLUG}&select=*&limit=1`);
  if (existingClients.length) {
    client = existingClients[0];
    console.log(`   ✓ exists (id ${client.id})`);
  } else {
    client = await sbInsert('mc_clients', CLIENT_DATA);
    console.log(`   ✓ created (id ${client.id})`);
  }

  // 2. Engagement
  console.log('2. mc_engagements');
  let engagement;
  const existingEng = await sbSelect(`mc_engagements?client_id=eq.${client.id}&doc_prefix=eq.${DOC_PREFIX}&select=*&limit=1`);
  if (existingEng.length) {
    engagement = existingEng[0];
    console.log(`   ✓ exists (id ${engagement.id})`);
  } else {
    engagement = await sbInsert('mc_engagements', { client_id: client.id, ...ENGAGEMENT_DATA });
    console.log(`   ✓ created (id ${engagement.id})`);
  }

  // 3. Documents
  console.log('3. mc_documents');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
  for (const d of DOCS) {
    const existing = await sbSelect(`mc_documents?doc_id=eq.${d.doc_id}&select=id&limit=1`);
    if (existing.length) {
      console.log(`   ✓ ${d.doc_id} exists (id ${existing[0].id})`);
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
    console.log(`   ✓ ${d.doc_id} created (id ${inserted.id})`);
  }

  // 4. Audit log
  try {
    await sbInsert('mc_audit_log', {
      client_id: client.id,
      engagement_id: engagement.id,
      event: 'cirilo_seed_completed',
      payload: {
        slug: SLUG,
        doc_prefix: DOC_PREFIX,
        docs_seeded: DOCS.map(d => d.doc_id),
        seeded_by: 'scripts/seed-cirilo.js',
        seeded_at: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.warn('   ⚠ audit log insert failed (non-fatal):', e.message);
  }

  console.log();
  console.log('━━━ DONE ━━━');
  console.log();
  console.log('URLs:');
  console.log(`  Cover:       https://markcmo.com/documents/clients/cirilo-design-build/`);
  console.log(`  Proposal:    https://markcmo.com/documents/clients/cirilo-design-build/proposal.html`);
  console.log(`  Audit:       https://markcmo.com/documents/clients/cirilo-design-build/audit.html`);
  console.log(`  Roadmap:     https://markcmo.com/documents/clients/cirilo-design-build/roadmap.html`);
  console.log(`  Playbook:    https://markcmo.com/documents/clients/cirilo-design-build/partnerships.html`);
  console.log(`  Sign form:   https://markcmo.com/forms/cirilo-design-build-sign.html`);
  console.log(`  Sign (test): https://markcmo.com/forms/cirilo-design-build-sign.html?test=1`);
  console.log(`  Admin VDR:   https://markcmo.com/admin/vdr/?slug=cirilo-design-build`);
  console.log();
  console.log('Admin panel should now show Tiffany under Clients with engagement CDB.');
})().catch(err => {
  console.error();
  console.error('FATAL:', err.message);
  process.exit(1);
});
