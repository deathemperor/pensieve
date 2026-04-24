import { test } from "node:test";
import assert from "node:assert/strict";
import { nextBirthdayOccurrence } from "../../src/lib/portraits/reminders";

test("nextBirthdayOccurrence: future same year", () => {
  const d = nextBirthdayOccurrence("1990-08-15", new Date("2026-04-22T00:00:00Z"));
  assert.equal(d, "2026-08-15");
});

test("nextBirthdayOccurrence: past in current year → next year", () => {
  const d = nextBirthdayOccurrence("1990-02-10", new Date("2026-04-22T00:00:00Z"));
  assert.equal(d, "2027-02-10");
});

test("nextBirthdayOccurrence: year-less MM-DD format", () => {
  const d = nextBirthdayOccurrence("--05-20", new Date("2026-04-22T00:00:00Z"));
  assert.equal(d, "2026-05-20");
});

test("nextBirthdayOccurrence: returns null for invalid input", () => {
  assert.equal(nextBirthdayOccurrence("not-a-date", new Date()), null);
});
