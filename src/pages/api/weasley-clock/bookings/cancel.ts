import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { cancelBooking } from "../../../../lib/weasley-clock/booking-cancel";
import { sendCancellationEmail } from "../../../../lib/weasley-clock/email";
import { BookingError } from "../../../../lib/weasley-clock/booking-create";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	try {
		const body = (await request.json()) as { cancel_token: string; lang?: "vi" | "en" };
		if (!body.cancel_token || typeof body.cancel_token !== "string") {
			return json({ error: "cancel_token required" }, 400);
		}

		const result = await cancelBooking({
			db: (env as any).DB,
			encKey: (env as any).OAUTH_ENC_KEY,
			clientId: (env as any).GOOGLE_OAUTH_CLIENT_ID,
			clientSecret: (env as any).GOOGLE_OAUTH_CLIENT_SECRET,
			cancelToken: body.cancel_token,
		});

		// Send cancellation email — non-fatal, only if not already cancelled
		// (avoid duplicate emails if guest clicks confirm twice).
		if (!result.wasAlreadyCancelled) {
			try {
				await sendCancellationEmail({
					apiKey: (env as any).RESEND_API_KEY,
					guestEmail: result.guestEmail,
					guestName: result.guestName,
					meetingTitle: result.meetingTitle,
					slotStartIso: result.slotStartIso,
					guestTimezone: result.timezone,
					lang: body.lang ?? "vi",
				});
			} catch (err: any) {
				console.error("[wc/cancel] email send failed:", err?.message ?? err);
			}
		}

		return json({
			booking_id: result.bookingId,
			already_cancelled: result.wasAlreadyCancelled,
		});
	} catch (err: any) {
		console.error("[wc/cancel]", err?.message ?? err, err?.stack ?? "");
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
	return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
