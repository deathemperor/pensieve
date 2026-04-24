import type { AvailabilityRuleData } from "./storage";

export interface BusyWindow {
	start_iso: string;
	end_iso: string;
}

export interface Slot {
	start_iso: string;
	end_iso: string;
}

export interface ComputeSlotsInput {
	rule: AvailabilityRuleData;
	busyWindows: BusyWindow[];
	durationMin: number;
	bufferBeforeMin: number;
	bufferAfterMin: number;
	minNoticeHrs: number;
	maxAdvanceDays: number;
	/** UTC ISO, inclusive. */
	rangeStartIso: string;
	/** UTC ISO, exclusive. */
	rangeEndIso: string;
	/** For deterministic testing. UTC ISO. */
	nowIso: string;
}

const DAY_MS = 86_400_000;
const MIN_MS = 60_000;
const HOUR_MS = 3_600_000;
const QUARTER_MS = 15 * MIN_MS;

const DOW_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
type DowKey = (typeof DOW_KEYS)[number];

/** Returns the tz offset (in minutes) of the instant `d` in the given IANA timezone.
 * Positive for zones east of UTC (e.g. Asia/Ho_Chi_Minh → +420).
 *
 * Uses `Intl.DateTimeFormat` with `timeZoneName: "longOffset"` to parse the
 * "GMT+07:00" / "GMT-05:30" string directly — DST-safe and locale-stable. */
function getTzOffsetMin(d: Date, tz: string): number {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: tz,
		timeZoneName: "longOffset",
	}).formatToParts(d);
	const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
	// Format is "GMT+07:00" or "GMT-05:30" or "GMT" for UTC.
	const m = tzName.match(/^GMT(?:([+-])(\d{2}):(\d{2}))?$/);
	if (!m) return 0;
	if (!m[1]) return 0; // "GMT" alone = UTC
	const sign = m[1] === "+" ? 1 : -1;
	const hours = parseInt(m[2], 10);
	const mins = parseInt(m[3], 10);
	return sign * (hours * 60 + mins);
}

/** Convert `YYYY-MM-DD` + `HH:MM` (local to `tz`) → UTC ms since epoch. */
function ymdHmToUtcMs(ymd: string, hm: string, tz: string): number {
	const [Y, M, D] = ymd.split("-").map(Number);
	const [h, m] = hm.split(":").map(Number);
	// First guess: treat the fields as if they were UTC. The true UTC instant
	// differs by the timezone's offset at that wall-clock moment.
	const guess = Date.UTC(Y, M - 1, D, h, m);
	const offsetMin = getTzOffsetMin(new Date(guess), tz);
	return guess - offsetMin * MIN_MS;
}

/** Format a UTC instant as `YYYY-MM-DD` in the given timezone. */
function ymdInTz(msUtc: number, tz: string): string {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: tz,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(new Date(msUtc));
	const get = (t: string) => parts.find((p) => p.type === t)!.value;
	return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Weekday key (`mon`, `tue`, ...) of a UTC instant in the given timezone. */
function dowKeyInTz(msUtc: number, tz: string): DowKey {
	const weekday = new Intl.DateTimeFormat("en-US", {
		timeZone: tz,
		weekday: "short",
	}).format(new Date(msUtc));
	// "Mon" "Tue" ... "Sun"
	const map: Record<string, DowKey> = {
		Sun: "sun",
		Mon: "mon",
		Tue: "tue",
		Wed: "wed",
		Thu: "thu",
		Fri: "fri",
		Sat: "sat",
	};
	return map[weekday];
}

interface Interval {
	start: number;
	end: number;
}

/** Merge overlapping intervals; input need not be sorted. */
function mergeIntervals(list: Interval[]): Interval[] {
	if (list.length === 0) return [];
	const sorted = [...list].sort((a, b) => a.start - b.start);
	const out: Interval[] = [sorted[0]];
	for (let i = 1; i < sorted.length; i++) {
		const prev = out[out.length - 1];
		const cur = sorted[i];
		if (cur.start <= prev.end) {
			prev.end = Math.max(prev.end, cur.end);
		} else {
			out.push({ ...cur });
		}
	}
	return out;
}

/** Subtract a set of blocked intervals from free intervals. Both assumed sorted/merged. */
function subtractIntervals(free: Interval[], blocked: Interval[]): Interval[] {
	if (blocked.length === 0) return free;
	const out: Interval[] = [];
	for (const f of free) {
		let segments: Interval[] = [{ start: f.start, end: f.end }];
		for (const b of blocked) {
			const next: Interval[] = [];
			for (const s of segments) {
				if (b.end <= s.start || b.start >= s.end) {
					next.push(s);
					continue;
				}
				// Overlap
				if (b.start > s.start) next.push({ start: s.start, end: Math.min(s.end, b.start) });
				if (b.end < s.end) next.push({ start: Math.max(s.start, b.end), end: s.end });
			}
			segments = next;
			if (segments.length === 0) break;
		}
		out.push(...segments);
	}
	return out.filter((s) => s.end > s.start);
}

/**
 * Pure availability engine. Given an availability rule, busy windows, and slot
 * parameters, return bookable slots (start/end in UTC ISO) in chronological
 * order.
 *
 * Buffer semantics (from the new meeting's perspective):
 *   bufferBeforeMin = minimum gap BEFORE the new meeting starts.
 *     → pushes the new meeting's earliest start to `busyEnd + bufferBeforeMin`.
 *   bufferAfterMin  = minimum gap AFTER the new meeting ends.
 *     → pulls the new meeting's latest end back to `busyStart - bufferAfterMin`.
 * So a busy window [s, e] blocks [s - bufferAfterMin, e + bufferBeforeMin].
 */
export function computeSlots(input: ComputeSlotsInput): Slot[] {
	const {
		rule,
		busyWindows,
		durationMin,
		bufferBeforeMin,
		bufferAfterMin,
		minNoticeHrs,
		maxAdvanceDays,
		rangeStartIso,
		rangeEndIso,
		nowIso,
	} = input;

	if (durationMin <= 0) return [];

	const rangeStart = Date.parse(rangeStartIso);
	const rangeEnd = Date.parse(rangeEndIso);
	const now = Date.parse(nowIso);
	if (!(rangeEnd > rangeStart)) return [];

	const tz = rule.timezone;
	const durationMs = durationMin * MIN_MS;

	// 1. Collect free intervals from the rule for every local day that
	//    could overlap [rangeStart, rangeEnd).
	//
	// We walk the UTC range stepping by 1 day (86_400_000 ms) but also probe
	// one extra day on each side so we don't miss the edges of a wall-clock day
	// that straddles the UTC range boundary.
	const ymdSet = new Set<string>();
	for (let t = rangeStart - DAY_MS; t <= rangeEnd + DAY_MS; t += DAY_MS) {
		ymdSet.add(ymdInTz(t, tz));
	}

	const free: Interval[] = [];
	for (const ymd of ymdSet) {
		let intervals: { start: string; end: string }[] | undefined;
		if (rule.date_overrides && rule.date_overrides[ymd] !== undefined) {
			intervals = rule.date_overrides[ymd];
		} else {
			// Compute day-of-week key by anchoring on noon local time.
			const anchorMs = ymdHmToUtcMs(ymd, "12:00", tz);
			const key = dowKeyInTz(anchorMs, tz);
			intervals = rule.weekly_hours[key] ?? [];
		}
		for (const iv of intervals) {
			const s = ymdHmToUtcMs(ymd, iv.start, tz);
			const e = ymdHmToUtcMs(ymd, iv.end, tz);
			if (e <= s) continue;
			const clippedStart = Math.max(s, rangeStart);
			const clippedEnd = Math.min(e, rangeEnd);
			if (clippedEnd > clippedStart) {
				free.push({ start: clippedStart, end: clippedEnd });
			}
		}
	}

	const mergedFree = mergeIntervals(free);

	// 2. Subtract busy windows (expanded by buffers).
	const blocked: Interval[] = [];
	for (const b of busyWindows) {
		const bs = Date.parse(b.start_iso);
		const be = Date.parse(b.end_iso);
		if (!(be > bs)) continue;
		blocked.push({
			start: bs - bufferAfterMin * MIN_MS,
			end: be + bufferBeforeMin * MIN_MS,
		});
	}
	const mergedBlocked = mergeIntervals(blocked);
	const remaining = subtractIntervals(mergedFree, mergedBlocked);

	// 3. Slice into duration-length slots aligned to 15-min boundaries.
	const minAllowed = now + minNoticeHrs * HOUR_MS;
	const maxAllowed = now + maxAdvanceDays * DAY_MS;

	const slots: Slot[] = [];
	for (const iv of remaining) {
		// After aligning the first slot to a 15-minute boundary, subsequent slots are
		// back-to-back (step = durationMin). So a 45-min meeting at 09:00 produces
		// 09:00, 09:45, 10:30, 11:15 — NOT re-aligned to :00/:15/:30/:45 per slot.
		// This matches Calendly/cal.com default behavior.
		let t = Math.ceil(iv.start / QUARTER_MS) * QUARTER_MS;
		while (t + durationMs <= iv.end) {
			// 4. Notice / max-advance filters.
			if (t >= minAllowed && t <= maxAllowed) {
				slots.push({
					start_iso: new Date(t).toISOString(),
					end_iso: new Date(t + durationMs).toISOString(),
				});
			}
			t += durationMs;
		}
	}

	// Remaining intervals aren't guaranteed sorted across days if ymdSet order
	// is insertion-based — sort final output chronologically for determinism.
	slots.sort((a, b) => a.start_iso.localeCompare(b.start_iso));
	return slots;
}
