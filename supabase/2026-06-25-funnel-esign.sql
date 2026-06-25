-- ============================================================================
-- Funnel e-sign: signature capture columns on mcf_agreements
-- Run after the acquisition-funnel + funnel-dispatch migrations.
-- ============================================================================
alter table mcf_agreements add column if not exists signer_name    text;
alter table mcf_agreements add column if not exists signer_title   text;
alter table mcf_agreements add column if not exists signature_type text;   -- type | draw
alter table mcf_agreements add column if not exists signature_data text;   -- typed name or data URL
alter table mcf_agreements add column if not exists signer_email   text;
alter table mcf_agreements add column if not exists user_agent     text;
