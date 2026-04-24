import { decryptToken, encryptToken } from "./crypto";

export interface OAuthAccountRow {
	id: string;
	provider: "google";
	account_email: string;
	access_token_enc: string;
	access_token_iv: string;
	refresh_token_enc: string;
	refresh_token_iv: string;
	access_token_expires_at: string;
	scope: string;
	status: "active" | "revoked" | "error";
}

export interface EnsureOptions {
	encKey: string;
	clientId: string;
	clientSecret: string;
	fetchImpl?: typeof fetch;
	// Consider expired if < this many seconds remain. Default 60.
	expirySkewSec?: number;
}

export interface EnsureResult {
	access_token: string;
	refreshed: boolean;
	updatedRow: OAuthAccountRow | null;
}

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// Returns a usable access token. If the current one has > skewSec of life
// left, returns it as-is. Otherwise refreshes via refresh_token grant and
// returns the new token + an updated row (for the caller to persist).
// On invalid_grant, throws — caller should mark the account revoked.
export async function ensureFreshAccessToken(
	row: OAuthAccountRow,
	opts: EnsureOptions,
): Promise<EnsureResult> {
	const skew = opts.expirySkewSec ?? 60;
	const expiresAt = new Date(row.access_token_expires_at).getTime();
	const now = Date.now();

	if (expiresAt > now + skew * 1000) {
		const access_token = await decryptToken(
			{ ciphertext_b64: row.access_token_enc, iv_b64: row.access_token_iv },
			opts.encKey,
		);
		return { access_token, refreshed: false, updatedRow: null };
	}

	const refresh_token = await decryptToken(
		{ ciphertext_b64: row.refresh_token_enc, iv_b64: row.refresh_token_iv },
		opts.encKey,
	);

	const fetchImpl = opts.fetchImpl ?? fetch;
	let lastErr = "";
	for (let attempt = 0; attempt < 2; attempt++) {
		const res = await fetchImpl(GOOGLE_TOKEN_URL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token,
				client_id: opts.clientId,
				client_secret: opts.clientSecret,
			}),
		});
		if (res.ok) {
			const tok = (await res.json()) as { access_token: string; expires_in: number; scope?: string };
			const enc = await encryptToken(tok.access_token, opts.encKey);
			const updatedRow: OAuthAccountRow = {
				...row,
				access_token_enc: enc.ciphertext_b64,
				access_token_iv: enc.iv_b64,
				access_token_expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
				// scope may narrow on refresh — preserve returned scope
				scope: tok.scope ?? row.scope,
				status: "active",
			};
			return { access_token: tok.access_token, refreshed: true, updatedRow };
		}
		const text = await res.text();
		lastErr = `${res.status} ${text}`;
		if (res.status === 400 && /invalid_grant/i.test(text)) {
			throw new Error(`Refresh failed: invalid_grant (${text})`);
		}
		// Only retry on 5xx
		if (res.status < 500) break;
	}
	throw new Error(`Refresh failed: ${lastErr}`);
}
