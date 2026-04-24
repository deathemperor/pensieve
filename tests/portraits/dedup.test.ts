import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, matchCandidates } from "../../src/lib/portraits/dedup";

test("normalizePhone: E.164 pass-through", () => {
  assert.equal(normalizePhone("+1 408 555 1212"), "+14085551212");
});

test("normalizePhone: strips formatting", () => {
  assert.equal(normalizePhone("(408) 555-1212"), "4085551212");
});

test("matchCandidates: exact email wins", () => {
  const candidates = [
    { id: "a", name: "Other", emails: ["other@x.com"], phones: [] },
    { id: "b", name: "Target", emails: ["match@x.com"], phones: [] },
  ];
  const out = matchCandidates(candidates, { emails: ["match@x.com"], phones: [] });
  assert.equal(out[0].id, "b");
  assert.equal(out[0].reason, "email_exact");
});

test("matchCandidates: phone match (normalized)", () => {
  const candidates = [{ id: "a", name: "A", emails: [], phones: ["+14085551212"] }];
  const out = matchCandidates(candidates, { emails: [], phones: ["(408) 555-1212"] });
  assert.equal(out[0]?.id, "a");
  assert.equal(out[0]?.reason, "phone_match");
});

test("matchCandidates: no match returns empty", () => {
  const out = matchCandidates([{ id: "a", name: "A", emails: ["x@y.com"], phones: [] }], {
    emails: ["z@w.com"],
    phones: [],
  });
  assert.deepEqual(out, []);
});
