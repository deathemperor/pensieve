import { test } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.PORTRAITS_SMOKE_BASE_URL;

test("GET /api/portraits returns guest demo shape", { skip: !BASE }, async () => {
  const res = await fetch(`${BASE}/api/portraits`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { contacts: any[]; guest: boolean };
  assert.equal(body.guest, true);
  assert.equal(body.contacts.length, 12);
});

test("POST /api/portraits without session returns 403", { skip: !BASE }, async () => {
  const res = await fetch(`${BASE}/api/portraits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name: "Test", prestige_tier: "D" }),
  });
  assert.equal(res.status, 403);
});
