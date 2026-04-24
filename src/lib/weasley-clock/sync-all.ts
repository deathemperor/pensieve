import type { D1Database } from "@cloudflare/workers-types";
import { ensureFreshAccessToken } from "./token-refresh";
import { syncCalendar, type CalendarRow } from "./sync-calendar";
import { collections } from "./storage";

export interface SyncSummaryEntry {
	calendarId: string;
	status: string;
	events: number;
}

export interface SyncSecrets {
	encKey: string;
	clientId: string;
	clientSecret: string;
}

// Sync all (or one account's) calendars. Returns per-calendar outcome.
// Caller is responsible for auth (cron has shared-secret; sync-now has admin session).
export async function syncAll(
	db: D1Database,
	secrets: SyncSecrets,
	opts: { accountId?: string } = {},
): Promise<{ summary: SyncSummaryEntry[] }> {
	const c = collections(db);
	const accounts = await c.oauth_accounts.list();
	const calendars = await c.oauth_calendars.list();

	const accountsById = new Map<string, any>();
	for (const r of accounts) accountsById.set(r.id, r.data);

	const summary: SyncSummaryEntry[] = [];

	for (const cr of calendars) {
		const cal = cr.data;
		if (!cal.synced) continue;
		if (opts.accountId && cal.account_id !== opts.accountId) continue;

		const acc = accountsById.get(cal.account_id);
		if (!acc || acc.status !== "active") {
			summary.push({ calendarId: cr.id, status: "skipped_inactive_account", events: 0 });
			continue;
		}

		try {
			const accRowForRefresh = { ...acc, id: cal.account_id };
			const { access_token, refreshed, updatedRow } = await ensureFreshAccessToken(accRowForRefresh, secrets);
			if (refreshed && updatedRow) {
				const { id: _drop, ...data } = updatedRow as any;
				await c.oauth_accounts.put(cal.account_id, data);
			}
			const calRow: CalendarRow = { ...cal, id: cr.id };
			const result = await syncCalendar(db, calRow, async () => access_token);
			summary.push({ calendarId: cr.id, status: result.status, events: result.eventsProcessed });
		} catch (err: any) {
			const msg = String(err?.message ?? err);
			if (/invalid_grant/i.test(msg)) {
				await c.oauth_accounts.put(cal.account_id, {
					...acc,
					status: "revoked",
					last_sync_error: msg,
					revoked_at: new Date().toISOString(),
				});
				summary.push({ calendarId: cr.id, status: "account_revoked", events: 0 });
			} else {
				await c.oauth_accounts.put(cal.account_id, {
					...acc,
					last_sync_error: msg,
				});
				summary.push({ calendarId: cr.id, status: "error", events: 0 });
			}
			console.error(`[weasley-clock] sync ${cr.id} failed: ${msg}`);
		}
	}

	return { summary };
}
