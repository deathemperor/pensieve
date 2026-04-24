import { test } from "node:test";
import assert from "node:assert/strict";
import { isAdminResponse } from "../../src/lib/portraits/auth";

// EmDash returns {data: {id, email, role, ...}} — the real prod shape.
test("isAdminResponse returns true for role 50 under data shape", () => {
  const body = { data: { id: "01", email: "loc@example.com", role: 50 } };
  assert.equal(isAdminResponse(200, body), true);
});

test("isAdminResponse also accepts legacy {user} shape for role 50", () => {
  const body = { user: { role: 50, email: "loc@example.com" } };
  assert.equal(isAdminResponse(200, body), true);
});

test("isAdminResponse returns false for role 40 (Editor) under data shape", () => {
  const body = { data: { role: 40, email: "editor@example.com" } };
  assert.equal(isAdminResponse(200, body), false);
});

test("isAdminResponse returns false for 401 response", () => {
  assert.equal(isAdminResponse(401, null), false);
});

test("isAdminResponse returns false for empty body", () => {
  assert.equal(isAdminResponse(200, {}), false);
});

test("isAdminResponse returns false for role undefined under data shape", () => {
  assert.equal(isAdminResponse(200, { data: { email: "x" } }), false);
});
