import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

function d1(sql: string) {
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
      sql,
    ],
    { encoding: "utf8" },
  );
  return JSON.parse(out) as Array<{ results: any[] }>;
}

test("placeholder contacts exist (12 rows)", () => {
  const parsed = d1(
    "SELECT COUNT(*) AS n FROM contacts WHERE is_placeholder=1 AND deleted_at IS NULL",
  );
  assert.equal(parsed[0].results[0].n, 12);
});

test("placeholder S-tier has 4 rows", () => {
  const parsed = d1(
    "SELECT COUNT(*) AS n FROM contacts WHERE is_placeholder=1 AND prestige_tier='S' AND deleted_at IS NULL",
  );
  assert.equal(parsed[0].results[0].n, 4);
});

test("every placeholder contact has at least one email channel", () => {
  const parsed = d1(`
    SELECT c.id
    FROM contacts c
    LEFT JOIN contact_channels ch
      ON ch.contact_id = c.id AND ch.kind = 'email'
    WHERE c.is_placeholder=1 AND c.deleted_at IS NULL
    GROUP BY c.id
    HAVING COUNT(ch.id) = 0
  `);
  assert.deepEqual(parsed[0].results, []);
});
