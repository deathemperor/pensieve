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
	date: Date; // HCMC midnight of the occurrence
	nth: number | null; // occurrence count (e.g. 34th birthday) if origin_year set
}

const HCMC_OFFSET_MS = 7 * 3600 * 1000;

/**
 * Materialise every event instance falling within [start, end].
 *
 * `FamilyOccurrence.date` is HCMC midnight (UTC - 7h) of the actual HCMC
 * calendar day the event falls on. Range comparison is a direct instant
 * comparison — no UTC-day normalisation.
 *
 *   - Solar event on month M, day D, year Y →
 *       new Date(Date.UTC(Y, M-1, D) - HCMC_OFFSET_MS)
 *   - Lunar event → lunarToSolar() which already returns HCMC midnight; used
 *       as-is with no further normalisation.
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

	const startYear = hcmcYear(start);
	const endYear = hcmcYear(end);

	for (const evt of events) {
		for (let year = startYear; year <= endYear; year++) {
			let occurrenceDate: Date | null = null;

			if (evt.date_calendar === "solar") {
				let day = evt.day;
				// Feb-29 birthdays fall back to Feb 28 in non-leap years
				if (evt.month === 2 && evt.day === 29 && !isLeapYear(year)) {
					day = 28;
				}
				// HCMC midnight = UTC midnight of same calendar date minus 7 hours
				occurrenceDate = new Date(Date.UTC(year, evt.month - 1, day) - HCMC_OFFSET_MS);
			} else {
				// Lunar: always observe on the regular (non-leap) month.
				// lunarToSolar already returns HCMC midnight — use as-is.
				occurrenceDate = lunarToSolar({
					year,
					month: evt.month,
					day: evt.day,
					isLeapMonth: false,
				});
			}

			if (occurrenceDate !== null && occurrenceDate >= start && occurrenceDate <= end) {
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

/** Return the HCMC calendar year of a given instant. */
function hcmcYear(d: Date): number {
	const parts = new Intl.DateTimeFormat("en-GB", {
		year: "numeric",
		timeZone: "Asia/Ho_Chi_Minh",
	}).formatToParts(d);
	const yearPart = parts.find((p) => p.type === "year");
	return Number(yearPart?.value);
}

function isLeapYear(y: number): boolean {
	return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}
