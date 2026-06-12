-- ─────────────────────────────────────────────────────────────────
-- mc_inbound_leads: every contact-form submission on markcmo.com
--
-- Created 2026-06-12 after discovering that the homepage_cta form
-- (added 2026-05-07) and ~12 service-page forms had been silently
-- dropping every submission since the May 29 Cloudflare migration:
-- they used the legacy Netlify Forms protocol (POST to "/") which
-- Cloudflare answers with the homepage HTML, so the JS thought it
-- succeeded and showed "Message Sent" - but no data was stored.
--
-- This table catches everything from now on, sourced via the new
-- native /api/lead endpoint on CF Pages.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mc_inbound_leads (
  id              bigserial PRIMARY KEY,
  created_at      timestamptz DEFAULT now(),

  source          text NOT NULL,      -- which form: homepage_cta, fractional_cmo, contact, etc.
  page_url        text,               -- referer URL the user submitted from
  name            text,
  email           text,
  company         text,
  phone           text,
  message         text,

  ip              text,
  user_agent      text,
  raw             jsonb,              -- full payload for forensics

  notified_at     timestamptz,        -- when Mark was emailed
  resend_id       text,               -- Resend message id of the notification
  status          text DEFAULT 'new', -- new | notified | replied | spam

  is_spam         boolean DEFAULT false,
  spam_reason     text
);

CREATE INDEX IF NOT EXISTS mc_inbound_leads_created_idx ON public.mc_inbound_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS mc_inbound_leads_email_idx ON public.mc_inbound_leads (email);
CREATE INDEX IF NOT EXISTS mc_inbound_leads_source_idx ON public.mc_inbound_leads (source);
CREATE INDEX IF NOT EXISTS mc_inbound_leads_status_idx ON public.mc_inbound_leads (status);
