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
