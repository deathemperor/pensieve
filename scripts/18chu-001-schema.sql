-- 18 Chữ game results — feeds the "top X% of scores submitted today" stat.
-- Apply:  npx wrangler d1 execute pensieve-db --remote --file scripts/18chu-001-schema.sql
CREATE TABLE IF NOT EXISTS game_18chu_results (
  id         TEXT PRIMARY KEY,   -- ULID
  day        TEXT NOT NULL,      -- YYYY-MM-DD (Vietnam time)
  score      INTEGER NOT NULL,   -- 0..18 words survived
  time_ms    INTEGER NOT NULL,   -- total run time
  created_at TEXT NOT NULL       -- ISO 8601
);
CREATE INDEX IF NOT EXISTS idx_18chu_day_score ON game_18chu_results(day, score);
