import type { D1Database } from "@cloudflare/workers-types";
import { collections } from "./storage";

const KEY_PREFIX = "wck_"; // weasley-clock key

export async function generateApiKey(): Promise<{ raw: string; hash: string }> {
	const random = crypto.getRandomValues(new Uint8Array(32));
	const raw = KEY_PREFIX + base32(random); // 32 bytes → ~52 base32 chars
	const hash = await sha256Hex(raw);
	return { raw, hash };
}

export async function verifyApiKey(
	db: D1Database,
	rawKey: string,
	requiredScope: string,
): Promise<{ ok: true; keyId: string; scopes: string[] } | { ok: false; reason: string }> {
	if (!rawKey.startsWith(KEY_PREFIX)) return { ok: false, reason: "invalid_format" };
	const hash = await sha256Hex(rawKey);
	const c = collections(db);
	const all = await c.api_keys.list();
	const match = all.find((r) => r.data.hash === hash && !r.data.revoked_at);
	if (!match) return { ok: false, reason: "not_found_or_revoked" };
	if (!match.data.scopes.includes(requiredScope)) return { ok: false, reason: "missing_scope" };
	// stamp last_used_at, fire-and-forget on failure
	c.api_keys.put(match.id, { ...match.data, last_used_at: new Date().toISOString() })
		.catch((err) => console.error("[api-keys] last_used_at update failed:", err?.message ?? err));
	return { ok: true, keyId: match.id, scopes: match.data.scopes };
}

async function sha256Hex(s: string): Promise<string> {
	const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
	return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base32(bytes: Uint8Array): string {
	const ALPH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
	let out = "";
	for (let i = 0; i < bytes.length; i++) out += ALPH[bytes[i] % 32];
	return out;
}
