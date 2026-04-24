export interface GoogleIdTokenPayload {
	iss: string;
	aud: string;
	email: string;
	email_verified?: boolean;
	name?: string;
	sub: string;
	iat: number;
	exp: number;
}

export interface VerifyOptions {
	// If supplied, use this JWKS instead of fetching from Google. For testing.
	jwks?: { keys: any[] };
	// Override current time (seconds since epoch). For testing.
	now?: number;
}

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const VALID_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

// Module-level cache for Google's JWKS. Google rotates keys every ~1-2 days;
// we refresh after 1h fallback. Force-refresh on kid miss as a safety net.
let cachedJwks: { keys: any[]; fetchedAt: number } | null = null;

async function getJwks(force = false): Promise<{ keys: any[] }> {
	const MAX_AGE_MS = 60 * 60 * 1000;
	if (!force && cachedJwks && Date.now() - cachedJwks.fetchedAt < MAX_AGE_MS) {
		return { keys: cachedJwks.keys };
	}
	const res = await fetch(GOOGLE_JWKS_URL);
	if (!res.ok) throw new Error(`Failed to fetch Google JWKS: ${res.status}`);
	const data = (await res.json()) as { keys: any[] };
	cachedJwks = { keys: data.keys, fetchedAt: Date.now() };
	return data;
}

function b64urlDecode(s: string): Uint8Array {
	const pad = "=".repeat((4 - (s.length % 4)) % 4);
	const bin = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

async function importJwk(jwk: JsonWebKey): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		"jwk",
		jwk,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["verify"],
	);
}

export async function verifyGoogleIdToken(
	token: string,
	expectedAud: string,
	opts: VerifyOptions = {},
): Promise<GoogleIdTokenPayload> {
	const [headerB64, payloadB64, signatureB64] = token.split(".");
	if (!headerB64 || !payloadB64 || !signatureB64) {
		throw new Error("Malformed JWT: expected 3 dot-separated segments");
	}

	const header = JSON.parse(new TextDecoder().decode(b64urlDecode(headerB64)));
	const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64))) as GoogleIdTokenPayload;
	const signature = b64urlDecode(signatureB64);

	if (header.alg !== "RS256") throw new Error(`Unsupported JWT alg: ${header.alg}`);
	if (!header.kid) throw new Error("JWT missing kid");

	const jwks = opts.jwks ?? (await getJwks());
	const jwk = jwks.keys.find((k: any) => k.kid === header.kid);
	if (!jwk) {
		// Maybe our cache is stale — force-refresh once
		if (!opts.jwks) {
			const fresh = await getJwks(true);
			const jwk2 = fresh.keys.find((k: any) => k.kid === header.kid);
			if (!jwk2) throw new Error(`JWT kid ${header.kid} not found in JWKS`);
			return verifyWithKey(jwk2, headerB64, payloadB64, signature, payload, expectedAud, opts.now);
		}
		throw new Error(`JWT kid ${header.kid} not found in JWKS`);
	}

	return verifyWithKey(jwk, headerB64, payloadB64, signature, payload, expectedAud, opts.now);
}

async function verifyWithKey(
	jwk: JsonWebKey,
	headerB64: string,
	payloadB64: string,
	signature: Uint8Array,
	payload: GoogleIdTokenPayload,
	expectedAud: string,
	nowOverride?: number,
): Promise<GoogleIdTokenPayload> {
	const key = await importJwk(jwk);
	const signed = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
	const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature as BufferSource, signed as BufferSource);
	if (!valid) throw new Error("JWT signature verification failed");

	const now = nowOverride ?? Math.floor(Date.now() / 1000);
	if (payload.exp < now) throw new Error("JWT expired");
	if (payload.iat > now + 300) throw new Error("JWT iat too far in future");
	if (!VALID_ISSUERS.includes(payload.iss)) throw new Error(`Invalid issuer: ${payload.iss}`);
	if (payload.aud !== expectedAud) throw new Error(`Invalid audience: ${payload.aud}`);

	return payload;
}
