// Generates RS256-signed JWTs + matching JWKS for use in tests.
// Not used at runtime — only imported by jwt.test.ts.

import { subtle } from "node:crypto";

export interface TestKey {
	publicJwk: JsonWebKey & { kid: string; use: string; alg: string };
	sign(payload: Record<string, unknown>): Promise<string>;
}

export async function generateTestKey(kid = "test-kid-1"): Promise<TestKey> {
	const keyPair = await subtle.generateKey(
		{ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
		true,
		["sign", "verify"],
	);
	const pubJwk = await subtle.exportKey("jwk", keyPair.publicKey);
	const publicJwk = { ...pubJwk, kid, use: "sig", alg: "RS256" } as any;
	return {
		publicJwk,
		async sign(payload: Record<string, unknown>): Promise<string> {
			const header = { alg: "RS256", kid, typ: "JWT" };
			const enc = (obj: object) => btoa(JSON.stringify(obj)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
			const unsigned = `${enc(header)}.${enc(payload)}`;
			const sig = await subtle.sign("RSASSA-PKCS1-v1_5", keyPair.privateKey, new TextEncoder().encode(unsigned));
			const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
			return `${unsigned}.${sigB64}`;
		},
	};
}
