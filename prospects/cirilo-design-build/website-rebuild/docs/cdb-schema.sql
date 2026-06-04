-- ════════════════════════════════════════════════════════════
-- Cirilo Design + Build : Supabase schema (cdb_* prefix)
-- Lives in the CLIPOS project (saoomfwycegflxelggxv) alongside
-- mc_* (markcmo) and cp_* (credit repair). cdb_* is namespaced
-- so it never collides.
--
-- Run via Supabase SQL editor or the apply-migration MCP tool.
-- All tables RLS-enabled, deny-all anon/auth. Service role only
-- (Cloudflare Pages Functions hold the service key).
-- ════════════════════════════════════════════════════════════

-- ─── 1. LEADS (inbound, pre-qualification) ──────────────────────
create table if not exists cdb_leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null,
  email         text,
  phone         text,
  address       text,                 -- property address / neighborhood
  project_type  text,                 -- Custom Pool / Pool+Outdoor / Reno / Addition
  budget        text,                 -- budget band
  timeline      text,                 -- timeline band
  message       text,
  source        text default 'website',  -- website / lsa / houzz / referral / meta
  status        text not null default 'new',  -- new / contacted / qualified / consult_booked / converted / lost
  session_id    text,                 -- ties to cdb_events journey
  ip            text,
  user_agent    text,
  responded_at  timestamptz,          -- when first response sent (track sub-1-min)
  owner         text default 'Tiffany',
  notes         text
);
create index if not exists cdb_leads_status_idx on cdb_leads(status);
create index if not exists cdb_leads_created_idx on cdb_leads(created_at desc);

-- ─── 2. CLIENTS (converted leads / signed customers) ────────────
create table if not exists cdb_clients (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  lead_id         uuid references cdb_leads(id),
  name            text not null,
  email           text,
  phone           text,
  address         text,
  neighborhood    text,               -- Myers Park, Lake Norman, etc. (for analytics)
  square_customer_id text,
  qbo_customer_id text,
  portal_code     text,               -- access code for the Owner's Suite portal (else last4 phone)
  status          text not null default 'active',  -- active / complete / on_hold
  notes           text
);
-- If cdb_clients already exists, add the portal code column:
alter table cdb_clients add column if not exists portal_code text;
create index if not exists cdb_clients_status_idx on cdb_clients(status);

-- ─── 3. PROJECTS (one per pool build, the 14-stage pipeline) ────
create table if not exists cdb_projects (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  client_id       uuid not null references cdb_clients(id),
  name            text not null,             -- "Myers Park Vanishing Edge"
  project_type    text default 'Custom Pool',
  contract_value  numeric,                   -- signed contract value (for rev share + reporting)
  stage           text not null default 'consultation',  -- see cdb_stage_order below
  stage_index     int not null default 0,    -- 0-13, drives kanban ordering
  pool_type       text,                      -- gunite / vanishing-edge / plunge / spa-integrated
  start_date      date,
  target_complete date,
  actual_complete date,
  permit_status   text,                      -- not_started / submitted / approved
  permit_number   text,
  is_test         boolean default false,
  notes           text
);
create index if not exists cdb_projects_stage_idx on cdb_projects(stage_index);
create index if not exists cdb_projects_client_idx on cdb_projects(client_id);

-- The 14 canonical stages (matches Tiffany's construction sequence).
-- Stored as a comment for reference; enforced in app code:
--  0  consultation        1  design            2  proposal
--  3  contract            4  excavation        5  rebar_bonding
--  6  plumbing_electrical 7  inspections       8  shotcrete
--  9  tile_coping         10 equipment         11 decking
--  12 interior_finish     13 fill_startup      (then complete)

-- ─── 4. STAGE EVENTS (audit trail of stage transitions) ─────────
create table if not exists cdb_project_events (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  project_id    uuid not null references cdb_projects(id),
  event         text not null,        -- stage_advanced / photo_added / inspection_passed / note
  from_stage    text,
  to_stage      text,
  detail        jsonb,
  author        text default 'Tiffany'
);
create index if not exists cdb_project_events_project_idx on cdb_project_events(project_id, created_at desc);

-- ─── 5. DOCUMENTS (contracts, change orders, plans, per project) ─
create table if not exists cdb_documents (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  project_id    uuid references cdb_projects(id),
  client_id     uuid references cdb_clients(id),
  doc_type      text not null,        -- contract / change_order / plan / permit / invoice / warranty / photo
  doc_name      text,
  storage_path  text,                 -- Supabase Storage path
  status        text default 'draft', -- draft / sent / signed / executed
  signed_at     timestamptz,
  amount_usd    numeric,
  metadata      jsonb
);
create index if not exists cdb_documents_project_idx on cdb_documents(project_id);

-- ─── 6. JOURNEY EVENTS (web analytics, page views, clicks) ──────
create table if not exists cdb_events (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  type          text not null,        -- view / click / form_submit
  page          text,                 -- home / service / portfolio / contact / service-area
  detail        jsonb,                -- {service, area, ...}
  session_id    text,
  lead_id       uuid references cdb_leads(id),
  url           text,
  referrer      text,
  ip            text,
  user_agent    text
);
create index if not exists cdb_events_session_idx on cdb_events(session_id);
create index if not exists cdb_events_created_idx on cdb_events(created_at desc);
create index if not exists cdb_events_page_idx on cdb_events(page);

-- ─── 7. ADMIN USERS (Tiffany + Mark) ────────────────────────────
create table if not exists cdb_admin_users (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  email         text unique not null,
  name          text,
  role          text default 'owner', -- owner / admin / viewer
  pass_hash     text,                 -- bcrypt/argon if local auth; or external
  last_login    timestamptz
);

-- ─── RLS: deny-all to anon/auth, service role bypasses ──────────
alter table cdb_leads          enable row level security;
alter table cdb_clients        enable row level security;
alter table cdb_projects       enable row level security;
alter table cdb_project_events enable row level security;
alter table cdb_documents      enable row level security;
alter table cdb_events         enable row level security;
alter table cdb_admin_users    enable row level security;

-- No policies = deny all for anon/authenticated. Service role
-- (used by Pages Functions) bypasses RLS entirely. This is the
-- same security posture as the mc_* tables.

-- ─── Seed: admin users ──────────────────────────────────────────
insert into cdb_admin_users (email, name, role) values
  ('Tiffany@CiriloDB.com', 'Tiffany Cirilo', 'owner'),
  ('mark@markcmo.com', 'Mark Gabrielli', 'admin')
on conflict (email) do nothing;
