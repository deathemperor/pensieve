import { test } from "node:test";
import assert from "node:assert/strict";
import { materialiseFamilyEvents, type FamilyEventRecord } from "../../src/utils/familyEvents";

test("Weasley Clock glue: collection → materialise produces chips for current month", () => {
	const events: FamilyEventRecord[] = [
		{
			id: "e1",
			title_en: "Tam birthday",
			title_vi: "Sinh nhật Tâm",
			event_type: "birthday",
			date_calendar: "solar",
			month: 4,
			day: 25,
			origin_year: 1992,
			visibility: "household",
		},
	];
	const start = new Date("2026-04-01T00:00:00+07:00");
	const end = new Date("2026-04-30T23:59:59+07:00");
	const occs = materialiseFamilyEvents(events, start, end);
	assert.equal(occs.length, 1);
	assert.equal(occs[0].nth, 34);
	assert.equal(occs[0].event.title_vi, "Sinh nhật Tâm");
});
