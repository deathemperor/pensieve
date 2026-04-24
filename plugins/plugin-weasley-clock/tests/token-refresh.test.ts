import { test } from "node:test";
import assert from "node:assert/strict";
import { ensureFreshAccessToken, type OAuthAccountRow } from "../src/lib/token-refresh";
import { encryptToken } from "../src/lib/crypto";

const TEST_KEY_B64 = "XjwK/3ucADAnw/Nx+FSnsC7Ra/x6O/bQlcJo3RGA9qs=";
const CLIENT_ID = "cid.apps.googleusercontent.com";
const CLIENT_SECRET = "test-secret";

async function makeRow(access: string, refresh: string, expiresInSec: number): Promise<OAuthAccountRow> {
	const a = await encryptToken(access, TEST_KEY_B64);
	const r = await encryptToken(refresh, TEST_KEY_B64);
	return {
		id: "acc_test",
		provider: "google",
		account_email: "t@example.com",
		access_token_enc: a.ciphertext_b64,
		access_token_iv: a.iv_b64,
		refresh_token_enc: r.ciphertext_b64,
		refresh_token_iv: r.iv_b64,
		access_token_expires_at: new Date(Date.now() + expiresInSec * 1000).toISOString(),
		scope: "https://www.googleapis.com/auth/calendar.readonly",
		status: "active",
	};
}

test("returns existing token when not expired (> 60s remaining)", async () => {
	const row = await makeRow("FAKE_ACCESS_FRESH", "FAKE_REFRESH", 3600);
	let fetchCalled = 0;
	const { access_token, refreshed } = await ensureFreshAccessToken(row, {
		encKey: TEST_KEY_B64,
		clientId: CLIENT_ID,
		clientSecret: CLIENT_SECRET,
		fetchImpl: async () => { fetchCalled++; throw new Error("should not be called"); },
	});
	assert.equal(access_token, "FAKE_ACCESS_FRESH");
	assert.equal(refreshed, false);
	assert.equal(fetchCalled, 0);
});

test("refreshes when < 60s remaining; returns new token + new encrypted fields", async () => {
	const row = await makeRow("FAKE_ACCESS_OLD", "FAKE_REFRESH", 30);
	const { access_token, refreshed, updatedRow } = await ensureFreshAccessToken(row, {
		encKey: TEST_KEY_B64,
		clientId: CLIENT_ID,
		clientSecret: CLIENT_SECRET,
		fetchImpl: async () => new Response(
			JSON.stringify({ access_token: "FAKE_ACCESS_NEW", expires_in: 3600, scope: row.scope, token_type: "Bearer" }),
			{ status: 200, headers: { "content-type": "application/json" } },
		),
	});
	assert.equal(access_token, "FAKE_ACCESS_NEW");
	assert.equal(refreshed, true);
	assert.ok(updatedRow);
	assert.notEqual(updatedRow!.access_token_enc, row.access_token_enc);
	assert.notEqual(updatedRow!.access_token_iv, row.access_token_iv);
	assert.ok(new Date(updatedRow!.access_token_expires_at).getTime() > Date.now() + 60 * 60 * 1000 - 5000);
});

test("propagates invalid_grant — caller should mark account revoked", async () => {
	const row = await makeRow("FAKE_ACCESS_OLD", "FAKE_REVOKED", 10);
	await assert.rejects(
		() => ensureFreshAccessToken(row, {
			encKey: TEST_KEY_B64,
			clientId: CLIENT_ID,
			clientSecret: CLIENT_SECRET,
			fetchImpl: async () => new Response(
				JSON.stringify({ error: "invalid_grant", error_description: "Token has been expired or revoked." }),
				{ status: 400, headers: { "content-type": "application/json" } },
			),
		}),
		(err: Error) => /invalid_grant/i.test(err.message),
	);
});

test("retries transient 5xx once, then propagates on second failure", async () => {
	const row = await makeRow("FAKE_ACCESS_OLD", "FAKE_REFRESH", 10);
	let n = 0;
	await assert.rejects(
		() => ensureFreshAccessToken(row, {
			encKey: TEST_KEY_B64,
			clientId: CLIENT_ID,
			clientSecret: CLIENT_SECRET,
			fetchImpl: async () => { n++; return new Response("gateway", { status: 502 }); },
		}),
		(err: Error) => /502|refresh failed/i.test(err.message),
	);
	assert.equal(n, 2, "expected one retry before giving up");
});
