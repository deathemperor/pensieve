import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { verifyApiKey } from "../../../../lib/weasley-clock/api-keys";
import { collections } from "../../../../lib/weasley-clock/storage";
import { getEmDashCollection } from "emdash";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
	try {
		// Auth
		const auth = request.headers.get("authorization") ?? "";
		const m = auth.match(/^Bearer\s+(.+)$/i);
		if (!m) return json({ error: "Missing Bearer token" }, 401);
		const verifyResult = await verifyApiKey((env as any).DB, m[1], "bookings:read");
		if (!verifyResult.ok) return json({ error: `Auth failed: ${(verifyResult as any).reason}` }, 401);

		// Filters
		const url = new URL(request.url);
		const audience = url.searchParams.get("audience"); // optional
		const status = url.searchParams.get("status") ?? "confirmed";
		const fromIso = url.searchParams.get("from");
		const toIso = url.searchParams.get("to");

		const c = collections((env as any).DB);
		const all = await c.bookings.list();

		// If audience filter set, look up meeting types and filter by audience_tags
		let mtAllowed: Set<string> | null = null;
		if (audience) {
			const { entries: mts } = await getEmDashCollection("meeting_types");
			const allowed: string[] = [];
			for (const e of mts ?? []) {
				const tags = (e as any).data?.audience_tags ?? (e as any).audience_tags;
				let parsed: string[] = [];
				try { parsed = typeof tags === "string" ? JSON.parse(tags) : (Array.isArray(tags) ? tags : []); } catch { parsed = []; }
				if (parsed.includes(audience)) allowed.push(e.id);
			}
			mtAllowed = new Set(allowed);
		}

		const fromMs = fromIso ? new Date(fromIso).getTime() : -Infinity;
		const toMs = toIso ? new Date(toIso).getTime() : Infinity;

		const matched = all
			.filter((r) => r.data.status === status)
			.filter((r) => !mtAllowed || mtAllowed.has(r.data.meeting_type_id))
			.filter((r) => {
				const t = new Date(r.data.slot_start_iso).getTime();
				return t >= fromMs && t <= toMs;
			})
			.map((r) => ({
				id: r.id,
				meeting_type_id: r.data.meeting_type_id,
				slot_start_iso: r.data.slot_start_iso,
				slot_end_iso: r.data.slot_end_iso,
				timezone: r.data.timezone,
				guest_name: r.data.guest_name,
				guest_email: r.data.guest_email,
				status: r.data.status,
				created_at: r.data.created_at,
				cancelled_at: r.data.cancelled_at,
			}));

		return json({ bookings: matched, count: matched.length });
	} catch (err: any) {
		console.error("[wc/public/bookings]", err?.message ?? err);
		return json({ error: "Internal error" }, 500);
	}
};

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
