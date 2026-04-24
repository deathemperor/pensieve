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
	assert.equal(store._size(), 0);
});

test("consumeState: expired state → null + deletes row", async () => {
	const store = mkStore();
	const created = new Date("2026-04-24T10:00:00Z");
	const token = await generateState(store, { now: created, returnUrl: "/x" });
	const later = new Date("2026-04-24T10:11:00Z");
	const result = await consumeState(store, token, { now: later });
	assert.equal(result, null);
	assert.equal(store._size(), 0);
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
