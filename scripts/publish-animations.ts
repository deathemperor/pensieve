#!/usr/bin/env -S node --import tsx
import { readFile, readdir, unlink, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { redactAll, type RawEntry } from "./redact-transcript.ts";
import {
  buildSourceHistory,
  type RedactedEntry,
  type SourceHistory,
} from "./source-history.ts";

const REPO_ROOT = process.cwd();
const ALLOWLIST_PREFIXES = ["src/animations/", "public/"];
const ALLOWLIST_EXTS = [".md", ".txt", ".astro", ".ts", ".tsx", ".css", ".html", ".json"];

export interface PrepareArgs {
  slug: string;
  sessionId: string;
  transcriptLines: string[];
  repoRoot: string;
}

export interface PreparedSession {
  slug: string;
  sessionId: string;
  toolCallCount: number;
  redacted: RawEntry[];
  sourceHistory: SourceHistory;
  transcriptGz: Uint8Array;
  sourceHistoryGz: Uint8Array;
}

export async function prepareSession(args: PrepareArgs): Promise<PreparedSession> {
  const entries: RawEntry[] = args.transcriptLines.map((l) => JSON.parse(l) as RawEntry);

  for (let i = 0; i < entries.length; i++) {
    if (entries[i].cursor !== i) {
      throw new Error(
        `cursor discontinuity: entry ${i} has cursor ${entries[i].cursor}`,
      );
    }
  }

  const redacted = redactAll(entries, {
    repoRoot: args.repoRoot,
    allowlistPrefixes: ALLOWLIST_PREFIXES,
    allowlistExtensions: ALLOWLIST_EXTS,
  });

  const sourceHistory = buildSourceHistory(
    redacted as RedactedEntry[],
    `src/animations/${args.slug}/`,
    { verifyChecksums: false },
  );

  const toolCallCount = entries.filter((e) => e.kind === "tool").length;

  const transcriptGz = gzipSync(Buffer.from(redacted.map((e) => JSON.stringify(e)).join("\n")));
  const sourceHistoryGz = gzipSync(Buffer.from(JSON.stringify(sourceHistory)));

  return {
    slug: args.slug,
    sessionId: args.sessionId,
    toolCallCount,
    redacted,
    sourceHistory,
    transcriptGz,
    sourceHistoryGz,
  };
}

function wranglerR2Put(bucketKey: string, filePath: string, contentType: string): void {
  execFileSync(
    "npx",
    [
      "wrangler", "r2", "object", "put",
      bucketKey,
      "--file", filePath,
      "--remote",
      "--content-type", contentType,
    ],
    { stdio: "inherit" },
  );
}

function d1Run(sql: string): void {
  execFileSync(
    "npx",
    [
      "wrangler", "d1", "execute", "pensieve-db", "--remote",
      "--command", sql,
    ],
    { stdio: "inherit" },
  );
}

async function main(): Promise<void> {
  const dir = join(REPO_ROOT, ".session/animation-transcripts");
  let descriptors: string[] = [];
  try {
    descriptors = (await readdir(dir)).filter((f) => f.endsWith(".session.json"));
  } catch {
    console.error("no session transcripts to publish");
    return;
  }

  if (descriptors.length === 0) {
    console.error("no finished sessions to publish");
    return;
  }

  for (const descFile of descriptors) {
    const descPath = join(dir, descFile);
    const desc = JSON.parse(await readFile(descPath, "utf8")) as {
      slug: string;
      sessionId: string;
      startedAt: string;
      endedAt: string;
      toolCallCount: number;
    };
    const transcriptPath = join(dir, `${desc.sessionId}.jsonl`);
    const transcriptLines = (await readFile(transcriptPath, "utf8"))
      .split("\n")
      .filter(Boolean);

    const prepared = await prepareSession({
      slug: desc.slug,
      sessionId: desc.sessionId,
      transcriptLines,
      repoRoot: REPO_ROOT,
    });

    const r2Prefix = `animations/${desc.slug}/${desc.sessionId}`;
    const transcriptKey = `${r2Prefix}/transcript.jsonl.gz`;
    const sourceHistoryKey = `${r2Prefix}/source-history.json.gz`;

    const tmp1 = `/tmp/transcript-${desc.sessionId}.gz`;
    const tmp2 = `/tmp/source-history-${desc.sessionId}.gz`;
    await writeFile(tmp1, prepared.transcriptGz);
    await writeFile(tmp2, prepared.sourceHistoryGz);

    console.error(`uploading ${transcriptKey}...`);
    wranglerR2Put(`pensieve-media/${transcriptKey}`, tmp1, "application/gzip");
    console.error(`uploading ${sourceHistoryKey}...`);
    wranglerR2Put(`pensieve-media/${sourceHistoryKey}`, tmp2, "application/gzip");

    const rendersDir = join(REPO_ROOT, ".session/animation-renders", desc.sessionId);
    const manifest: Array<{ cursor_index: number; r2_key: string }> = [];
    try {
      const files = await readdir(rendersDir);
      for (const f of files.filter((fn) => fn.endsWith(".png"))) {
        const m = /cursor-(\d+)\.png/.exec(f);
        if (!m) continue;
        const cursor = parseInt(m[1], 10);
        const key = `${r2Prefix}/renders/${f}`;
        wranglerR2Put(`pensieve-media/${key}`, join(rendersDir, f), "image/png");
        manifest.push({ cursor_index: cursor, r2_key: key });
      }
    } catch {
      // no renders dir — ok
    }

    const manifestKey = `${r2Prefix}/renders/manifest.json`;
    const manifestTmp = `/tmp/manifest-${desc.sessionId}.json`;
    await writeFile(manifestTmp, JSON.stringify(manifest, null, 2));
    wranglerR2Put(`pensieve-media/${manifestKey}`, manifestTmp, "application/json");

    const createdAt = new Date().toISOString();
    const esc = (s: string): string => s.replace(/'/g, "''");
    const insertSql = `INSERT OR REPLACE INTO animation_sessions
      (id, animation_slug, started_at, ended_at, tool_call_count, transcript_r2_key, renders_manifest_r2_key, transcript_size_bytes, published, created_at)
      VALUES ('${esc(desc.sessionId)}', '${esc(desc.slug)}', '${esc(desc.startedAt)}', '${esc(desc.endedAt)}', ${prepared.toolCallCount}, '${esc(transcriptKey)}', '${esc(manifestKey)}', ${prepared.transcriptGz.byteLength}, 1, '${esc(createdAt)}')`;

    console.error("inserting D1 session row...");
    d1Run(insertSql);

    const insightsPath = join(REPO_ROOT, ".session/insights.jsonl");
    try {
      const insightLines = (await readFile(insightsPath, "utf8")).split("\n").filter(Boolean);
      for (const line of insightLines) {
        const insight = JSON.parse(line) as { ts: string; insight: string };
        if (insight.ts >= desc.startedAt && insight.ts <= desc.endedAt) {
          const before = prepared.redacted.filter((e) => e.ts <= insight.ts);
          const cursor = before.length > 0 ? before[before.length - 1].cursor : 0;
          const id = `aref_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
          const refSql = `INSERT INTO animation_artifact_refs
            (id, session_id, cursor_index, artifact_type, artifact_inline_text, created_at)
            VALUES ('${id}', '${esc(desc.sessionId)}', ${cursor}, 'insight', '${esc(insight.insight)}', '${esc(createdAt)}')`;
          d1Run(refSql);
        }
      }
    } catch {
      // no insights to link — ok
    }

    await unlink(transcriptPath);
    await unlink(descPath);
    await rm(rendersDir, { recursive: true, force: true });
    await unlink(tmp1);
    await unlink(tmp2);
    await unlink(manifestTmp);

    console.error(`published ${desc.slug}/${desc.sessionId}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("publish failed:", e);
    process.exit(2);
  });
}
