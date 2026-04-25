import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { isAdmin, forbidden } from "../../../../lib/weasley-clock/auth";
import { collections } from "../../../../lib/weasley-clock/storage";

export const prerender = false;

const SECRET_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function generateSecret(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	let out = "";
	for (let i = 0; i < bytes.length; i++) out += SECRET_ALPHABET[bytes[i] % 32];
	return out;
}

export const PATCH: APIRoute = async ({ locals, params, request }) => {
	if (!isAdmin(locals)) return forbidden();
	if (!params.id) return j({ error: "id required" }, 400);
	try {
		const body = (await request.json()) as { active?: boolean; rotate_secret?: boolean };
		const c = collections((env as any).DB);
		const row = await c.webhook_endpoints.get(params.id);
		if (!row) return j({ error: "Not found" }, 404);
		const updated = { ...row.data };
		if (typeof body.active === "boolean") updated.active = body.active;
		let newSecret: string | undefined;
		if (body.rotate_secret) {
			newSecret = generateSecret();
			updated.secret = newSecret;
		}
		await c.webhook_endpoints.put(params.id, updated);
		return j({ id: params.id, ...(newSecret ? { secret: newSecret } : {}) });
	} catch (err: any) {
		console.error("[wc/webhooks/patch]", err?.message ?? err);
		return j({ error: "Internal error" }, 500);
	}
};

export const DELETE: APIRoute = async ({ locals, params }) => {
	if (!isAdmin(locals)) return forbidden();
	if (!params.id) return j({ error: "id required" }, 400);
	try {
		const c = collections((env as any).DB);
		const row = await c.webhook_endpoints.get(params.id);
		if (!row) return j({ error: "Not found" }, 404);
		await c.webhook_endpoints.delete(params.id);
		return j({ id: params.id, deleted: true });
	} catch (err: any) {
		console.error("[wc/webhooks/delete]", err?.message ?? err);
		return j({ error: "Internal error" }, 500);
	}
};

function j(b: unknown, s = 200): Response {
	return new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
}
