-- Phase 14: normalized_value on contact_channels so phone matching uses an
-- index instead of a full-table scan. Matches the last-10-digit rule from
-- src/lib/portraits/dedup.ts phoneMatchKey.

ALTER TABLE contact_channels ADD COLUMN normalized_value TEXT;

UPDATE contact_channels
   SET normalized_value = substr(
         replace(replace(replace(replace(replace(replace(replace(value, ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), '.', ''), CHAR(9), ''),
         -10
       )
 WHERE kind = 'phone' AND (normalized_value IS NULL OR normalized_value = '');

UPDATE contact_channels
   SET normalized_value = LOWER(TRIM(value))
 WHERE kind = 'email' AND (normalized_value IS NULL OR normalized_value = '');

CREATE INDEX IF NOT EXISTS idx_channels_normalized
  ON contact_channels(kind, normalized_value);

CREATE TRIGGER IF NOT EXISTS contact_channels_ai_normalize
  AFTER INSERT ON contact_channels
  WHEN NEW.kind IN ('phone','email')
  BEGIN
    UPDATE contact_channels
       SET normalized_value = CASE
             WHEN NEW.kind = 'phone'
               THEN substr(
                      replace(replace(replace(replace(replace(replace(replace(NEW.value, ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), '.', ''), CHAR(9), ''),
                      -10
                    )
             WHEN NEW.kind = 'email'
               THEN LOWER(TRIM(NEW.value))
           END
     WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS contact_channels_au_normalize
  AFTER UPDATE OF value, kind ON contact_channels
  WHEN NEW.kind IN ('phone','email')
  BEGIN
    UPDATE contact_channels
       SET normalized_value = CASE
             WHEN NEW.kind = 'phone'
               THEN substr(
                      replace(replace(replace(replace(replace(replace(replace(NEW.value, ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), '.', ''), CHAR(9), ''),
                      -10
                    )
             WHEN NEW.kind = 'email'
               THEN LOWER(TRIM(NEW.value))
           END
     WHERE id = NEW.id;
  END;
