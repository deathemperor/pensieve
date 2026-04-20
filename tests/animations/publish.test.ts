import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareSession } from "../../scripts/publish-animations.ts";
import type { RawEntry } from "../../scripts/redact-transcript.ts";

test("prepareSession redacts, builds source-history, and gzips", async () => {
  const entries: RawEntry[] = [
    { cursor: 0, ts: "t0", kind: "prompt", content: "Build it" },
    {
      cursor: 1,
      ts: "t1",
      kind: "tool",
      tool: "Write",
      input: { file_path: "src/animations/demo/index.astro", content: "hello" },
      output: { status: "ok" },
    },
  ];

  const prepared = await prepareSession({
    slug: "demo",
    sessionId: "sess-xyz",
    transcriptLines: entries.map((e) => JSON.stringify(e)),
    repoRoot: "/repo",
  });

  assert.equal(prepared.slug, "demo");
  assert.equal(prepared.sessionId, "sess-xyz");
  assert.equal(prepared.toolCallCount, 1);

  const promptCount = prepared.redacted.filter((e) => e.kind === "prompt").length;
  assert.equal(promptCount, 1);

  assert.ok(prepared.sourceHistory.cursors[1], "source history has cursor 1");
  assert.equal(
    prepared.sourceHistory.cursors[1].files["src/animations/demo/index.astro"],
    "hello",
  );

  assert.ok(prepared.transcriptGz.byteLength > 0);
  assert.ok(prepared.sourceHistoryGz.byteLength > 0);
});

test("prepareSession throws when transcript has a cursor gap", async () => {
  const entries: RawEntry[] = [
    { cursor: 0, ts: "t0", kind: "prompt", content: "a" },
    { cursor: 2, ts: "t2", kind: "prompt", content: "b" },
  ];
  await assert.rejects(
    () =>
      prepareSession({
        slug: "demo",
        sessionId: "sess-gap",
        transcriptLines: entries.map((e) => JSON.stringify(e)),
        repoRoot: "/repo",
      }),
    /cursor/i,
  );
});
