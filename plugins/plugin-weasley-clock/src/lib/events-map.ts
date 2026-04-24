export interface GoogleEvent {
	id: string;
	status: "confirmed" | "tentative" | "cancelled";
	summary?: string;
	location?: string;
	description?: string;
	start: { dateTime?: string; date?: string; timeZone?: string };
	end: { dateTime?: string; date?: string; timeZone?: string };
	deleted?: boolean;
}

export interface SyncedEventRow {
	id: string;
	source_type: "gcal";
	gcal_account_id: string;
	gcal_calendar_id: string;
	external_uid: string;
	title: string;
	starts_at: string;
	ends_at: string;
	all_day: 0 | 1;
	location: string | null;
	description: string | null;
	deleted: 0 | 1;
	synced_at: string;
}

export function isCancelled(evt: GoogleEvent): boolean {
	return evt.status === "cancelled" || evt.deleted === true;
}

const HCMC_OFFSET_MS = 7 * 3600 * 1000;

// All-day dates in Google's API are date-only strings ("2026-04-25").
// We anchor them to HCMC midnight (matches how family_events are stored).
function allDayToUtc(dateStr: string): string {
	const [y, m, d] = dateStr.split("-").map(Number);
	const utcMidnight = Date.UTC(y, m - 1, d);
	return new Date(utcMidnight - HCMC_OFFSET_MS).toISOString();
}

export function mapGoogleEvent(
	evt: GoogleEvent,
	ctx: { accountId: string; calendarId: string },
): SyncedEventRow {
	const allDay = !!(evt.start.date && !evt.start.dateTime);
	const starts_at = allDay
		? allDayToUtc(evt.start.date!)
		: new Date(evt.start.dateTime!).toISOString();
	const ends_at = allDay
		? allDayToUtc(evt.end.date!)
		: new Date(evt.end.dateTime!).toISOString();

	const id = `gcal_${ctx.accountId}_${ctx.calendarId}_${evt.id}`.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 128);

	return {
		id,
		source_type: "gcal",
		gcal_account_id: ctx.accountId,
		gcal_calendar_id: ctx.calendarId,
		external_uid: evt.id,
		title: evt.summary?.trim() || "(no title)",
		starts_at,
		ends_at,
		all_day: allDay ? 1 : 0,
		location: evt.location?.trim() || null,
		description: evt.description?.trim() || null,
		deleted: isCancelled(evt) ? 1 : 0,
		synced_at: new Date().toISOString(),
	};
}
