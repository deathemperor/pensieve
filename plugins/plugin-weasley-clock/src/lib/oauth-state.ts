export interface OAuthStateRow {
	state: string;
	created_at: string;
	expires_at: string;
	return_url?: string;
}

// Narrow interface matching EmDash's ctx.storage.<namespace> shape.
// Tests inject a Map-backed version; production passes ctx.storage.oauth_state.
export interface OAuthStateStore {
	put(id: string, data: OAuthStateRow): Promise<void>;
	get(id: string): Promise<{ id: string; data: OAuthStateRow } | null>;
	delete(id: string): Promise<void>;
}

const TTL_MS = 10 * 60 * 1000;
const STATE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";  // RFC 4648 base32

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

// Atomically check + consume a state token. Returns the row if valid, else
// null. Always deletes the row (even if expired) to prevent replay.
export async function consumeState(
	store: OAuthStateStore,
	state: string,
	opts: { now?: Date } = {},
): Promise<OAuthStateRow | null> {
	const now = opts.now ?? new Date();
	const found = await store.get(state);
	if (!found) return null;
	await store.delete(state);
	const expiresAt = new Date(found.data.expires_at);
	if (expiresAt.getTime() < now.getTime()) return null;
	return found.data;
}
