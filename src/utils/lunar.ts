/**
 * Vietnamese âm lịch (lunisolar calendar) conversion.
 *
 * Algorithm: Hồ Ngọc Đức's canonical method.
 * Source: https://www.informatik.uni-leipzig.de/~duc/amlich/
 * Table data vendored from NghiaCaNgao/LunarDate (ISC licence) — see lunar-table.ts.
 *
 * Time-zone anchor: Asia/Ho_Chi_Minh = UTC+7. All "day boundaries" are at
 * midnight HCMC time. A JS Date whose UTC value corresponds to HCMC midnight
 * is the canonical input for solarToLunar.
 *
 * Supported range: Gregorian 1900-01-01 through 2100-12-31 (HCMC local).
 */

import { YEAR_INFO, TABLE_START_YEAR, TABLE_END_YEAR } from "./lunar-table";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface LunarDate {
  year: number;       // lunar year
  month: number;      // 1–12
  day: number;        // 1–30
  isLeapMonth: boolean;
}

/**
 * Convert a JS Date to its Vietnamese lunar date.
 * The date is interpreted in Asia/Ho_Chi_Minh (UTC+7).
 * Returns null if the date is outside the 1900–2100 table range.
 */
export function solarToLunar(date: Date): LunarDate | null {
  // Shift to HCMC local by adding 7 hours, then read UTC fields as if local.
  const hcmc = new Date(date.getTime() + 7 * 3600 * 1000);
  const sYear  = hcmc.getUTCFullYear();
  const sMonth = hcmc.getUTCMonth() + 1; // 1-based
  const sDay   = hcmc.getUTCDate();

  if (sYear < 1900 || sYear > 2100) return null;

  const jd = solarToJd(sYear, sMonth, sDay);

  // Decode the lunar year — if before lunar new year, use previous solar year.
  let lunarYear = sYear;
  let months = decodeLunarYear(lunarYear);
  if (jd < months[0].jd) {
    lunarYear = sYear - 1;
    months = decodeLunarYear(lunarYear);
  }

  // Range guard after adjusting lunarYear
  if (lunarYear < 1900 || lunarYear > 2100) return null;

  return findLunarDate(jd, months, lunarYear);
}

/**
 * Convert a lunar date to its corresponding JS Date (HCMC midnight, UTC+7).
 * isLeapMonth defaults to false.
 * Returns null if the year is outside 1900–2100 or if the (month, day, leap)
 * combination is invalid for that year (e.g., day 30 in a 29-day month).
 */
export function lunarToSolar(l: {
  year: number;
  month: number;
  day: number;
  isLeapMonth?: boolean;
}): Date | null {
  const { year, month, day, isLeapMonth = false } = l;
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12 || day < 1 || day > 30) return null;

  const months = decodeLunarYear(year);

  // Find the matching lunar month (regular or leap)
  let targetMonth: DecodedMonth | undefined;
  for (const m of months) {
    if (m.month === month && m.isLeap === isLeapMonth) {
      targetMonth = m;
      break;
    }
  }

  if (!targetMonth) return null;           // no such leap month in this year
  if (day > targetMonth.length) return null; // day beyond month end

  const jd = targetMonth.jd + day - 1;
  return jdToDate(jd); // returns HCMC midnight as a Date
}

/**
 * Format a date as both Gregorian and lunar calendar strings for UI display.
 *
 * gregorian: human-readable date in the requested language (Vietnamese by default).
 * lunar:     "D/M" or "D/M nhuận". Falls back to "—" outside the 1900–2100 range.
 */
export function formatDualDate(
  date: Date,
  opts?: { lang?: "vi" | "en" }
): { gregorian: string; lunar: string } {
  const lang = opts?.lang ?? "vi";

  // Gregorian label: shift to HCMC local for the display date
  const hcmc = new Date(date.getTime() + 7 * 3600 * 1000);
  const sYear  = hcmc.getUTCFullYear();
  const sMonth = hcmc.getUTCMonth();
  const sDay   = hcmc.getUTCDate();
  const localDate = new Date(Date.UTC(sYear, sMonth, sDay));

  const locale = lang === "en" ? "en-GB" : "vi-VN";
  const gregorian = localDate.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC", // already shifted; treat UTC fields as local
  });

  const lunar = solarToLunar(date);
  if (!lunar) return { gregorian, lunar: "—" };

  const lunarStr = `${lunar.day}/${lunar.month}${lunar.isLeapMonth ? " nhuận" : ""}`;
  return { gregorian, lunar: lunarStr };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface DecodedMonth {
  month: number;   // 1–12
  isLeap: boolean;
  jd: number;      // Julian day of month's day 1
  length: number;  // 29 or 30
}

/** Look up the packed year code for a given lunar year (1900–2100). */
function getYearCode(year: number): number {
  if (year < TABLE_START_YEAR || year > TABLE_END_YEAR) {
    throw new RangeError(`Lunar year ${year} is outside supported range ${TABLE_START_YEAR}–${TABLE_END_YEAR}`);
  }
  return YEAR_INFO[year - TABLE_START_YEAR];
}

/**
 * Decode a packed year code into a list of lunar months.
 *
 * Bit layout (as used in Hồ Ngọc Đức's algorithm, confirmed by NghiaCaNgao/LunarDate):
 *   yearCode >> 17          → offset: days from Jan 1 of solar year to lunar New Year
 *   (yearCode >> 16) & 0x1  → leap-month length: 1=30 days, 0=29 days
 *   (yearCode >> 4) & 0xfff → 12-bit mask; bit 11 = month 1 … bit 0 = month 12;
 *                              1 = 30 days, 0 = 29 days
 *   yearCode & 0xf          → which month has a leap month (0 = none)
 */
function decodeLunarYear(year: number): DecodedMonth[] {
  const code = getYearCode(year);

  // Julian day of Jan 1 of this solar year, then add the Tết offset
  const tetOffset = code >> 17;
  const jan1Jd = solarToJd(year, 1, 1);
  let currentJd = jan1Jd + tetOffset;

  const leapMonthNum    = code & 0xf;             // 0 = no leap; 1–12 = which
  const leapMonthLength = ((code >> 16) & 0x1) ? 30 : 29;

  // 12-bit mask: bit 11 is month 1, bit 0 is month 12
  const lenMask = (code >> 4) & 0xfff;

  const months: DecodedMonth[] = [];

  for (let m = 1; m <= 12; m++) {
    const bitPos = 12 - m; // month 1 → bit 11, month 12 → bit 0
    const length = (lenMask >> bitPos) & 0x1 ? 30 : 29;

    months.push({ month: m, isLeap: false, jd: currentJd, length });
    currentJd += length;

    if (leapMonthNum === m) {
      months.push({ month: m, isLeap: true, jd: currentJd, length: leapMonthLength });
      currentJd += leapMonthLength;
    }
  }

  return months;
}

/** Binary-search the month list to find which month a Julian day falls in. */
function findLunarDate(jd: number, months: DecodedMonth[], lunarYear: number): LunarDate {
  let idx = months.length - 1;
  while (idx > 0 && jd < months[idx].jd) idx--;

  const m = months[idx];
  return {
    year: lunarYear,
    month: m.month,
    day: jd - m.jd + 1,
    isLeapMonth: m.isLeap,
  };
}

// ---------------------------------------------------------------------------
// Julian Day Number utilities (proleptic Gregorian, post-1582)
// ---------------------------------------------------------------------------

/**
 * Convert a Gregorian date to its Julian Day Number.
 * Uses the Gregorian formula unconditionally (same as the reference library for
 * all dates in our 1900–2100 range, which is post-1582).
 */
function solarToJd(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y +
    Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

/**
 * Convert a Julian Day Number back to a JS Date at HCMC midnight (UTC+7).
 * The resulting Date's UTC instant is midnight HCMC = 17:00 the previous UTC day.
 */
function jdToDate(jd: number): Date {
  // JDN → Gregorian calendar (Gregorian formula, valid post-1582)
  const a = jd + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor(146097 * b / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor(1461 * d / 4);
  const mm = Math.floor((5 * e + 2) / 153);

  const day   = e - Math.floor((153 * mm + 2) / 5) + 1;
  const month = mm + 3 - 12 * Math.floor(mm / 10);
  const year  = 100 * b + d - 4800 + Math.floor(mm / 10);

  // Construct as HCMC midnight: UTC is 7 hours behind local midnight
  return new Date(Date.UTC(year, month - 1, day) - 7 * 3600 * 1000);
}
