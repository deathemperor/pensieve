import { parseTranscript, type TranscriptEntry } from "./transcript.ts";
import { loadFixture, type FixtureChapter, type LoadedFixture } from "./load-fixture.ts";

export interface SourceHistoryCursor {
  cursor: number;
  files: Record<string, string>;
}

export interface SourceHistory {
  slugPrefix: string;
  cursors: Record<string, SourceHistoryCursor>;
}

export interface RenderEntry {
  cursor_index: number;
  r2_key: string;
}

export interface LoadedWithHistory extends LoadedFixture {
  sourceHistory?: SourceHistory;
  renders?: RenderEntry[];
}

interface CloudflareEnv {
  DB: {
    prepare: (sql: string) => {
      bind: (...args: unknown[]) => {
        first: <T>() => Promise<T | null>;
        all: <T>() => Promise<{ results: T[] }>;
      };
    };
  };
  MEDIA: {
    get: (key: string) => Promise<{
      text: () => Promise<string>;
      arrayBuffer: () => Promise<ArrayBuffer>;
    } | null>;
  };
}

async function gunzipString(gz: Uint8Array): Promise<string> {
  const stream = new Blob([gz as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

export async function loadFromR2(
  slug: string,
  env: CloudflareEnv | undefined,
): Promise<LoadedWithHistory> {
  if (!env) return loadFixture(slug);

  // Pick the session: first honor ec_animations.primary_session_id (explicit
  // pointer — set by the publisher or manually via D1), else fall back to
  // the most-recent animation_sessions row with animation_slug = <slug>.
  const animEntry = await env.DB
    .prepare(`SELECT primary_session_id FROM ec_animations WHERE slug = ?1 LIMIT 1`)
    .bind(slug)
    .first<{ primary_session_id: string | null }>();

  let session: { id: string; transcript_r2_key: string; renders_manifest_r2_key: string | null } | null = null;
  if (animEntry?.primary_session_id) {
    session = await env.DB
      .prepare(
        `SELECT id, transcript_r2_key, renders_manifest_r2_key FROM animation_sessions
         WHERE id = ?1 AND published = 1 LIMIT 1`,
      )
      .bind(animEntry.primary_session_id)
      .first<{ id: string; transcript_r2_key: string; renders_manifest_r2_key: string | null }>();
  }
  if (!session) {
    session = await env.DB
      .prepare(
        `SELECT id, transcript_r2_key, renders_manifest_r2_key FROM animation_sessions
         WHERE animation_slug = ?1 AND published = 1
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(slug)
      .first<{ id: string; transcript_r2_key: string; renders_manifest_r2_key: string | null }>();
  }

  if (!session) return loadFixture(slug);

  const obj = await env.MEDIA.get(session.transcript_r2_key);
  if (!obj) return loadFixture(slug);

  const gz = new Uint8Array(await obj.arrayBuffer());
  const raw = await gunzipString(gz);
  const transcript: TranscriptEntry[] = parseTranscript(raw);

  const chapterRows = await env.DB
    .prepare(
      `SELECT cursor_index, label, description FROM animation_chapters
       WHERE session_id = ?1 ORDER BY sort_order ASC`,
    )
    .bind(session.id)
    .all<{ cursor_index: number; label: string; description: string | null }>();

  const chapters: FixtureChapter[] = chapterRows.results.map((r) => ({
    cursor_index: r.cursor_index,
    label: r.label,
    description: r.description ?? undefined,
  }));

  // Source-history key is derived from the transcript key (same prefix).
  // Try v2 first (post-bugfix), fall back to v1 for sessions published
  // before the fix. Either returns null means we skip the live pane.
  const transcriptKey = session.transcript_r2_key;
  const basePrefix = transcriptKey.replace(/transcript\.jsonl\.gz$/, "");
  let sourceHistory: SourceHistory | undefined;
  for (const variant of ["source-history.v2.json.gz", "source-history.json.gz"]) {
    const shObj = await env.MEDIA.get(`${basePrefix}${variant}`);
    if (shObj) {
      const shGz = new Uint8Array(await shObj.arrayBuffer());
      const shRaw = await gunzipString(shGz);
      const parsed = JSON.parse(shRaw) as SourceHistory;
      if (Object.keys(parsed.cursors).length > 0) {
        sourceHistory = parsed;
        break;
      }
    }
  }

  // Fetch renders manifest (if any) — small JSON describing the PNG filmstrip
  let renders: RenderEntry[] | undefined;
  if (session.renders_manifest_r2_key) {
    const manifestObj = await env.MEDIA.get(session.renders_manifest_r2_key);
    if (manifestObj) {
      try {
        const text = await manifestObj.text();
        const parsed = JSON.parse(text) as Array<{ cursor_index: number; r2_key: string }>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          renders = parsed;
        }
      } catch {
        // malformed manifest — ignore, filmstrip stays hidden
      }
    }
  }

  return { transcript, chapters, sourceHistory, renders };
}
