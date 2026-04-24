import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSlots } from "../../src/lib/weasley-clock/availability";
import type { AvailabilityRuleData } from "../../src/lib/weasley-clock/storage";

function emptyWeekly(): AvailabilityRuleData["weekly_hours"] {
	return { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
}

// Monday 2026-05-04 in ICT (UTC+7). 09:00-17:30 ICT == 02:00-10:30 UTC.
const BASIC_RULE: AvailabilityRuleData = {
	label: "Default",
	timezone: "Asia/Ho_Chi_Minh",
	weekly_hours: {
		...emptyWeekly(),
		mon: [{ start: "09:00", end: "17:30" }],
	},
};

// Range covers just one ICT day: UTC range needs to straddle the ICT day.
// 2026-05-04 00:00 ICT = 2026-05-03 17:00 UTC
// 2026-05-05 00:00 ICT = 2026-05-04 17:00 UTC
const DAY_RANGE_START = "2026-05-03T17:00:00.000Z";
const DAY_RANGE_END = "2026-05-04T17:00:00.000Z";

test("basic free day yields 17 slots aligned to 15-min boundaries", () => {
	const slots = computeSlots({
		rule: BASIC_RULE,
		busyWindows: [],
		durationMin: 30,
		bufferBeforeMin: 0,
		bufferAfterMin: 0,
		minNoticeHrs: 0,
		maxAdvanceDays: 365,
		rangeStartIso: DAY_RANGE_START,
		rangeEndIso: DAY_RANGE_END,
		nowIso: "2026-05-01T00:00:00.000Z",
	});

	assert.equal(slots.length, 17);
	assert.equal(slots[0].start_iso, "2026-05-04T02:00:00.000Z");
	assert.equal(slots[0].end_iso, "2026-05-04T02:30:00.000Z");
	assert.equal(slots[slots.length - 1].start_iso, "2026-05-04T10:00:00.000Z");
	assert.equal(slots[slots.length - 1].end_iso, "2026-05-04T10:30:00.000Z");
});

test("busy window with buffers removes overlapping slots", () => {
	// Busy 10:00-11:00 ICT (03:00-04:00 UTC), bufferBeforeMin=15, bufferAfterMin=15.
	// Effective block = [02:45, 04:15] UTC.
	// Removed 30-min slots starting at: 02:30, 03:00, 03:30, 04:00.
	// Remaining: 17 - 4 = 13 slots.
	const slots = computeSlots({
		rule: BASIC_RULE,
		busyWindows: [
			{ start_iso: "2026-05-04T03:00:00.000Z", end_iso: "2026-05-04T04:00:00.000Z" },
		],
		durationMin: 30,
		bufferBeforeMin: 15,
		bufferAfterMin: 15,
		minNoticeHrs: 0,
		maxAdvanceDays: 365,
		rangeStartIso: DAY_RANGE_START,
		rangeEndIso: DAY_RANGE_END,
		nowIso: "2026-05-01T00:00:00.000Z",
	});

	// Free intervals after subtracting [02:45, 04:15]:
	//   [02:00, 02:45] (02:00 start is a 30-min slot ending 02:30 — fits; 02:30 start ends 03:00 — collides? No, 02:30-03:00, but 02:45+ is blocked, so 02:30 slot doesn't fit in [02:00, 02:45] — end 03:00 > 02:45.)
	//   [04:15, 10:30]
	// First interval: only one 30-min slot fits: 02:00-02:30.
	// Second interval: aligned to 15-min boundary starting at 04:15.
	//   04:15, 04:45, 05:15, ..., step 30-min, last start whose end ≤ 10:30 is 10:00.
	//   Count = (10:00 - 04:15)/0.5 + 1 = 11.5 + 1 → integer math: 04:15, 04:45, 05:15, 05:45,
	//   06:15, 06:45, 07:15, 07:45, 08:15, 08:45, 09:15, 09:45 = 12 slots.
	// Total = 1 + 12 = 13.
	assert.equal(slots.length, 13);
	const starts = slots.map((s) => s.start_iso);
	assert.ok(starts.includes("2026-05-04T02:00:00.000Z"), "02:00 before block kept");
	assert.ok(!starts.includes("2026-05-04T02:30:00.000Z"), "02:30 would end at 03:00 inside block");
	assert.ok(!starts.includes("2026-05-04T03:00:00.000Z"), "03:00 inside block");
	assert.ok(!starts.includes("2026-05-04T03:30:00.000Z"), "03:30 inside block");
	assert.ok(!starts.includes("2026-05-04T04:00:00.000Z"), "04:00 overlaps block (ends 04:30 > 04:15)");
	assert.ok(starts.includes("2026-05-04T04:15:00.000Z"), "04:15 aligns to 15-min boundary at block end");
	assert.ok(starts.includes("2026-05-04T09:45:00.000Z"), "last slot 09:45 (ends 10:15 ≤ 10:30)");
});

test("min-notice filter drops slots starting too soon", () => {
	// nowIso = 01:30 UTC, minNoticeHrs = 2 => earliest acceptable = 03:30 UTC.
	// Slots 02:00, 02:30, 03:00 are dropped; 03:30 onward kept.
	const slots = computeSlots({
		rule: BASIC_RULE,
		busyWindows: [],
		durationMin: 30,
		bufferBeforeMin: 0,
		bufferAfterMin: 0,
		minNoticeHrs: 2,
		maxAdvanceDays: 365,
		rangeStartIso: DAY_RANGE_START,
		rangeEndIso: DAY_RANGE_END,
		nowIso: "2026-05-04T01:30:00.000Z",
	});

	const starts = slots.map((s) => s.start_iso);
	assert.ok(!starts.includes("2026-05-04T02:00:00.000Z"));
	assert.ok(!starts.includes("2026-05-04T02:30:00.000Z"));
	assert.ok(!starts.includes("2026-05-04T03:00:00.000Z"));
	assert.ok(starts.includes("2026-05-04T03:30:00.000Z"));
	// 14 slots from 03:30 to 10:00 inclusive = (10:00 - 03:30)/0.5 + 1 = 14.
	assert.equal(slots.length, 14);
});

test("max-advance filter drops slots too far in the future", () => {
	// nowIso = 2026-05-01T00:00 UTC, maxAdvanceDays=2 => cutoff = 2026-05-03T00:00 UTC.
	// Our day (2026-05-04) is entirely after that — all slots dropped.
	const slots = computeSlots({
		rule: BASIC_RULE,
		busyWindows: [],
		durationMin: 30,
		bufferBeforeMin: 0,
		bufferAfterMin: 0,
		minNoticeHrs: 0,
		maxAdvanceDays: 2,
		rangeStartIso: DAY_RANGE_START,
		rangeEndIso: DAY_RANGE_END,
		nowIso: "2026-05-01T00:00:00.000Z",
	});
	assert.equal(slots.length, 0);
});

test("date_overrides empty array blocks the day", () => {
	const rule: AvailabilityRuleData = {
		...BASIC_RULE,
		date_overrides: { "2026-05-04": [] },
	};
	const slots = computeSlots({
		rule,
		busyWindows: [],
		durationMin: 30,
		bufferBeforeMin: 0,
		bufferAfterMin: 0,
		minNoticeHrs: 0,
		maxAdvanceDays: 365,
		rangeStartIso: DAY_RANGE_START,
		rangeEndIso: DAY_RANGE_END,
		nowIso: "2026-05-01T00:00:00.000Z",
	});
	assert.equal(slots.length, 0);
});

test("lunch-break splits slots around midday gap", () => {
	// 09:00-12:00 ICT (02:00-05:00 UTC) + 13:00-17:30 ICT (06:00-10:30 UTC).
	// Morning: 02:00..11:30 starts of 30-min = (05:00 - 02:00)/0.5 = 6 slots (02:00..04:30).
	// Afternoon: 06:00..10:00 starts = (10:00 - 06:00)/0.5 + 1 = 9 slots.
	const rule: AvailabilityRuleData = {
		...BASIC_RULE,
		weekly_hours: {
			...emptyWeekly(),
			mon: [
				{ start: "09:00", end: "12:00" },
				{ start: "13:00", end: "17:30" },
			],
		},
	};
	const slots = computeSlots({
		rule,
		busyWindows: [],
		durationMin: 30,
		bufferBeforeMin: 0,
		bufferAfterMin: 0,
		minNoticeHrs: 0,
		maxAdvanceDays: 365,
		rangeStartIso: DAY_RANGE_START,
		rangeEndIso: DAY_RANGE_END,
		nowIso: "2026-05-01T00:00:00.000Z",
	});

	assert.equal(slots.length, 6 + 9);
	const starts = slots.map((s) => s.start_iso);
	// No slot starts at/after 04:30 end-bound bleeding into lunch; no 05:00/05:30.
	assert.ok(starts.includes("2026-05-04T04:30:00.000Z"), "last morning slot 04:30 kept");
	assert.ok(!starts.includes("2026-05-04T05:00:00.000Z"), "lunch gap: no 05:00 slot");
	assert.ok(!starts.includes("2026-05-04T05:30:00.000Z"), "lunch gap: no 05:30 slot");
	assert.ok(starts.includes("2026-05-04T06:00:00.000Z"), "first afternoon slot 06:00");
	assert.ok(starts.includes("2026-05-04T10:00:00.000Z"), "last slot 10:00");
});

// --- Extra edge-case tests ---

test("zero-duration returns no slots", () => {
	const slots = computeSlots({
		rule: BASIC_RULE,
		busyWindows: [],
		durationMin: 0,
		bufferBeforeMin: 0,
		bufferAfterMin: 0,
		minNoticeHrs: 0,
		maxAdvanceDays: 365,
		rangeStartIso: DAY_RANGE_START,
		rangeEndIso: DAY_RANGE_END,
		nowIso: "2026-05-01T00:00:00.000Z",
	});
	assert.equal(slots.length, 0);
});

test("empty weekly rule yields no slots", () => {
	const slots = computeSlots({
		rule: { label: "Empty", timezone: "Asia/Ho_Chi_Minh", weekly_hours: emptyWeekly() },
		busyWindows: [],
		durationMin: 30,
		bufferBeforeMin: 0,
		bufferAfterMin: 0,
		minNoticeHrs: 0,
		maxAdvanceDays: 365,
		rangeStartIso: DAY_RANGE_START,
		rangeEndIso: DAY_RANGE_END,
		nowIso: "2026-05-01T00:00:00.000Z",
	});
	assert.equal(slots.length, 0);
});

test("slots align to 15-min boundaries when interval starts off-boundary", () => {
	// Rule starts at 09:07 ICT (02:07 UTC). First 15-min boundary: 02:15 UTC.
	const rule: AvailabilityRuleData = {
		...BASIC_RULE,
		weekly_hours: {
			...emptyWeekly(),
			mon: [{ start: "09:07", end: "17:30" }],
		},
	};
	const slots = computeSlots({
		rule,
		busyWindows: [],
		durationMin: 30,
		bufferBeforeMin: 0,
		bufferAfterMin: 0,
		minNoticeHrs: 0,
		maxAdvanceDays: 365,
		rangeStartIso: DAY_RANGE_START,
		rangeEndIso: DAY_RANGE_END,
		nowIso: "2026-05-01T00:00:00.000Z",
	});
	assert.equal(slots[0].start_iso, "2026-05-04T02:15:00.000Z");
});

test("range boundary clips partial intervals", () => {
	// Range ends at 2026-05-04T04:00 UTC => slots after 03:30 start dropped.
	const slots = computeSlots({
		rule: BASIC_RULE,
		busyWindows: [],
		durationMin: 30,
		bufferBeforeMin: 0,
		bufferAfterMin: 0,
		minNoticeHrs: 0,
		maxAdvanceDays: 365,
		rangeStartIso: DAY_RANGE_START,
		rangeEndIso: "2026-05-04T04:00:00.000Z",
		nowIso: "2026-05-01T00:00:00.000Z",
	});
	// 02:00, 02:30, 03:00, 03:30 = 4 slots (end 04:00 <= 04:00).
	assert.equal(slots.length, 4);
	assert.equal(slots[slots.length - 1].start_iso, "2026-05-04T03:30:00.000Z");
});

test("day-of-week resolution in host timezone (Sunday in ICT)", () => {
	// 2026-05-03 in ICT is Sunday. Weekly hours set only for sun.
	const rule: AvailabilityRuleData = {
		label: "Sun only",
		timezone: "Asia/Ho_Chi_Minh",
		weekly_hours: {
			...emptyWeekly(),
			sun: [{ start: "09:00", end: "10:00" }],
		},
	};
	// ICT range: 2026-05-03 00:00 ICT .. 2026-05-04 00:00 ICT
	const slots = computeSlots({
		rule,
		busyWindows: [],
		durationMin: 30,
		bufferBeforeMin: 0,
		bufferAfterMin: 0,
		minNoticeHrs: 0,
		maxAdvanceDays: 365,
		rangeStartIso: "2026-05-02T17:00:00.000Z",
		rangeEndIso: "2026-05-03T17:00:00.000Z",
		nowIso: "2026-05-01T00:00:00.000Z",
	});
	assert.equal(slots.length, 2);
	assert.equal(slots[0].start_iso, "2026-05-03T02:00:00.000Z");
	assert.equal(slots[1].start_iso, "2026-05-03T02:30:00.000Z");
});
