import { test, before } from "node:test";
import assert from "node:assert/strict";
import { verifyGoogleIdToken } from "../src/lib/jwt";
import { generateTestKey, type TestKey } from "./jwt-test-helpers";

const TEST_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
let key: TestKey;
let jwks: { keys: any[] };
let validToken: string;
let expiredToken: string;
let wrongIssToken: string;

before(async () => {
	key = await generateTestKey();
	jwks = { keys: [key.publicJwk] };
	const now = Math.floor(Date.now() / 1000);
	validToken = await key.sign({
		iss: "https://accounts.google.com",
		aud: TEST_CLIENT_ID,
		email: "loc@example.com",
		email_verified: true,
		name: "Loc Truong",
		sub: "1234567890",
		iat: now,
		exp: now + 3600,
	});
	expiredToken = await key.sign({
		iss: "https://accounts.google.com",
		aud: TEST_CLIENT_ID,
		email: "loc@example.com",
		sub: "1234567890",
		iat: now - 7200,
		exp: now - 3600,
	});
	wrongIssToken = await key.sign({
		iss: "https://evil.com",
		aud: TEST_CLIENT_ID,
		email: "loc@example.com",
		sub: "1234567890",
		iat: now,
		exp: now + 3600,
	});
});

test("verifyGoogleIdToken: accepts a valid signed token with matching aud", async () => {
	const payload = await verifyGoogleIdToken(validToken, TEST_CLIENT_ID, { jwks });
	assert.equal(payload.email, "loc@example.com");
	assert.equal(payload.aud, TEST_CLIENT_ID);
	assert.ok(payload.exp > Date.now() / 1000);
});

test("verifyGoogleIdToken: rejects token with wrong audience", async () => {
	await assert.rejects(
		() => verifyGoogleIdToken(validToken, "wrong-client-id", { jwks }),
		/audience/i,
	);
});

test("verifyGoogleIdToken: rejects tampered signature", async () => {
	const tampered = validToken.slice(0, -4) + "XXXX";
	await assert.rejects(() => verifyGoogleIdToken(tampered, TEST_CLIENT_ID, { jwks }));
});

test("verifyGoogleIdToken: rejects expired token", async () => {
	await assert.rejects(
		() => verifyGoogleIdToken(expiredToken, TEST_CLIENT_ID, { jwks }),
		/expired/i,
	);
});

test("verifyGoogleIdToken: rejects wrong issuer", async () => {
	await assert.rejects(
		() => verifyGoogleIdToken(wrongIssToken, TEST_CLIENT_ID, { jwks }),
		/issuer/i,
	);
});
