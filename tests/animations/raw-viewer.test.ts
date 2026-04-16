import { test } from "node:test";
import assert from "node:assert/strict";
import { renderEntryLabel } from "../../src/lib/animations/render-entry.ts";

test("renderEntryLabel formats tool entries with tool + first arg", () => {
  const label = renderEntryLabel({
    cursor: 3,
    ts: "2026-04-16T09:00:00Z",
    kind: "tool",
    tool: "Edit",
    input: { file_path: "src/animations/placeholder/index.astro" },
    output: {},
  });
  assert.match(label, /Edit/);
  assert.match(label, /placeholder\/index\.astro/);
});

test("renderEntryLabel formats prompts with first 60 chars", () => {
  const label = renderEntryLabel({
    cursor: 0,
    ts: "2026-04-16T09:00:00Z",
    kind: "prompt",
    content:
      "Build a simple spinning snitch animation for the Quidditch playground placeholder.",
  });
  assert.match(label, /prompt/i);
  assert.match(label, /Build a simple spinning/);
});

test("renderEntryLabel formats assistant messages with kind prefix", () => {
  const label = renderEntryLabel({
    cursor: 3,
    ts: "2026-04-16T09:00:00Z",
    kind: "assistant",
    content: "Initial static snitch rendered. Adding orbit animation next.",
  });
  assert.match(label, /assistant/i);
  assert.match(label, /Initial static snitch/);
});
