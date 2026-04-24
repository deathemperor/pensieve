-- Phase 12: batch card scanning at events. Each event groups many cards.

CREATE TABLE IF NOT EXISTS contact_card_events (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  location     TEXT,
  happened_at  TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  note         TEXT
);
CREATE INDEX IF NOT EXISTS idx_card_events_happened ON contact_card_events(happened_at DESC);

-- Link existing contact_cards rows to an event. Cards can exist without events
-- (the Phase 2 single-capture flow stays unchanged), so event_id is nullable
-- on the link table rather than ALTERing contact_cards.
CREATE TABLE IF NOT EXISTS contact_card_event_links (
  card_id    TEXT PRIMARY KEY REFERENCES contact_cards(id) ON DELETE CASCADE,
  event_id   TEXT NOT NULL REFERENCES contact_card_events(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cel_event ON contact_card_event_links(event_id);
