// Integration tests for the Phase 13 collaborator access model.
// Hits real remote D1 via wrangler — gated on SKIP_D1_TESTS=1 so CI
// without wrangler credentials can opt out.
//
// Flow: seed a non-placeholder contact + a collaborator grant, then
// probe the resolveContactAccess contract via D1 directly (we can't
// easily instantiate an AstroGlobal in a node:test harness).

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const skip = process.env.SKIP_D1_TESTS === "1";

function d1(sql: string, binds: string[] = []): Array<{ results: any[] }> {
  const args = [
    "wrangler", "d1", "execute", "pensieve-db",
    "--remote", "--json",
    "--command", sql,
  ];
  // Bindings interpolated by the wrangler --command is awkward — our tests
  // use literals to avoid that complexity. Kept binds param for future use.
  const _ = binds;
  const out = execFileSync("npx", args, { encoding: "utf8" });
  return JSON.parse(out);
}

const TEST_CONTACT_ID = "zz_collab_test_contact";
const TEST_COLLAB_EMAIL = "collab-test@example.com";
const TEST_GRANT_ID = "zz_collab_grant_test";

function cleanup() {
  d1(`DELETE FROM contact_collaborators WHERE id = '${TEST_GRANT_ID}'`);
  d1(`DELETE FROM contacts WHERE id = '${TEST_CONTACT_ID}'`);
}

test("collaborator grant creates a view-level row", { skip }, () => {
  cleanup();
  // Seed a real (non-placeholder) contact.
  d1(`
    INSERT INTO contacts (id, full_name, prestige_tier, source, is_placeholder, created_at, updated_at)
    VALUES ('${TEST_CONTACT_ID}', 'Test Collab Contact', 'C', 'manual', 0,
            '2026-04-23T00:00:00Z', '2026-04-23T00:00:00Z')
  `);
  d1(`
    INSERT INTO contact_collaborators (id, contact_id, email, access, granted_by, created_at)
    VALUES ('${TEST_GRANT_ID}', '${TEST_CONTACT_ID}', '${TEST_COLLAB_EMAIL}', 'view',
            'admin@example.com', '2026-04-23T00:00:00Z')
  `);

  const rs = d1(`
    SELECT access FROM contact_collaborators
    WHERE contact_id = '${TEST_CONTACT_ID}' AND email = '${TEST_COLLAB_EMAIL}'
  `);
  assert.equal(rs[0].results[0].access, "view");
  cleanup();
});

test("promoting view → edit via UNIQUE constraint upsert", { skip }, () => {
  cleanup();
  d1(`
    INSERT INTO contacts (id, full_name, prestige_tier, source, is_placeholder, created_at, updated_at)
    VALUES ('${TEST_CONTACT_ID}', 'Test', 'C', 'manual', 0, '2026-04-23T00:00:00Z', '2026-04-23T00:00:00Z')
  `);
  d1(`
    INSERT INTO contact_collaborators (id, contact_id, email, access, granted_by, created_at)
    VALUES ('${TEST_GRANT_ID}', '${TEST_CONTACT_ID}', '${TEST_COLLAB_EMAIL}', 'view', 'a', '2026-04-23T00:00:00Z')
  `);
  // POST /collaborators upserts via UPDATE-on-UNIQUE; simulate that path.
  d1(`
    UPDATE contact_collaborators SET access = 'edit'
    WHERE contact_id = '${TEST_CONTACT_ID}' AND email = '${TEST_COLLAB_EMAIL}'
  `);
  const rs = d1(`SELECT access FROM contact_collaborators WHERE id = '${TEST_GRANT_ID}'`);
  assert.equal(rs[0].results[0].access, "edit");
  cleanup();
});

test("revoking collaborator removes the row", { skip }, () => {
  cleanup();
  d1(`
    INSERT INTO contacts (id, full_name, prestige_tier, source, is_placeholder, created_at, updated_at)
    VALUES ('${TEST_CONTACT_ID}', 'Test', 'C', 'manual', 0, '2026-04-23T00:00:00Z', '2026-04-23T00:00:00Z')
  `);
  d1(`
    INSERT INTO contact_collaborators (id, contact_id, email, access, granted_by, created_at)
    VALUES ('${TEST_GRANT_ID}', '${TEST_CONTACT_ID}', '${TEST_COLLAB_EMAIL}', 'view', 'a', '2026-04-23T00:00:00Z')
  `);
  d1(`DELETE FROM contact_collaborators WHERE id = '${TEST_GRANT_ID}'`);
  const rs = d1(`SELECT id FROM contact_collaborators WHERE id = '${TEST_GRANT_ID}'`);
  assert.deepEqual(rs[0].results, []);
  cleanup();
});

test("contact soft-delete does not cascade to collaborator rows (FK cascade does)", { skip }, () => {
  cleanup();
  d1(`
    INSERT INTO contacts (id, full_name, prestige_tier, source, is_placeholder, created_at, updated_at)
    VALUES ('${TEST_CONTACT_ID}', 'Test', 'C', 'manual', 0, '2026-04-23T00:00:00Z', '2026-04-23T00:00:00Z')
  `);
  d1(`
    INSERT INTO contact_collaborators (id, contact_id, email, access, granted_by, created_at)
    VALUES ('${TEST_GRANT_ID}', '${TEST_CONTACT_ID}', '${TEST_COLLAB_EMAIL}', 'view', 'a', '2026-04-23T00:00:00Z')
  `);
  // Soft delete — deleted_at set, row stays. Collab row also stays.
  d1(`UPDATE contacts SET deleted_at = '2026-04-23T00:00:00Z' WHERE id = '${TEST_CONTACT_ID}'`);
  const rs = d1(`SELECT id FROM contact_collaborators WHERE id = '${TEST_GRANT_ID}'`);
  assert.equal(rs[0].results.length, 1, "soft-delete preserves collaborator grant");
  // Hard delete — FK cascades.
  d1(`DELETE FROM contacts WHERE id = '${TEST_CONTACT_ID}'`);
  const rs2 = d1(`SELECT id FROM contact_collaborators WHERE id = '${TEST_GRANT_ID}'`);
  assert.deepEqual(rs2[0].results, [], "hard-delete cascades to collaborator grant");
  cleanup();
});

test("rate_limit_buckets upsert increments count", { skip }, () => {
  const key = "test:collab-integration-test";
  const windowStart = "2026-04-23T00:00:00Z";
  d1(`DELETE FROM rate_limit_buckets WHERE bucket_key = '${key}'`);
  d1(`
    INSERT INTO rate_limit_buckets (bucket_key, window_start, count)
    VALUES ('${key}', '${windowStart}', 1)
    ON CONFLICT(bucket_key, window_start) DO UPDATE SET count = count + 1
  `);
  d1(`
    INSERT INTO rate_limit_buckets (bucket_key, window_start, count)
    VALUES ('${key}', '${windowStart}', 1)
    ON CONFLICT(bucket_key, window_start) DO UPDATE SET count = count + 1
  `);
  const rs = d1(`SELECT count FROM rate_limit_buckets WHERE bucket_key = '${key}'`);
  assert.equal(rs[0].results[0].count, 2);
  d1(`DELETE FROM rate_limit_buckets WHERE bucket_key = '${key}'`);
});
