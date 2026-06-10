-- ────────────────────────────────────────────────────────────────
-- mc_pending_outbound_emails
-- ────────────────────────────────────────────────────────────────
-- Approval queue for ALL prospect-facing email sends.
--
-- Mark's directive 2026-06-09: "all emails need to go to me first
-- before you send them. send or decline sending for all communication
-- emails. dont blow these deals for me with too much sending without
-- approvals."
--
-- Every Calendly auto-fire email (confirmation, T-24h, T-8h, T-1h,
-- T-15min, recap, T+72h rebook), every Gemini personalized recap, and
-- every no-show email lands here with status='pending'. Mark gets a
-- per-booking approval-request email with Approve/Decline/Edit links.
-- On approve, the system POSTs to Resend with the original scheduled_at
-- preserved. On decline, the row stays as audit only.
--
-- Internal alerts to Mark (notifyNewBooking, error alerts, etc.) do
-- NOT go through this queue - they fire directly. Only PROSPECT-facing
-- email is gated.
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mc_pending_outbound_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- ── Email payload ──
  recipient_email text NOT NULL,
  recipient_name text,
  from_addr text NOT NULL,
  reply_to text,
  cc text[],
  subject text NOT NULL,
  body_text text NOT NULL,
  body_html text,
  attachments_json jsonb,
  tags_json jsonb,
  resend_idempotency_key text,

  -- ── Scheduling ──
  scheduled_send_at timestamptz,  -- null = send-now on approval

  -- ── Context ──
  source text NOT NULL,           -- e.g. 'calendly_t24h_reminder', 'gemini_personalized_recap'
  engagement_id uuid,
  client_id uuid,
  approval_group_id uuid,         -- groups emails belonging to same booking together
  metadata jsonb DEFAULT '{}'::jsonb,

  -- ── Approval state ──
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','declined','sent','send_failed','expired','superseded')),
  approval_token text NOT NULL UNIQUE,
  decision_via text,              -- 'one_click' | 'edit_then_approve' | 'auto_rule' | 'cron_expired'
  decision_reason text,
  approved_at timestamptz,
  declined_at timestamptz,
  sent_at timestamptz,
  resend_id text,
  resend_status int,
  send_error text,

  -- ── Edit history ──
  edit_history jsonb DEFAULT '[]'::jsonb  -- array of {edited_at, before_subject, before_body_text, edited_field, ...}
);

CREATE INDEX IF NOT EXISTS idx_mc_pending_outbound_emails_status_scheduled
  ON mc_pending_outbound_emails(status, scheduled_send_at);
CREATE INDEX IF NOT EXISTS idx_mc_pending_outbound_emails_engagement
  ON mc_pending_outbound_emails(engagement_id);
CREATE INDEX IF NOT EXISTS idx_mc_pending_outbound_emails_approval_group
  ON mc_pending_outbound_emails(approval_group_id);
CREATE INDEX IF NOT EXISTS idx_mc_pending_outbound_emails_recipient
  ON mc_pending_outbound_emails(recipient_email);
CREATE INDEX IF NOT EXISTS idx_mc_pending_outbound_emails_created
  ON mc_pending_outbound_emails(created_at DESC);

-- Optional: auto-mark pending emails as expired if their scheduled
-- send time has passed by more than 1 hour with no decision. Mark
-- can run this manually or set up a cron.
-- UPDATE mc_pending_outbound_emails SET status='expired', decision_via='cron_expired'
-- WHERE status='pending' AND scheduled_send_at < now() - interval '1 hour';
