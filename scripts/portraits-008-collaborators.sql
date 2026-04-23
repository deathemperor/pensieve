-- Phase 13: per-contact collaborator grants. Admin (role≥50) always has full access;
-- this table is only consulted when the caller is NOT admin.

CREATE TABLE IF NOT EXISTS contact_collaborators (
  id          TEXT PRIMARY KEY,
  contact_id  TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,             -- lowercased. Matched against Astro.locals.user.email
  access      TEXT NOT NULL CHECK (access IN ('view','edit')),
  granted_by  TEXT NOT NULL,             -- admin email who issued the grant
  created_at  TEXT NOT NULL,
  UNIQUE(contact_id, email)
);
CREATE INDEX IF NOT EXISTS idx_collab_email ON contact_collaborators(email, access);
CREATE INDEX IF NOT EXISTS idx_collab_contact ON contact_collaborators(contact_id);
