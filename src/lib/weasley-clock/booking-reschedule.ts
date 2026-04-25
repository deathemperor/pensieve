import type { D1Database } from "@cloudflare/workers-types";
import { getEmDashCollection } from "emdash";
import { collections, type OAuthAccountData } from "./storage";
import { computeSlots, type BusyWindow } from "./availability";
import { ensureFreshAccessToken, type OAuthAccountRow } from "./token-refresh";
import { BookingError } from "./booking-create";
import { ulid } from "../portraits/ulid";

export interface RescheduleBookingInput {
	db: D1Database;
	encKey: string;
	clientId: string;
	clientSecret: string;
	rescheduleToken: string;
	newSlotStartIso: string;
	guestTimezone: string;
}

export interface RescheduleBookingResult {
	bookingId: string;
	guestEmail: string;
	guestName: string;
	meetingTitle: string;
	oldSlotStartIso: string;
	oldSlotEndIso: string;
	newSlotStartIso: string;
	newSlotEndIso: string;
	timezone: string;
	newCancelToken: string;
	newRescheduleToken: string;
}

const DAY_MS = 86_400_000;

// Defensive field access — same pattern as booking-create.ts / booking-cancel.ts.
function field<T = any>(entry: any, key: string): T | undefined {
	if (!entry) return undefined;
	return entry.data?.[key] ?? entry[key];
}

export async function rescheduleBooking(input: RescheduleBookingInput): Promise<RescheduleBookingResult> {
	const c = collections(input.db);

	// 1. Find booking by reschedule_token.
	const all = await c.bookings.list();
	const row = all.find((r) => r.data.reschedule_token === input.rescheduleToken);
	if (!row) throw new BookingError("Booking not found", "not_found");

	const booking = row.data;

	// 2. Already cancelled bookings can't be rescheduled.
	if (booking.status === "cancelled") {
		throw new BookingError("This booking has been cancelled and cannot be rescheduled", "bad_input");
	}

	// 3. Load meeting type for revalidation params + title.
	const { entries: meetingTypes } = await getEmDashCollection("meeting_types");
	const mt = (meetingTypes ?? []).find((e: any) => e.id === booking.meeting_type_id) as any;
	if (!mt) throw new BookingError("Meeting type not found", "not_found");

	const durationMin = Number(field(mt, "duration_min") ?? 30);
	const bufferBefore = Number(field(mt, "buffer_before") ?? 0);
	const bufferAfter = Number(field(mt, "buffer_after") ?? 0);
	const minNoticeHrs = Number(field(mt, "min_notice_hrs") ?? 2);
	const maxAdvanceDays = Number(field(mt, "max_advance_days") ?? 60);
	const titleVi = field<string>(mt, "title_vi");
	const titleEn = field<string>(mt, "title_en");
	const meetingTitle = titleVi || titleEn || "Meeting";

	// 4. Availability rule.
	const availId = field<string>(mt, "availability_id") || "default";
	const ruleRow = await c.availability_rules.get(availId);
	if (!ruleRow) throw new BookingError(`Availability rule "${availId}" not found`, "not_found");

	// 5. Busy windows for host's synced calendars (same query shape as booking-create.ts).
	const hostId = booking.host_account_id;
	const cals = (await c.oauth_calendars.list()).filter(
		(r) => r.data.account_id === hostId && r.data.synced === 1,
	);
	const calIds = new Set(cals.map((r) => r.data.calendar_id));
	const eventsRes = await input.db
		.prepare(
			`SELECT json_extract(data, '$.starts_at') AS s,
			        json_extract(data, '$.ends_at') AS e,
			        json_extract(data, '$.gcal_calendar_id') AS cid,
			        json_extract(data, '$.deleted') AS del
			 FROM _plugin_storage
			 WHERE plugin_id = 'weasley-clock' AND collection = 'synced_events'`,
		)
		.all<{ s: string; e: string; cid: string; del: number | null }>();

	// EXCLUDE the existing booking's own GCal event from busy windows. Otherwise
	// the slot containing the *current* booking time would be flagged busy and
	// the user couldn't reschedule into a window that overlaps their old time.
	const oldStartIso = booking.slot_start_iso;
	const oldEndIso = booking.slot_end_iso;
	const busyWindows: BusyWindow[] = (eventsRes.results ?? [])
		.filter((r) => calIds.has(r.cid) && !r.del)
		.filter((r) => !(r.s === oldStartIso && r.e === oldEndIso))
		.map((r) => ({ start_iso: r.s, end_iso: r.e }));

	// 6. Revalidate the new slot is available — ±1 day window around the request.
	const slotStartMs = Date.parse(input.newSlotStartIso);
	if (Number.isNaN(slotStartMs)) throw new BookingError("Invalid new_slot_start_iso", "bad_input");
	const rangeStartIso = new Date(slotStartMs - DAY_MS).toISOString();
	const rangeEndIso = new Date(slotStartMs + DAY_MS).toISOString();
	const slots = computeSlots({
		rule: ruleRow.data,
		busyWindows,
		durationMin,
		bufferBeforeMin: bufferBefore,
		bufferAfterMin: bufferAfter,
		minNoticeHrs,
		maxAdvanceDays,
		rangeStartIso,
		rangeEndIso,
		nowIso: new Date().toISOString(),
	});
	const match = slots.find((s) => s.start_iso === input.newSlotStartIso);
	if (!match) throw new BookingError("Slot no longer available", "slot_unavailable");

	const newSlotEndIso = match.end_iso;

	// 7. Decrypt + refresh host token.
	const acctRow = await c.oauth_accounts.get(hostId);
	if (!acctRow) throw new BookingError("Host OAuth account not found", "not_found");

	const oauthRow: OAuthAccountRow = {
		id: acctRow.id,
		provider: acctRow.data.provider,
		account_email: acctRow.data.account_email,
		access_token_enc: acctRow.data.access_token_enc,
		access_token_iv: acctRow.data.access_token_iv,
		refresh_token_enc: acctRow.data.refresh_token_enc,
		refresh_token_iv: acctRow.data.refresh_token_iv,
		access_token_expires_at: acctRow.data.access_token_expires_at,
		scope: acctRow.data.scope,
		status: acctRow.data.status,
	};
	const { access_token, refreshed, updatedRow } = await ensureFreshAccessToken(oauthRow, {
		encKey: input.encKey,
		clientId: input.clientId,
		clientSecret: input.clientSecret,
		expirySkewSec: 300,
	});

	if (refreshed && updatedRow) {
		const updatedData: OAuthAccountData = {
			...acctRow.data,
			access_token_enc: updatedRow.access_token_enc,
			access_token_iv: updatedRow.access_token_iv,
			access_token_expires_at: updatedRow.access_token_expires_at,
			scope: updatedRow.scope,
			status: updatedRow.status,
		};
		try {
			await c.oauth_accounts.put(hostId, updatedData);
		} catch (err: any) {
			console.error(
				`[wc/reschedule] Failed to persist refreshed token for account ${hostId}: ${err?.message ?? err}`,
			);
		}
	}

	// 8. PATCH the GCal event.
	if (!booking.gcal_event_id) {
		throw new BookingError("Booking has no calendar event to reschedule", "bad_input");
	}
	try {
		const gcalRes = await fetch(
			`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(booking.gcal_event_id)}?sendUpdates=all`,
			{
				method: "PATCH",
				headers: {
					Authorization: `Bearer ${access_token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					start: { dateTime: input.newSlotStartIso, timeZone: "UTC" },
					end: { dateTime: newSlotEndIso, timeZone: "UTC" },
				}),
			},
		);
		if (!gcalRes.ok) {
			const text = await gcalRes.text();
			console.error(`[wc/reschedule] GCal PATCH non-2xx (status=${gcalRes.status}): ${text}`);
			throw new BookingError("Failed to reschedule calendar event", "upstream");
		}
	} catch (err: any) {
		if (err instanceof BookingError) throw err;
		console.error(`[wc/reschedule] GCal PATCH network error: ${err?.message ?? err}`);
		throw new BookingError("Failed to reschedule calendar event", "upstream");
	}

	// 9. Rotate tokens — old links become invalid.
	const newCancelToken = ulid();
	const newRescheduleToken = ulid();

	// 10. Update booking row. reminded_at = null so the reminder cron fires for
	// the new time. All other fields preserved.
	await c.bookings.put(row.id, {
		...booking,
		slot_start_iso: input.newSlotStartIso,
		slot_end_iso: newSlotEndIso,
		cancel_token: newCancelToken,
		reschedule_token: newRescheduleToken,
		reminded_at: null,
	});

	try {
		const { dispatchWebhook } = await import("./webhooks");
		await dispatchWebhook({
			db: input.db,
			event: "booking.rescheduled",
			data: {
				booking_id: row.id,
				old_slot_start_iso: oldStartIso,  // captured BEFORE the put
				new_slot_start_iso: input.newSlotStartIso,
				new_slot_end_iso: newSlotEndIso,
			},
		});
	} catch (err: any) { console.error("[wc/booking-reschedule] webhook dispatch failed:", err?.message ?? err); }

	return {
		bookingId: row.id,
		guestEmail: booking.guest_email,
		guestName: booking.guest_name,
		meetingTitle,
		oldSlotStartIso: oldStartIso,
		oldSlotEndIso: oldEndIso,
		newSlotStartIso: input.newSlotStartIso,
		newSlotEndIso,
		timezone: booking.timezone,
		newCancelToken,
		newRescheduleToken,
	};
}
