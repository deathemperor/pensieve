# Weasley Clock Booking — Phase 3 (API Keys + Webhooks) Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Programmatic access to booking data for partners/PAs (read-only API behind Bearer auth) and outbound webhooks fired on booking lifecycle events for downstream automation.

**Builds on Phase 1+2:** all booking storage, helpers, plugin admin scaffold are in place.

---

## Scope

- `api_keys` collection — generate, hash (SHA-256), label, scope, list, revoke
- `GET /api/weasley-clock/public/bookings` — Bearer-auth list endpoint with audience filtering
- API keys admin page in the existing weasley-clock plugin admin (sub-route alongside `/feeds`)
- `webhook_endpoints` collection — register endpoint URL + event subscriptions + secret + active toggle
- Webhook dispatch helper — HMAC-SHA256 signed POST on booking.created / booking.cancelled / booking.rescheduled
- Webhooks admin page

**Out of scope:** webhook delivery retries (best-effort fire-and-forget for MVP), webhook replay protection beyond HMAC + timestamp (acceptable for v1), webhook event subscriptions per-key scoping, OAuth2 client_credentials flow.

---

## File structure

```
src/lib/weasley-clock/
  storage.ts           # MODIFY: add ApiKeyData + WebhookEndpointData interfaces, add to collections()
  api-keys.ts          # NEW: hash + verify helpers
  webhooks.ts          # NEW: HMAC sign + dispatch helpers
src/pages/api/weasley-clock/
  public/bookings.ts   # NEW: Bearer-auth GET endpoint
  api-keys/
    index.ts           # NEW: POST create, GET list
    [id].ts            # NEW: DELETE revoke
  webhooks/
    index.ts           # NEW: POST create, GET list
    [id].ts            # NEW: PATCH (toggle active, rotate secret), DELETE
plugins/plugin-weasley-clock/src/
  index.ts             # MODIFY: register api_keys + webhook_endpoints storage namespaces, add admin pages
  sandbox-entry.ts     # MODIFY: same namespace registration
  admin/
    api-keys.tsx       # NEW: admin React page
    webhooks.tsx       # NEW: admin React page
    index.ts           # MODIFY: export new pages
src/lib/weasley-clock/
  booking-create.ts    # MODIFY: fire booking.created webhook
  booking-cancel.ts    # MODIFY: fire booking.cancelled webhook
  booking-reschedule.ts # MODIFY: fire booking.rescheduled webhook
```

---

## Task 1: Storage extensions

**Modify** `src/lib/weasley-clock/storage.ts`:

```ts
export interface ApiKeyData {
	label: string;
	hash: string;        // SHA-256 hex of the raw key
	scopes: string[];    // e.g., ["bookings:read"]
	created_at: string;
	last_used_at: string | null;
	revoked_at: string | null;
}

export interface WebhookEndpointData {
	url: string;
	events: string[];          // e.g., ["booking.created","booking.cancelled","booking.rescheduled"]
	secret: string;            // HMAC-SHA256 secret, rotated on demand
	active: boolean;
	created_at: string;
	last_dispatched_at: string | null;
	last_status: number | null;  // last HTTP status from a delivery
	last_error: string | null;
}
```

Add to `collections()`:
```ts
api_keys: new Collection<ApiKeyData>(db, "api_keys"),
webhook_endpoints: new Collection<WebhookEndpointData>(db, "webhook_endpoints"),
```

Update both plugin descriptors (`index.ts` + `sandbox-entry.ts`):
```ts
api_keys: { indexes: ["hash", "revoked_at"] },
webhook_endpoints: { indexes: ["active"] },
```

Commit: `feat(weasley-clock): add api_keys + webhook_endpoints collections`.

---

## Task 2: API key hash + verify helpers

**Create** `src/lib/weasley-clock/api-keys.ts`:

```ts
import type { D1Database } from "@cloudflare/workers-types";
import { collections } from "./storage";
import { ulid } from "../portraits/ulid";

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
```

Commit: `feat(weasley-clock): API key generation + verification helpers`.

---

## Task 3: Public GET /api/weasley-clock/public/bookings endpoint

**Create** `src/pages/api/weasley-clock/public/bookings.ts`:

```ts
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { verifyApiKey } from "../../../../lib/weasley-clock/api-keys";
import { collections } from "../../../../lib/weasley-clock/storage";
import { getEmDashCollection } from "emdash";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
	try {
		// Auth
		const auth = request.headers.get("authorization") ?? "";
		const m = auth.match(/^Bearer\s+(.+)$/i);
		if (!m) return json({ error: "Missing Bearer token" }, 401);
		const verifyResult = await verifyApiKey((env as any).DB, m[1], "bookings:read");
		if (!verifyResult.ok) return json({ error: `Auth failed: ${verifyResult.reason}` }, 401);

		// Filters
		const url = new URL(request.url);
		const audience = url.searchParams.get("audience"); // optional
		const status = url.searchParams.get("status") ?? "confirmed";
		const fromIso = url.searchParams.get("from");
		const toIso = url.searchParams.get("to");

		const c = collections((env as any).DB);
		const all = await c.bookings.list();

		// If audience filter set, look up meeting types and filter by audience_tags
		let mtAllowed: Set<string> | null = null;
		if (audience) {
			const { entries: mts } = await getEmDashCollection("meeting_types");
			const allowed: string[] = [];
			for (const e of mts ?? []) {
				const tags = e.data?.audience_tags ?? e.audience_tags;
				let parsed: string[] = [];
				try { parsed = typeof tags === "string" ? JSON.parse(tags) : (Array.isArray(tags) ? tags : []); } catch { parsed = []; }
				if (parsed.includes(audience)) allowed.push(e.id);
			}
			mtAllowed = new Set(allowed);
		}

		const fromMs = fromIso ? new Date(fromIso).getTime() : -Infinity;
		const toMs = toIso ? new Date(toIso).getTime() : Infinity;

		const matched = all
			.filter((r) => r.data.status === status)
			.filter((r) => !mtAllowed || mtAllowed.has(r.data.meeting_type_id))
			.filter((r) => {
				const t = new Date(r.data.slot_start_iso).getTime();
				return t >= fromMs && t <= toMs;
			})
			.map((r) => ({
				id: r.id,
				meeting_type_id: r.data.meeting_type_id,
				slot_start_iso: r.data.slot_start_iso,
				slot_end_iso: r.data.slot_end_iso,
				timezone: r.data.timezone,
				guest_name: r.data.guest_name,
				guest_email: r.data.guest_email,
				status: r.data.status,
				created_at: r.data.created_at,
				cancelled_at: r.data.cancelled_at,
			}));

		return json({ bookings: matched, count: matched.length });
	} catch (err: any) {
		console.error("[wc/public/bookings]", err?.message ?? err);
		return json({ error: "Internal error" }, 500);
	}
};

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
```

Commit: `feat(weasley-clock): GET /public/bookings — Bearer-auth read API`.

---

## Task 4: API keys admin UI page

**Create** `plugins/plugin-weasley-clock/src/admin/api-keys.tsx` — React component listing keys (mask hash, show label/scopes/created/lastUsed), generating new keys (show raw value ONCE in a modal), revoking keys.

**Create** `src/pages/api/weasley-clock/api-keys/index.ts` — `POST` (admin-only, isAdmin guard) creates a key + returns `{ raw, id }`; `GET` (admin-only) lists all (excluding hashes).

**Create** `src/pages/api/weasley-clock/api-keys/[id].ts` — `DELETE` (admin-only) revokes (sets `revoked_at`).

**Modify** `plugins/plugin-weasley-clock/src/admin/index.ts` to export the new page.

**Modify** plugin descriptors to add `adminPages` entry: `{ path: "/api-keys", label: "API Keys", icon: "key" }`.

Use `isAdmin(locals)` from `src/lib/weasley-clock/auth.ts` (existing) for all CRUD endpoints.

Commit: `feat(weasley-clock): API keys CRUD admin + endpoints`.

---

## Task 5: Webhook dispatch helper

**Create** `src/lib/weasley-clock/webhooks.ts`:

```ts
import type { D1Database } from "@cloudflare/workers-types";
import { collections } from "./storage";

export type WebhookEvent = "booking.created" | "booking.cancelled" | "booking.rescheduled";

export interface DispatchInput {
	db: D1Database;
	event: WebhookEvent;
	data: Record<string, unknown>;
}

export async function dispatchWebhook(input: DispatchInput): Promise<void> {
	try {
		const c = collections(input.db);
		const all = await c.webhook_endpoints.list();
		const targets = all.filter(
			(r) => r.data.active && r.data.events.includes(input.event),
		);
		if (targets.length === 0) return;

		const payload = JSON.stringify({
			event: input.event,
			timestamp: new Date().toISOString(),
			data: input.data,
		});

		// Fire all in parallel; collect results to update last_status / last_error.
		await Promise.allSettled(
			targets.map(async (t) => {
				try {
					const sig = await sign(t.data.secret, payload);
					const res = await fetch(t.data.url, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-WC-Signature": `sha256=${sig}`,
							"X-WC-Event": input.event,
						},
						body: payload,
					});
					await c.webhook_endpoints.put(t.id, {
						...t.data,
						last_dispatched_at: new Date().toISOString(),
						last_status: res.status,
						last_error: res.ok ? null : `HTTP ${res.status}`,
					});
				} catch (err: any) {
					await c.webhook_endpoints.put(t.id, {
						...t.data,
						last_dispatched_at: new Date().toISOString(),
						last_status: 0,
						last_error: err?.message ?? String(err),
					}).catch(() => undefined);
				}
			}),
		);
	} catch (err: any) {
		// Webhook dispatch is fire-and-forget — never block booking flow.
		console.error("[webhooks] dispatch exception:", err?.message ?? err);
	}
}

async function sign(secret: string, body: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
	return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

Commit: `feat(weasley-clock): HMAC-signed webhook dispatch helper`.

---

## Task 6: Wire dispatch into booking lifecycle

Modify three files:

- `booking-create.ts` — after the `bookings.put`, call `dispatchWebhook({ db, event: "booking.created", data: { booking_id, meeting_type_id, slot_start_iso, slot_end_iso, guest_email, guest_name, timezone } })`. Use `ctx.waitUntil` if available; else just `await` it (cheap).
- `booking-cancel.ts` — after status flip, dispatch `booking.cancelled` with `{ booking_id, slot_start_iso, cancelled_at }`.
- `booking-reschedule.ts` — after PATCH+row update, dispatch `booking.rescheduled` with `{ booking_id, old_slot_start_iso, new_slot_start_iso, new_slot_end_iso }`.

All three: webhook dispatch is non-fatal — wrap in try/catch and log only.

Commit: `feat(weasley-clock): fire webhooks on booking.created/cancelled/rescheduled`.

---

## Task 7: Webhook admin UI

**Create** `plugins/plugin-weasley-clock/src/admin/webhooks.tsx` — React component. List webhooks (URL, events, active toggle, last status, last_dispatched_at). New webhook form: URL, events checkboxes, generates secret on creation, shows secret ONCE in modal. Edit (toggle active, rotate secret), delete.

**Create** API endpoints under `src/pages/api/weasley-clock/webhooks/index.ts` and `[id].ts`. All admin-only via `isAdmin(locals)`.

**Modify** plugin admin index + descriptor to register the page.

Commit: `feat(weasley-clock): webhook endpoints CRUD admin + endpoints`.

---

## Task 8: PR + deploy + smoke test

- Push branch.
- Open PR with test plan covering: create API key via admin → curl public/bookings with key → see filtered result; create webhook pointing to a temporary endpoint → make a booking → verify HMAC-signed POST received with correct event payload; revoke API key → curl returns 401.
- Squash-merge.
- Wait for deploy.

---

## Phase 4 (round-robin) deferred to a separate plan, simpler scope:

- Allow `host_account_ids` to have multiple entries
- Slot computation merges availability across all hosts (any free host counts the slot as available)
- On booking create, assign to least-recently-booked host (count of confirmed bookings in next 30 days)
- Stored on `bookings.host_account_id` row

A separate ~1-session plan after Phase 3 ships.
