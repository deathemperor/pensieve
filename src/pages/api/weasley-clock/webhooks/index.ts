import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { isAdmin, forbidden } from "../../../../lib/weasley-clock/auth";
import { collections } from "../../../../lib/weasley-clock/storage";
import { ulid } from "../../../../lib/portraits/ulid";

export const prerender = false;

const ALLOWED_EVENTS = ["booking.created", "booking.cancelled", "booking.rescheduled"];
const SECRET_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function generateSecret(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	let out = "";
	for (let i = 0; i < bytes.length; i++) out += SECRET_ALPHABET[bytes[i] % 32];
	return out;
}

export const GET: APIRoute = async ({ locals }) => {
	if (!isAdmin(locals)) return forbidden();
	try {
		const c = collections((env as any).DB);
		const all = await c.webhook_endpoints.list();
		const endpoints = all.map((r) => ({
			id: r.id,
			url: r.data.url,
			events: r.data.events,
			active: r.data.active,
			created_at: r.data.created_at,
			last_dispatched_at: r.data.last_dispatched_at,
			last_status: r.data.last_status,
			last_error: r.data.last_error,
		}));
		return json({ endpoints });
	} catch (err: any) {
		console.error("[wc/webhooks/list]", err?.message ?? err);
		return json({ error: "Internal error" }, 500);
	}
};

export const POST: APIRoute = async ({ locals, request }) => {
	if (!isAdmin(locals)) return forbidden();
	try {
		const body = (await request.json()) as { url?: string; events?: string[] };
		if (!body.url?.trim() || !/^https?:\/\//.test(body.url.trim())) {
			return json({ error: "valid url (http(s)://) required" }, 400);
		}
		if (!Array.isArray(body.events) || body.events.length === 0) {
			return json({ error: "events required" }, 400);
		}
		const events = body.events.filter((e) => ALLOWED_EVENTS.includes(e));
		if (events.length === 0) return json({ error: "no valid events provided" }, 400);

		const id = "wh_" + ulid();
		const secret = generateSecret();
		const c = collections((env as any).DB);
		await c.webhook_endpoints.put(id, {
			url: body.url.trim(),
			events,
			secret,
			active: true,
			created_at: new Date().toISOString(),
			last_dispatched_at: null,
			last_status: null,
			last_error: null,
		});
		return json({ id, secret }, 201);
	} catch (err: any) {
		console.error("[wc/webhooks/create]", err?.message ?? err);
		return json({ error: "Internal error" }, 500);
	}
};

function json(b: unknown, s = 200): Response {
	return new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
}
