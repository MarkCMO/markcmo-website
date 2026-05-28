-- WETYR Infrastructure Protocol v1 — ops_* tables for self-healing operations.
-- Paste this into Supabase SQL editor for the markcmo project and run once.
-- Idempotent: every CREATE uses IF NOT EXISTS so re-running is safe.

-- ── ops_webhook_events ──────────────────────────────────────────────────
-- §3.3 webhook idempotency log. Composite PK on (event_id, property) so the
-- same event_id from Square and Whop don't collide.
CREATE TABLE IF NOT EXISTS ops_webhook_events (
  event_id      text        NOT NULL,
  property      text        NOT NULL DEFAULT 'unknown',
  event_type    text        NOT NULL DEFAULT 'unknown',
  processed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, property)
);
CREATE INDEX IF NOT EXISTS ops_webhook_events_processed_at_idx
  ON ops_webhook_events (processed_at DESC);

-- ── ops_heartbeats ──────────────────────────────────────────────────────
-- §5.3 cron heartbeat table. One row per cron job. Upsert on every run.
-- listMissedHeartbeats() reads this and flags any row where stale > 2x interval.
CREATE TABLE IF NOT EXISTS ops_heartbeats (
  job_name                   text PRIMARY KEY,
  last_run_at                timestamptz NOT NULL DEFAULT now(),
  last_status                text NOT NULL DEFAULT 'unknown',
  last_error                 text,
  last_duration_ms           integer,
  expected_interval_minutes  integer NOT NULL DEFAULT 60
);

-- ── ops_error_log ───────────────────────────────────────────────────────
-- §5.4 central error log. Appended to by ops.logError() from every function.
-- recentErrorRate() reads the last N minutes for spike detection.
CREATE TABLE IF NOT EXISTS ops_error_log (
  id                text PRIMARY KEY,
  property          text NOT NULL DEFAULT 'markcmo.com',
  source            text NOT NULL,
  error_type        text NOT NULL DEFAULT 'Error',
  error_message     text NOT NULL,
  stack_trace       text,
  request_metadata  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ops_error_log_created_at_idx
  ON ops_error_log (created_at DESC);
CREATE INDEX IF NOT EXISTS ops_error_log_source_idx
  ON ops_error_log (source);
CREATE INDEX IF NOT EXISTS ops_error_log_property_idx
  ON ops_error_log (property);

-- ── ops_alert_log ───────────────────────────────────────────────────────
-- Alert dedup state. alertAdminOnce(key, subject, html) reads/writes here so
-- the same failure key only emails Mark once per ALERT_COOLDOWN_MS (1 hour).
-- alert_count tracks how many times the same failure recurred while deduped,
-- which is what the daily digest reports back as "X duplicate alerts suppressed".
CREATE TABLE IF NOT EXISTS ops_alert_log (
  alert_key        text PRIMARY KEY,
  last_alerted_at  timestamptz NOT NULL DEFAULT now(),
  alert_count      integer NOT NULL DEFAULT 1,
  subject_preview  text
);
CREATE INDEX IF NOT EXISTS ops_alert_log_last_alerted_idx
  ON ops_alert_log (last_alerted_at DESC);

-- ── Optional: auto-prune to keep tables fast ───────────────────────────
-- Webhook event idempotency only needs ~30 days of history for replay attacks.
-- Error log: keep 90 days for forensics, then drop.
-- Alert log: keep forever (small, useful for trend analysis).
--
-- Schedule via pg_cron if available, or run from a Supabase Edge Function once a day:
--   DELETE FROM ops_webhook_events WHERE processed_at < now() - interval '30 days';
--   DELETE FROM ops_error_log      WHERE created_at   < now() - interval '90 days';

-- ── Smoke test: confirm tables exist ──────────────────────────────────
SELECT 'ops_webhook_events' AS table, count(*) AS rows FROM ops_webhook_events
UNION ALL SELECT 'ops_heartbeats',     count(*) FROM ops_heartbeats
UNION ALL SELECT 'ops_error_log',      count(*) FROM ops_error_log
UNION ALL SELECT 'ops_alert_log',      count(*) FROM ops_alert_log;
