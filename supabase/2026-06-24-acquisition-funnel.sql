-- ============================================================================
-- MarkCMO / WETYR Fractional Acquisition Funnel - schema
-- Run in the MarkCMO Supabase project (MARKCMO_SUPABASE_URL).
-- Service-role access only (Pages Functions use the service key). No public
-- RLS policies are granted; the anon key cannot read these tables.
-- Tables are prefixed mcf_ (markcmo funnel) to sit alongside the existing
-- mc_inbound_leads / mc_audit_log tables without collision.
-- ============================================================================

-- ---------- prospect: one row per lead, advanced through the funnel ----------
create table if not exists mcf_prospects (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  resume_token        text unique,                       -- tokenized Stage-2 link
  source              text,
  stage               text not null default 'lead',      -- lead..won/lost/disqualified
  full_name           text,
  email               text,
  phone               text,
  company             text,
  website             text,
  role                text,
  -- scoring + classification (written by the engine)
  pre_score           int,
  full_score          int,
  disposition         text,                              -- HOT|WARM|COOL|DISQUALIFIED
  segment             text,                              -- HIGH_TICKET_SERVICE..UNDETERMINED
  growth_stage        text,                              -- GROWING|SUCCESSION|ACQUIRING
  marketing_capacity  text,                              -- NONE|SOLO|LEAN|ROBUST|AGENCY
  engagement_type     text,                              -- STRATEGY_ONLY|STRATEGY_PLUS_EXECUTION
  budget_band         text,
  recommended_package text,
  recommended_tier    text,                              -- FOUNDATION|MOMENTUM|EMPIRE|CUSTOM
  wetyr_track         jsonb,
  flags               text[] default '{}',
  tags                text[] default '{}',
  disqualify_reason   text,
  assigned_to         uuid,                              -- -> mcf_consultants.id
  assignment_queue    text,                              -- mark_direct|mark_approval|fractional|specialist|waitlist
  ip                  text,
  user_agent          text,
  raw_pre             jsonb,
  raw_intake          jsonb
);
create index if not exists mcf_prospects_email_idx       on mcf_prospects (lower(email));
create index if not exists mcf_prospects_stage_idx       on mcf_prospects (stage);
create index if not exists mcf_prospects_disposition_idx on mcf_prospects (disposition);
create index if not exists mcf_prospects_assigned_idx    on mcf_prospects (assigned_to);

-- ---------- answer: append-only per-question record (audit + analytics) ------
create table if not exists mcf_answers (
  id            uuid primary key default gen_random_uuid(),
  prospect_id   uuid not null references mcf_prospects(id) on delete cascade,
  stage         text not null,                           -- 'pre' | 'full'
  question_key  text not null,
  value         jsonb,
  answered_at   timestamptz not null default now()
);
create index if not exists mcf_answers_prospect_idx on mcf_answers (prospect_id);

-- ---------- consultant: Mark + the fractional CMO bench ----------------------
create table if not exists mcf_consultants (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null,
  is_principal  boolean not null default false,          -- true for Mark
  capacity_max  int not null default 0,
  capacity_used int not null default 0,
  industries    text[] default '{}',                     -- segment/compliance match tags
  min_deal_size int not null default 0,                  -- monthly floor
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------- proposal: generated package + hosted/PDF artifacts ---------------
create table if not exists mcf_proposals (
  id            uuid primary key default gen_random_uuid(),
  prospect_id   uuid not null references mcf_prospects(id) on delete cascade,
  tier          text,
  engagement_type text,
  line_items    jsonb,
  model         jsonb,                                   -- full 8-section proposal model
  monthly_total numeric,
  onetime_total numeric,
  term_months   int default 12,
  hosted_url    text,
  pdf_url       text,
  status        text not null default 'draft',           -- draft|sent|viewed|accepted|declined|expired
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists mcf_proposals_prospect_idx on mcf_proposals (prospect_id);

-- ---------- agreement: engagement letter / MSA / NDA -------------------------
create table if not exists mcf_agreements (
  id            uuid primary key default gen_random_uuid(),
  prospect_id   uuid not null references mcf_prospects(id) on delete cascade,
  type          text not null,                           -- engagement_letter|msa|nda
  status        text not null default 'sent',            -- sent|viewed|signed|declined
  signed_at     timestamptz,
  signer_ip     text,
  document_url  text,
  created_at    timestamptz not null default now()
);
create index if not exists mcf_agreements_prospect_idx on mcf_agreements (prospect_id);

-- ---------- payment: deposit / first month / recurring setup -----------------
create table if not exists mcf_payments (
  id            uuid primary key default gen_random_uuid(),
  prospect_id   uuid not null references mcf_prospects(id) on delete cascade,
  kind          text not null,                           -- deposit|first_month|recurring_setup
  amount        numeric,
  status        text not null default 'pending',         -- pending|succeeded|failed
  processor_ref text,
  paid_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists mcf_payments_prospect_idx on mcf_payments (prospect_id);

-- ---------- event_log: append-only audit of every state change ---------------
create table if not exists mcf_events (
  id            uuid primary key default gen_random_uuid(),
  prospect_id   uuid references mcf_prospects(id) on delete cascade,
  actor         text not null default 'system',          -- system|consultant:<id>|prospect
  event_type    text not null,
  payload       jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists mcf_events_prospect_idx on mcf_events (prospect_id);
create index if not exists mcf_events_type_idx     on mcf_events (event_type);

-- ---------- seed: Mark as principal -----------------------------------------
insert into mcf_consultants (name, email, is_principal, capacity_max, capacity_used, industries, min_deal_size, active)
select 'Mark Gabrielli', 'mark@markcmo.com', true, 999, 0, '{}', 0, true
where not exists (select 1 from mcf_consultants where email = 'mark@markcmo.com');
