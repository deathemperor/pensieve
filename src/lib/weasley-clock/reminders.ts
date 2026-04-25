import type { D1Database } from "@cloudflare/workers-types";
import { collections } from "./storage";
import { getEmDashCollection } from "emdash";
import { sendReminderEmail } from "./email";

export interface RunReminderPassInput {
	db: D1Database;
	resendApiKey: string;
}

export interface RunReminderPassResult {
	scanned: number;
	sent: number;
	errors: number;
}

const BATCH_LIMIT = 50;
const WINDOW_LOWER_HRS = 23;
const WINDOW_UPPER_HRS = 24;

export async function runReminderPass(input: RunReminderPassInput): Promise<RunReminderPassResult> {
	const c = collections(input.db);
	const now = Date.now();
	const lowerMs = now + WINDOW_LOWER_HRS * 3600_000;
	const upperMs = now + WINDOW_UPPER_HRS * 3600_000;

	// Pull all bookings that *might* qualify. Plugin storage doesn't expose
	// rich query operators, so list + filter in memory. With BATCH_LIMIT=50
	// + bookings table starting empty, this is fine for the foreseeable.
	const all = await c.bookings.list();
	const candidates = all
		.filter((r) => {
			if (r.data.status !== "confirmed") return false;
			if (r.data.reminded_at) return false;
			const startMs = new Date(r.data.slot_start_iso).getTime();
			return startMs >= lowerMs && startMs <= upperMs;
		})
		.slice(0, BATCH_LIMIT);

	if (candidates.length === 0) return { scanned: all.length, sent: 0, errors: 0 };

	// Look up meeting types once for title resolution.
	const { entries: mts } = await getEmDashCollection("meeting_types");
	const mtById = new Map<string, any>();
	for (const e of mts ?? []) {
		mtById.set(e.id, e);
	}
	const field = (e: any, k: string) => e?.data?.[k] ?? e?.[k];

	let sent = 0;
	let errors = 0;
	for (const row of candidates) {
		const mt = mtById.get(row.data.meeting_type_id);
		const titleVi = mt ? field(mt, "title_vi") : "Cuộc hẹn";
		const titleEn = mt ? field(mt, "title_en") : "Meeting";
		// We don't store guest's preferred language on the booking row yet — default to "vi".
		// Future: store guest_lang on the row. For now, send VI primary; the Phase 1 confirmation
		// also defaults to VI when lang is missing.
		try {
			await sendReminderEmail({
				apiKey: input.resendApiKey,
				guestEmail: row.data.guest_email,
				guestName: row.data.guest_name,
				meetingTitleVi: titleVi,
				meetingTitleEn: titleEn,
				slotStartIso: row.data.slot_start_iso,
				guestTimezone: row.data.timezone,
				cancelUrl: cancelUrlFor(row.data.cancel_token),
				rescheduleUrl: rescheduleUrlFor(row.data.reschedule_token),
			});
			await c.bookings.put(row.id, { ...row.data, reminded_at: new Date().toISOString() });
			sent++;
		} catch (err: any) {
			console.error(`[reminder] booking ${row.id} failed:`, err?.message ?? err);
			errors++;
		}
	}

	return { scanned: all.length, sent, errors };
}

function cancelUrlFor(token: string): string {
	return `https://huuloc.com/book/cancel/${encodeURIComponent(token)}`;
}
function rescheduleUrlFor(token: string): string {
	return `https://huuloc.com/book/reschedule/${encodeURIComponent(token)}`;
}
