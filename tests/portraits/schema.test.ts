import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

// Shells out to `npx wrangler d1 execute --remote`. Set SKIP_D1_TESTS=1 to skip in envs without wrangler auth.
const skipD1 = process.env.SKIP_D1_TESTS === "1";

test("portraits tables exist in remote D1", { skip: skipD1 }, () => {
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
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('contacts','contact_channels','contact_notes','contact_cards','contact_interactions','contact_edges','contact_reminders') ORDER BY name",
    ],
    { encoding: "utf8" },
  );
  const parsed = JSON.parse(out) as Array<{ results: Array<{ name: string }> }>;
  const names = parsed[0].results.map((r) => r.name);
  assert.deepEqual(names, [
    "contact_cards",
    "contact_channels",
    "contact_edges",
    "contact_interactions",
    "contact_notes",
    "contact_reminders",
    "contacts",
  ]);
});
