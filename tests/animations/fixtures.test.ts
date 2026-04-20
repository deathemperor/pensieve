import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("placeholder transcript is a well-formed JSONL with monotonic cursors", () => {
  const text = readFileSync(
    "src/fixtures/animations/placeholder/transcript.jsonl",
    "utf8",
  );
  const lines = text.trim().split("\n");
  let prev = -1;
  for (const line of lines) {
    const entry = JSON.parse(line);
    assert.ok(
      typeof entry.cursor === "number" && entry.cursor === prev + 1,
      `cursor ${entry.cursor} follows ${prev}`,
    );
    assert.ok(entry.ts, "ts present");
    assert.ok(
      ["prompt", "tool", "assistant"].includes(entry.kind),
      `kind "${entry.kind}" is valid`,
    );
    prev = entry.cursor;
  }
  assert.ok(lines.length >= 5, "fixture has at least 5 entries");
});

test("placeholder chapters all reference valid cursor indices", () => {
  const transcript = readFileSync(
    "src/fixtures/animations/placeholder/transcript.jsonl",
    "utf8",
  )
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
  const maxCursor = transcript[transcript.length - 1].cursor;

  const chapters = JSON.parse(
    readFileSync("src/fixtures/animations/placeholder/chapters.json", "utf8"),
  );
  for (const ch of chapters) {
    assert.ok(
      typeof ch.cursor_index === "number" &&
        ch.cursor_index >= 0 &&
        ch.cursor_index <= maxCursor,
      `chapter "${ch.label}" cursor ${ch.cursor_index} in range [0, ${maxCursor}]`,
    );
    assert.ok(ch.label, "label present");
  }
});
