-- ============================================================================
-- Funnel dispatch layer - post-call recap + custom/productized routing + theming
-- Adds columns to the acquisition-funnel tables (run AFTER
-- 2026-06-24-acquisition-funnel.sql).
-- ============================================================================

-- Per-prospect look & feel + which proposal path Mark chose from the recap email.
alter table mcf_prospects add column if not exists theme         text;        -- theme key (funnel-themes.js)
alter table mcf_prospects add column if not exists proposal_mode text;        -- custom | productized
alter table mcf_prospects add column if not exists brand_kit     jsonb;       -- extracted logo/colors/fonts (custom)
alter table mcf_prospects add column if not exists call_recap    jsonb;       -- recap content sent to Mark

-- Proposals remember the look they were rendered with.
alter table mcf_proposals add column if not exists theme     text;
alter table mcf_proposals add column if not exists brand_kit jsonb;
alter table mcf_proposals add column if not exists mode      text;            -- custom | productized
