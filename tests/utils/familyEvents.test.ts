import { test } from "node:test";
import assert from "node:assert/strict";
import { materialiseFamilyEvents } from "../../src/utils/familyEvents";
import type { FamilyEventRecord } from "../../src/utils/familyEvents";

const GRANDFATHER_GIO: FamilyEventRecord = {
	id: "evt_1",
	title_en: "Grandfather's giỗ",
	title_vi: "Giỗ Ông Nội",
	event_type: "death_anniv",
	date_calendar: "lunar",
	month: 3,
	day: 15,
	is_leap_month: false,
	origin_year: 2019,
	person_name: "Ông Nội Trương Văn Hương",
	relationship: "grandfather (paternal)",
	visibility: "household",
	reminder_days_before: "[7,1]",
};

const TAM_BIRTHDAY: FamilyEventRecord = {
	id: "evt_2",
	title_en: "Tam birthday",
	title_vi: "Sinh nhật Tâm",
	event_type: "birthday",
	date_calendar: "solar",
	month: 4,
	day: 25,
	origin_year: 1992,
	person_name: "Tâm",
	visibility: "household",
};

test("materialiseFamilyEvents: solar birthday materialises on HCMC April 25", () => {
	const start = new Date("2026-04-01T00:00:00+07:00");
	const end = new Date("2026-04-30T23:59:59+07:00");
	const out = materialiseFamilyEvents([TAM_BIRTHDAY], start, end);
	assert.equal(out.length, 1);
	const hcmcDate = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Ho_Chi_Minh",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(out[0].date);
	assert.equal(hcmcDate, "2026-04-25");
	assert.equal(out[0].nth, 34); // 2026 - 1992
});

test("materialiseFamilyEvents: event outside range is excluded", () => {
	const start = new Date("2026-05-01T00:00:00+07:00");
	const end = new Date("2026-05-31T23:59:59+07:00");
	const out = materialiseFamilyEvents([TAM_BIRTHDAY], start, end);
	assert.equal(out.length, 0);
});

test("materialiseFamilyEvents: multi-year window returns one occurrence per year", () => {
	const start = new Date("2025-04-01T00:00:00+07:00");
	const end = new Date("2027-04-30T23:59:59+07:00");
	const out = materialiseFamilyEvents([TAM_BIRTHDAY], start, end);
	assert.equal(out.length, 3); // 2025, 2026, 2027
	const fmt = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Ho_Chi_Minh",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	assert.deepEqual(
		out.map((o) => fmt.format(o.date)),
		["2025-04-25", "2026-04-25", "2027-04-25"],
	);
});

test("materialiseFamilyEvents: lunar giỗ — 2026 falls on May 1 HCMC", () => {
	// Lunar 3/15 in lunar year 2026 converts to HCMC May 1 2026.
	// Widen the range to include early May so the occurrence is found.
	const start = new Date("2026-04-01T00:00:00+07:00");
	const end = new Date("2026-05-31T23:59:59+07:00");
	const out = materialiseFamilyEvents([GRANDFATHER_GIO], start, end);
	assert.equal(out.length, 1, "should have exactly one occurrence");
	// Format the date in HCMC locale and check it's May 1
	const hcmcDate = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Ho_Chi_Minh",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(out[0].date);
	assert.equal(hcmcDate, "2026-05-01");
	assert.equal(out[0].nth, 7); // 2026 - 2019
});

test("materialiseFamilyEvents: lunar giỗ — April-only range excludes May 1", () => {
	// Ensures UTC-midnight shortcuts aren't silently pulling May events into April
	const start = new Date("2026-04-01T00:00:00+07:00");
	const end = new Date("2026-04-30T23:59:59+07:00");
	const out = materialiseFamilyEvents([GRANDFATHER_GIO], start, end);
	assert.equal(out.length, 0, "May 1 event should NOT appear in April-only range");
});
