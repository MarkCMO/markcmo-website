-- ────────────────────────────────────────────────────────────────
-- mc_mailbox_messages
-- ────────────────────────────────────────────────────────────────
-- Persistent inbox/sent storage for mark@markcmo.com webmail.
-- Self-contained: nothing depends on Gmail/M365/Workspace.
-- All data on Supabase, sends via Resend SMTP/API, reads via this table.
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mc_mailbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Direction
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),

  -- Addressing
  from_addr text NOT NULL,
  from_name text,
  to_addrs text[] NOT NULL,
  cc_addrs text[],
  bcc_addrs text[],
  reply_to text,

  -- Content
  subject text,
  body_text text,
  body_html text,
  body_preview text,             -- short snippet for inbox view

  -- Headers + auth (for inbound)
  raw_headers jsonb,             -- key/value of all parsed headers
  spf_result text,               -- pass | fail | neutral | softfail | none
  dkim_result text,
  dmarc_result text,
  message_id_header text,        -- original Message-ID
  in_reply_to text,              -- thread tracking
  references_header text,

  -- Send result (for outbound)
  resend_id text,
  resend_status int,
  send_error text,

  -- State
  read_at timestamptz,
  archived_at timestamptz,
  starred boolean DEFAULT false,
  labels text[],

  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_mailbox_messages_direction_created
  ON mc_mailbox_messages(direction, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mailbox_messages_read
  ON mc_mailbox_messages(read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mailbox_messages_from
  ON mc_mailbox_messages(from_addr);
CREATE INDEX IF NOT EXISTS idx_mailbox_messages_subject
  ON mc_mailbox_messages USING gin (to_tsvector('english', coalesce(subject,'')));
