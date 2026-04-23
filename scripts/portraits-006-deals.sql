-- Phase 11: deal pipeline per contact.

CREATE TABLE IF NOT EXISTS contact_deals (
  id                TEXT PRIMARY KEY,
  contact_id        TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  stage             TEXT NOT NULL CHECK (stage IN ('lead','qualified','proposal','negotiation','closed_won','closed_lost')),
  value_cents       INTEGER,           -- value in minor units (cents, VND, etc.). NULL allowed for fuzzy deals.
  currency          TEXT DEFAULT 'USD',
  probability       INTEGER NOT NULL DEFAULT 50 CHECK (probability BETWEEN 0 AND 100),
  expected_close_at TEXT,              -- ISO date
  summary           TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  closed_at         TEXT
);
CREATE INDEX IF NOT EXISTS idx_deals_contact ON contact_deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage   ON contact_deals(stage) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deals_close   ON contact_deals(expected_close_at) WHERE closed_at IS NULL;
