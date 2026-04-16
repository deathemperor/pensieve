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

export interface LoadedWithHistory extends LoadedFixture {
  sourceHistory?: SourceHistory;
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

  const session = await env.DB
    .prepare(
      `SELECT id, transcript_r2_key FROM animation_sessions
       WHERE animation_slug = ?1 AND published = 1
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(slug)
    .first<{ id: string; transcript_r2_key: string }>();

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

  return { transcript, chapters, sourceHistory };
}
