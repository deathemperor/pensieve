-- Phase 10: client-side encrypted notes (AES-GCM-256, PBKDF2 key from passphrase).
-- Adds opaque metadata columns so server stays zero-knowledge.

ALTER TABLE contact_notes ADD COLUMN encrypted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contact_notes ADD COLUMN salt TEXT;   -- hex-encoded 16-byte PBKDF2 salt
ALTER TABLE contact_notes ADD COLUMN iv TEXT;     -- hex-encoded 12-byte AES-GCM IV

CREATE INDEX IF NOT EXISTS idx_notes_encrypted ON contact_notes(contact_id, encrypted);
