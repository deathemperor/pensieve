import type { D1Database } from "@cloudflare/workers-types";
import { getEmDashCollection } from "emdash";
import { collections, type BookingData, type OAuthAccountData } from "./storage";
import { computeSlots, type Slot } from "./availability";
import { buildBusyWindowsForHost, hostsAvailableAt, pickAssignedHost } from "./multi-host";
import { ensureFreshAccessToken, type OAuthAccountRow } from "./token-refresh";
import { ulid } from "../portraits/ulid";

export class BookingError extends Error {
	constructor(message: string, public readonly code: "not_found" | "slot_unavailable" | "bad_input" | "upstream") {
		super(message);
		this.name = "BookingError";
	}
}

export interface CreateBookingInput {
	db: D1Database;
	encKey: string;
	clientId: string;
	clientSecret: string;
	meetingTypeId: string;
	slotStartIso: string;
	guestName: string;
	guestEmail: string;
	guestAnswers: Record<string, string>;
	guestTimezone: string;
}

export interface CreateBookingResult {
	bookingId: string;
	cancelToken: string;
	rescheduleToken: string;
	meetingTitle: string;
	slotStartIso: string;
	slotEndIso: string;
	hostAccountId: string;
}

const DAY_MS = 86_400_000;

// Defensive field access — EmDash entry fields can appear either at the
// top level or nested under `.data` depending on collection shape.
function field<T = any>(entry: any, key: string): T | undefined {
	if (!entry) return undefined;
	return entry.data?.[key] ?? entry[key];
}

function renderAnswers(answers: Record<string, string>): string {
	if (Object.keys(answers).length === 0) return "(no additional details)";
	return Object.entries(answers)
		.map(([k, v]) => `${k}: ${v}`)
		.join("\n");
}

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
	// 0. Basic email sanity.
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.guestEmail)) {
		throw new Error("Invalid guest email");
	}

	const c = collections(input.db);

	// 1. Load meeting type from EmDash.
	const { entries: meetingTypes } = await getEmDashCollection("meeting_types");
	const mt = meetingTypes.find((e: any) => e.id === input.meetingTypeId) as any;
	if (!mt) throw new BookingError("Meeting type not found", "not_found");

	const durationMin = Number(field(mt, "duration_min") ?? 30);
	const bufferBefore = Number(field(mt, "buffer_before") ?? 0);
	const bufferAfter = Number(field(mt, "buffer_after") ?? 0);
	const minNoticeHrs = Number(field(mt, "min_notice_hrs") ?? 2);
	const maxAdvanceDays = Number(field(mt, "max_advance_days") ?? 60);
	const titleVi = field<string>(mt, "title_vi");
	const titleEn = field<string>(mt, "title_en");
	const meetingTitle = titleVi || titleEn || "Meeting";
	const location = field<string>(mt, "location") || "To be coordinated via email";

	// 2. Host accounts — host_account_ids is a JSON array.
	let hostIds: string[] = [];
	const rawHostIds = field<string | string[]>(mt, "host_account_ids") ?? "[]";
	try {
		hostIds = typeof rawHostIds === "string" ? JSON.parse(rawHostIds) : rawHostIds;
	} catch {
		hostIds = [];
	}
	if (!Array.isArray(hostIds) || hostIds.length === 0) {
		throw new BookingError("No host configured for this meeting type", "bad_input");
	}

	// 3. Availability rule.
	const availId = field<string>(mt, "availability_id") || "default";
	const ruleRow = await c.availability_rules.get(availId);
	if (!ruleRow) throw new BookingError(`Availability rule "${availId}" not found`, "not_found");

	// 4. Build busy windows + compute slots per host over a ±1 day window around
	// the requested slot — enough to revalidate without a full-month recomputation.
	const slotStartMs = Date.parse(input.slotStartIso);
	if (Number.isNaN(slotStartMs)) throw new Error("Invalid slot_start_iso");
	const rangeStartIso = new Date(slotStartMs - DAY_MS).toISOString();
	const rangeEndIso = new Date(slotStartMs + DAY_MS).toISOString();

	const slotsByHost: Record<string, Slot[]> = {};
	for (const hid of hostIds) {
		const busy = await buildBusyWindowsForHost(input.db, hid);
		slotsByHost[hid] = computeSlots({
			rule: ruleRow.data,
			busyWindows: busy,
			durationMin,
			bufferBeforeMin: bufferBefore,
			bufferAfterMin: bufferAfter,
			minNoticeHrs,
			maxAdvanceDays,
			rangeStartIso,
			rangeEndIso,
			nowIso: new Date().toISOString(),
		});
	}

	// 5. Find which hosts have the requested slot, then pick via round-robin.
	const candidates = hostsAvailableAt(slotsByHost, input.slotStartIso);
	if (candidates.length === 0) {
		throw new BookingError("Slot no longer available", "slot_unavailable");
	}

	const hostId = await pickAssignedHost(input.db, candidates);

	// slotEndIso from the assigned host's matched slot (all candidates share the same end).
	const matched = slotsByHost[hostId].find((s) => s.start_iso === input.slotStartIso)!;
	const slotEndIso = matched.end_iso;

	// 6. Fresh access token.
	const acctRow = await c.oauth_accounts.get(hostId);
	if (!acctRow) throw new Error("Host OAuth account not found");
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
		// 5 min skew per spec — refresh if <5 min remain.
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
				`[weasley-clock/booking-create] CRITICAL: failed to persist refreshed token for account ${hostId}. Booking will continue but future refreshes may fail if the refresh_token rotated. err=${err?.message ?? err}`,
			);
		}
	}

	// 7. Insert the Google Calendar event. `sendUpdates=all` makes Google email
	// the attendees directly (guest gets a native Google invite on top of our
	// Resend confirmation).
	const gcalRes = await fetch(
		"https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${access_token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				summary: meetingTitle,
				description: renderAnswers(input.guestAnswers),
				start: { dateTime: input.slotStartIso, timeZone: "UTC" },
				end: { dateTime: slotEndIso, timeZone: "UTC" },
				attendees: [{ email: input.guestEmail, displayName: input.guestName }],
				location,
			}),
		},
	);
	if (!gcalRes.ok) {
		const text = await gcalRes.text();
		console.error(`[weasley-clock/booking-create] Google Calendar rejected: ${gcalRes.status} ${text}`);
		throw new BookingError("Failed to create calendar event", "upstream");
	}
	const gcalBody = (await gcalRes.json()) as { id?: string };
	const gcalEventId = gcalBody.id ?? null;

	// 8. Tokens + booking ID.
	const cancelToken = ulid();
	const rescheduleToken = ulid();
	const bookingId = `bk_${ulid()}`;

	const nowIso = new Date().toISOString();
	const bookingData: BookingData = {
		meeting_type_id: input.meetingTypeId,
		host_account_id: hostId,
		slot_start_iso: input.slotStartIso,
		slot_end_iso: slotEndIso,
		timezone: input.guestTimezone,
		guest_name: input.guestName,
		guest_email: input.guestEmail,
		guest_answers: input.guestAnswers,
		gcal_event_id: gcalEventId,
		status: "confirmed",
		cancel_token: cancelToken,
		reschedule_token: rescheduleToken,
		created_at: nowIso,
		cancelled_at: null,
		reminded_at: null,
	};
	await c.bookings.put(bookingId, bookingData);

	try {
		const { dispatchWebhook } = await import("./webhooks");
		await dispatchWebhook({
			db: input.db,
			event: "booking.created",
			data: {
				booking_id: bookingId,
				meeting_type_id: input.meetingTypeId,
				slot_start_iso: input.slotStartIso,
				slot_end_iso: slotEndIso,
				guest_email: input.guestEmail,
				guest_name: input.guestName,
				timezone: input.guestTimezone,
			},
		});
	} catch (err: any) { console.error("[wc/booking-create] webhook dispatch failed:", err?.message ?? err); }

	return {
		bookingId,
		cancelToken,
		rescheduleToken,
		meetingTitle,
		slotStartIso: input.slotStartIso,
		slotEndIso,
		hostAccountId: hostId,
	};
}
