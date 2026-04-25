import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { isAdmin, forbidden } from "../../../../lib/weasley-clock/auth";
import { collections } from "../../../../lib/weasley-clock/storage";

export const prerender = false;

export const DELETE: APIRoute = async ({ locals, params }) => {
	if (!isAdmin(locals)) return forbidden();
	if (!params.id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { "Content-Type": "application/json" } });
	try {
		const c = collections((env as any).DB);
		const row = await c.api_keys.get(params.id);
		if (!row) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
		await c.api_keys.put(params.id, { ...row.data, revoked_at: new Date().toISOString() });
		return new Response(JSON.stringify({ id: params.id, revoked: true }), { status: 200, headers: { "Content-Type": "application/json" } });
	} catch (err: any) {
		console.error("[wc/api-keys/revoke]", err?.message ?? err);
		return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { "Content-Type": "application/json" } });
	}
};
