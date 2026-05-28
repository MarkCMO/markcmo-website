# Supabase migrations

Idempotent SQL files. Paste into the Supabase SQL editor for the markcmo
project and run. Safe to re-run.

| File | What it creates | When to run |
|------|----------------|-------------|
| `ops_tables.sql` | `ops_webhook_events`, `ops_heartbeats`, `ops_error_log`, `ops_alert_log` | Once, before the academy worker handles its first webhook or cron tick. Without these tables `_lib_ops` silently no-ops on every write. |

## How to run

1. Open `https://supabase.com/dashboard/project/<project-ref>/sql`
2. New query → paste the file contents → Run
3. The trailing `SELECT` returns one row per table with row count to confirm.

## Why these tables matter

The daily ops digest (`wetyr-daily-report.js`) is built around these four
tables. If they don't exist:
- Heartbeats don't persist, so `listMissedHeartbeats` always returns empty.
- Webhook idempotency degrades to "process every event" - duplicate enrollments
  on retry storms.
- Error log writes silently fail, so `recentErrorRate` thresholds never trip.
- Alert dedup falls back to "send every time" - the exact failure mode that
  flooded Mark's inbox with 522 alerts on 2026-05-27.

After running the migration, the next cron tick of `wetyr-ops-cron` will
populate `ops_heartbeats`, and any subsequent failure will deduplicate
through `ops_alert_log`.
