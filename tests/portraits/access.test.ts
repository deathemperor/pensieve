import { test } from "node:test";
import assert from "node:assert/strict";

// Import only the pure helper -- resolveContactAccess / requireContactAccess
// require real D1 + Astro globals and are exercised integration-level.
import { isAdminResponse } from "../../src/lib/portraits/auth";

// Sanity: Phase 1 behavior preserved.
test("isAdminResponse: admin role unchanged", () => {
  assert.equal(isAdminResponse(200, { user: { role: 50, email: "loc@example.com" } }), true);
});
test("isAdminResponse: editor role still non-admin", () => {
  assert.equal(isAdminResponse(200, { user: { role: 40, email: "ed@example.com" } }), false);
});
