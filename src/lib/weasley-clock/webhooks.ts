import type { D1Database } from "@cloudflare/workers-types";
import { collections } from "./storage";

export type WebhookEvent = "booking.created" | "booking.cancelled" | "booking.rescheduled";

export interface DispatchInput {
	db: D1Database;
	event: WebhookEvent;
	data: Record<string, unknown>;
}

export async function dispatchWebhook(input: DispatchInput): Promise<void> {
	try {
		const c = collections(input.db);
		const all = await c.webhook_endpoints.list();
		const targets = all.filter(
			(r) => r.data.active && r.data.events.includes(input.event),
		);
		if (targets.length === 0) return;

		const payload = JSON.stringify({
			event: input.event,
			timestamp: new Date().toISOString(),
			data: input.data,
		});

		// Fire all in parallel; collect results to update last_status / last_error.
		await Promise.allSettled(
			targets.map(async (t) => {
				try {
					const sig = await sign(t.data.secret, payload);
					const res = await fetch(t.data.url, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-WC-Signature": `sha256=${sig}`,
							"X-WC-Event": input.event,
						},
						body: payload,
					});
					await c.webhook_endpoints.put(t.id, {
						...t.data,
						last_dispatched_at: new Date().toISOString(),
						last_status: res.status,
						last_error: res.ok ? null : `HTTP ${res.status}`,
					});
				} catch (err: any) {
					await c.webhook_endpoints.put(t.id, {
						...t.data,
						last_dispatched_at: new Date().toISOString(),
						last_status: 0,
						last_error: err?.message ?? String(err),
					}).catch(() => undefined);
				}
			}),
		);
	} catch (err: any) {
		// Webhook dispatch is fire-and-forget — never block booking flow.
		console.error("[webhooks] dispatch exception:", err?.message ?? err);
	}
}

async function sign(secret: string, body: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
	return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
