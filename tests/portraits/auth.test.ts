import { test } from "node:test";
import assert from "node:assert/strict";
import { isAdminResponse } from "../../src/lib/portraits/auth";

test("isAdminResponse returns true for role 50", () => {
  const body = { user: { role: 50, email: "loc@example.com" } };
  assert.equal(isAdminResponse(200, body), true);
});

test("isAdminResponse returns false for role 40 (Editor)", () => {
  const body = { user: { role: 40, email: "editor@example.com" } };
  assert.equal(isAdminResponse(200, body), false);
});

test("isAdminResponse returns false for 401 response", () => {
  assert.equal(isAdminResponse(401, null), false);
});

test("isAdminResponse returns false for missing user", () => {
  assert.equal(isAdminResponse(200, {}), false);
});

test("isAdminResponse returns false for role undefined", () => {
  assert.equal(isAdminResponse(200, { user: { email: "x" } }), false);
});
