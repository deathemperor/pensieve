import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { solarToLunar, lunarToSolar, formatDualDate } from "../../src/utils/lunar";

// Asia/Ho_Chi_Minh midnight for a given ISO date string
function hcmcMidnight(iso: string): Date {
  return new Date(iso + "T00:00:00+07:00");
}

// Convert a JS Date back to YYYY-MM-DD in Asia/Ho_Chi_Minh (UTC+7)
function toHcmcIso(date: Date): string {
  const offsetMs = 7 * 60 * 60 * 1000;
  const local = new Date(date.getTime() + offsetMs);
  return local.toISOString().slice(0, 10);
}

// Known Gregorian dates for Tết (lunar 1/1) — from reference tables.
// NOTE: The original spec listed 2030 as "2030-02-03", but the Hồ Ngọc Đức
// algorithm and Wikipedia both give February 2, 2030 (Year of the Dog).
// The spec had a typo; 2030-02-02 is the correct value.
const KNOWN_TET: Record<number, string> = {
  2000: "2000-02-05",
  2005: "2005-02-09",
  2010: "2010-02-14",
  2015: "2015-02-19",
  2020: "2020-01-25",
  2023: "2023-01-22",
  2024: "2024-02-10",
  2025: "2025-01-29",
  2026: "2026-02-17",
  2027: "2027-02-06",
  2030: "2030-02-02", // corrected from spec's "2030-02-03" (Wikipedia + algorithm agree)
};

describe("lunarToSolar — round-trip Tết", () => {
  for (const [yearStr, iso] of Object.entries(KNOWN_TET)) {
    const year = Number(yearStr);
    test(`Tết ${year}: lunarToSolar({year:${year}, month:1, day:1}) === ${iso}`, () => {
      const result = lunarToSolar({ year, month: 1, day: 1 });
      assert.ok(result !== null, `Expected non-null for year ${year}`);
      assert.equal(toHcmcIso(result!), iso);
    });
  }
});

describe("solarToLunar — Tết detection", () => {
  for (const [yearStr, iso] of Object.entries(KNOWN_TET)) {
    const year = Number(yearStr);
    test(`solarToLunar(${iso}) → month:1, day:1`, () => {
      const result = solarToLunar(hcmcMidnight(iso));
      assert.ok(result !== null, `Expected non-null for ${iso}`);
      assert.equal(result!.month, 1, "month should be 1");
      assert.equal(result!.day, 1, "day should be 1");
      // Year check: lunar year equals solar year or solar year-1 depending on when Tết falls,
      // but Tết is always in Jan/Feb so lunar year equals solar year.
      assert.equal(result!.year, year, `lunar year should be ${year}`);
      assert.equal(result!.isLeapMonth, false, "Tết is never a leap month");
    });
  }
});

describe("out-of-range returns null", () => {
  test("solarToLunar: 1899-12-31 → null", () => {
    assert.equal(solarToLunar(new Date("1899-12-31T00:00:00+07:00")), null);
  });

  test("solarToLunar: 2101-01-01 → null", () => {
    assert.equal(solarToLunar(new Date("2101-01-01T00:00:00+07:00")), null);
  });

  test("lunarToSolar: year 1899 → null", () => {
    assert.equal(lunarToSolar({ year: 1899, month: 1, day: 1 }), null);
  });

  test("lunarToSolar: year 2101 → null", () => {
    assert.equal(lunarToSolar({ year: 2101, month: 1, day: 1 }), null);
  });

  test("solarToLunar: invalid Date returns null", () => {
    assert.equal(solarToLunar(new Date("invalid")), null);
    assert.equal(solarToLunar(new Date(NaN)), null);
  });
});

describe("2025 has leap month 6", () => {
  test("month 6 non-leap exists", () => {
    const result = lunarToSolar({ year: 2025, month: 6, day: 1, isLeapMonth: false });
    assert.ok(result !== null, "regular month 6 should exist");
  });

  test("month 6 leap exists", () => {
    const result = lunarToSolar({ year: 2025, month: 6, day: 1, isLeapMonth: true });
    assert.ok(result !== null, "leap month 6 should exist");
  });

  test("leap month 6 comes after regular month 6 in solar calendar", () => {
    const regular = lunarToSolar({ year: 2025, month: 6, day: 1, isLeapMonth: false });
    const leap    = lunarToSolar({ year: 2025, month: 6, day: 1, isLeapMonth: true });
    assert.ok(regular !== null && leap !== null);
    assert.ok(
      leap!.getTime() > regular!.getTime(),
      `Leap month-6 day-1 (${toHcmcIso(leap!)}) must be after regular (${toHcmcIso(regular!)})`
    );
  });

  test("invalid: isLeapMonth:true for month 5 in 2025 (not the leap month)", () => {
    // month 5 is NOT the leap month in 2025; requesting leap month 5 should return null
    assert.equal(lunarToSolar({ year: 2025, month: 5, day: 1, isLeapMonth: true }), null);
  });
});

describe("formatDualDate", () => {
  const d = hcmcMidnight("2026-04-23");

  test("gregorian field contains '23'", () => {
    const { gregorian } = formatDualDate(d);
    assert.ok(gregorian.includes("23"), `Expected gregorian to include '23', got: ${gregorian}`);
  });

  test("lunar field matches D/M or D/M nhuận", () => {
    const { lunar } = formatDualDate(d);
    assert.match(lunar, /^\d+\/\d+( nhuận)?$/);
  });

  test("out-of-range date returns lunar '—'", () => {
    const outOfRange = new Date("1800-01-01T00:00:00+07:00");
    const { lunar } = formatDualDate(outOfRange);
    assert.equal(lunar, "—");
  });

  test("lang:en produces English gregorian", () => {
    const { gregorian } = formatDualDate(d, { lang: "en" });
    // English locale should include the day number
    assert.ok(gregorian.includes("23"), `Expected '23' in EN gregorian: ${gregorian}`);
  });
});

describe("edge cases", () => {
  test("day 30 in a 29-day month returns null", () => {
    // Month 2 of 2025 is 29 days (confirmed by decoding the YEAR_INFO mask for 2025).
    // day:30 passes the blanket guard (day <= 30) but should be rejected by the
    // per-month-length check (day > targetMonth.length) inside lunarToSolar.
    assert.equal(lunarToSolar({ year: 2025, month: 2, day: 30 }), null);
  });

  test("solarToLunar on day before Tết gives month 12 of prior year", () => {
    // Day before Tết 2026 (2026-02-16) should be last month of lunar year 2025
    const dayBeforeTet = hcmcMidnight("2026-02-16");
    const result = solarToLunar(dayBeforeTet);
    assert.ok(result !== null);
    assert.equal(result!.year, 2025);
    assert.equal(result!.month, 12);
  });
});
