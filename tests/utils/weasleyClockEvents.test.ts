import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeEventSources, type RenderableEvent } from "../../src/utils/weasleyClockEvents";
import type { FamilyOccurrence } from "../../src/utils/familyEvents";

test("mergeEventSources: returns empty when no events", () => {
	assert.deepEqual(mergeEventSources([], []), []);
});

test("mergeEventSources: solo synced events — preserved with source:'synced'", () => {
	const synced = [
		{
			id: "gcal_a1_primary_e1",
			external_uid: "e1",
			title: "Sprint review",
			starts_at: "2026-04-23T03:00:00.000Z",
			ends_at: "2026-04-23T04:00:00.000Z",
			all_day: 0,
			location: "Hanoi",
			description: null,
			source_type: "gcal",
			gcal_account_id: "a1",
			gcal_calendar_id: "primary",
			deleted: 0,
		},
	];
	const merged: RenderableEvent[] = mergeEventSources([], synced as any);
	assert.equal(merged.length, 1);
	assert.equal(merged[0].source, "synced");
	assert.equal(merged[0].title, "Sprint review");
	assert.equal(merged[0].allDay, false);
});

test("mergeEventSources: interleaves family and synced events in chronological order", () => {
	const family: FamilyOccurrence[] = [
		{
			event: {
				id: "evt1", title_en: "Tam birthday", title_vi: "Sinh nhật Tâm",
				event_type: "birthday", date_calendar: "solar", month: 4, day: 25,
				origin_year: 1992, visibility: "household",
			},
			date: new Date("2026-04-24T17:00:00Z"),
			nth: 34,
		},
	];
	const synced = [
		{
			id: "gcal_a1_primary_work",
			external_uid: "work",
			title: "Work meeting",
			starts_at: "2026-04-23T03:00:00.000Z",
			ends_at: "2026-04-23T04:00:00.000Z",
			all_day: 0,
			location: null, description: null, source_type: "gcal",
			gcal_account_id: "a1", gcal_calendar_id: "primary", deleted: 0,
		},
	];
	const merged = mergeEventSources(family, synced as any);
	assert.equal(merged.length, 2);
	assert.equal(merged[0].source, "synced");
	assert.equal(merged[0].title, "Work meeting");
	assert.equal(merged[1].source, "family");
	assert.match(merged[1].title, /Sinh nhật|Tam birthday/);
});
