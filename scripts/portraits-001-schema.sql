-- Portraits Phase 1 schema. Creates all 7 tables.
-- Only contacts + contact_channels are used in Phase 1; others are
-- reserved for Phase 2-5 so later migrations don't grow the footprint.

CREATE TABLE IF NOT EXISTS contacts (
  id             TEXT PRIMARY KEY,
  full_name      TEXT NOT NULL,
  display_name   TEXT,
  title          TEXT,
  company        TEXT,
  company_domain TEXT,
  photo_key      TEXT,
  prestige_tier  TEXT NOT NULL CHECK (prestige_tier IN ('S','A','B','C','D')),
  tier_score     INTEGER NOT NULL DEFAULT 50 CHECK (tier_score BETWEEN 0 AND 100),
  location       TEXT,
  bio            TEXT,
  source         TEXT NOT NULL,
  external_ids   TEXT,
  tags           TEXT,
  birthday       TEXT,
  is_placeholder INTEGER NOT NULL DEFAULT 0,
  deleted_at     TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contacts_tier ON contacts(prestige_tier, tier_score DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_placeholder ON contacts(is_placeholder);

CREATE TABLE IF NOT EXISTS contact_channels (
  id          TEXT PRIMARY KEY,
  contact_id  TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  value       TEXT NOT NULL,
  label       TEXT,
  is_primary  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_channels_contact ON contact_channels(contact_id);
CREATE INDEX IF NOT EXISTS idx_channels_value ON contact_channels(value);

CREATE TABLE IF NOT EXISTS contact_notes (
  id          TEXT PRIMARY KEY,
  contact_id  TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_cards (
  id            TEXT PRIMARY KEY,
  contact_id    TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  r2_key        TEXT NOT NULL,
  captured_at   TEXT NOT NULL,
  ocr_status    TEXT NOT NULL,
  ocr_provider  TEXT,
  raw_ocr_json  TEXT,
  extracted     TEXT,
  error         TEXT
);
CREATE INDEX IF NOT EXISTS idx_cards_pending ON contact_cards(ocr_status) WHERE ocr_status IN ('pending','parsing');

CREATE TABLE IF NOT EXISTS contact_interactions (
  id           TEXT PRIMARY KEY,
  contact_id   TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,
  body         TEXT,
  happened_at  TEXT NOT NULL,
  metadata     TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_interactions_contact_time ON contact_interactions(contact_id, happened_at DESC);

CREATE TABLE IF NOT EXISTS contact_edges (
  id            TEXT PRIMARY KEY,
  src_id        TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  dst_id        TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,
  note          TEXT,
  created_at    TEXT NOT NULL,
  UNIQUE(src_id, dst_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_edges_src ON contact_edges(src_id);
CREATE INDEX IF NOT EXISTS idx_edges_dst ON contact_edges(dst_id);

CREATE TABLE IF NOT EXISTS contact_reminders (
  id           TEXT PRIMARY KEY,
  contact_id   TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,
  due_at       TEXT NOT NULL,
  recurring    TEXT,
  body         TEXT,
  dismissed_at TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON contact_reminders(due_at) WHERE dismissed_at IS NULL;
