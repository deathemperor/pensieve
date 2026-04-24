import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { collections } from "../../../../../lib/weasley-clock/storage";
import { generateState } from "../../../../../lib/weasley-clock/oauth-state";
import { isAdmin, forbidden } from "../../../../../lib/weasley-clock/auth";

export const prerender = false;

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

export const POST: APIRoute = async ({ request, locals }) => {
	if (!isAdmin(locals)) return forbidden();

	const clientId = (env as any).GOOGLE_OAUTH_CLIENT_ID as string | undefined;
	if (!clientId) {
		return new Response(
			JSON.stringify({ error: "GOOGLE_OAUTH_CLIENT_ID not configured" }),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}

	let body: { return_url?: string } = {};
	try { body = await request.json(); } catch { /* empty body is fine */ }
	const returnUrl = typeof body.return_url === "string"
		? body.return_url
		: "/_emdash/admin/plugins/weasley-clock";

	const db = (env as any).DB;
	console.log(`[wc-oauth/initiate] db binding:`, typeof db, db ? "present" : "MISSING");
	const c = collections(db);
	let state: string;
	try {
		state = await generateState(c.oauth_state, { returnUrl });
		console.log(`[wc-oauth/initiate] state=${state} returnUrl=${returnUrl}`);
	} catch (err: any) {
		console.error(`[wc-oauth/initiate] generateState THREW:`, err?.message ?? err, err?.stack ?? "");
		return new Response(
			JSON.stringify({ error: "generateState failed", detail: err?.message ?? String(err) }),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}

	// Verify the write actually landed by reading it back.
	try {
		const verify = await c.oauth_state.get(state);
		console.log(`[wc-oauth/initiate] readback after put: ${verify ? "FOUND" : "MISSING"}`);
	} catch (err: any) {
		console.error(`[wc-oauth/initiate] readback threw:`, err?.message ?? err);
	}

	const origin = new URL(request.url).origin;
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: `${origin}/api/weasley-clock/oauth/google/callback`,
		response_type: "code",
		scope: SCOPE,
		access_type: "offline",
		prompt: "consent",
		state,
	});

	return new Response(
		JSON.stringify({ redirect: `${GOOGLE_AUTH_URL}?${params.toString()}` }),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
};
