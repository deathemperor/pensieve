import type { D1Database } from "@cloudflare/workers-types";
import { getEmDashCollection } from "emdash";
import { collections, type OAuthAccountData } from "./storage";
import { ensureFreshAccessToken, type OAuthAccountRow } from "./token-refresh";
import { BookingError } from "./booking-create";

export interface CancelBookingInput {
	db: D1Database;
	encKey: string;
	clientId: string;
	clientSecret: string;
	cancelToken: string;
}

export interface CancelBookingResult {
	bookingId: string;
	guestEmail: string;
	guestName: string;
	meetingTitle: string;
	slotStartIso: string;
	slotEndIso: string;
	timezone: string;
	wasAlreadyCancelled: boolean;
}

// Defensive field access — same pattern as booking-create.ts.
function field<T = any>(entry: any, key: string): T | undefined {
	if (!entry) return undefined;
	return entry.data?.[key] ?? entry[key];
}

export async function cancelBooking(input: CancelBookingInput): Promise<CancelBookingResult> {
	const c = collections(input.db);

	// 1. Find booking by cancel_token.
	const all = await c.bookings.list();
	const row = all.find((r) => r.data.cancel_token === input.cancelToken);
	if (!row) throw new BookingError("Booking not found", "not_found");

	const booking = row.data;

	// 2. Look up meeting type for title.
	const { entries: meetingTypes } = await getEmDashCollection("meeting_types");
	const mt = (meetingTypes ?? []).find((e: any) => e.id === booking.meeting_type_id) as any;
	const titleVi = field<string>(mt, "title_vi");
	const titleEn = field<string>(mt, "title_en");
	const meetingTitle = titleVi || titleEn || "Meeting";

	const baseResult: Omit<CancelBookingResult, "wasAlreadyCancelled"> = {
		bookingId: row.id,
		guestEmail: booking.guest_email,
		guestName: booking.guest_name,
		meetingTitle,
		slotStartIso: booking.slot_start_iso,
		slotEndIso: booking.slot_end_iso,
		timezone: booking.timezone,
	};

	// 3. Idempotent re-cancel.
	if (booking.status === "cancelled") {
		return { ...baseResult, wasAlreadyCancelled: true };
	}

	// 4. Decrypt + refresh host token.
	const acctRow = await c.oauth_accounts.get(booking.host_account_id);
	if (!acctRow) {
		console.error(`[wc/cancel] Host OAuth account not found: ${booking.host_account_id}`);
		// Continue — we still want to cancel our row even if we can't delete the GCal event.
	}

	let access_token: string | null = null;
	if (acctRow) {
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
		try {
			const { access_token: tok, refreshed, updatedRow } = await ensureFreshAccessToken(oauthRow, {
				encKey: input.encKey,
				clientId: input.clientId,
				clientSecret: input.clientSecret,
				expirySkewSec: 300,
			});
			access_token = tok;

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
					await c.oauth_accounts.put(booking.host_account_id, updatedData);
				} catch (err: any) {
					console.error(
						`[wc/cancel] Failed to persist refreshed token for account ${booking.host_account_id}: ${err?.message ?? err}`,
					);
				}
			}
		} catch (err: any) {
			console.error(`[wc/cancel] Token refresh failed: ${err?.message ?? err}`);
		}
	}

	// 5. DELETE the GCal event.
	if (access_token && booking.gcal_event_id) {
		try {
			const gcalRes = await fetch(
				`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(booking.gcal_event_id)}?sendUpdates=all`,
				{
					method: "DELETE",
					headers: {
						Authorization: `Bearer ${access_token}`,
					},
				},
			);
			if (!gcalRes.ok && gcalRes.status !== 410) {
				const text = await gcalRes.text();
				console.error(
					`[wc/cancel] GCal DELETE non-2xx (status=${gcalRes.status}): ${text}. Proceeding with row cancellation.`,
				);
			}
			// 200 / 204 = success, 410 = already gone — both treated as success.
		} catch (err: any) {
			console.error(`[wc/cancel] GCal DELETE network error: ${err?.message ?? err}. Proceeding with row cancellation.`);
		}
	}

	// 6. Update booking row.
	const nowIso = new Date().toISOString();
	await c.bookings.put(row.id, {
		...booking,
		status: "cancelled",
		cancelled_at: nowIso,
	});

	// 7. Return result.
	return { ...baseResult, wasAlreadyCancelled: false };
}
