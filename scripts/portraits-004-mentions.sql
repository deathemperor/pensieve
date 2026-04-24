-- Phase 9: newspaper / article mentions scraped via Google Custom Search.
-- Idempotent: rerun-safe with IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS contact_mentions (
  id            TEXT PRIMARY KEY,
  contact_id    TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  url           TEXT NOT NULL,
  source        TEXT,         -- displayLink, e.g. "nytimes.com"
  snippet       TEXT,
  published_at  TEXT,         -- ISO-8601 if extracted from metatags; else NULL
  fetched_at    TEXT NOT NULL,
  query         TEXT NOT NULL  -- the search string used, for debugging
);
CREATE INDEX IF NOT EXISTS idx_mentions_contact_date ON contact_mentions(contact_id, published_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mentions_contact_url ON contact_mentions(contact_id, url);
