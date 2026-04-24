-- Phase 16: app-level rate limiting. Token-bucket-ish with a fixed window.
-- One row per (bucket_key, window_start). Budget + window size live in code
-- (src/lib/portraits/rate-limit.ts) so tuning doesn't require a migration.

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key    TEXT NOT NULL,   -- e.g. "enrich:loc@example.com" or "ingest:<bearer-hash>"
  window_start  TEXT NOT NULL,   -- ISO minute boundary, e.g. "2026-04-23T14:00:00Z"
  count         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON rate_limit_buckets(window_start);
