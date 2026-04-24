import { mapGoogleEvent, type GoogleEvent } from "./events-map";

export interface CalendarRow {
	id: string;
	account_id: string;
	calendar_id: string;
	summary: string;
	synced: 0 | 1;
	sync_token: string | null;
	last_resynced_at: string | null;
	expose_titles: 0 | 1;
}

export interface SyncContext {
	storage: {
		synced_events: { put(id: string, data: any): Promise<void>; get(id: string): Promise<{ id: string; data: any } | null>; query(f: any): Promise<any> };
		oauth_calendars: { put(id: string, data: any): Promise<void>; get(id: string): Promise<{ id: string; data: any } | null> };
	};
	getAccessToken: () => Promise<string>;
	fetchImpl?: typeof fetch;
}

export interface SyncResult {
	status: "ok" | "error" | "sync_token_invalidated";
	eventsProcessed: number;
	nextSyncToken: string | null;
}

export async function syncCalendar(cal: CalendarRow, ctx: SyncContext): Promise<SyncResult> {
	const fetchImpl = ctx.fetchImpl ?? fetch;
	const accessToken = await ctx.getAccessToken();

	const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.calendar_id)}/events`;
	let pageToken: string | null = null;
	let nextSyncToken: string | null = null;
	let processed = 0;

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
			await ctx.storage.oauth_calendars.put(cal.id, { ...cal, sync_token: null });
			return { status: "sync_token_invalidated", eventsProcessed: processed, nextSyncToken: null };
		}
		if (!res.ok) {
			return { status: "error", eventsProcessed: processed, nextSyncToken: null };
		}

		const body = (await res.json()) as { items?: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string };
		for (const evt of body.items ?? []) {
			const row = mapGoogleEvent(evt, { accountId: cal.account_id, calendarId: cal.calendar_id });
			await ctx.storage.synced_events.put(row.id, row);
			processed++;
		}
		if (body.nextPageToken) {
			pageToken = body.nextPageToken;
			continue;
		}
		nextSyncToken = body.nextSyncToken ?? null;
		break;
	}

	await ctx.storage.oauth_calendars.put(cal.id, {
		...cal,
		sync_token: nextSyncToken ?? cal.sync_token,
		last_resynced_at: new Date().toISOString(),
	});

	return { status: "ok", eventsProcessed: processed, nextSyncToken };
}
