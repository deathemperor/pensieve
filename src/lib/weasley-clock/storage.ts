import type { D1Database } from "@cloudflare/workers-types";

// EmDash stores all plugin data in ONE table: _plugin_storage with
// composite PK (plugin_id, collection, id) and a JSON `data` column.
// We query it directly from Astro API routes since plugin-sandbox
// ctx.storage isn't available outside the plugin runtime.

export const PLUGIN_ID = "weasley-clock";
export const TABLE = "_plugin_storage";

export interface StorageRow<T = any> {
	id: string;
	data: T;
}

export class Collection<T = any> {
	constructor(private db: D1Database, private collection: string) {}

	async get(id: string): Promise<StorageRow<T> | null> {
		const row = await this.db
			.prepare(`SELECT id, data FROM ${TABLE} WHERE plugin_id=? AND collection=? AND id=?`)
			.bind(PLUGIN_ID, this.collection, id)
			.first<{ id: string; data: string }>();
		if (!row) return null;
		return { id: row.id, data: JSON.parse(row.data) as T };
	}

	async put(id: string, data: T): Promise<void> {
		const now = new Date().toISOString();
		const json = JSON.stringify(data);
		await this.db
			.prepare(
				`INSERT INTO ${TABLE} (plugin_id, collection, id, data, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?)
				 ON CONFLICT (plugin_id, collection, id) DO UPDATE SET
					data = excluded.data,
					updated_at = excluded.updated_at`,
			)
			.bind(PLUGIN_ID, this.collection, id, json, now, now)
			.run();
	}

	async delete(id: string): Promise<void> {
		await this.db
			.prepare(`DELETE FROM ${TABLE} WHERE plugin_id=? AND collection=? AND id=?`)
			.bind(PLUGIN_ID, this.collection, id)
			.run();
	}

	async list(): Promise<StorageRow<T>[]> {
		const res = await this.db
			.prepare(`SELECT id, data FROM ${TABLE} WHERE plugin_id=? AND collection=?`)
			.bind(PLUGIN_ID, this.collection)
			.all<{ id: string; data: string }>();
		return (res.results ?? []).map((r) => ({ id: r.id, data: JSON.parse(r.data) as T }));
	}
}

export interface OAuthAccountData {
	provider: "google";
	account_email: string;
	display_name: string | null;
	access_token_enc: string;
	access_token_iv: string;
	refresh_token_enc: string;
	refresh_token_iv: string;
	access_token_expires_at: string;
	scope: string;
	status: "active" | "revoked" | "error";
	last_sync_error: string | null;
	connected_at: string;
	last_synced_at: string | null;
	revoked_at: string | null;
}

export interface OAuthCalendarData {
	account_id: string;
	calendar_id: string;
	summary: string;
	time_zone: string | null;
	background_color: string | null;
	access_role: string | null;
	synced: 0 | 1;
	sync_token: string | null;
	last_resynced_at: string | null;
	expose_titles: 0 | 1;
}

export interface OAuthStateData {
	state: string;
	created_at: string;
	expires_at: string;
	return_url?: string;
}

export interface AvailabilityRuleData {
	label: string;
	// Host's timezone — weekly_hours + date_overrides are interpreted in this zone.
	timezone: string;
	// Weekly pattern: mon..sun keyed days, each a list of HH:MM intervals.
	weekly_hours: {
		mon: { start: string; end: string }[];
		tue: { start: string; end: string }[];
		wed: { start: string; end: string }[];
		thu: { start: string; end: string }[];
		fri: { start: string; end: string }[];
		sat: { start: string; end: string }[];
		sun: { start: string; end: string }[];
	};
	// YYYY-MM-DD → replacement intervals (or [] to mean "blocked that day")
	date_overrides?: Record<string, { start: string; end: string }[]>;
}

export interface BookingData {
	meeting_type_id: string;
	host_account_id: string;
	slot_start_iso: string;
	slot_end_iso: string;
	// Guest's timezone captured at booking time (for email formatting + display).
	timezone: string;
	guest_name: string;
	guest_email: string;
	// Keyed by meeting_type.questions[].id (NOT label — labels can change over time).
	guest_answers: Record<string, string>;
	gcal_event_id: string | null;
	status: "confirmed" | "cancelled";
	cancel_token: string;
	reschedule_token: string;
	created_at: string;
	cancelled_at: string | null;
	reminded_at: string | null;
}

export function collections(db: D1Database) {
	return {
		oauth_accounts: new Collection<OAuthAccountData>(db, "oauth_accounts"),
		oauth_calendars: new Collection<OAuthCalendarData>(db, "oauth_calendars"),
		oauth_state: new Collection<OAuthStateData>(db, "oauth_state"),
		availability_rules: new Collection<AvailabilityRuleData>(db, "availability_rules"),
		bookings: new Collection<BookingData>(db, "bookings"),
	};
}
