import { test } from "node:test";
import assert from "node:assert/strict";
import { encryptToken, decryptToken, type EncryptedToken } from "../src/lib/crypto";

const TEST_KEY_B64 = "XjwK/3ucADAnw/Nx+FSnsC7Ra/x6O/bQlcJo3RGA9qs=";

test("encrypt + decrypt round-trips an access token", async () => {
	const plaintext = "FIXTURE_TOKEN_DO_NOT_USE_1234567890abcdefghij";
	const enc = await encryptToken(plaintext, TEST_KEY_B64);
	const dec = await decryptToken(enc, TEST_KEY_B64);
	assert.equal(dec, plaintext);
});

test("encryption produces different ciphertext every time (random IV)", async () => {
	const plaintext = "refresh-token-x";
	const a = await encryptToken(plaintext, TEST_KEY_B64);
	const b = await encryptToken(plaintext, TEST_KEY_B64);
	assert.notEqual(a.ciphertext_b64, b.ciphertext_b64);
	assert.notEqual(a.iv_b64, b.iv_b64);
});

test("decryption with wrong key fails (doesn't return garbage)", async () => {
	const plaintext = "secret";
	const enc = await encryptToken(plaintext, TEST_KEY_B64);
	const WRONG_KEY = "A".repeat(44);
	await assert.rejects(() => decryptToken(enc, WRONG_KEY));
});

test("tampered ciphertext is detected (AES-GCM authenticated)", async () => {
	const enc = await encryptToken("secret", TEST_KEY_B64);
	const tampered: EncryptedToken = {
		...enc,
		ciphertext_b64: enc.ciphertext_b64.slice(0, -4) + "XXXX",
	};
	await assert.rejects(() => decryptToken(tampered, TEST_KEY_B64));
});

test("empty string round-trips", async () => {
	const enc = await encryptToken("", TEST_KEY_B64);
	const dec = await decryptToken(enc, TEST_KEY_B64);
	assert.equal(dec, "");
});

test("unicode round-trips (Vietnamese diacritics)", async () => {
	const plaintext = "Đồng hồ Weasley · Giỗ Ông Nội";
	const enc = await encryptToken(plaintext, TEST_KEY_B64);
	const dec = await decryptToken(enc, TEST_KEY_B64);
	assert.equal(dec, plaintext);
});
