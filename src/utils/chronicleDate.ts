import type { DatePrecision } from "./romanDate";

export interface ChronicleDated {
  event_date: string;       // "YYYY-MM-DD"
  date_precision: DatePrecision;
}

export interface ParsedDate {
  year: number;
  month: number | null;
  day: number | null;
  precision: DatePrecision;
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseChronicleDate(e: ChronicleDated): ParsedDate {
  const match = e.event_date.match(ISO_RE);
  if (!match) throw new Error(`Bad event_date: ${e.event_date}`);
  const [, y, m, d] = match;
  const year = Number(y);
  const precision = e.date_precision;
  if (precision === "year") return { year, month: null, day: null, precision };
  const month = Number(m);
  if (precision === "month") return { year, month, day: null, precision };
  return { year, month, day: Number(d), precision };
}

export function compareChronicleDate(
  a: ChronicleDated,
  b: ChronicleDated,
): number {
  if (b.event_date !== a.event_date) {
    return b.event_date.localeCompare(a.event_date);
  }
  const rank = (p: DatePrecision) => (p === "day" ? 0 : p === "month" ? 1 : 2);
  return rank(a.date_precision) - rank(b.date_precision);
}

export interface YearGroup<T extends ChronicleDated> {
  year: number;
  entries: T[];
}

export function groupByYear<T extends ChronicleDated>(entries: T[]): YearGroup<T>[] {
  const sorted = entries.slice().sort(compareChronicleDate);
  const map = new Map<number, T[]>();
  for (const e of sorted) {
    const yr = parseChronicleDate(e).year;
    const list = map.get(yr);
    if (list) list.push(e);
    else map.set(yr, [e]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, entries]) => ({ year, entries }));
}
