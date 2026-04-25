import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { D1Database } from "@cloudflare/workers-types";
import { getEmDashCollection } from "emdash";
import { collections } from "../../../../lib/weasley-clock/storage";
import { computeSlots, type Slot } from "../../../../lib/weasley-clock/availability";
import { buildBusyWindowsForHost, unionSlots } from "../../../../lib/weasley-clock/multi-host";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	// IMPORTANT: wrap the entire handler body in try/catch so any uncaught
	// exception returns a real 500 Response. If we let it bubble, Astro's
	// Cloudflare adapter re-invokes the handler (learned from the OAuth
	// callback bug). The try/catch is a defensive pattern, not optional.
	try {
		const body = (await request.json()) as {
			meeting_type_id: string;
			range_start_iso: string;
			range_end_iso: string;
			guest_timezone?: string;
		};
		if (!body.meeting_type_id || !body.range_start_iso || !body.range_end_iso) {
			return json({ error: "Missing required fields" }, 400);
		}

		const db = (env as any).DB as D1Database;
		const c = collections(db);

		// 1) Load meeting type from EmDash content.
		const { entries: meetingTypes } = await getEmDashCollection("meeting_types");
		const mt = meetingTypes.find((e: any) => e.id === body.meeting_type_id) as any;
		if (!mt) return json({ error: "Meeting type not found" }, 404);

		// 2) Host accounts — host_account_ids is a JSON string array.
		let hostIds: string[] = [];
		try { hostIds = JSON.parse(mt.data?.host_account_ids || mt.host_account_ids || "[]"); } catch { hostIds = []; }
		if (hostIds.length === 0) return json({ error: "No host configured for this meeting type" }, 500);

		// 3) Availability rule — default if not specified.
		const availId = mt.data?.availability_id || mt.availability_id || "default";
		const ruleRow = await c.availability_rules.get(availId);
		if (!ruleRow) return json({ error: `Availability rule "${availId}" not found` }, 500);

		// 4) Build busy windows + compute slots per host; merge into union.
		const durationMin = Number(mt.data?.duration_min ?? mt.duration_min ?? 30);
		const slotsByHost: Record<string, Slot[]> = {};
		for (const hostId of hostIds) {
			const busyWindows = await buildBusyWindowsForHost(db, hostId);
			slotsByHost[hostId] = computeSlots({
				rule: ruleRow.data,
				busyWindows,
				durationMin,
				bufferBeforeMin: Number(mt.data?.buffer_before ?? mt.buffer_before ?? 0),
				bufferAfterMin: Number(mt.data?.buffer_after ?? mt.buffer_after ?? 0),
				minNoticeHrs: Number(mt.data?.min_notice_hrs ?? mt.min_notice_hrs ?? 2),
				maxAdvanceDays: Number(mt.data?.max_advance_days ?? mt.max_advance_days ?? 60),
				rangeStartIso: body.range_start_iso,
				rangeEndIso: body.range_end_iso,
				nowIso: new Date().toISOString(),
			});
		}

		const slots = unionSlots(slotsByHost);
		// host_id kept for backward-compat with the slot picker; round-robin assignment
		// happens at booking-create time, not here.
		return json({ slots, host_id: hostIds[0], timezone: ruleRow.data.timezone });
	} catch (err: any) {
		console.error("[wc/bookings/slots]", err?.message ?? err, err?.stack ?? "");
		return json({ error: err?.message ?? "Internal error" }, 500);
	}
};

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}
