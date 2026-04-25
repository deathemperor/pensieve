import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { rescheduleBooking } from "../../../../lib/weasley-clock/booking-reschedule";
import { sendRescheduledEmail } from "../../../../lib/weasley-clock/email";
import { BookingError } from "../../../../lib/weasley-clock/booking-create";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	// IMPORTANT: wrap the entire handler in try/catch — Astro's Cloudflare
	// adapter re-invokes on uncaught throws (OAuth callback bug lesson).
	try {
		const e = env as any;

		const body = (await request.json()) as {
			reschedule_token: string;
			new_slot_start_iso: string;
			guest_timezone: string;
			lang?: "vi" | "en";
		};

		for (const field of ["reschedule_token", "new_slot_start_iso", "guest_timezone"] as const) {
			const v = body[field];
			if (typeof v !== "string" || !v.trim()) {
				return json({ error: `${field} is required` }, 400);
			}
		}

		const result = await rescheduleBooking({
			db: e.DB,
			encKey: e.OAUTH_ENC_KEY,
			clientId: e.GOOGLE_OAUTH_CLIENT_ID,
			clientSecret: e.GOOGLE_OAUTH_CLIENT_SECRET,
			rescheduleToken: body.reschedule_token,
			newSlotStartIso: body.new_slot_start_iso,
			guestTimezone: body.guest_timezone,
		});

		const origin = new URL(request.url).origin;
		const newCancelUrl = `${origin}/book/cancel/${result.newCancelToken}`;
		const newRescheduleUrl = `${origin}/book/reschedule/${result.newRescheduleToken}`;

		// Email is non-fatal — booking is already persisted + GCal event patched.
		try {
			await sendRescheduledEmail({
				apiKey: e.RESEND_API_KEY,
				guestEmail: result.guestEmail,
				guestName: result.guestName,
				meetingTitle: result.meetingTitle,
				oldSlotStartIso: result.oldSlotStartIso,
				newSlotStartIso: result.newSlotStartIso,
				newSlotEndIso: result.newSlotEndIso,
				guestTimezone: result.timezone,
				lang: body.lang ?? "vi",
				newCancelUrl,
				newRescheduleUrl,
			});
		} catch (err: any) {
			console.error("[wc/reschedule] email send failed:", err?.message ?? err);
		}

		return json(
			{
				booking_id: result.bookingId,
				confirmed_url: `/book/confirmed/${result.bookingId}`,
				new_cancel_url: newCancelUrl,
				new_reschedule_url: newRescheduleUrl,
			},
			201,
		);
	} catch (err: any) {
		console.error("[wc/reschedule]", err?.message ?? err, err?.stack ?? "");
		if (err instanceof BookingError) {
			const statusByCode: Record<string, number> = {
				not_found: 404,
				slot_unavailable: 409,
				bad_input: 400,
				upstream: 502,
			};
			return json({ error: err.message }, statusByCode[err.code] ?? 500);
		}
		return json({ error: "Internal error" }, 500);
	}
};

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}
