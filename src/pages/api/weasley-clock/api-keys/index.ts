import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { isAdmin, forbidden } from "../../../../lib/weasley-clock/auth";
import { collections } from "../../../../lib/weasley-clock/storage";
import { generateApiKey } from "../../../../lib/weasley-clock/api-keys";
import { ulid } from "../../../../lib/portraits/ulid";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
	if (!isAdmin(locals)) return forbidden();
	const c = collections((env as any).DB);
	const all = await c.api_keys.list();
	const keys = all.map((r) => ({
		id: r.id,
		label: r.data.label,
		scopes: r.data.scopes,
		created_at: r.data.created_at,
		last_used_at: r.data.last_used_at,
		revoked_at: r.data.revoked_at,
		// hash NEVER exposed
	}));
	return new Response(JSON.stringify({ keys }), { status: 200, headers: { "Content-Type": "application/json" } });
};

export const POST: APIRoute = async ({ locals, request }) => {
	if (!isAdmin(locals)) return forbidden();
	try {
		const body = await request.json() as { label: string; scopes: string[] };
		if (!body.label?.trim()) return json({ error: "label required" }, 400);
		if (!Array.isArray(body.scopes) || body.scopes.length === 0) return json({ error: "scopes required" }, 400);

		const { raw, hash } = await generateApiKey();
		const id = "ak_" + ulid();
		const c = collections((env as any).DB);
		await c.api_keys.put(id, {
			label: body.label.trim(),
			hash,
			scopes: body.scopes,
			created_at: new Date().toISOString(),
			last_used_at: null,
			revoked_at: null,
		});
		return json({ id, raw }, 201); // raw shown ONCE
	} catch (err: any) {
		console.error("[wc/api-keys/create]", err?.message ?? err);
		return json({ error: "Internal error" }, 500);
	}
};

function json(b: unknown, s = 200): Response {
	return new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
}
