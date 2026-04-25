import type { D1Database } from "@cloudflare/workers-types";
import { collections } from "./storage";
import { type BusyWindow, type Slot } from "./availability";

export async function buildBusyWindowsForHost(
	db: D1Database,
	hostAccountId: string,
): Promise<BusyWindow[]> {
	const c = collections(db);
	const cals = (await c.oauth_calendars.list()).filter(
		(r) => r.data.account_id === hostAccountId && r.data.synced === 1,
	);
	const calIds = new Set(cals.map((r) => r.data.calendar_id));
	const eventsRes = await db
		.prepare(
			`SELECT json_extract(data, '$.starts_at') AS s,
			        json_extract(data, '$.ends_at') AS e,
			        json_extract(data, '$.gcal_calendar_id') AS cid,
			        json_extract(data, '$.deleted') AS del
			 FROM _plugin_storage WHERE plugin_id='weasley-clock' AND collection='synced_events'`,
		)
		.all<{ s: string; e: string; cid: string; del: number | null }>();
	return (eventsRes.results ?? [])
		.filter((r) => calIds.has(r.cid) && !r.del)
		.map((r) => ({ start_iso: r.s, end_iso: r.e }));
}

export function unionSlots(slotsByHost: Record<string, Slot[]>): Slot[] {
	const seen = new Map<string, Slot>();
	for (const slots of Object.values(slotsByHost)) {
		for (const s of slots) {
			if (!seen.has(s.start_iso)) seen.set(s.start_iso, s);
		}
	}
	return Array.from(seen.values()).sort((a, b) => a.start_iso.localeCompare(b.start_iso));
}

export function hostsAvailableAt(
	slotsByHost: Record<string, Slot[]>,
	slotStartIso: string,
): string[] {
	const out: string[] = [];
	for (const [host, slots] of Object.entries(slotsByHost)) {
		if (slots.some((s) => s.start_iso === slotStartIso)) out.push(host);
	}
	return out;
}

export async function pickAssignedHost(
	db: D1Database,
	candidateHosts: string[],
): Promise<string> {
	if (candidateHosts.length === 1) return candidateHosts[0];
	const c = collections(db);
	const all = await c.bookings.list();
	const nowMs = Date.now();
	const horizonMs = nowMs + 30 * 24 * 3600 * 1000;
	const counts: Record<string, number> = Object.fromEntries(candidateHosts.map((h) => [h, 0]));
	for (const r of all) {
		if (r.data.status !== "confirmed") continue;
		if (!Object.prototype.hasOwnProperty.call(counts, r.data.host_account_id)) continue;
		const startMs = new Date(r.data.slot_start_iso).getTime();
		if (startMs >= nowMs && startMs <= horizonMs) {
			counts[r.data.host_account_id]++;
		}
	}
	const sorted = candidateHosts.slice().sort((a, b) => {
		if (counts[a] !== counts[b]) return counts[a] - counts[b];
		return a.localeCompare(b);
	});
	return sorted[0];
}
