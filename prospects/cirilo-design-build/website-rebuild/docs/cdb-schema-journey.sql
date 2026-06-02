-- ════════════════════════════════════════════════════════════
-- Cirilo Design + Build : journey expansion schema (additive)
-- Payments, referrals, email, vendors + bidding.
-- Safe to run after cdb-schema.sql. All RLS-enabled, deny-all
-- anon/auth, service role only (Cloudflare Pages Functions).
-- ════════════════════════════════════════════════════════════

-- ─── PAYMENTS (check + ACH for now; processor later) ────────────
create table if not exists cdb_payments (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  project_id    uuid references cdb_projects(id),
  client_id     uuid references cdb_clients(id),
  draw_label    text,                 -- "Draw 3 - Shotcrete shell"
  draw_number   int,
  amount_usd    numeric,
  method        text default 'check', -- check / ach
  status        text default 'reported', -- reported / received / cleared / void
  reference     text,                 -- check #, ACH confirmation, etc.
  reported_at   timestamptz,          -- homeowner clicked "I've sent payment"
  received_at   timestamptz,          -- Cirilo confirmed receipt
  cleared_at    timestamptz,
  notes         text
);
create index if not exists cdb_payments_project_idx on cdb_payments(project_id);
-- Billing schedule support: draws are pre-created at onboarding as status
-- 'scheduled', then admin 'issue's them (status 'due' + due_at) to bill the
-- homeowner. Status flow: scheduled -> due -> reported -> received -> cleared
-- (or void). issued_at = when the draw was billed; due_at = when it is due.
alter table cdb_payments add column if not exists due_at timestamptz;
alter table cdb_payments add column if not exists issued_at timestamptz;

-- ─── REFERRALS ──────────────────────────────────────────────────
alter table cdb_clients add column if not exists referral_code text;  -- shareable code
alter table cdb_leads   add column if not exists referred_by_code text; -- captured from ?ref=
alter table cdb_leads   add column if not exists utm jsonb;            -- utm_source/medium/campaign

create table if not exists cdb_referrals (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  referrer_client_id uuid references cdb_clients(id),
  referrer_code      text,
  referred_lead_id   uuid references cdb_leads(id),
  referred_name      text,
  referred_email     text,
  status             text default 'pending', -- pending / consult / converted / rewarded
  reward_status      text default 'none',    -- none / pending / issued
  notes              text
);
create index if not exists cdb_referrals_referrer_idx on cdb_referrals(referrer_client_id);
create index if not exists cdb_referrals_code_idx on cdb_referrals(referrer_code);

-- ─── EMAIL (templates + send log; sends gated by consent) ───────
create table if not exists cdb_email_templates (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  key         text unique not null,  -- consult_confirm / consult_followup / ...
  name        text,
  subject     text,
  body_html   text,
  active      boolean default true
);

create table if not exists cdb_email_log (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  to_email     text,
  template_key text,
  lead_id      uuid references cdb_leads(id),
  client_id    uuid references cdb_clients(id),
  status       text default 'queued', -- queued / dry_run / sent / skipped / failed
  provider_id  text,                  -- Resend id when actually sent
  scheduled_for timestamptz,
  meta         jsonb
);
create index if not exists cdb_email_log_status_idx on cdb_email_log(status);

-- ─── VENDORS + ASSIGNMENTS + BIDDING ────────────────────────────
create table if not exists cdb_vendors (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  company     text,
  email       text,
  phone       text,
  trade       text,                  -- gunite / plumbing / electrical / tile / decking / equipment ...
  portal_code text,                  -- vendor portal access code
  status      text default 'active', -- active / paused / archived
  rating      numeric,
  notes       text
);
create index if not exists cdb_vendors_trade_idx on cdb_vendors(trade);

create table if not exists cdb_vendor_assignments (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  project_id  uuid references cdb_projects(id),
  vendor_id   uuid references cdb_vendors(id),
  stage       text,                  -- which build stage this covers
  scope       text,
  amount_usd  numeric,
  status      text default 'assigned', -- assigned / accepted / in_progress / complete / declined
  due_date    date,
  lien_waiver_at timestamptz,         -- vendor acknowledged lien waiver at completion
  notes       text
);
alter table cdb_vendor_assignments add column if not exists lien_waiver_at timestamptz;
create index if not exists cdb_va_project_idx on cdb_vendor_assignments(project_id);
create index if not exists cdb_va_vendor_idx on cdb_vendor_assignments(vendor_id);

create table if not exists cdb_jobs (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  project_id   uuid references cdb_projects(id),
  title        text not null,
  trade        text,
  stage        text,
  scope        text,
  budget_usd   numeric,
  status       text default 'open',  -- open / awarded / closed
  bid_deadline date,
  awarded_vendor_id uuid references cdb_vendors(id)
);
create index if not exists cdb_jobs_status_idx on cdb_jobs(status);

create table if not exists cdb_bids (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  job_id      uuid references cdb_jobs(id),
  vendor_id   uuid references cdb_vendors(id),
  amount_usd  numeric,
  timeline    text,
  notes       text,
  status      text default 'submitted' -- submitted / shortlisted / awarded / declined
);
create index if not exists cdb_bids_job_idx on cdb_bids(job_id);

-- ─── RLS deny-all (service role bypasses) ───────────────────────
alter table cdb_payments           enable row level security;
alter table cdb_referrals          enable row level security;
alter table cdb_email_templates    enable row level security;
alter table cdb_email_log          enable row level security;
alter table cdb_vendors            enable row level security;
alter table cdb_vendor_assignments enable row level security;
alter table cdb_jobs               enable row level security;
alter table cdb_bids               enable row level security;

-- ─── Seed: email templates (plain, no em/en dashes) ─────────────
insert into cdb_email_templates (key, name, subject, body_html) values
 ('consult_confirm','Consultation confirmation','Your Cirilo consultation request','<p>Hi {{name}},</p><p>Thank you for requesting a consultation with Cirilo Design + Build. We will confirm your time within one business hour.</p><p>Tiffany Cirilo</p>'),
 ('consult_followup','Consultation follow-up','Following up on your pool project','<p>Hi {{name}},</p><p>Just following up on the consultation you requested. Are you still interested in moving forward? Reply any time.</p><p>Tiffany Cirilo</p>'),
 ('proposal_sent','Proposal delivered','Your Cirilo proposal is ready','<p>Hi {{name}},</p><p>Your proposal is ready to review and sign here: {{proposal_url}}</p><p>Tiffany Cirilo</p>'),
 ('proposal_followup','Proposal follow-up','A quick note on your proposal','<p>Hi {{name}},</p><p>Wanted to make sure you received your proposal. Happy to walk through any questions before you sign.</p><p>Tiffany Cirilo</p>'),
 ('welcome','Welcome to your Owner Suite','Welcome to Cirilo, your project is open','<p>Hi {{name}},</p><p>Your project is open. Access your private Owner Suite any time with code {{access_code}} at {{portal_url}}.</p><p>Tiffany Cirilo</p>'),
 ('payment_reminder','Draw payment reminder','A friendly reminder on your draw','<p>Hi {{name}},</p><p>This is a friendly reminder that {{draw_label}} ({{amount}}) is due. Payment details are in your Owner Suite.</p><p>Tiffany Cirilo</p>')
on conflict (key) do nothing;

-- ════════════════════════════════════════════════════════════
-- Addendum: vendor scheduling + vendor payments + document vault
-- ════════════════════════════════════════════════════════════

-- Vendor payments (what Cirilo owes each vendor per assignment).
alter table cdb_vendor_assignments add column if not exists pay_status text default 'unpaid'; -- unpaid / paid
alter table cdb_vendor_assignments add column if not exists paid_at timestamptz;
alter table cdb_vendor_assignments add column if not exists paid_amount numeric;

-- Document vault metadata. Reuses cdb_documents; add origin columns.
alter table cdb_documents add column if not exists uploaded_by text;  -- client / vendor / admin
alter table cdb_documents add column if not exists vendor_id uuid references cdb_vendors(id);
alter table cdb_documents add column if not exists size_bytes int;
alter table cdb_documents add column if not exists mime text;

-- Per-client proposals (unique slug per prospect; /proposal?c=slug).
create table if not exists cdb_proposals (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  slug          text unique not null,
  client_name   text,
  client_email  text,
  neighborhood  text,
  title         text,
  project_type  text,
  pool_type     text,
  contract_value numeric,
  vision        text,
  inclusions    jsonb,   -- ["...", "..."]
  draws         jsonb,   -- [{label, amount}]
  status        text default 'draft',  -- draft / sent / viewed / signed
  sent_at       timestamptz,
  viewed_at     timestamptz,
  signed_at     timestamptz,
  lead_id       uuid references cdb_leads(id)
);
create index if not exists cdb_proposals_slug_idx on cdb_proposals(slug);
alter table cdb_proposals add column if not exists viewed_at timestamptz;
alter table cdb_proposals enable row level security;

-- Storage bucket for the vault (create once in Supabase Storage):
--   bucket id: cdb-files  (private). Pages Functions sign URLs via service role.
-- If using SQL to create (Supabase >= storage v1):
--   insert into storage.buckets (id, name, public) values ('cdb-files','cdb-files', false) on conflict do nothing;

-- ════════════════════════════════════════════════════════════
-- Addendum: partner applications (referral / co-marketing program)
-- ════════════════════════════════════════════════════════════
create table if not exists cdb_partners (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null,          -- contact person
  firm          text,                   -- company / brokerage / club / brand
  partner_type  text,                   -- real_estate / builder / designer / club / brand / other
  email         text,
  phone         text,
  territory     text,                   -- neighborhoods / areas they cover
  message       text,
  source        text default 'website', -- which page / firm-page they came from
  status        text default 'new',     -- new / contacted / active / declined
  ip            text,
  user_agent    text
);
create index if not exists cdb_partners_status_idx on cdb_partners(status);
create index if not exists cdb_partners_type_idx on cdb_partners(partner_type);
alter table cdb_partners enable row level security;

-- Vendor self-signups reuse cdb_vendors with status='pending'. Add a couple
-- of optional columns so applicants can describe coverage + credentials.
alter table cdb_vendors add column if not exists service_area text;
alter table cdb_vendors add column if not exists applied_at timestamptz;

-- ════════════════════════════════════════════════════════════
-- Addendum: 3D rendering requests (the real-estate partner offer)
-- An agent submits a listing + backyard photos; Cirilo returns a free
-- 3D rendering they can use to anchor price / overcome objections.
-- ════════════════════════════════════════════════════════════
create table if not exists cdb_rendering_requests (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  agent_name      text not null,
  firm            text,
  email           text,
  phone           text,
  listing_address text,
  notes           text,
  photo_paths     jsonb,                 -- ["cdb-files/rendering/...png", ...]
  status          text default 'new',    -- new / in_progress / delivered / declined
  source          text default 'website',
  ip              text,
  user_agent      text
);
create index if not exists cdb_rendering_status_idx on cdb_rendering_requests(status);
alter table cdb_rendering_requests enable row level security;

-- ════════════════════════════════════════════════════════════
-- Addendum: accounting integrations (QuickBooks Online OAuth2)
-- One row per provider. Tokens are service-role only (RLS deny-all).
-- ════════════════════════════════════════════════════════════
create table if not exists cdb_integrations (
  id                  uuid primary key default gen_random_uuid(),
  provider            text unique not null,   -- 'quickbooks'
  access_token        text,
  refresh_token       text,
  realm_id            text,                   -- QBO company id
  token_expires_at    timestamptz,
  refresh_expires_at  timestamptz,
  status              text default 'connected', -- connected / disconnected / error
  meta                jsonb,                  -- company name, last sync, last error
  connected_at        timestamptz default now(),
  updated_at          timestamptz default now()
);
alter table cdb_integrations enable row level security;

-- Map our records to their QuickBooks counterparts.
alter table cdb_clients  add column if not exists qbo_customer_id text;
alter table cdb_payments add column if not exists qbo_invoice_id text;
alter table cdb_payments add column if not exists qbo_payment_id text;
alter table cdb_payments add column if not exists synced_at timestamptz;

-- Accounts payable side: vendors as QBO Vendors, paid assignments as QBO Purchases.
alter table cdb_vendors             add column if not exists qbo_vendor_id text;
alter table cdb_vendor_assignments  add column if not exists qbo_purchase_id text;
alter table cdb_vendor_assignments  add column if not exists synced_at timestamptz;

-- Uptime / health log (optional; written by the monitor worker).
create table if not exists cdb_uptime (
  id          uuid primary key default gen_random_uuid(),
  checked_at  timestamptz not null default now(),
  ok          boolean,
  mode        text,
  latency_ms  int,
  detail      jsonb
);
create index if not exists cdb_uptime_checked_idx on cdb_uptime(checked_at desc);
alter table cdb_uptime enable row level security;
