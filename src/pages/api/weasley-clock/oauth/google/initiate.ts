import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { collections } from "../../../../../lib/weasley-clock/storage";
import { generateState } from "../../../../../lib/weasley-clock/oauth-state";
import { isAdmin, forbidden } from "../../../../../lib/weasley-clock/auth";

export const prerender = false;

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
// Calendar read is the feature scope; `openid email profile` is required so
// Google issues an id_token in the token response — we verify it to obtain
// the account_email for the oauth_accounts row.
const SCOPES = [
	"https://www.googleapis.com/auth/calendar.readonly",
	"openid",
	"email",
	"profile",
];

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

	const c = collections((env as any).DB);
	const state = await generateState(c.oauth_state, { returnUrl });

	const origin = new URL(request.url).origin;
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: `${origin}/api/weasley-clock/oauth/google/callback`,
		response_type: "code",
		scope: SCOPES.join(" "),
		access_type: "offline",
		prompt: "consent",
		state,
	});

	return new Response(
		JSON.stringify({ redirect: `${GOOGLE_AUTH_URL}?${params.toString()}` }),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
};
