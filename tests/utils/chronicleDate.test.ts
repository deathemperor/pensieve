import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseChronicleDate,
  compareChronicleDate,
  groupByYear,
} from "../../src/utils/chronicleDate";

const A = { event_date: "2021-12-14", date_precision: "day" as const };
const B = { event_date: "2021-05-21", date_precision: "day" as const };
const C = { event_date: "2015-05-01", date_precision: "month" as const };
const D = { event_date: "2004-01-01", date_precision: "year" as const };

test("parseChronicleDate: returns year/month/day with precision", () => {
  assert.deepEqual(parseChronicleDate(A), { year: 2021, month: 12, day: 14, precision: "day" });
  assert.deepEqual(parseChronicleDate(C), { year: 2015, month: 5, day: null, precision: "month" });
  assert.deepEqual(parseChronicleDate(D), { year: 2004, month: null, day: null, precision: "year" });
});

test("compareChronicleDate: sorts newest first", () => {
  const sorted = [D, C, B, A].slice().sort(compareChronicleDate);
  assert.deepEqual(sorted, [A, B, C, D]);
});

test("compareChronicleDate: same date sorts day-precision first", () => {
  const monthOnly = { event_date: "2021-12-01", date_precision: "month" as const };
  const dayExact = { event_date: "2021-12-14", date_precision: "day" as const };
  const sorted = [dayExact, monthOnly].slice().sort(compareChronicleDate);
  assert.deepEqual(sorted, [dayExact, monthOnly]);
});

test("groupByYear: buckets into year arrays, newest year first", () => {
  const grouped = groupByYear([A, B, C, D]);
  assert.deepEqual(grouped.map((g) => g.year), [2021, 2015, 2004]);
  assert.deepEqual(grouped[0].entries, [A, B]);
});
