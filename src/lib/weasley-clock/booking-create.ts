import type { D1Database } from "@cloudflare/workers-types";
import { getEmDashCollection } from "emdash";
import { collections, type BookingData, type OAuthAccountData } from "./storage";
import { computeSlots, type BusyWindow } from "./availability";
import { ensureFreshAccessToken, type OAuthAccountRow } from "./token-refresh";
import { ulid } from "../portraits/ulid";

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
	if (!mt) throw new Error("Meeting type not found");

	const durationMin = Number(field(mt, "duration_min") ?? 30);
	const bufferBefore = Number(field(mt, "buffer_before") ?? 0);
	const bufferAfter = Number(field(mt, "buffer_after") ?? 0);
	const minNoticeHrs = Number(field(mt, "min_notice_hrs") ?? 2);
	const maxAdvanceDays = Number(field(mt, "max_advance_days") ?? 60);
	const titleVi = field<string>(mt, "title_vi");
	const titleEn = field<string>(mt, "title_en");
	const meetingTitle = titleVi || titleEn || "Meeting";
	const location = field<string>(mt, "location") || "To be coordinated via email";

	// 2. Host account — first in the list (round-robin is Phase 4).
	let hostIds: string[] = [];
	const rawHostIds = field<string | string[]>(mt, "host_account_ids") ?? "[]";
	try {
		hostIds = typeof rawHostIds === "string" ? JSON.parse(rawHostIds) : rawHostIds;
	} catch {
		hostIds = [];
	}
	if (!Array.isArray(hostIds) || hostIds.length === 0) {
		throw new Error("No host configured for this meeting type");
	}
	const hostId = hostIds[0];

	// 3. Availability rule.
	const availId = field<string>(mt, "availability_id") || "default";
	const ruleRow = await c.availability_rules.get(availId);
	if (!ruleRow) throw new Error(`Availability rule "${availId}" not found`);

	// 4. Busy windows for host's synced calendars (same query shape as slots.ts).
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
	const busyWindows: BusyWindow[] = (eventsRes.results ?? [])
		.filter((r) => calIds.has(r.cid) && !r.del)
		.map((r) => ({ start_iso: r.s, end_iso: r.e }));

	// 5. Revalidate the slot is still available. Use a ±1 day window around the
	// requested slot — enough to include neighboring slots without paying for a
	// full-month recomputation.
	const slotStartMs = Date.parse(input.slotStartIso);
	if (Number.isNaN(slotStartMs)) throw new Error("Invalid slot_start_iso");
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
	const match = slots.find((s) => s.start_iso === input.slotStartIso);
	if (!match) throw new Error("Slot no longer available");

	const slotEndIso = match.end_iso;

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
		await c.oauth_accounts.put(hostId, updatedData);
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
		throw new Error(`Google Calendar rejected: ${gcalRes.status} ${text}`);
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
