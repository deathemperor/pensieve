import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { collections } from "../../../../../lib/weasley-clock/storage";
import { consumeState } from "../../../../../lib/weasley-clock/oauth-state";
import { encryptToken } from "../../../../../lib/weasley-clock/crypto";
import { verifyGoogleIdToken } from "../../../../../lib/weasley-clock/jwt";

export const prerender = false;

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDARLIST_URL = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

function redirect(url: string): Response {
	return new Response(null, { status: 302, headers: { Location: url } });
}

function errorJson(message: string, status = 400): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

export const GET: APIRoute = async ({ request }) => {
	// Wrap everything in a try/catch so the handler *always* returns a Response.
	// If we let an exception bubble, Astro's Cloudflare adapter re-invokes the
	// handler — the second run can't find the just-consumed state and returns
	// "Invalid or expired state", which is what the user saw.
	try {
		return await handleCallback(request);
	} catch (err: any) {
		console.error(`[wc-oauth/callback] UNCAUGHT:`, err?.message ?? err, err?.stack ?? "");
		return errorJson(`callback threw: ${err?.message ?? String(err)}`, 500);
	}
};

async function handleCallback(request: Request): Promise<Response> {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	const errorParam = url.searchParams.get("error");

	if (errorParam) {
		return redirect(`/_emdash/admin/plugins/weasley-clock?error=${encodeURIComponent(errorParam)}`);
	}
	if (!code || !state) {
		return errorJson("Missing code or state");
	}

	const db = (env as any).DB;
	console.log(`[wc-oauth/callback] state=${state} code=${code ? "present" : "missing"} db=${db ? "present" : "MISSING"}`);
	const c = collections(db);

	try {
		const probe = await c.oauth_state.get(state);
		console.log(`[wc-oauth/callback] probe: ${probe ? `FOUND expires_at=${probe.data.expires_at}` : "NOT IN D1"}`);
	} catch (err: any) {
		console.error(`[wc-oauth/callback] probe threw:`, err?.message ?? err);
	}

	const stateRow = await consumeState(c.oauth_state, state);
	console.log(`[wc-oauth/callback] consumeState → ${stateRow ? "ok" : "null (not-found-or-expired)"}`);
	if (!stateRow) {
		return errorJson("Invalid or expired state — please retry");
	}

	const clientId = (env as any).GOOGLE_OAUTH_CLIENT_ID;
	const clientSecret = (env as any).GOOGLE_OAUTH_CLIENT_SECRET;
	const encKey = (env as any).OAUTH_ENC_KEY;
	console.log(`[wc-oauth/callback] env check: clientId=${!!clientId} clientSecret=${!!clientSecret} encKey=${!!encKey}`);
	if (!clientId || !clientSecret || !encKey) {
		return errorJson("OAuth not fully configured", 500);
	}

	console.log(`[wc-oauth/callback] exchanging code for tokens`);
	const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			client_id: clientId,
			client_secret: clientSecret,
			redirect_uri: `${url.origin}/api/weasley-clock/oauth/google/callback`,
		}),
	});
	console.log(`[wc-oauth/callback] token exchange status=${tokenRes.status}`);
	if (!tokenRes.ok) {
		const text = await tokenRes.text();
		console.error(`[wc-oauth/callback] token exchange failed ${tokenRes.status}: ${text}`);
		return errorJson("Token exchange failed", 502);
	}
	const tokens = (await tokenRes.json()) as {
		access_token: string;
		refresh_token?: string;
		expires_in: number;
		id_token: string;
		scope: string;
	};
	console.log(`[wc-oauth/callback] tokens: scope=${tokens.scope} hasRefresh=${!!tokens.refresh_token} expiresIn=${tokens.expires_in}`);

	if (!tokens.scope.split(/\s+/).includes(SCOPE)) {
		return errorJson("Required calendar read access was not granted. Please accept all requested scopes.");
	}
	if (!tokens.refresh_token) {
		return errorJson("Google did not return a refresh_token — please revoke access in your Google account settings and try again");
	}

	console.log(`[wc-oauth/callback] verifying id_token`);
	const idPayload = await verifyGoogleIdToken(tokens.id_token, clientId);
	console.log(`[wc-oauth/callback] id_token ok — email=${idPayload.email}`);

	console.log(`[wc-oauth/callback] encrypting tokens`);
	const accessEnc = await encryptToken(tokens.access_token, encKey);
	const refreshEnc = await encryptToken(tokens.refresh_token, encKey);
	console.log(`[wc-oauth/callback] tokens encrypted`);

	console.log(`[wc-oauth/callback] listing existing oauth_accounts`);
	const existing = (await c.oauth_accounts.list())
		.find((r) => r.data.provider === "google" && r.data.account_email === idPayload.email);

	const now = new Date().toISOString();
	const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
	const accountId = existing?.id ?? "acc_" + state.slice(0, 16).toLowerCase();
	console.log(`[wc-oauth/callback] upserting account ${accountId} (existing=${!!existing})`);

	await c.oauth_accounts.put(accountId, {
		provider: "google",
		account_email: idPayload.email,
		display_name: idPayload.name ?? null,
		access_token_enc: accessEnc.ciphertext_b64,
		access_token_iv: accessEnc.iv_b64,
		refresh_token_enc: refreshEnc.ciphertext_b64,
		refresh_token_iv: refreshEnc.iv_b64,
		access_token_expires_at: expiresAt,
		scope: tokens.scope,
		status: "active",
		last_sync_error: null,
		connected_at: existing?.data.connected_at ?? now,
		last_synced_at: existing?.data.last_synced_at ?? null,
		revoked_at: null,
	});
	console.log(`[wc-oauth/callback] account upserted`);

	try {
		const res = await fetch(GOOGLE_CALENDARLIST_URL, {
			headers: { Authorization: `Bearer ${tokens.access_token}` },
		});
		console.log(`[wc-oauth/callback] calendarList status=${res.status}`);
		if (res.ok) {
			const data = (await res.json()) as { items: any[] };
			for (const cal of data.items ?? []) {
				const id = `cal_${accountId}_${btoa(cal.id).replace(/[^a-zA-Z0-9]/g, "").slice(0, 32)}`;
				await c.oauth_calendars.put(id, {
					account_id: accountId,
					calendar_id: cal.id,
					summary: cal.summary ?? cal.summaryOverride ?? cal.id,
					time_zone: cal.timeZone ?? null,
					background_color: cal.backgroundColor ?? null,
					access_role: cal.accessRole ?? null,
					synced: 0,
					sync_token: null,
					last_resynced_at: null,
					expose_titles: 1,
				});
			}
			console.log(`[wc-oauth/callback] calendars upserted count=${data.items?.length ?? 0}`);
		} else {
			console.error(`[weasley-clock] discoverCalendars failed: ${res.status}`);
		}
	} catch (err: any) {
		console.error(`[weasley-clock] discoverCalendars exception:`, err?.message ?? err);
	}

	console.log(`[wc-oauth/callback] redirecting to ${stateRow.return_url || "/_emdash/admin/plugins/weasley-clock"}`);
	return redirect(stateRow.return_url || "/_emdash/admin/plugins/weasley-clock");
}
