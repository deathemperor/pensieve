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

test("materialiseFamilyEvents: solar birthday materialises on same solar date", () => {
	const start = new Date("2026-04-01T00:00:00+07:00");
	const end = new Date("2026-04-30T23:59:59+07:00");
	const out = materialiseFamilyEvents([TAM_BIRTHDAY], start, end);
	assert.equal(out.length, 1);
	assert.equal(out[0].date.toISOString().slice(0, 10), "2026-04-25");
	assert.equal(out[0].nth, 34); // 2026 - 1992
});

test("materialiseFamilyEvents: lunar giỗ — 2026 materialises (any April date)", () => {
	const start = new Date("2026-04-01T00:00:00+07:00");
	const end = new Date("2026-04-30T23:59:59+07:00");
	const out = materialiseFamilyEvents([GRANDFATHER_GIO], start, end);
	// Lunar 3/15 in 2026 should fall somewhere in April (lunar leap year pushes it into late April/early May)
	assert.equal(out.length, 1, "should have exactly one occurrence in April 2026");
	assert.ok(out[0].date.toISOString().startsWith("2026-04"), "should be an April 2026 date");
	assert.equal(out[0].nth, 7); // 2026 - 2019
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
	assert.deepEqual(
		out.map((o) => o.date.toISOString().slice(0, 10)),
		["2025-04-25", "2026-04-25", "2027-04-25"],
	);
});
