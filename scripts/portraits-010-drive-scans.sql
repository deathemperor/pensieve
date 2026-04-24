-- Phase 15: Google Drive folder scans for business-card captures.

CREATE TABLE IF NOT EXISTS drive_scan_folders (
  folder_id       TEXT PRIMARY KEY,
  label           TEXT,
  enabled         INTEGER NOT NULL DEFAULT 1,
  last_scanned_at TEXT,
  last_status     TEXT,
  last_error      TEXT,
  last_new_count  INTEGER DEFAULT 0,
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drive_processed_files (
  file_id      TEXT PRIMARY KEY,
  folder_id    TEXT NOT NULL,
  card_id      TEXT REFERENCES contact_cards(id) ON DELETE SET NULL,
  processed_at TEXT NOT NULL,
  status       TEXT NOT NULL,
  error        TEXT
);
CREATE INDEX IF NOT EXISTS idx_dpf_folder ON drive_processed_files(folder_id, processed_at DESC);
