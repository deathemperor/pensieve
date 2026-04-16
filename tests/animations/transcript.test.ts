import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseTranscript,
  filterByKinds,
  type TranscriptEntry,
} from "../../src/lib/animations/transcript.ts";

const SAMPLE = [
  `{"cursor":0,"ts":"2026-04-16T09:00:00Z","kind":"prompt","content":"Hi"}`,
  `{"cursor":1,"ts":"2026-04-16T09:00:05Z","kind":"tool","tool":"Read","input":{},"output":{}}`,
  `{"cursor":2,"ts":"2026-04-16T09:00:10Z","kind":"assistant","content":"Ok"}`,
].join("\n");

test("parseTranscript yields typed entries in order", () => {
  const entries = parseTranscript(SAMPLE);
  assert.equal(entries.length, 3);
  assert.equal(entries[0].kind, "prompt");
  assert.equal(entries[1].kind, "tool");
  assert.equal(entries[2].kind, "assistant");
});

test("filterByKinds excludes unwanted kinds", () => {
  const entries: TranscriptEntry[] = parseTranscript(SAMPLE);
  const onlyPromptsAndTools = filterByKinds(entries, ["prompt", "tool"]);
  assert.equal(onlyPromptsAndTools.length, 2);
  assert.ok(!onlyPromptsAndTools.some((e) => e.kind === "assistant"));
});
