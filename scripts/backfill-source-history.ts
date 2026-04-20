#!/usr/bin/env -S node --import tsx
import { readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { buildSourceHistory, type RedactedEntry } from "./source-history.ts";

async function main(): Promise<void> {
  const [, , slug, sessionId] = process.argv;
  if (!slug || !sessionId) {
    console.error("usage: backfill-source-history.ts <slug> <session-id>");
    process.exit(1);
  }

  const transcriptKey = `animations/${slug}/${sessionId}/transcript.jsonl.gz`;
  const sourceHistoryKey = `animations/${slug}/${sessionId}/source-history.json.gz`;
  const tmpT = `/tmp/bf-t-${sessionId}.gz`;
  const tmpSh = `/tmp/bf-sh-${sessionId}.gz`;

  console.error(`fetching ${transcriptKey}...`);
  execFileSync(
    "npx",
    ["wrangler", "r2", "object", "get", `pensieve-media/${transcriptKey}`, "--remote", "--file", tmpT],
    { stdio: "inherit" },
  );

  execFileSync("gunzip", ["-fk", tmpT]);
  const raw = await readFile(tmpT.replace(".gz", ""), "utf8");
  const lines = raw.split("\n").filter(Boolean);
  const entries = lines.map((l) => JSON.parse(l) as RedactedEntry);
  const history = buildSourceHistory(entries, `src/animations/${slug}/`);
  console.error(`rebuilt source-history: ${Object.keys(history.cursors).length} cursors from ${entries.length} entries`);

  await writeFile(tmpSh, gzipSync(Buffer.from(JSON.stringify(history))));
  console.error(`uploading ${sourceHistoryKey}...`);
  execFileSync(
    "npx",
    ["wrangler", "r2", "object", "put", `pensieve-media/${sourceHistoryKey}`, "--file", tmpSh, "--remote", "--content-type", "application/gzip"],
    { stdio: "inherit" },
  );
  console.error("done");
}

main().catch((e) => {
  console.error("backfill failed:", e);
  process.exit(2);
});
