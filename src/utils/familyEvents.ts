import { lunarToSolar } from "./lunar";

export interface FamilyEventRecord {
	id: string;
	title_en: string;
	title_vi: string;
	event_type: "birthday" | "death_anniv" | "wedding_anniv" | "cultural" | "milestone";
	date_calendar: "solar" | "lunar";
	month: number;
	day: number;
	is_leap_month?: boolean;
	origin_year?: number;
	person_name?: string;
	relationship?: string;
	visibility: "household" | "public";
	reminder_days_before?: string; // JSON-serialised number[]
	photo?: { src: string; alt: string };
}

export interface FamilyOccurrence {
	event: FamilyEventRecord;
	date: Date; // UTC midnight on the solar calendar date of the occurrence
	nth: number | null; // occurrence count (e.g. 34th birthday) if origin_year set
}

/**
 * Materialise every event instance falling within [start, end].
 *
 * Date comparison is UTC-calendar-day based:
 *   - Solar events get UTC midnight of (year, month, day).
 *   - Lunar events: lunarToSolar returns HCMC midnight (UTC-7h); we normalise
 *     to UTC midnight of that UTC calendar day so toISOString().slice(0,10)
 *     reads the same as the raw lunarToSolar UTC date string.
 *   - Range boundaries are compared as their UTC calendar dates (YYYY-MM-DD)
 *     so that HCMC-local range strings behave as expected for callers.
 *
 * Subsequent years always observe a leap-month origin on the regular month
 * (Vietnamese convention).
 */
export function materialiseFamilyEvents(
	events: FamilyEventRecord[],
	start: Date,
	end: Date,
): FamilyOccurrence[] {
	const out: FamilyOccurrence[] = [];

	// Normalise range bounds to UTC-day boundaries for comparison
	const startDay = utcDayStart(start);
	const endDay = utcDayEnd(end);

	// Year range: derive from the UTC calendar years of the bounds
	const startYear = start.getUTCFullYear();
	// end can cross into an extra UTC year; add 1 to be safe and filter by date
	const endYear = end.getUTCFullYear() + 1;

	for (const evt of events) {
		for (let year = startYear; year <= endYear; year++) {
			let occurrenceDate: Date | null = null;

			if (evt.date_calendar === "solar") {
				let day = evt.day;
				// Feb-29 birthdays fall back to Feb 28 in non-leap years
				if (evt.month === 2 && evt.day === 29 && !isLeapYear(year)) {
					day = 28;
				}
				// UTC midnight on the exact solar date — toISOString().slice(0,10) === YYYY-MM-DD
				occurrenceDate = new Date(Date.UTC(year, evt.month - 1, day));
			} else {
				// Lunar: always observe on the regular (non-leap) month
				const raw = lunarToSolar({
					year,
					month: evt.month,
					day: evt.day,
					isLeapMonth: false,
				});
				if (raw !== null) {
					// lunarToSolar returns HCMC midnight (UTC - 7h).
					// Normalise to UTC midnight of the same UTC calendar day so
					// toISOString().slice(0,10) gives the correct solar date string.
					occurrenceDate = utcMidnightOfUtcDay(raw);
				}
			}

			if (
				occurrenceDate !== null &&
				occurrenceDate.getTime() >= startDay.getTime() &&
				occurrenceDate.getTime() <= endDay.getTime()
			) {
				const nth = evt.origin_year != null ? year - evt.origin_year : null;
				out.push({ event: evt, date: occurrenceDate, nth });
			}
		}
	}

	out.sort((a, b) => a.date.getTime() - b.date.getTime());
	return out;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** UTC midnight at the start of the UTC calendar day containing d. */
function utcMidnightOfUtcDay(d: Date): Date {
	return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** UTC midnight at the start of the UTC calendar day of d (range lower bound). */
function utcDayStart(d: Date): Date {
	return utcMidnightOfUtcDay(d);
}

/** UTC 23:59:59.999 at the end of the UTC calendar day of d (range upper bound). */
function utcDayEnd(d: Date): Date {
	const s = utcMidnightOfUtcDay(d);
	return new Date(s.getTime() + 86400_000 - 1);
}

function isLeapYear(y: number): boolean {
	return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}
