CREATE TABLE IF NOT EXISTS animation_sessions (
  id TEXT PRIMARY KEY,
  animation_slug TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  tool_call_count INTEGER DEFAULT 0,
  duration_ms INTEGER,
  transcript_r2_key TEXT NOT NULL,
  renders_manifest_r2_key TEXT,
  transcript_size_bytes INTEGER,
  redacted INTEGER DEFAULT 0,
  published INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS animation_chapters (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  cursor_index INTEGER NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES animation_sessions(id)
);

CREATE TABLE IF NOT EXISTS animation_artifact_refs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  cursor_index INTEGER NOT NULL,
  artifact_type TEXT NOT NULL,
  artifact_id TEXT,
  artifact_inline_text TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES animation_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_chapters_session ON animation_chapters(session_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_artifact_refs_session ON animation_artifact_refs(session_id, cursor_index);
CREATE INDEX IF NOT EXISTS idx_sessions_slug ON animation_sessions(animation_slug, published);
