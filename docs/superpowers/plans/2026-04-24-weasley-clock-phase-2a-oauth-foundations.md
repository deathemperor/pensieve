# Weasley Clock Phase 2a Foundations — OAuth handshake + calendar discovery

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loc can OAuth-connect one or more Google accounts, see their calendars enumerated with opt-in toggles, and have the tokens stored encrypted at rest. No event sync yet (follow-up plan).

**Architecture:** Activate the `plugin-weasley-clock` sandbox (currently scaffolded-but-unregistered) with real hooks. Four plugin storage namespaces: `oauth_accounts`, `oauth_calendars`, `oauth_state`, `synced_events` (schema only — filled by follow-up plan). Two plugin routes (`oauth/google/initiate`, `oauth/google/callback`). One admin page at `/_emdash/admin/weasley-clock/feeds`. Tokens encrypted with AES-GCM using Web Crypto and a Cloudflare secret key.

**Tech Stack:** EmDash 0.5 plugin API (ctx.storage / ctx.routes / ctx.kv), Web Crypto (AES-GCM 256-bit, Google JWT verification), Cloudflare Workers runtime, Google OAuth 2.0 Calendar API (calendar.readonly scope).

**Spec:** `docs/superpowers/specs/2026-04-23-weasley-clock-phase-2a-oauth-sync-design.md` (sections P2a.1, P2a.2, P2a.3 of the phased breakdown; Architecture; Data model; Security).

---

## File structure for Phase 2a Foundations

**Created:**
- `plugins/plugin-weasley-clock/src/lib/crypto.ts` — AES-GCM encrypt/decrypt + key material resolution
- `plugins/plugin-weasley-clock/src/lib/jwt.ts` — Google id_token signature verification (RS256 against Google's public keys)
- `plugins/plugin-weasley-clock/src/lib/oauth-state.ts` — CSRF state token generation + validation helpers
- `plugins/plugin-weasley-clock/src/admin/feeds.tsx` — plugin admin page React component
- `plugins/plugin-weasley-clock/tests/crypto.test.ts` — round-trip + tamper-detection tests
- `plugins/plugin-weasley-clock/tests/jwt.test.ts` — signature verification tests with sample Google JWK set
- `plugins/plugin-weasley-clock/tests/oauth-state.test.ts` — TTL / one-time-use tests

**Modified:**
- `plugins/plugin-weasley-clock/src/index.ts` — populate `capabilities`, `allowedHosts`, `storage`, `adminPages` in the descriptor
- `plugins/plugin-weasley-clock/src/sandbox-entry.ts` — replace the Phase 1 no-op hook with `plugin:install` (schema bootstrap) + two `routes` (oauth initiate/callback)
- `astro.config.mjs` — re-register `weasleyClockPlugin()` (was unregistered at end of Phase 1)
- `worker-configuration.d.ts` — add type for `OAUTH_ENC_KEY`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` env vars

**Operational (outside the repo):**
- Wrangler secrets: `OAUTH_ENC_KEY`, `GOOGLE_OAUTH_CLIENT_SECRET` (committed as instructions in Task 1)
- Wrangler var: `GOOGLE_OAUTH_CLIENT_ID` (non-secret)
- Google Cloud Console OAuth 2.0 client registered with callback URL `https://huuloc.com/_emdash/api/plugins/weasley-clock/oauth/google/callback`

---

## Worktree safety note (applies to every task below)

Every task runs in `/Users/deathemperor/death/pensieve/.claude/worktrees/molly` on branch `feat/weasley-clock-phase-2a-foundations` (or merge into the existing `feat/weasley-clock-phase-1` if Phase 1 hasn't merged to main yet — see Task 0).

**Every subagent dispatch MUST run first:**

```bash
pwd && git branch --show-current
```

and abort if the output doesn't match the expected path + branch. Two subagents during Phase 1 accidentally committed to `main` instead of the worktree; don't repeat that mistake. If `pwd` shows `/Users/deathemperor/death/pensieve` (main), stop and report BLOCKED immediately.

---

## Task 0: Branch setup

**Files:** none (branch ops only).

- [ ] **Step 1: Verify clean state + active branch**

```bash
cd /Users/deathemperor/death/pensieve/.claude/worktrees/molly
pwd
git branch --show-current
git status -s
```

Expected: `feat/weasley-clock-phase-1` with no uncommitted changes (the Phase 1 work).

- [ ] **Step 2: Create phase-2a branch from current HEAD**

```bash
git checkout -b feat/weasley-clock-phase-2a-foundations
```

Expected: switches to new branch. `git log --oneline -1` shows the last Phase 1 commit as the new branch's HEAD.

- [ ] **Step 3: Verify**

```bash
git branch --show-current  # should say feat/weasley-clock-phase-2a-foundations
```

No commit for this task — just a branch creation.

---

## Task 1: Secrets + env wiring

Before any code, register the secrets that the OAuth flow needs. The `wrangler secret put` commands are interactive — **you (Daisy/engineer) must run these yourself** unless you want to bail. Include the exact commands in the commit message body so there's a record.

**Files:**
- Modify: `worker-configuration.d.ts`

- [ ] **Step 1: Generate a fresh AES-GCM key (paste this into your terminal)**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Expected output: a 44-character base64 string (ends with `=`), e.g. `XjwK/3ucADAnw/Nx+FSnsC7Ra/x6O/bQlcJo3RGA9qs=`.

Save this temporarily — you'll paste it into wrangler in Step 3.

- [ ] **Step 2: Register Google OAuth client ID (not a secret)**

In Cloudflare dashboard or via wrangler, set `GOOGLE_OAUTH_CLIENT_ID` as a `vars` entry. If using `wrangler.jsonc`, add:

```jsonc
"vars": {
  "GOOGLE_OAUTH_CLIENT_ID": "<your-client-id>.apps.googleusercontent.com"
}
```

(The client ID is NOT secret — it's safe in config. Get it from Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs.)

- [ ] **Step 3: Register secrets via wrangler CLI**

```bash
wrangler secret put OAUTH_ENC_KEY
# paste the base64 string from Step 1, press Enter

wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
# paste the client secret from Google Cloud Console, press Enter
```

Confirm both commands return "✓ Success! Uploaded secret".

- [ ] **Step 4: Add the Google Cloud Console OAuth client config**

In https://console.cloud.google.com/apis/credentials:

1. Create a new OAuth 2.0 Client ID (if not already).
2. Application type: Web application.
3. Authorised redirect URIs — add BOTH:
   - `https://huuloc.com/_emdash/api/plugins/weasley-clock/oauth/google/callback` (prod)
   - `http://localhost:4321/_emdash/api/plugins/weasley-clock/oauth/google/callback` (dev)
4. Authorised JavaScript origins — add:
   - `https://huuloc.com`
   - `http://localhost:4321`
5. Enable the Google Calendar API on the project (APIs & Services → Library → search "Google Calendar API" → Enable).
6. In **OAuth consent screen**:
   - Publishing status: Testing (keep to Testing-only for now; avoids Google's verification gauntlet)
   - Test users: add `loc.truongh@gmail.com` + any other Google accounts you want to connect. Google limits unverified apps to 100 test users, which is fine for household use.
   - Scopes: add `.../auth/calendar.readonly`.

- [ ] **Step 5: Add env types**

Open `worker-configuration.d.ts`. Find the `interface Env {` block (search for `interface Env` — it already has `DB`, `HOL_DB`, `MEDIA`, `SESSION` bindings). Add these three lines inside the interface:

```ts
OAUTH_ENC_KEY: string;              // base64 AES-GCM 256-bit key
GOOGLE_OAUTH_CLIENT_ID: string;      // <id>.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET: string;  // wrangler secret
```

- [ ] **Step 6: Verify + commit**

Run `npm run typecheck`. The new env vars should now be typed; no new TS errors should appear.

```bash
git add worker-configuration.d.ts
git commit -m "feat(weasley-clock): type OAuth secrets + client ID in Env"
```

The commit body should also record what you did manually (paste into message):

```
Manual steps completed:
- wrangler secret put OAUTH_ENC_KEY           ← 32-byte base64
- wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
- wrangler.jsonc vars: GOOGLE_OAUTH_CLIENT_ID
- Google Cloud Console OAuth client registered with redirect URIs
- calendar.readonly scope added to consent screen
- loc.truongh@gmail.com added as test user
```

---

## Task 2: Token crypto module (TDD)

**Files:**
- Create: `plugins/plugin-weasley-clock/src/lib/crypto.ts`
- Create: `plugins/plugin-weasley-clock/tests/crypto.test.ts`

Pure module using Web Crypto (`crypto.subtle`) to AES-GCM encrypt/decrypt arbitrary strings with a per-call random IV. The IV is stored alongside ciphertext because it's required for decryption.

- [ ] **Step 1: Write the failing tests**

Create `plugins/plugin-weasley-clock/tests/crypto.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { encryptToken, decryptToken, type EncryptedToken } from "../src/lib/crypto";

const TEST_KEY_B64 = "XjwK/3ucADAnw/Nx+FSnsC7Ra/x6O/bQlcJo3RGA9qs=";

test("encrypt + decrypt round-trips an access token", async () => {
	const plaintext = "ya29.a0AeDClZABCD1234567890abcdefghij...";
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
```

- [ ] **Step 2: Run the failing test**

```bash
node --import tsx --test plugins/plugin-weasley-clock/tests/crypto.test.ts
```

Expected: FAIL — `encryptToken` / `decryptToken` not defined.

- [ ] **Step 3: Implement the module**

Create `plugins/plugin-weasley-clock/src/lib/crypto.ts`:

```ts
export interface EncryptedToken {
	ciphertext_b64: string;  // base64
	iv_b64: string;          // base64, 12 bytes for AES-GCM
}

// Import the base64-encoded 256-bit key as a CryptoKey for AES-GCM.
async function importKey(keyB64: string): Promise<CryptoKey> {
	const raw = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
	if (raw.length !== 32) {
		throw new Error(`AES-GCM key must be 32 bytes (256-bit); got ${raw.length}`);
	}
	return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function toB64(bytes: Uint8Array): string {
	let s = "";
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s);
}

function fromB64(b64: string): Uint8Array {
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

export async function encryptToken(plaintext: string, keyB64: string): Promise<EncryptedToken> {
	const key = await importKey(keyB64);
	const iv = crypto.getRandomValues(new Uint8Array(12));  // 96-bit IV for AES-GCM
	const data = new TextEncoder().encode(plaintext);
	const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
	return {
		ciphertext_b64: toB64(new Uint8Array(ct)),
		iv_b64: toB64(iv),
	};
}

export async function decryptToken(enc: EncryptedToken, keyB64: string): Promise<string> {
	const key = await importKey(keyB64);
	const iv = fromB64(enc.iv_b64);
	const ct = fromB64(enc.ciphertext_b64);
	const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
	return new TextDecoder().decode(pt);
}
```

- [ ] **Step 4: Run the tests — should pass**

```bash
node --import tsx --test plugins/plugin-weasley-clock/tests/crypto.test.ts
```

Expected: 6 pass, 0 fail.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no new errors from `plugins/plugin-weasley-clock/src/lib/crypto.ts` or the test file.

- [ ] **Step 6: Commit**

```bash
git add plugins/plugin-weasley-clock/src/lib/crypto.ts plugins/plugin-weasley-clock/tests/crypto.test.ts
git commit -m "feat(weasley-clock): AES-GCM token encryption helper + tests"
```

---

## Task 3: JWT verification for Google id_token (TDD)

**Files:**
- Create: `plugins/plugin-weasley-clock/src/lib/jwt.ts`
- Create: `plugins/plugin-weasley-clock/tests/jwt.test.ts`

Verifies an RS256 JWT against Google's published JWK set. Uses Web Crypto (`crypto.subtle.verify`). Fetches and caches `https://www.googleapis.com/oauth2/v3/certs` so we don't hit Google for every token.

Why: the OAuth token response includes an `id_token` (JWT) containing the user's `email`, `name`, `sub`. We verify the JWT locally instead of hitting the `userinfo` endpoint to save a network round-trip. An unverified JWT is worthless — a forged one could let any email look like loc.truongh@gmail.com.

- [ ] **Step 1: Write the failing tests**

Create `plugins/plugin-weasley-clock/tests/jwt.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyGoogleIdToken, type GoogleIdTokenPayload } from "../src/lib/jwt";

// Fixture: a real Google id_token is a ~1KB signed JWT. For tests we use a
// crafted token signed by a known test key. The verification logic accepts
// a custom JWK set for injectable testing; in production, the fetcher hits
// Google's /oauth2/v3/certs.

// These fixtures are generated in Step 3 below after we have a token-signing
// test helper. Placeholder here; replace contents when running.
const VALID_TOKEN = "<generated in test-helper.ts>";
const VALID_JWKS = { keys: [/* <public key matching the signer> */] };
const TEST_CLIENT_ID = "test-client-id.apps.googleusercontent.com";

test("verifyGoogleIdToken: accepts a valid signed token with matching aud", async () => {
	const payload = await verifyGoogleIdToken(VALID_TOKEN, TEST_CLIENT_ID, { jwks: VALID_JWKS });
	assert.equal(payload.email, "loc@example.com");
	assert.equal(payload.aud, TEST_CLIENT_ID);
	assert.ok(payload.exp > Date.now() / 1000);
});

test("verifyGoogleIdToken: rejects token with wrong audience", async () => {
	await assert.rejects(
		() => verifyGoogleIdToken(VALID_TOKEN, "wrong-client-id", { jwks: VALID_JWKS }),
		/audience/i,
	);
});

test("verifyGoogleIdToken: rejects tampered signature", async () => {
	const tampered = VALID_TOKEN.slice(0, -4) + "XXXX";
	await assert.rejects(() => verifyGoogleIdToken(tampered, TEST_CLIENT_ID, { jwks: VALID_JWKS }));
});

test("verifyGoogleIdToken: rejects expired token", async () => {
	// Build a token with exp 1 hour ago (see test-helper)
	const EXPIRED_TOKEN = "<generated with exp in past>";
	await assert.rejects(
		() => verifyGoogleIdToken(EXPIRED_TOKEN, TEST_CLIENT_ID, { jwks: VALID_JWKS }),
		/expired/i,
	);
});

test("verifyGoogleIdToken: rejects wrong issuer", async () => {
	const WRONG_ISS_TOKEN = "<generated with iss='https://evil.com'>";
	await assert.rejects(
		() => verifyGoogleIdToken(WRONG_ISS_TOKEN, TEST_CLIENT_ID, { jwks: VALID_JWKS }),
		/issuer/i,
	);
});
```

The token fixtures use placeholder strings — you'll generate them in the next step with a small test helper.

- [ ] **Step 2: Create the test-helper for generating fixtures**

Create `plugins/plugin-weasley-clock/tests/jwt-test-helpers.ts`:

```ts
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
```

Then update `jwt.test.ts` to use this helper:

```ts
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
```

- [ ] **Step 3: Run — should fail**

```bash
node --import tsx --test plugins/plugin-weasley-clock/tests/jwt.test.ts
```

Expected: FAIL — `verifyGoogleIdToken` not defined.

- [ ] **Step 4: Implement `plugins/plugin-weasley-clock/src/lib/jwt.ts`**

```ts
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
// cache-Control on the certs response is honoured implicitly by re-fetch on
// verification failure with a known-good key id.
let cachedJwks: { keys: any[]; fetchedAt: number } | null = null;

async function getJwks(force = false): Promise<{ keys: any[] }> {
	const MAX_AGE_MS = 60 * 60 * 1000; // 1h fallback; Google's Cache-Control is longer
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
	const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signed);
	if (!valid) throw new Error("JWT signature verification failed");

	const now = nowOverride ?? Math.floor(Date.now() / 1000);
	if (payload.exp < now) throw new Error("JWT expired");
	if (payload.iat > now + 300) throw new Error("JWT iat too far in future");
	if (!VALID_ISSUERS.includes(payload.iss)) throw new Error(`Invalid issuer: ${payload.iss}`);
	if (payload.aud !== expectedAud) throw new Error(`Invalid audience: ${payload.aud}`);

	return payload;
}
```

- [ ] **Step 5: Run tests — should pass**

```bash
node --import tsx --test plugins/plugin-weasley-clock/tests/jwt.test.ts
```

Expected: 5 pass, 0 fail.

- [ ] **Step 6: Typecheck + commit**

```bash
npm run typecheck
git add plugins/plugin-weasley-clock/src/lib/jwt.ts plugins/plugin-weasley-clock/tests/jwt.test.ts plugins/plugin-weasley-clock/tests/jwt-test-helpers.ts
git commit -m "feat(weasley-clock): Google JWT id_token verification + tests"
```

---

## Task 4: OAuth state helper (TDD)

CSRF-state tokens for the OAuth handshake. 32-char base32 random, 10-minute TTL, one-time use (validated-and-consumed atomically).

**Files:**
- Create: `plugins/plugin-weasley-clock/src/lib/oauth-state.ts`
- Create: `plugins/plugin-weasley-clock/tests/oauth-state.test.ts`

- [ ] **Step 1: Write tests**

Create `plugins/plugin-weasley-clock/tests/oauth-state.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateState, consumeState, type OAuthStateStore } from "../src/lib/oauth-state";

// In-memory test store matching the real ctx.storage.oauth_state shape.
function mkStore(): OAuthStateStore & { _size: () => number } {
	const rows = new Map<string, { id: string; data: any }>();
	return {
		async put(id: string, data: any) { rows.set(id, { id, data }); },
		async get(id: string) {
			const r = rows.get(id);
			return r ? { id, data: r.data } : null;
		},
		async delete(id: string) { rows.delete(id); },
		_size: () => rows.size,
	};
}

test("generateState: creates a 32-char token, persists it, returns the token", async () => {
	const store = mkStore();
	const now = new Date("2026-04-24T10:00:00Z");
	const token = await generateState(store, { now, returnUrl: "/admin" });
	assert.equal(token.length, 32);
	assert.match(token, /^[A-Z2-7]{32}$/);
	assert.equal(store._size(), 1);
});

test("consumeState: valid state → returns stored data + deletes row", async () => {
	const store = mkStore();
	const now = new Date("2026-04-24T10:00:00Z");
	const token = await generateState(store, { now, returnUrl: "/admin" });
	const result = await consumeState(store, token, { now: new Date("2026-04-24T10:05:00Z") });
	assert.ok(result);
	assert.equal(result!.return_url, "/admin");
	assert.equal(store._size(), 0);  // consumed
});

test("consumeState: expired state → null + deletes row", async () => {
	const store = mkStore();
	const created = new Date("2026-04-24T10:00:00Z");
	const token = await generateState(store, { now: created, returnUrl: "/x" });
	// 11 minutes later (TTL is 10 min)
	const later = new Date("2026-04-24T10:11:00Z");
	const result = await consumeState(store, token, { now: later });
	assert.equal(result, null);
	assert.equal(store._size(), 0);  // purged
});

test("consumeState: unknown state → null", async () => {
	const store = mkStore();
	const result = await consumeState(store, "NEVEREXISTEDAAAAAAAAAAAAAAAAAAAA", { now: new Date() });
	assert.equal(result, null);
});

test("consumeState: already-consumed state → null (one-time use)", async () => {
	const store = mkStore();
	const now = new Date("2026-04-24T10:00:00Z");
	const token = await generateState(store, { now, returnUrl: "/admin" });
	const first = await consumeState(store, token, { now });
	const second = await consumeState(store, token, { now });
	assert.ok(first);
	assert.equal(second, null);
});
```

- [ ] **Step 2: Run — should fail**

```bash
node --import tsx --test plugins/plugin-weasley-clock/tests/oauth-state.test.ts
```

- [ ] **Step 3: Implement `plugins/plugin-weasley-clock/src/lib/oauth-state.ts`**

```ts
export interface OAuthStateRow {
	state: string;
	created_at: string;  // ISO 8601
	expires_at: string;  // ISO 8601
	return_url?: string;
}

// Narrow interface that matches EmDash's ctx.storage.<namespace> shape.
// Tests inject a Map-backed version; production hooks pass ctx.storage.oauth_state.
export interface OAuthStateStore {
	put(id: string, data: OAuthStateRow): Promise<void>;
	get(id: string): Promise<{ id: string; data: OAuthStateRow } | null>;
	delete(id: string): Promise<void>;
}

const TTL_MS = 10 * 60 * 1000;
const STATE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";  // RFC 4648 base32, no I/O/0/1

function randomState(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	let out = "";
	for (let i = 0; i < 32; i++) out += STATE_ALPHABET[bytes[i] % 32];
	return out;
}

export async function generateState(
	store: OAuthStateStore,
	opts: { now?: Date; returnUrl?: string } = {},
): Promise<string> {
	const now = opts.now ?? new Date();
	const state = randomState();
	const row: OAuthStateRow = {
		state,
		created_at: now.toISOString(),
		expires_at: new Date(now.getTime() + TTL_MS).toISOString(),
		return_url: opts.returnUrl,
	};
	await store.put(state, row);
	return state;
}

// Atomically check + consume a state token. Returns the stored row if valid,
// else null. Always deletes the row to prevent replay (even if expired).
export async function consumeState(
	store: OAuthStateStore,
	state: string,
	opts: { now?: Date } = {},
): Promise<OAuthStateRow | null> {
	const now = opts.now ?? new Date();
	const found = await store.get(state);
	if (!found) return null;
	await store.delete(state);  // one-time use; delete even if expired
	const expiresAt = new Date(found.data.expires_at);
	if (expiresAt.getTime() < now.getTime()) return null;
	return found.data;
}
```

- [ ] **Step 4: Run — should pass**

```bash
node --import tsx --test plugins/plugin-weasley-clock/tests/oauth-state.test.ts
```

Expected: 5 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
npm run typecheck
git add plugins/plugin-weasley-clock/src/lib/oauth-state.ts plugins/plugin-weasley-clock/tests/oauth-state.test.ts
git commit -m "feat(weasley-clock): OAuth state CSRF token helper + tests"
```

---

## Task 5: Plugin descriptor + storage namespaces

Update `plugins/plugin-weasley-clock/src/index.ts` to declare the real capabilities, storage namespaces, and allowed hosts. Also re-register the plugin in `astro.config.mjs` (it was unregistered in Phase 1 commit `9d6185c7`).

**Files:**
- Modify: `plugins/plugin-weasley-clock/src/index.ts`
- Modify: `astro.config.mjs`

- [ ] **Step 1: Rewrite `plugins/plugin-weasley-clock/src/index.ts`**

```ts
import type { PluginDescriptor } from "emdash";

export function weasleyClockPlugin(): PluginDescriptor {
	return {
		id: "weasley-clock",
		version: "0.2.0",
		format: "standard",
		entrypoint: "plugin-weasley-clock/sandbox",
		options: {},
		capabilities: [
			"network:fetch",     // for Google OAuth token exchange + calendarList
			"read:secrets",      // OAUTH_ENC_KEY + client id/secret
		],
		allowedHosts: [
			"accounts.google.com",
			"oauth2.googleapis.com",
			"www.googleapis.com",
		],
		storage: {
			oauth_accounts: { indexes: ["provider", "account_email", "status"] },
			oauth_calendars: { indexes: ["account_id", "calendar_id", "synced"] },
			oauth_state: { indexes: ["expires_at"] },
			synced_events: {
				indexes: [
					"source_type",
					"gcal_account_id",
					"gcal_calendar_id",
					"starts_at",
					"ends_at",
					"external_uid",
					"deleted",
				],
			},
		},
		adminPages: [
			{ path: "/feeds", label: "Calendar Feeds", icon: "calendar" },
		],
	};
}
```

Note: `synced_events` is declared here so the namespace exists (EmDash may require declaration before `ctx.storage.synced_events` works), but no code writes to it in this plan — that's the follow-up sync plan.

- [ ] **Step 2: Re-register the plugin in `astro.config.mjs`**

Open `astro.config.mjs`. Un-comment the previously-commented import:

```js
import { weasleyClockPlugin } from "plugin-weasley-clock";
```

And re-add `weasleyClockPlugin()` to the `plugins:` array:

```js
plugins: [formsPlugin(), resendPlugin(), pensieveEngagePlugin(), weasleyClockPlugin()],
```

Leave the Vite `optimizeDeps.exclude` and `ssr.noExternal` entries for `plugin-weasley-clock` as-is — they were kept even when the plugin was unregistered.

- [ ] **Step 3: Dev-boot sanity check**

```bash
pkill -f "emdash dev" 2>/dev/null; sleep 2
(timeout 30 npx emdash dev > /tmp/dev-bootstrap.log 2>&1 &)
sleep 22
grep -iE "error|standard plugin|typegen|oauth_accounts" /tmp/dev-bootstrap.log | head -10
pkill -f "emdash dev"
```

Expected in log: no "Standard plugin format requires at least `hooks` or `routes`" error (we're about to add them in Task 6). If the error persists despite real storage declared, continue to Task 6 — the error should clear once we add at least one hook.

*Known exception:* you WILL still see the error at this step because we haven't added hooks/routes yet. That's fine — the next commit fixes it. Don't spend time debugging a "Standard plugin format" error at this step.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add plugins/plugin-weasley-clock/src/index.ts astro.config.mjs
git commit -m "feat(weasley-clock): populate plugin descriptor with OAuth storage namespaces"
```

---

## Task 6: OAuth initiate + callback routes

Two HTTP routes on the plugin: `/oauth/google/initiate` (generates state, redirects to Google) and `/oauth/google/callback` (verifies state, exchanges code, stores tokens).

**Files:**
- Modify: `plugins/plugin-weasley-clock/src/sandbox-entry.ts`

Previous Phase 1 content was a no-op `plugin:install` hook. Replace entirely.

- [ ] **Step 1: Rewrite `plugins/plugin-weasley-clock/src/sandbox-entry.ts`**

```ts
import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";
import { encryptToken } from "./lib/crypto";
import { verifyGoogleIdToken } from "./lib/jwt";
import { generateState, consumeState, type OAuthStateStore } from "./lib/oauth-state";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDARLIST_URL = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

function redirectUri(origin: string): string {
	return `${origin}/_emdash/api/plugins/weasley-clock/oauth/google/callback`;
}

function getOrigin(routeCtx: any): string {
	// EmDash passes the original request URL on routeCtx.url (or routeCtx.request.url)
	const raw = routeCtx.url ?? routeCtx.request?.url;
	if (!raw) throw new Error("Route context missing url");
	return new URL(raw).origin;
}

// Wrap ctx.storage.oauth_state in the narrow OAuthStateStore interface our helper expects.
function stateStoreFor(ctx: PluginContext): OAuthStateStore {
	const ns = (ctx.storage as any).oauth_state;
	return {
		async put(id, data) { await ns.put(id, data); },
		async get(id) { return ns.get(id); },
		async delete(id) { await ns.delete(id); },
	};
}

export default definePlugin({
	hooks: {
		"plugin:install": {
			handler: async (_event: unknown, ctx: PluginContext) => {
				ctx.log.info("weasley-clock: plugin installed");
			},
		},
	},

	routes: {
		"oauth/google/initiate": {
			public: false,  // admin-only
			handler: async (routeCtx: any, ctx: PluginContext) => {
				const origin = getOrigin(routeCtx);
				const clientId = (ctx.env as any).GOOGLE_OAUTH_CLIENT_ID;
				if (!clientId) return { error: "GOOGLE_OAUTH_CLIENT_ID not configured" };

				const returnUrl = typeof routeCtx.input?.return_url === "string" ? routeCtx.input.return_url : "/_emdash/admin/weasley-clock/feeds";
				const state = await generateState(stateStoreFor(ctx), { returnUrl });

				const params = new URLSearchParams({
					client_id: clientId,
					redirect_uri: redirectUri(origin),
					response_type: "code",
					scope: SCOPE,
					access_type: "offline",
					prompt: "consent",
					state,
				});

				return { redirect: `${GOOGLE_AUTH_URL}?${params.toString()}` };
			},
		},

		"oauth/google/callback": {
			public: true,  // Google redirects here; must be accessible without auth
			handler: async (routeCtx: any, ctx: PluginContext) => {
				const url = new URL(routeCtx.url ?? routeCtx.request?.url);
				const code = url.searchParams.get("code");
				const state = url.searchParams.get("state");
				const errorParam = url.searchParams.get("error");

				if (errorParam) {
					ctx.log.info(`oauth/callback: user denied consent (${errorParam})`);
					return { redirect: `/_emdash/admin/weasley-clock/feeds?error=${encodeURIComponent(errorParam)}` };
				}
				if (!code || !state) return { error: "Missing code or state" };

				const stateRow = await consumeState(stateStoreFor(ctx), state);
				if (!stateRow) return { error: "Invalid or expired state — please retry" };

				const clientId = (ctx.env as any).GOOGLE_OAUTH_CLIENT_ID;
				const clientSecret = (ctx.env as any).GOOGLE_OAUTH_CLIENT_SECRET;
				const encKey = (ctx.env as any).OAUTH_ENC_KEY;
				if (!clientId || !clientSecret || !encKey) return { error: "OAuth not fully configured" };

				const origin = getOrigin(routeCtx);
				// Exchange code for tokens
				const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
					method: "POST",
					headers: { "Content-Type": "application/x-www-form-urlencoded" },
					body: new URLSearchParams({
						grant_type: "authorization_code",
						code,
						client_id: clientId,
						client_secret: clientSecret,
						redirect_uri: redirectUri(origin),
					}),
				});
				if (!tokenRes.ok) {
					const text = await tokenRes.text();
					ctx.log.info(`oauth/callback: token exchange failed ${tokenRes.status}: ${text}`);
					return { error: "Token exchange failed" };
				}
				const tokens = (await tokenRes.json()) as {
					access_token: string;
					refresh_token?: string;
					expires_in: number;
					id_token: string;
					scope: string;
				};
				if (!tokens.refresh_token) {
					// Google only emits refresh_token on first consent. If missing, prompt=consent
					// should have forced it — but if user revoked AND reconsented without prompt=consent,
					// we might miss it. Tell user to retry.
					return { error: "Google did not return a refresh_token — please revoke access in your Google account settings and try again" };
				}

				// Verify id_token signature + claims
				const idPayload = await verifyGoogleIdToken(tokens.id_token, clientId);

				// Encrypt tokens
				const accessEnc = await encryptToken(tokens.access_token, encKey);
				const refreshEnc = await encryptToken(tokens.refresh_token, encKey);

				// Upsert account: key by (provider, account_email)
				const accountId = await findAccountIdByEmail(ctx, idPayload.email);
				const now = new Date().toISOString();
				const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
				const row = {
					id: accountId ?? "acc_" + state.slice(0, 16).toLowerCase(),
					provider: "google" as const,
					account_email: idPayload.email,
					display_name: idPayload.name ?? null,
					access_token_enc: accessEnc.ciphertext_b64,
					access_token_iv: accessEnc.iv_b64,
					refresh_token_enc: refreshEnc.ciphertext_b64,
					refresh_token_iv: refreshEnc.iv_b64,
					access_token_expires_at: expiresAt,
					scope: tokens.scope,
					status: "active" as const,
					last_sync_error: null,
					connected_at: accountId ? undefined : now,
					last_synced_at: null,
					revoked_at: null,
				};
				await (ctx.storage as any).oauth_accounts.put(row.id, row);

				return { redirect: stateRow.return_url || "/_emdash/admin/weasley-clock/feeds" };
			},
		},
	},
});

async function findAccountIdByEmail(ctx: PluginContext, email: string): Promise<string | null> {
	const all = await (ctx.storage as any).oauth_accounts.query({});
	const items = all.items ?? all ?? [];
	const existing = items.find((r: any) => r.data?.provider === "google" && r.data?.account_email === email);
	return existing ? existing.id : null;
}
```

- [ ] **Step 2: Restart dev server + verify no "Standard plugin format" error**

```bash
pkill -f "emdash dev" 2>/dev/null; sleep 2
rm -rf node_modules/.vite .astro
(timeout 45 npx emdash dev > /tmp/dev-task6.log 2>&1 &)
sleep 35
grep -iE "Standard plugin|Error|oauth" /tmp/dev-task6.log | head -10
pkill -f "emdash dev"
```

Expected: no "Standard plugin format" error. Typegen should succeed.

- [ ] **Step 3: Dev-only smoke curl**

Still with dev server running (re-boot if needed):

```bash
(timeout 40 npx emdash dev > /tmp/dev-smoke.log 2>&1 &)
sleep 28
curl -s -D - "http://localhost:4321/_emdash/api/plugins/weasley-clock/oauth/google/initiate" -H "Content-Type: application/json" -X POST --data '{}' | head -10
pkill -f "emdash dev"
```

Expected: returns a `redirect` to Google's auth URL containing `client_id=`, `scope=calendar.readonly`, and your `state`. If you see `{"error":"GOOGLE_OAUTH_CLIENT_ID not configured"}` it means the secret isn't flowing in dev — check `wrangler.jsonc` `vars.GOOGLE_OAUTH_CLIENT_ID` and `.dev.vars` for `GOOGLE_OAUTH_CLIENT_SECRET`.

*If no admin session is active*, you may get a 401 because the route is `public: false`. In that case, temporarily set `public: true` in the source (just to smoke-test), revert, and move on.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add plugins/plugin-weasley-clock/src/sandbox-entry.ts
git commit -m "feat(weasley-clock): OAuth initiate + callback routes (code exchange, token encryption)"
```

---

## Task 7: Calendar discovery on connect

Extend the callback handler to fetch the user's Google calendar list and upsert each into `oauth_calendars` with `synced=0` (user opts in per calendar in the admin UI).

**Files:**
- Modify: `plugins/plugin-weasley-clock/src/sandbox-entry.ts`

- [ ] **Step 1: Add the calendar-discovery helper and call it from the callback handler**

In `sandbox-entry.ts`, below `findAccountIdByEmail`, add:

```ts
async function discoverCalendars(ctx: PluginContext, accountRow: { id: string; access_token: string }): Promise<void> {
	const res = await fetch(GOOGLE_CALENDARLIST_URL, {
		headers: { Authorization: `Bearer ${accountRow.access_token}` },
	});
	if (!res.ok) {
		const text = await res.text();
		ctx.log.info(`discoverCalendars failed: ${res.status} ${text}`);
		return;  // non-fatal; UI will show "no calendars yet" and user can retry
	}
	const data = (await res.json()) as { items: any[] };
	for (const cal of data.items ?? []) {
		const id = `cal_${accountRow.id}_${btoa(cal.id).replace(/[^a-zA-Z0-9]/g, "").slice(0, 32)}`;
		await (ctx.storage as any).oauth_calendars.put(id, {
			id,
			account_id: accountRow.id,
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
	ctx.log.info(`discoverCalendars: ${(data.items ?? []).length} calendars enumerated for ${accountRow.id}`);
}
```

- [ ] **Step 2: Call discoverCalendars from the callback handler after storing the account**

In the `oauth/google/callback` handler, after the line `await (ctx.storage as any).oauth_accounts.put(row.id, row);`, add:

```ts
// Enumerate calendars for this account (non-fatal on failure — user can re-auth)
await discoverCalendars(ctx, { id: row.id, access_token: tokens.access_token });
```

- [ ] **Step 3: Dev smoke — walk through the full flow**

The full flow requires a real browser + real Google account. Manual steps:

1. Boot `npx emdash dev`. Wait for "astro ... ready".
2. Ensure you're logged in as an EmDash admin. If not already, sign in via the EmDash admin UI (`http://localhost:4321/_emdash/admin`).
3. Temporarily set `public: true` on the `oauth/google/initiate` route to skip auth, OR grab an admin session cookie from the browser and include it in curl.
4. POST to the initiate endpoint, follow the redirect manually (paste the redirect URL into the browser).
5. Consent to access on Google's page.
6. Google redirects back to `http://localhost:4321/_emdash/api/plugins/weasley-clock/oauth/google/callback?code=...&state=...`.
7. Check the response — should be a redirect to `/_emdash/admin/weasley-clock/feeds`.
8. Use the EmDash admin's data browser to verify rows exist in `oauth_accounts` and `oauth_calendars`.

If anything fails, check `/tmp/dev-smoke.log` for error messages.

- [ ] **Step 4: Commit**

```bash
git add plugins/plugin-weasley-clock/src/sandbox-entry.ts
git commit -m "feat(weasley-clock): enumerate calendars on OAuth connect → oauth_calendars"
```

---

## Task 8: Admin page — account list + calendar opt-in

MVP admin UI. Lists connected Google accounts with their calendars and a sync toggle per calendar. Uses EmDash's plugin admin React component API.

**Files:**
- Create: `plugins/plugin-weasley-clock/src/admin/feeds.tsx`
- Modify: `plugins/plugin-weasley-clock/src/sandbox-entry.ts` — add an API route `calendars/toggle` that flips `synced`
- Modify: `plugins/plugin-weasley-clock/src/index.ts` — register the admin page (already done in Task 5)

- [ ] **Step 1: Add `calendars/toggle` route in `sandbox-entry.ts`**

Inside the `routes:` object, after `oauth/google/callback`, add:

```ts
"calendars/toggle": {
	public: false,
	handler: async (routeCtx: any, ctx: PluginContext) => {
		const { calendar_id, synced } = (routeCtx.input ?? {}) as { calendar_id?: string; synced?: boolean };
		if (!calendar_id || typeof synced !== "boolean") return { error: "Expected { calendar_id, synced }" };
		const row = await (ctx.storage as any).oauth_calendars.get(calendar_id);
		if (!row) return { error: "Calendar not found" };
		await (ctx.storage as any).oauth_calendars.put(calendar_id, { ...row.data, synced: synced ? 1 : 0 });
		return { ok: true };
	},
},

"accounts/list": {
	public: false,
	handler: async (_routeCtx: any, ctx: PluginContext) => {
		const accs = await (ctx.storage as any).oauth_accounts.query({});
		const cals = await (ctx.storage as any).oauth_calendars.query({});
		const accountsList = ((accs.items ?? accs ?? []) as any[]).map((r: any) => ({
			id: r.id,
			account_email: r.data.account_email,
			display_name: r.data.display_name,
			status: r.data.status,
			connected_at: r.data.connected_at,
		}));
		const calendarsByAccount: Record<string, any[]> = {};
		for (const r of (cals.items ?? cals ?? []) as any[]) {
			const list = calendarsByAccount[r.data.account_id] ?? (calendarsByAccount[r.data.account_id] = []);
			list.push({
				id: r.id,
				calendar_id: r.data.calendar_id,
				summary: r.data.summary,
				time_zone: r.data.time_zone,
				background_color: r.data.background_color,
				synced: !!r.data.synced,
			});
		}
		return { accounts: accountsList, calendarsByAccount };
	},
},
```

- [ ] **Step 2: Create the admin page React component**

Create `plugins/plugin-weasley-clock/src/admin/feeds.tsx`:

```tsx
import { useEffect, useState } from "react";

interface Account {
	id: string;
	account_email: string;
	display_name: string | null;
	status: string;
	connected_at: string | null;
}

interface Calendar {
	id: string;
	calendar_id: string;
	summary: string;
	time_zone: string | null;
	background_color: string | null;
	synced: boolean;
}

const API_BASE = "/_emdash/api/plugins/weasley-clock";

export default function FeedsPage() {
	const [accounts, setAccounts] = useState<Account[]>([]);
	const [calByAccount, setCalByAccount] = useState<Record<string, Calendar[]>>({});
	const [loading, setLoading] = useState(true);

	async function refresh() {
		setLoading(true);
		const res = await fetch(`${API_BASE}/accounts/list`, { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
		const data = await res.json();
		setAccounts(data.accounts ?? []);
		setCalByAccount(data.calendarsByAccount ?? {});
		setLoading(false);
	}

	useEffect(() => { refresh(); }, []);

	async function toggleCalendar(accountId: string, calendarRowId: string, next: boolean) {
		await fetch(`${API_BASE}/calendars/toggle`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ calendar_id: calendarRowId, synced: next }),
		});
		// Optimistic update
		setCalByAccount((prev) => ({
			...prev,
			[accountId]: (prev[accountId] ?? []).map((c) => (c.id === calendarRowId ? { ...c, synced: next } : c)),
		}));
	}

	async function startConnect() {
		const res = await fetch(`${API_BASE}/oauth/google/initiate`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ return_url: window.location.pathname }),
		});
		const data = await res.json();
		if (data.redirect) window.location.href = data.redirect;
		else alert("Failed to start OAuth: " + JSON.stringify(data));
	}

	if (loading) return <div style={{ padding: 20 }}>Loading…</div>;

	return (
		<div style={{ padding: 20, maxWidth: 820 }}>
			<h1>Calendar Feeds</h1>
			<section>
				<h2>Google accounts</h2>
				{accounts.length === 0 && <p style={{ color: "#888" }}>No Google accounts connected yet.</p>}
				{accounts.map((acc) => (
					<div key={acc.id} style={{ border: "1px solid #333", padding: 12, marginBottom: 12, borderRadius: 4 }}>
						<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
							<div>
								<strong>{acc.account_email}</strong>
								{acc.display_name && <span style={{ color: "#888", marginLeft: 8 }}>· {acc.display_name}</span>}
							</div>
							<span style={{ fontSize: 11, color: acc.status === "active" ? "#6a6" : "#c66" }}>{acc.status}</span>
						</div>
						<div style={{ marginTop: 10 }}>
							{(calByAccount[acc.id] ?? []).map((cal) => (
								<label key={cal.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
									<input
										type="checkbox"
										checked={cal.synced}
										onChange={(e) => toggleCalendar(acc.id, cal.id, e.target.checked)}
									/>
									{cal.background_color && (
										<span style={{ width: 12, height: 12, background: cal.background_color, borderRadius: 2, display: "inline-block" }} />
									)}
									<span>{cal.summary}</span>
									{cal.time_zone && <span style={{ color: "#888", fontSize: 11 }}>· {cal.time_zone}</span>}
								</label>
							))}
						</div>
					</div>
				))}
			</section>
			<button
				onClick={startConnect}
				style={{ padding: "10px 16px", background: "#c9a961", color: "#1a1410", border: 0, borderRadius: 2, fontWeight: "bold", letterSpacing: 1 }}
			>
				+ Connect Google account
			</button>
		</div>
	);
}
```

- [ ] **Step 3: Register the admin page**

EmDash plugin admin pages are wired through the descriptor's `adminPages` field (already set to `{ path: "/feeds", label: "Calendar Feeds", icon: "calendar" }` in Task 5). EmDash discovers the component by convention — some EmDash versions resolve `plugins/<name>/src/admin/<path>.tsx` automatically; others require a declaration.

If the admin route doesn't render at `/_emdash/admin/weasley-clock/feeds` after rebuild, check how `plugin-pensieve-engage` exposes its admin pages (search for "adminPages" in `plugin-pensieve-engage/src/index.ts` and see what files exist in its `src/admin/` or equivalent directory). Mirror that pattern.

- [ ] **Step 4: Verify**

1. Restart `npx emdash dev`.
2. Navigate to `http://localhost:4321/_emdash/admin/weasley-clock/feeds`.
3. You should see the Calendar Feeds page with empty accounts state + a "Connect Google account" button.
4. Click the button. Should redirect to Google's consent page.
5. Consent. Should land back at `/_emdash/admin/weasley-clock/feeds` with your account + calendars populated.
6. Toggle one calendar. Reload the page. The toggle should persist.

If the admin page route 404s, Task 8 step 3 didn't complete — check the `plugin-pensieve-engage` pattern for how admin components are exposed.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add plugins/plugin-weasley-clock/src/admin/feeds.tsx plugins/plugin-weasley-clock/src/sandbox-entry.ts
git commit -m "feat(weasley-clock): admin page for accounts + calendar opt-in toggles"
```

---

## Task 9: End-to-end manual test + final verification

No code changes — this is a manual exercise to validate the whole Phase 2a Foundations stack. Do it before calling the plan done.

- [ ] **Step 1: Fresh environment sanity**

```bash
pkill -f "emdash dev" 2>/dev/null
rm -rf node_modules/.vite .astro
npm test 2>&1 | tail -20      # all tests pass
npm run typecheck 2>&1 | grep -E "error" | grep "plugin-weasley-clock" | head  # expect empty (no errors in our files)
npm run build 2>&1 | tail -6  # "Build complete"
```

Expected: tests pass, typecheck clean for plugin files, build succeeds.

- [ ] **Step 2: Full OAuth flow against real Google**

1. `npx emdash dev`.
2. Open `http://localhost:4321/_emdash/admin/weasley-clock/feeds`.
3. Click **Connect Google account**.
4. Sign in with your primary Google account (e.g. `loc.truongh@gmail.com`).
5. On the consent screen, verify it requests *only* "See and download any calendar you can access using your Google Calendar" (that's `calendar.readonly`).
6. Grant consent.
7. Land back on the feeds page. Your account + calendars should be listed.
8. Open the browser's dev tools → Network → find the `accounts/list` POST. Verify the response shape.
9. Toggle one calendar to `synced=true`. Reload. Confirm persistence.

- [ ] **Step 3: Connect a second Google account**

Repeat Step 2 with a different Google account (e.g., a work account).

Expected: both accounts appear in the list. Calendars from each are scoped to their own account block.

- [ ] **Step 4: Inspect the database**

Use EmDash's admin data browser, or a wrangler D1 query (works in prod only, not dev):

```bash
# In dev, use sqlite3 or whatever EmDash exposes. Example if the dev DB path is data.db:
sqlite3 data.db "SELECT id, json_extract(data, '$.account_email') AS email, json_extract(data, '$.status') AS status FROM ec_plugin_oauth_accounts;"
```

Expected: 2 rows, each with their email + `status='active'`.

```bash
sqlite3 data.db "SELECT id, json_extract(data, '$.account_id') AS acc, json_extract(data, '$.summary') AS summary, json_extract(data, '$.synced') AS synced FROM ec_plugin_oauth_calendars;"
```

Expected: N rows (depends on how many calendars each account has). The rows you toggled should have `synced=1`.

**Manually verify that `access_token_enc` is NOT plaintext** — inspect one row's `data.access_token_enc`. It should be random-looking base64, not `ya29.*` (which is Google's plaintext token prefix).

- [ ] **Step 5: Revoke scenario (document, don't test)**

Open https://myaccount.google.com/permissions → find your test app → "Remove access". This revokes our refresh token. Record the expected behaviour for the follow-up plan (which adds the sync cron):

- Next sync run: token refresh returns `invalid_grant` → set `oauth_accounts.status='revoked'`.
- Admin UI: show banner "reconnect required" (follow-up plan implements this).

This phase doesn't yet handle revocation automatically — that's the follow-up plan's responsibility. For now, just confirm the `status='active'` rows persist as-is.

- [ ] **Step 6: Tag**

```bash
git tag -a weasley-clock-phase-2a-foundations -m "OAuth foundations: connect Google account + list calendars"
```

- [ ] **Step 7: Merge back to the Phase 1 branch if preferred**

If Phase 1 hasn't landed on main yet, decide whether to keep these two branches separate or merge `feat/weasley-clock-phase-2a-foundations` into `feat/weasley-clock-phase-1` for a single PR.

---

## Self-review against the spec

| Spec section | Plan task |
|---|---|
| Q2a.1 client setup | Task 1 (wrangler secrets + Google Cloud Console) |
| Q2a.2 scope = calendar.readonly | Task 6 (SCOPE constant) |
| Q2a.3 unlimited accounts, soft-capped UX | Task 8 (UI doesn't restrict) |
| Q2a.4 per-account opt-in | Task 7 (discovery writes `synced=0`) + Task 8 (toggle) |
| Q2a.5 AES-GCM + OAUTH_ENC_KEY | Task 2 (crypto module) + Task 6 (uses it) |
| Q2a.6 5-min cron | **Deferred to follow-up plan** (not this plan) |
| Q2a.7 no push channels | N/A — explicitly out of scope this plan |
| Q2a.8 ICS hybrid retention | N/A — preserved by not touching `ics_sources` |
| OAuth flow initiate | Task 6 |
| OAuth flow callback | Task 6 |
| Calendar discovery | Task 7 |
| Admin opt-in UI | Task 8 |
| oauth_accounts table | Task 5 (schema) + Task 6 (writes) |
| oauth_calendars table | Task 5 (schema) + Task 7 (writes) + Task 8 (toggle) |
| oauth_state table | Task 5 (schema) + Task 4 (helper) + Task 6 (uses) |
| `synced_events` schema additions | Task 5 (namespace declared; no writes yet — follow-up plan) |
| AES-GCM IV uniqueness | Task 2 (per-call random IV, tested) |
| JWT verification | Task 3 |
| CSRF state | Task 4 |
| Scope downgrade rejection | **Gap — add explicit check** before marking task 6 complete |
| Refresh-token scarcity | Task 6 (uses `prompt=consent`) |
| Redirect URI dev-vs-prod | Task 1 (register both in Google Console) + Task 6 (uses `routeCtx.url` origin) |
| Log hygiene (no raw tokens) | Task 6 — audit log lines before commit |
| Token refresh cron | **Follow-up plan** (P2a.4) |
| events.list sync | **Follow-up plan** (P2a.4) |
| Render timed events on Weasley Clock | **Follow-up plan** (P2a.5) |
| Revocation handling | **Follow-up plan** (P2a.6) |

### Gap fix — scope downgrade rejection

Before marking Task 6 complete, add this check in the callback handler, right after the `tokens = await tokenRes.json()` line:

```ts
// User could unselect scopes on Google's consent screen — if they did,
// tokens.scope would not contain calendar.readonly. Reject with clear error.
if (!tokens.scope.split(/\s+/).includes(SCOPE)) {
	return { error: "Required calendar read access was not granted. Please accept all requested scopes." };
}
```

This gap isn't a full task — fold it into Task 6 when implementing.

### Placeholder scan

Ran search for "TBD", "TODO", "FIXME", "fill in" — no plan-failure placeholders. Every code block contains real implementation or exact test content.

### Type consistency check

- `EncryptedToken` (crypto.ts) — used in signature of `encryptToken` / `decryptToken`; returned and fed back consistently.
- `OAuthStateRow` / `OAuthStateStore` (oauth-state.ts) — `OAuthStateStore` is narrow interface, ctx.storage.oauth_state wrapped via `stateStoreFor`. Consistent.
- `GoogleIdTokenPayload` (jwt.ts) — single source of truth; sandbox-entry.ts consumes it.
- Storage row shapes — `oauth_accounts` written in Task 6 uses fields declared in the indexes list in Task 5. Match.
- `oauth_calendars` written in Task 7 matches Task 5 indexes. Match.

No drift.

### Scope check

This plan covers OAuth handshake + calendar discovery + opt-in UI. It does NOT cover:

- Token refresh (prerequisite for sync — follow-up plan)
- events.list fetching (follow-up plan)
- Incremental sync via syncToken (follow-up plan)
- Rendering synced events on Weasley Clock dashboard (follow-up plan — will update Phase 1's DayView placeholder hourly column)
- Revocation + reauth banner (follow-up plan)

That's all in the spec's P2a.4, P2a.5, P2a.6. They get a follow-up plan of ~8-10 tasks after you validate this foundation against real Google calendars.

---

## Execution handoff

This plan has 9 tasks (including Task 0 for branch setup). Tasks 2, 3, 4 are pure-function TDD (low bungle risk). Tasks 5, 6, 7 are plugin wiring (moderate complexity — heed the worktree-safety note). Task 8 is the React admin page (most visible user-facing piece). Task 9 is manual QA against real Google.

**Tasks 1 and 9 require operator-only actions** — wrangler secrets, Google Cloud Console clicks, browser-based OAuth consent. An agent cannot complete these alone; you'll need to sit in the driver's seat for those two specifically.
