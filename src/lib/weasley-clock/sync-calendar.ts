import type { D1Database } from "@cloudflare/workers-types";
import { mapGoogleEvent, type GoogleEvent } from "./events-map";
import { collections, type OAuthCalendarData } from "./storage";

export interface CalendarRow extends OAuthCalendarData {
	id: string;
}

export interface SyncResult {
	status: "ok" | "error" | "sync_token_invalidated";
	eventsProcessed: number;
	nextSyncToken: string | null;
}

export async function syncCalendar(
	db: D1Database,
	cal: CalendarRow,
	getAccessToken: () => Promise<string>,
	fetchImpl: typeof fetch = fetch,
): Promise<SyncResult> {
	const c = collections(db);
	const accessToken = await getAccessToken();

	const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.calendar_id)}/events`;
	let pageToken: string | null = null;
	let nextSyncToken: string | null = null;
	let processed = 0;

	// One of these is used as a cursor: syncToken (incremental) or timeMin (first run).
	// Google rejects combining them.
	for (;;) {
		const params = new URLSearchParams({ showDeleted: "true", singleEvents: "true", maxResults: "250" });
		if (cal.sync_token && !pageToken) params.set("syncToken", cal.sync_token);
		if (!cal.sync_token && !pageToken) {
			const min = new Date(Date.now() - 90 * 86400 * 1000).toISOString();
			params.set("timeMin", min);
		}
		if (pageToken) params.set("pageToken", pageToken);

		const res = await fetchImpl(`${base}?${params.toString()}`, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});

		if (res.status === 410) {
			await c.oauth_calendars.put(cal.id, { ...cal, sync_token: null });
			return { status: "sync_token_invalidated", eventsProcessed: processed, nextSyncToken: null };
		}
		if (!res.ok) {
			return { status: "error", eventsProcessed: processed, nextSyncToken: null };
		}

		const body = (await res.json()) as { items?: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string };
		for (const evt of body.items ?? []) {
			const row = mapGoogleEvent(evt, {
				accountId: cal.account_id,
				calendarId: cal.calendar_id,
				accessRole: cal.access_role,
			});
			// synced_events is also a plugin-storage collection — write via raw D1
			const now = new Date().toISOString();
			const json = JSON.stringify(row);
			await db
				.prepare(
					`INSERT INTO _plugin_storage (plugin_id, collection, id, data, created_at, updated_at)
					 VALUES ('weasley-clock', 'synced_events', ?, ?, ?, ?)
					 ON CONFLICT (plugin_id, collection, id) DO UPDATE SET
						data = excluded.data,
						updated_at = excluded.updated_at`,
				)
				.bind(row.id, json, now, now)
				.run();
			processed++;
		}
		if (body.nextPageToken) {
			pageToken = body.nextPageToken;
			continue;
		}
		nextSyncToken = body.nextSyncToken ?? null;
		break;
	}

	await c.oauth_calendars.put(cal.id, {
		...cal,
		sync_token: nextSyncToken ?? cal.sync_token,
		last_resynced_at: new Date().toISOString(),
	});

	return { status: "ok", eventsProcessed: processed, nextSyncToken };
}
