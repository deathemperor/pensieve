import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { syncAll } from "../../../lib/weasley-clock/sync-all";
import { isAdmin, forbidden } from "../../../lib/weasley-clock/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
	if (!isAdmin(locals)) return forbidden();

	let body: { account_id?: string } = {};
	try { body = await request.json(); } catch { /* noop */ }
	if (!body.account_id) {
		return new Response(
			JSON.stringify({ error: "Expected { account_id }" }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	const e = env as any;
	const encKey = e.OAUTH_ENC_KEY;
	const clientId = e.GOOGLE_OAUTH_CLIENT_ID;
	const clientSecret = e.GOOGLE_OAUTH_CLIENT_SECRET;
	if (!encKey || !clientId || !clientSecret) {
		return new Response(
			JSON.stringify({ error: "OAuth env not configured" }),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}

	const { summary } = await syncAll(e.DB, { encKey, clientId, clientSecret }, { accountId: body.account_id });

	return new Response(
		JSON.stringify({ ok: true, summary }),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
};
