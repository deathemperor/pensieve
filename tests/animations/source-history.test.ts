import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSourceHistory,
  reconstructStateAt,
  type RedactedEntry,
} from "../../scripts/source-history.ts";
import { createHash } from "node:crypto";

function sha(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

const SLUG_PREFIX = "src/animations/demo/";

test("buildSourceHistory captures file states for Write + Edit ops", () => {
  const entries: RedactedEntry[] = [
    {
      cursor: 0,
      ts: "t0",
      kind: "tool",
      tool: "Write",
      input: {
        file_path: "src/animations/demo/index.astro",
        content: "hello",
      },
      output: {},
      postStateChecksum: { "src/animations/demo/index.astro": sha("hello") },
    },
    {
      cursor: 1,
      ts: "t1",
      kind: "tool",
      tool: "Edit",
      input: {
        file_path: "src/animations/demo/index.astro",
        old_string: "hello",
        new_string: "hello world",
      },
      output: {},
      postStateChecksum: { "src/animations/demo/index.astro": sha("hello world") },
    },
  ];

  const history = buildSourceHistory(entries, SLUG_PREFIX);
  assert.equal(Object.keys(history.cursors).length, 2);
  assert.equal(
    history.cursors[0].files["src/animations/demo/index.astro"],
    "hello",
  );
  assert.equal(
    history.cursors[1].files["src/animations/demo/index.astro"],
    "hello world",
  );
});

test("buildSourceHistory ignores edits outside the slug prefix", () => {
  const entries: RedactedEntry[] = [
    {
      cursor: 0,
      ts: "t0",
      kind: "tool",
      tool: "Write",
      input: { file_path: "src/other/file.ts", content: "irrelevant" },
      output: {},
    },
  ];
  const history = buildSourceHistory(entries, SLUG_PREFIX);
  assert.equal(Object.keys(history.cursors).length, 0);
});

test("reconstructStateAt returns latest state at-or-before the requested cursor", () => {
  const entries: RedactedEntry[] = [
    {
      cursor: 0,
      ts: "t0",
      kind: "tool",
      tool: "Write",
      input: { file_path: "src/animations/demo/a.astro", content: "v1" },
      output: {},
    },
    {
      cursor: 1,
      ts: "t1",
      kind: "prompt",
      content: "idle",
    },
    {
      cursor: 2,
      ts: "t2",
      kind: "tool",
      tool: "Edit",
      input: {
        file_path: "src/animations/demo/a.astro",
        old_string: "v1",
        new_string: "v2",
      },
      output: {},
    },
  ];
  const history = buildSourceHistory(entries, SLUG_PREFIX);

  const at0 = reconstructStateAt(history, 0);
  assert.equal(at0["src/animations/demo/a.astro"], "v1");

  const at1 = reconstructStateAt(history, 1);
  assert.equal(at1["src/animations/demo/a.astro"], "v1");

  const at2 = reconstructStateAt(history, 2);
  assert.equal(at2["src/animations/demo/a.astro"], "v2");
});

test("buildSourceHistory flags a checksum mismatch", () => {
  const entries: RedactedEntry[] = [
    {
      cursor: 0,
      ts: "t0",
      kind: "tool",
      tool: "Write",
      input: {
        file_path: "src/animations/demo/index.astro",
        content: "actual content",
      },
      output: {},
      postStateChecksum: { "src/animations/demo/index.astro": sha("different content") },
    },
  ];

  assert.throws(
    () => buildSourceHistory(entries, SLUG_PREFIX, { verifyChecksums: true }),
    /checksum mismatch/i,
  );
});

test("buildSourceHistory handles <repo>/-prefixed paths from redacted entries", () => {
  const entries: RedactedEntry[] = [
    {
      cursor: 0,
      ts: "t0",
      kind: "tool",
      tool: "Write",
      input: {
        file_path: "<repo>/src/animations/demo/index.astro",
        content: "hello",
      },
      output: {},
    },
  ];
  const history = buildSourceHistory(entries, SLUG_PREFIX);
  assert.equal(
    history.cursors[0].files["src/animations/demo/index.astro"],
    "hello",
    "state key is normalized repo-relative",
  );
});
