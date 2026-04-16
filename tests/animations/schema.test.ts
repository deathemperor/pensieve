import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("animation tables exist in remote D1", () => {
  const out = execFileSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      "pensieve-db",
      "--remote",
      "--json",
      "--command",
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'animation_%' ORDER BY name",
    ],
    { encoding: "utf8" },
  );
  const parsed = JSON.parse(out) as Array<{
    results: Array<{ name: string }>;
  }>;
  const names = parsed[0].results.map((r) => r.name);
  assert.deepEqual(names, [
    "animation_artifact_refs",
    "animation_chapters",
    "animation_sessions",
  ]);
});
