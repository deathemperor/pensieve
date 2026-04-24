import type { Collection, OAuthStateData } from "./storage";

const TTL_MS = 10 * 60 * 1000;
const STATE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function randomState(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	let out = "";
	for (let i = 0; i < 32; i++) out += STATE_ALPHABET[bytes[i] % 32];
	return out;
}

export async function generateState(
	store: Collection<OAuthStateData>,
	opts: { now?: Date; returnUrl?: string } = {},
): Promise<string> {
	const now = opts.now ?? new Date();
	const state = randomState();
	await store.put(state, {
		state,
		created_at: now.toISOString(),
		expires_at: new Date(now.getTime() + TTL_MS).toISOString(),
		return_url: opts.returnUrl,
	});
	return state;
}

export async function consumeState(
	store: Collection<OAuthStateData>,
	state: string,
	opts: { now?: Date } = {},
): Promise<OAuthStateData | null> {
	const now = opts.now ?? new Date();
	const found = await store.get(state);
	if (!found) return null;
	await store.delete(state);
	const expiresAt = new Date(found.data.expires_at);
	if (expiresAt.getTime() < now.getTime()) return null;
	return found.data;
}
