import { test } from "node:test";
import assert from "node:assert/strict";
import { mapGoogleEvent, isCancelled } from "../src/lib/events-map";

const ACCOUNT_ID = "acc_test";
const CALENDAR_ID = "primary";

test("timed event — start.dateTime and end.dateTime", () => {
	const row = mapGoogleEvent({
		id: "abc123",
		status: "confirmed",
		summary: "Sprint review",
		location: "Hanoi office",
		description: "Weekly team meeting",
		start: { dateTime: "2026-04-23T10:00:00+07:00" },
		end: { dateTime: "2026-04-23T11:00:00+07:00" },
	}, { accountId: ACCOUNT_ID, calendarId: CALENDAR_ID });

	assert.equal(row.external_uid, "abc123");
	assert.equal(row.title, "Sprint review");
	assert.equal(row.location, "Hanoi office");
	assert.equal(row.description, "Weekly team meeting");
	assert.equal(row.all_day, 0);
	assert.equal(row.deleted, 0);
	assert.equal(row.source_type, "gcal");
	assert.equal(row.gcal_account_id, ACCOUNT_ID);
	assert.equal(row.gcal_calendar_id, CALENDAR_ID);
	assert.equal(row.starts_at, "2026-04-23T03:00:00.000Z");
	assert.equal(row.ends_at, "2026-04-23T04:00:00.000Z");
});

test("all-day event — start.date and end.date", () => {
	const row = mapGoogleEvent({
		id: "bday-tam",
		status: "confirmed",
		summary: "Tam birthday",
		start: { date: "2026-04-25" },
		end: { date: "2026-04-26" },
	}, { accountId: ACCOUNT_ID, calendarId: CALENDAR_ID });

	assert.equal(row.all_day, 1);
	assert.equal(row.starts_at, "2026-04-24T17:00:00.000Z");
	assert.equal(row.ends_at, "2026-04-25T17:00:00.000Z");
});

test("cancelled event — deleted=1", () => {
	const row = mapGoogleEvent({
		id: "cancelled-42",
		status: "cancelled",
		summary: "Moved to next week",
		start: { dateTime: "2026-04-23T10:00:00+07:00" },
		end: { dateTime: "2026-04-23T11:00:00+07:00" },
	}, { accountId: ACCOUNT_ID, calendarId: CALENDAR_ID });

	assert.equal(row.deleted, 1);
});

test("isCancelled helper returns true for status=cancelled and for truthy .deleted", () => {
	assert.equal(isCancelled({ status: "cancelled" } as any), true);
	assert.equal(isCancelled({ deleted: true } as any), true);
	assert.equal(isCancelled({ status: "confirmed" } as any), false);
	assert.equal(isCancelled({} as any), false);
});

test("title defaults to '(no title)' when summary is missing", () => {
	const row = mapGoogleEvent({
		id: "no-title",
		status: "confirmed",
		start: { dateTime: "2026-04-23T10:00:00+07:00" },
		end: { dateTime: "2026-04-23T11:00:00+07:00" },
	} as any, { accountId: ACCOUNT_ID, calendarId: CALENDAR_ID });

	assert.equal(row.title, "(no title)");
});
