import { test } from "node:test";
import assert from "node:assert/strict";
import { syncCalendar, type CalendarRow, type SyncContext } from "../src/lib/sync-calendar";

function mkStore(): any {
	const rows = new Map<string, any>();
	return {
		async put(id: string, data: any) { rows.set(id, { id, data }); },
		async get(id: string) {
			const r = rows.get(id);
			return r ? { id, data: r.data } : null;
		},
		async delete(id: string) { rows.delete(id); },
		async query(_filter: any) {
			return { items: Array.from(rows.values()) };
		},
		_size: () => rows.size,
		_rows: () => Array.from(rows.values()),
	};
}

function mkCal(overrides: Partial<CalendarRow> = {}): CalendarRow {
	return {
		id: "cal_acc1_primary",
		account_id: "acc1",
		calendar_id: "primary",
		summary: "Work",
		synced: 1,
		sync_token: null,
		last_resynced_at: null,
		expose_titles: 1,
		...overrides,
	};
}

function ctxWith(fetchImpl: typeof fetch, syncedEventsStore: any, calendarsStore: any): SyncContext {
	return {
		storage: { synced_events: syncedEventsStore, oauth_calendars: calendarsStore } as any,
		getAccessToken: async () => "FAKE_ACCESS_MOCK",
		fetchImpl,
	};
}

test("first run — no sync_token, full fetch, upserts all events, saves returned nextSyncToken", async () => {
	const cal = mkCal();
	const syncedEvents = mkStore();
	const cals = mkStore();
	await cals.put(cal.id, cal);
	const fetchImpl = (async (url: any) => {
		assert.ok(!String(url).includes("syncToken="), "first run should NOT send syncToken");
		return new Response(JSON.stringify({
			items: [
				{ id: "e1", status: "confirmed", summary: "Meeting",
					start: { dateTime: "2026-04-23T10:00:00+07:00" },
					end: { dateTime: "2026-04-23T11:00:00+07:00" } },
			],
			nextSyncToken: "SYNC_TOKEN_V1",
		}), { status: 200 });
	}) as typeof fetch;

	await syncCalendar(cal, ctxWith(fetchImpl, syncedEvents, cals));

	const rows = syncedEvents._rows();
	assert.equal(rows.length, 1);
	assert.equal(rows[0].data.external_uid, "e1");
	const cal2 = await cals.get(cal.id);
	assert.equal(cal2.data.sync_token, "SYNC_TOKEN_V1");
	assert.ok(cal2.data.last_resynced_at);
});

test("subsequent run — existing sync_token, incremental fetch; cancelled event soft-deleted", async () => {
	const cal = mkCal({ sync_token: "OLD" });
	const syncedEvents = mkStore();
	const cals = mkStore();
	await cals.put(cal.id, cal);
	await syncedEvents.put("gcal_acc1_primary_e1", {
		external_uid: "e1",
		deleted: 0,
		title: "Meeting",
		source_type: "gcal",
		gcal_account_id: "acc1",
		gcal_calendar_id: "primary",
	});

	const fetchImpl = (async (url: any) => {
		assert.ok(String(url).includes("syncToken=OLD"), "subsequent run should send old sync_token");
		return new Response(JSON.stringify({
			items: [
				{ id: "e1", status: "cancelled",
					start: { dateTime: "2026-04-23T10:00:00+07:00" },
					end: { dateTime: "2026-04-23T11:00:00+07:00" } },
			],
			nextSyncToken: "SYNC_TOKEN_V2",
		}), { status: 200 });
	}) as typeof fetch;

	await syncCalendar(cal, ctxWith(fetchImpl, syncedEvents, cals));

	const evt = await syncedEvents.get("gcal_acc1_primary_e1");
	assert.equal(evt.data.deleted, 1);
	assert.equal((await cals.get(cal.id)).data.sync_token, "SYNC_TOKEN_V2");
});

test("410 Gone — clears sync_token and returns early (next run does full resync)", async () => {
	const cal = mkCal({ sync_token: "STALE" });
	const syncedEvents = mkStore();
	const cals = mkStore();
	await cals.put(cal.id, cal);
	const fetchImpl = (async () => new Response("gone", { status: 410 })) as typeof fetch;

	await syncCalendar(cal, ctxWith(fetchImpl, syncedEvents, cals));

	assert.equal((await cals.get(cal.id)).data.sync_token, null);
});

test("non-ok, non-410 — leaves calendar in error-visible state (no timestamp update)", async () => {
	const cal = mkCal({ sync_token: "OK", last_resynced_at: "2026-04-22T00:00:00Z" });
	const syncedEvents = mkStore();
	const cals = mkStore();
	await cals.put(cal.id, cal);
	const fetchImpl = (async () => new Response("server error", { status: 500 })) as typeof fetch;

	await syncCalendar(cal, ctxWith(fetchImpl, syncedEvents, cals));

	const c = await cals.get(cal.id);
	assert.equal(c.data.sync_token, "OK");
	assert.equal(c.data.last_resynced_at, "2026-04-22T00:00:00Z");
	assert.equal(syncedEvents._size(), 0);
});
