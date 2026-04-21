import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toRoman,
  formatRomanDate,
} from "../../src/utils/romanDate";

test("toRoman: edge cases", () => {
  assert.equal(toRoman(1), "I");
  assert.equal(toRoman(4), "IV");
  assert.equal(toRoman(9), "IX");
  assert.equal(toRoman(12), "XII");
  assert.equal(toRoman(31), "XXXI");
  assert.equal(toRoman(1999), "MCMXCIX");
  assert.equal(toRoman(2000), "MM");
  assert.equal(toRoman(2021), "MMXXI");
  assert.equal(toRoman(2026), "MMXXVI");
});

test("toRoman: throws on invalid input", () => {
  assert.throws(() => toRoman(0));
  assert.throws(() => toRoman(-1));
  assert.throws(() => toRoman(4000));
  assert.throws(() => toRoman(3.5));
});

test("formatRomanDate: day precision", () => {
  assert.equal(
    formatRomanDate("2021-12-14", "day"),
    "XIV · XII · MMXXI",
  );
});

test("formatRomanDate: month precision drops day", () => {
  assert.equal(
    formatRomanDate("2015-05-01", "month"),
    "V · MMXV",
  );
});

test("formatRomanDate: year precision shows year only", () => {
  assert.equal(
    formatRomanDate("2004-01-01", "year"),
    "MMIV",
  );
});

test("formatRomanDate: rejects non-ISO date", () => {
  assert.throws(() => formatRomanDate("14/12/2021", "day"));
  assert.throws(() => formatRomanDate("2021-13-01", "day"));
});
