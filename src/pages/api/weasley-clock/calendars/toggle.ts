import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { collections } from "../../../../lib/weasley-clock/storage";
import { isAdmin, forbidden } from "../../../../lib/weasley-clock/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
	if (!isAdmin(locals)) return forbidden();

	let body: { calendar_id?: string; synced?: boolean } = {};
	try { body = await request.json(); } catch { /* noop */ }
	const { calendar_id, synced } = body;
	if (!calendar_id || typeof synced !== "boolean") {
		return new Response(
			JSON.stringify({ error: "Expected { calendar_id, synced }" }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	const c = collections((env as any).DB);
	const row = await c.oauth_calendars.get(calendar_id);
	if (!row) {
		return new Response(
			JSON.stringify({ error: "Calendar not found" }),
			{ status: 404, headers: { "Content-Type": "application/json" } },
		);
	}
	await c.oauth_calendars.put(calendar_id, { ...row.data, synced: synced ? 1 : 0 });
	return new Response(
		JSON.stringify({ ok: true }),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
};
