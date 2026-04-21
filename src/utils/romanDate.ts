/**
 * Roman numeral conversion for Chronicle dates.
 * Pure functions, no dependencies.
 */

const PAIRS: readonly [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"],  [90, "XC"],  [50, "L"],  [40, "XL"],
  [10, "X"],   [9, "IX"],   [5, "V"],   [4, "IV"],
  [1, "I"],
];

export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) {
    throw new Error(`Roman numeral out of range (1..3999): ${n}`);
  }
  let out = "";
  let rem = n;
  for (const [value, numeral] of PAIRS) {
    while (rem >= value) {
      out += numeral;
      rem -= value;
    }
  }
  return out;
}

export type DatePrecision = "day" | "month" | "year";

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatRomanDate(isoDate: string, precision: DatePrecision): string {
  const match = isoDate.match(ISO_RE);
  if (!match) throw new Error(`Expected ISO yyyy-mm-dd, got: ${isoDate}`);
  const [, y, m, d] = match;
  const yr = Number(y), mo = Number(m), dy = Number(d);
  if (mo < 1 || mo > 12) throw new Error(`Bad month: ${mo}`);
  if (dy < 1 || dy > 31) throw new Error(`Bad day: ${dy}`);

  // Reject calendar-invalid dates (e.g. 2021-02-30, 2021-04-31).
  const probe = new Date(Date.UTC(yr, mo - 1, dy));
  if (
    probe.getUTCFullYear() !== yr ||
    probe.getUTCMonth() !== mo - 1 ||
    probe.getUTCDate() !== dy
  ) {
    throw new Error(`Calendar-invalid date: ${isoDate}`);
  }

  if (precision === "year") return toRoman(yr);
  if (precision === "month") return `${toRoman(mo)} · ${toRoman(yr)}`;
  return `${toRoman(dy)} · ${toRoman(mo)} · ${toRoman(yr)}`;
}
