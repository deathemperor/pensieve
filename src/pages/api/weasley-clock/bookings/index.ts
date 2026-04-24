import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createBooking, BookingError } from "../../../../lib/weasley-clock/booking-create";
import { sendConfirmationEmail } from "../../../../lib/weasley-clock/email";
import { checkRateLimit } from "../../../../lib/weasley-clock/rate-limit";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	// IMPORTANT: wrap the entire handler in try/catch. Astro's Cloudflare
	// adapter re-invokes on uncaught throws (OAuth callback bug lesson).
	try {
		const e = env as any;

		// Rate limit by client IP — 5 bookings per hour.
		const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
		const rl = await checkRateLimit(e.SESSION, `book:${ip}`, 5, 3600);
		if (!rl.allowed) {
			return json({ error: "Rate limit exceeded. Please try again in an hour." }, 429);
		}

		const body = (await request.json()) as {
			meeting_type_id: string;
			slot_start_iso: string;
			guest_name: string;
			guest_email: string;
			guest_answers?: Record<string, string>;
			guest_timezone: string;
			lang?: "vi" | "en";
		};

		for (const field of [
			"meeting_type_id",
			"slot_start_iso",
			"guest_name",
			"guest_email",
			"guest_timezone",
		] as const) {
			const v = body[field];
			if (typeof v !== "string" || !v.trim()) {
				return json({ error: `${field} is required` }, 400);
			}
		}
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.guest_email)) {
			return json({ error: "Invalid email format" }, 400);
		}

		const booking = await createBooking({
			db: e.DB,
			encKey: e.OAUTH_ENC_KEY,
			clientId: e.GOOGLE_OAUTH_CLIENT_ID,
			clientSecret: e.GOOGLE_OAUTH_CLIENT_SECRET,
			meetingTypeId: body.meeting_type_id,
			slotStartIso: body.slot_start_iso,
			guestName: body.guest_name,
			guestEmail: body.guest_email,
			guestAnswers: body.guest_answers ?? {},
			guestTimezone: body.guest_timezone,
		});

		const origin = new URL(request.url).origin;
		await sendConfirmationEmail({
			apiKey: e.RESEND_API_KEY,
			guestEmail: body.guest_email,
			guestName: body.guest_name,
			meetingTitle: booking.meetingTitle,
			slotStartIso: booking.slotStartIso,
			slotEndIso: booking.slotEndIso,
			guestTimezone: body.guest_timezone,
			lang: body.lang ?? "vi",
			cancelUrl: `${origin}/book/cancel/${booking.cancelToken}`,
			rescheduleUrl: `${origin}/book/reschedule/${booking.rescheduleToken}`,
		});

		return json(
			{
				booking_id: booking.bookingId,
				confirmed_url: `/book/confirmed/${booking.bookingId}`,
			},
			201,
		);
	} catch (err: any) {
		console.error("[wc/bookings/create]", err?.message ?? err, err?.stack ?? "");
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
