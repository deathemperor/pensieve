-- Close the read-then-insert race in /api/portraits/ingest by enforcing
-- uniqueness on the ingest_idempotency_key at the DB layer. Two concurrent
-- requests with the same key now collide on a UNIQUE constraint instead of
-- both passing the existence check.
--
-- Uses a partial index keyed on the JSON extraction so contacts without an
-- ingest key (manual / vCard / card-capture sources) don't sit in the index.

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_ingest_idempotency
  ON contacts(json_extract(external_ids, '$.ingest_idempotency_key'))
  WHERE json_extract(external_ids, '$.ingest_idempotency_key') IS NOT NULL
    AND deleted_at IS NULL;
