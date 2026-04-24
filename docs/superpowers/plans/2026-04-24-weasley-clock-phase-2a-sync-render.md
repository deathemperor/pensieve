# Weasley Clock Phase 2a Sync + Render Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Phase 2a — a Cloudflare cron trigger refreshes tokens and pulls events from each `synced=1` Google calendar every 5 min, events land in `synced_events`, the Weasley Clock Day/Week/Month/Year views render them alongside family events, and the admin UI handles token-revocation gracefully with a reauth banner.

**Architecture:** Extend the already-shipped plugin-weasley-clock with (a) a token-refresh helper that decrypts, calls `oauth2.googleapis.com/token?grant_type=refresh_token`, re-encrypts, and persists; (b) an incremental-sync function using Google's `events.list` with `syncToken` (falls back to full resync on HTTP 410); (c) a Cloudflare `scheduled` handler wired to both a cron trigger and an admin "Sync now" button; (d) minor query updates in the Weasley Clock page + views to merge `synced_events` with `family_events` on the same timeline; (e) an `ec_plugin_oauth_accounts.status='revoked'` guard that hides calendars from the cron and surfaces a banner in the admin UI.

**Tech Stack:** EmDash 0.5 native plugin runtime (hooks/routes/scheduled), Web Crypto (reuse Phase 2a Foundations' crypto.ts), Google Calendar API v3 (`events.list`, `token` endpoints), Cloudflare Workers Cron Triggers via `scheduled` plugin hook, React (admin banner), Astro SSR (view components).

**Spec:** `docs/superpowers/specs/2026-04-23-weasley-clock-phase-2a-oauth-sync-design.md` — specifically §Data flow Step 4 (ongoing incremental sync), §Step 5 (revocation), §UI additions (banner + status indicators), and the "P2a.4 / P2a.5 / P2a.6" items in §Implementation phasing.

**Predecessor:** `2026-04-24-weasley-clock-phase-2a-oauth-foundations.md` (landed as PR #68). This plan assumes its commits are present — `oauth_accounts`, `oauth_calendars`, `oauth_state`, `synced_events` storage namespaces are declared; crypto.ts / jwt.ts / oauth-state.ts are available to import; OAuth handshake is functional.

---

## File structure

**Created:**
- `plugins/plugin-weasley-clock/src/lib/token-refresh.ts` — decrypt + refresh + re-encrypt helper with unit tests
- `plugins/plugin-weasley-clock/src/lib/sync-calendar.ts` — per-calendar incremental-sync function
- `plugins/plugin-weasley-clock/src/lib/events-map.ts` — transforms Google's event JSON → our `synced_events` row shape
- `plugins/plugin-weasley-clock/tests/token-refresh.test.ts` — 4 tests
- `plugins/plugin-weasley-clock/tests/events-map.test.ts` — 5 tests (all-day vs timed, cancelled soft-delete, RRULE-expanded instances, description/location handling)
- `plugins/plugin-weasley-clock/tests/sync-calendar.test.ts` — 4 tests (first run = no syncToken, subsequent incremental, 410 Gone resync, invalid_grant sets status=revoked)
- `src/utils/weasleyClockEvents.ts` — Astro-side helper: fetch + merge `synced_events` + materialised family events for a given time window
- `tests/utils/weasleyClockEvents.test.ts` — 3 tests (empty, solo synced, interleaved with family)

**Modified:**
- `plugins/plugin-weasley-clock/src/sandbox-entry.ts` — add `scheduled` hook + `sync-now` route + `accounts/list` response field `has_error` + banner-hiding `dismiss-reauth-banner` route
- `plugins/plugin-weasley-clock/src/admin/feeds.tsx` — render reauth banner when any account has `status='revoked'` or `last_sync_error`; add per-account "Sync now" button
- `src/pages/nydus/weasley-clock/index.astro` — merge synced_events into the materialised event window
- `src/components/weasley-clock/DayCell.astro` — accept either `FamilyOccurrence` or `SyncedOccurrence` (both have `date`, `title`, `category`)
- `src/components/weasley-clock/DayView.astro` — render timed events in the hourly column (currently a placeholder)
- `src/components/weasley-clock/YearView.astro` — include synced_events in the density heatmap
- `src/components/weasley-clock/EventChip.astro` — add `work`/`openclaw`/`personal` tint variants for synced events
- `plugins/plugin-weasley-clock/src/index.ts` — add `cronTriggers: [{ schedule: "*/5 * * * *", endpoint: "cron/sync-all" }]` or whatever EmDash's cron declaration shape is (verify during Task 1)
- `wrangler.jsonc` — add `triggers.crons` entry for `*/5 * * * *` if not managed by the plugin descriptor

---

## Worktree safety (every task)

Every subagent prompt MUST include this check as the first action:

```bash
cd /Users/deathemperor/death/pensieve/.claude/worktrees/molly
pwd && git branch --show-current
```

Expected: the `molly` path and branch `feat/weasley-clock-phase-2a-foundations` (same branch as PR #68 — all tasks append to it). If not, STOP with BLOCKED.

---

## Task 1: Investigate EmDash's scheduled-hook + cron registration shape

No code written yet — reconnaissance. Half an hour now saves four hours later if we guess the wrong API.

**Files:** none — read-only.

- [ ] **Step 1: Read the existing `scheduled` pattern in plugin-pensieve-engage**

```bash
grep -B 2 -A 10 "scheduled\|cron" plugins/plugin-pensieve-engage/src/sandbox-entry.ts | head -40
grep -B 2 -A 5 "cronTriggers\|crons\|schedule" plugins/plugin-pensieve-engage/src/index.ts | head -20
```

- [ ] **Step 2: Read EmDash's compiled runtime for the scheduled dispatch path**

```bash
grep -B 2 -A 8 "scheduled\s*(\|scheduled:\|cronTriggers\|cronEndpoint" node_modules/emdash/dist/**/*.mjs 2>/dev/null | head -40
```

- [ ] **Step 3: Look at `wrangler.jsonc` top-level cron triggers shape**

```bash
grep -B 1 -A 5 "triggers\|crons" wrangler.jsonc
```

If neither EmDash nor wrangler.jsonc already has a cron wiring, we'll use wrangler's `triggers.crons` directly and call our plugin's HTTP route from the worker's `scheduled` handler in `src/worker.ts`.

- [ ] **Step 4: Write findings as comments at the top of a new file `plugins/plugin-weasley-clock/src/CRON.md`**

Example content structure (fill with actual observations):

```md
# Cron wiring for plugin-weasley-clock

## EmDash API (what we found):
- Plugins declare scheduled hooks via `scheduled:` key in definePlugin({ scheduled: { handler: async (event, ctx) => {...} } })
- OR not supported; fallback is wrangler-level cron + HTTP route

## Chosen approach:
- [Option A: EmDash scheduled hook]  — implemented in Task 4
- [Option B: wrangler cron triggers.crons: ["*/5 * * * *"] + src/worker.ts scheduled() → fetch plugin route]  — implemented in Task 4

## Rationale:
(1-2 sentences)
```

- [ ] **Step 5: Commit (optional — safe to include, useful as a record)**

```bash
git add plugins/plugin-weasley-clock/src/CRON.md
git commit -m "docs(weasley-clock): findings on EmDash scheduled-hook vs wrangler cron wiring"
```

---

## Task 2: Token refresh helper (TDD)

**Files:**
- Create: `plugins/plugin-weasley-clock/src/lib/token-refresh.ts`
- Create: `plugins/plugin-weasley-clock/tests/token-refresh.test.ts`

Purpose: given an `oauth_accounts` row, return a valid (refreshed if needed) access token. Handles the common "token expired" case transparently.

- [ ] **Step 1: Write the failing test**

`plugins/plugin-weasley-clock/tests/token-refresh.test.ts`:

```ts
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { ensureFreshAccessToken, type OAuthAccountRow } from "../src/lib/token-refresh";
import { encryptToken } from "../src/lib/crypto";

const TEST_KEY_B64 = "XjwK/3ucADAnw/Nx+FSnsC7Ra/x6O/bQlcJo3RGA9qs=";
const CLIENT_ID = "cid.apps.googleusercontent.com";
const CLIENT_SECRET = "test-secret";

async function makeRow(access: string, refresh: string, expiresInSec: number): Promise<OAuthAccountRow> {
	const a = await encryptToken(access, TEST_KEY_B64);
	const r = await encryptToken(refresh, TEST_KEY_B64);
	return {
		id: "acc_test",
		provider: "google",
		account_email: "t@example.com",
		access_token_enc: a.ciphertext_b64,
		access_token_iv: a.iv_b64,
		refresh_token_enc: r.ciphertext_b64,
		refresh_token_iv: r.iv_b64,
		access_token_expires_at: new Date(Date.now() + expiresInSec * 1000).toISOString(),
		scope: "https://www.googleapis.com/auth/calendar.readonly",
		status: "active",
	};
}

test("returns existing token when not expired (> 60s remaining)", async () => {
	const row = await makeRow("FAKE_ACCESS_FRESH", "FAKE_REFRESH", 3600);
	let fetchCalled = 0;
	const { access_token, refreshed } = await ensureFreshAccessToken(row, {
		encKey: TEST_KEY_B64,
		clientId: CLIENT_ID,
		clientSecret: CLIENT_SECRET,
		fetchImpl: async () => { fetchCalled++; throw new Error("should not be called"); },
	});
	assert.equal(access_token, "FAKE_ACCESS_FRESH");
	assert.equal(refreshed, false);
	assert.equal(fetchCalled, 0);
});

test("refreshes when < 60s remaining; returns new token + new encrypted fields", async () => {
	const row = await makeRow("FAKE_ACCESS_OLD", "FAKE_REFRESH", 30);
	const { access_token, refreshed, updatedRow } = await ensureFreshAccessToken(row, {
		encKey: TEST_KEY_B64,
		clientId: CLIENT_ID,
		clientSecret: CLIENT_SECRET,
		fetchImpl: async () => new Response(
			JSON.stringify({ access_token: "FAKE_ACCESS_NEW", expires_in: 3600, scope: row.scope, token_type: "Bearer" }),
			{ status: 200, headers: { "content-type": "application/json" } },
		),
	});
	assert.equal(access_token, "FAKE_ACCESS_NEW");
	assert.equal(refreshed, true);
	assert.ok(updatedRow);
	assert.notEqual(updatedRow!.access_token_enc, row.access_token_enc);  // new ciphertext
	assert.notEqual(updatedRow!.access_token_iv, row.access_token_iv);     // new IV
	assert.ok(new Date(updatedRow!.access_token_expires_at).getTime() > Date.now() + 60 * 60 * 1000 - 5000);
});

test("propagates invalid_grant — caller should mark account revoked", async () => {
	const row = await makeRow("FAKE_ACCESS_OLD", "FAKE_REVOKED", 10);
	await assert.rejects(
		() => ensureFreshAccessToken(row, {
			encKey: TEST_KEY_B64,
			clientId: CLIENT_ID,
			clientSecret: CLIENT_SECRET,
			fetchImpl: async () => new Response(
				JSON.stringify({ error: "invalid_grant", error_description: "Token has been expired or revoked." }),
				{ status: 400, headers: { "content-type": "application/json" } },
			),
		}),
		(err: Error) => /invalid_grant/i.test(err.message),
	);
});

test("retries transient 5xx once, then propagates on second failure", async () => {
	const row = await makeRow("FAKE_ACCESS_OLD", "FAKE_REFRESH", 10);
	let n = 0;
	await assert.rejects(
		() => ensureFreshAccessToken(row, {
			encKey: TEST_KEY_B64,
			clientId: CLIENT_ID,
			clientSecret: CLIENT_SECRET,
			fetchImpl: async () => { n++; return new Response("gateway", { status: 502 }); },
		}),
		(err: Error) => /502|refresh failed/i.test(err.message),
	);
	assert.equal(n, 2, "expected one retry before giving up");
});
```

- [ ] **Step 2: Run — should fail**

```bash
node --import tsx --test plugins/plugin-weasley-clock/tests/token-refresh.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `plugins/plugin-weasley-clock/src/lib/token-refresh.ts`**

```ts
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
	let lastErr: string = "";
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
				// scope may narrow on refresh if Google ever does that — preserve returned scope
				scope: tok.scope ?? row.scope,
				status: "active",
			};
			return { access_token: tok.access_token, refreshed: true, updatedRow };
		}
		const text = await res.text();
		lastErr = `${res.status} ${text}`;
		// invalid_grant: don't retry — caller must handle
		if (res.status === 400 && /invalid_grant/i.test(text)) {
			throw new Error(`Refresh failed: invalid_grant (${text})`);
		}
		// Only retry on 5xx
		if (res.status < 500) break;
	}
	throw new Error(`Refresh failed: ${lastErr}`);
}
```

- [ ] **Step 4: Run — should pass**

```bash
node --import tsx --test plugins/plugin-weasley-clock/tests/token-refresh.test.ts
```

Expected: 4 pass, 0 fail.

- [ ] **Step 5: Typecheck + sync node_modules + commit**

```bash
npm run typecheck 2>&1 | grep "token-refresh" | head -3
cp plugins/plugin-weasley-clock/src/lib/token-refresh.ts node_modules/plugin-weasley-clock/src/lib/token-refresh.ts
git add plugins/plugin-weasley-clock/src/lib/token-refresh.ts plugins/plugin-weasley-clock/tests/token-refresh.test.ts
git commit -m "feat(weasley-clock): token-refresh helper with expiry skew + invalid_grant propagation"
```

---

## Task 3: Events-map helper (TDD)

Pure function that transforms Google's event payload into our `synced_events` row shape.

**Files:**
- Create: `plugins/plugin-weasley-clock/src/lib/events-map.ts`
- Create: `plugins/plugin-weasley-clock/tests/events-map.test.ts`

- [ ] **Step 1: Write the failing test**

`plugins/plugin-weasley-clock/tests/events-map.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mapGoogleEvent, isCancelled } from "../src/lib/events-map";

const ACCOUNT_ID = "acc_test";
const CALENDAR_ID = "primary";

test("timed event — start.dateTime and end.dateTime", () => {
	const row = mapGoogleEvent({
		id: "abc123",
		status: "confirmed",
		summary: "Sprint review",
		location: "Hanoi office",
		description: "Weekly team meeting",
		start: { dateTime: "2026-04-23T10:00:00+07:00" },
		end: { dateTime: "2026-04-23T11:00:00+07:00" },
	}, { accountId: ACCOUNT_ID, calendarId: CALENDAR_ID });

	assert.equal(row.external_uid, "abc123");
	assert.equal(row.title, "Sprint review");
	assert.equal(row.location, "Hanoi office");
	assert.equal(row.description, "Weekly team meeting");
	assert.equal(row.all_day, 0);
	assert.equal(row.deleted, 0);
	assert.equal(row.source_type, "gcal");
	assert.equal(row.gcal_account_id, ACCOUNT_ID);
	assert.equal(row.gcal_calendar_id, CALENDAR_ID);
	assert.equal(row.starts_at, "2026-04-23T03:00:00.000Z");
	assert.equal(row.ends_at, "2026-04-23T04:00:00.000Z");
});

test("all-day event — start.date and end.date", () => {
	const row = mapGoogleEvent({
		id: "bday-tam",
		status: "confirmed",
		summary: "Tam birthday",
		start: { date: "2026-04-25" },
		end: { date: "2026-04-26" },
	}, { accountId: ACCOUNT_ID, calendarId: CALENDAR_ID });

	assert.equal(row.all_day, 1);
	// all-day events anchor to HCMC midnight (UTC+7) — consistent with family_events
	assert.equal(row.starts_at, "2026-04-24T17:00:00.000Z");
	assert.equal(row.ends_at, "2026-04-25T17:00:00.000Z");
});

test("cancelled event — deleted=1", () => {
	const row = mapGoogleEvent({
		id: "cancelled-42",
		status: "cancelled",
		summary: "Moved to next week",
		start: { dateTime: "2026-04-23T10:00:00+07:00" },
		end: { dateTime: "2026-04-23T11:00:00+07:00" },
	}, { accountId: ACCOUNT_ID, calendarId: CALENDAR_ID });

	assert.equal(row.deleted, 1);
});

test("isCancelled helper returns true for status=cancelled and for truthy .deleted on compact sync responses", () => {
	assert.equal(isCancelled({ status: "cancelled" } as any), true);
	assert.equal(isCancelled({ deleted: true } as any), true);
	assert.equal(isCancelled({ status: "confirmed" } as any), false);
	assert.equal(isCancelled({} as any), false);
});

test("title defaults to '(no title)' when summary is missing — avoids empty chips on the dashboard", () => {
	const row = mapGoogleEvent({
		id: "no-title",
		status: "confirmed",
		start: { dateTime: "2026-04-23T10:00:00+07:00" },
		end: { dateTime: "2026-04-23T11:00:00+07:00" },
	} as any, { accountId: ACCOUNT_ID, calendarId: CALENDAR_ID });

	assert.equal(row.title, "(no title)");
});
```

- [ ] **Step 2: Run — should fail**

```bash
node --import tsx --test plugins/plugin-weasley-clock/tests/events-map.test.ts
```

- [ ] **Step 3: Implement `plugins/plugin-weasley-clock/src/lib/events-map.ts`**

```ts
export interface GoogleEvent {
	id: string;
	status: "confirmed" | "tentative" | "cancelled";
	summary?: string;
	location?: string;
	description?: string;
	start: { dateTime?: string; date?: string; timeZone?: string };
	end: { dateTime?: string; date?: string; timeZone?: string };
	deleted?: boolean;
}

export interface SyncedEventRow {
	id: string;  // caller builds this
	source_type: "gcal";
	gcal_account_id: string;
	gcal_calendar_id: string;
	external_uid: string;
	title: string;
	starts_at: string;   // ISO UTC
	ends_at: string;      // ISO UTC
	all_day: 0 | 1;
	location: string | null;
	description: string | null;
	deleted: 0 | 1;
	synced_at: string;
}

export function isCancelled(evt: GoogleEvent): boolean {
	return evt.status === "cancelled" || evt.deleted === true;
}

const HCMC_OFFSET_MS = 7 * 3600 * 1000;

// all-day dates in Google's API are a date-only string like "2026-04-25".
// We anchor them to HCMC midnight (matches how family_events are stored).
function allDayToUtc(dateStr: string): string {
	const [y, m, d] = dateStr.split("-").map(Number);
	const utcMidnight = Date.UTC(y, m - 1, d);
	return new Date(utcMidnight - HCMC_OFFSET_MS).toISOString();
}

export function mapGoogleEvent(
	evt: GoogleEvent,
	ctx: { accountId: string; calendarId: string },
): SyncedEventRow {
	const allDay = !!(evt.start.date && !evt.start.dateTime);
	const starts_at = allDay
		? allDayToUtc(evt.start.date!)
		: new Date(evt.start.dateTime!).toISOString();
	const ends_at = allDay
		? allDayToUtc(evt.end.date!)
		: new Date(evt.end.dateTime!).toISOString();

	const id = `gcal_${ctx.accountId}_${ctx.calendarId}_${evt.id}`.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 128);

	return {
		id,
		source_type: "gcal",
		gcal_account_id: ctx.accountId,
		gcal_calendar_id: ctx.calendarId,
		external_uid: evt.id,
		title: evt.summary?.trim() || "(no title)",
		starts_at,
		ends_at,
		all_day: allDay ? 1 : 0,
		location: evt.location?.trim() || null,
		description: evt.description?.trim() || null,
		deleted: isCancelled(evt) ? 1 : 0,
		synced_at: new Date().toISOString(),
	};
}
```

- [ ] **Step 4: Run — pass**

```bash
node --import tsx --test plugins/plugin-weasley-clock/tests/events-map.test.ts
```

Expected: 5 pass, 0 fail.

- [ ] **Step 5: Sync + commit**

```bash
cp plugins/plugin-weasley-clock/src/lib/events-map.ts node_modules/plugin-weasley-clock/src/lib/events-map.ts
git add plugins/plugin-weasley-clock/src/lib/events-map.ts plugins/plugin-weasley-clock/tests/events-map.test.ts
git commit -m "feat(weasley-clock): events-map helper — Google event JSON → synced_events row"
```

---

## Task 4: Per-calendar incremental sync (TDD)

**Files:**
- Create: `plugins/plugin-weasley-clock/src/lib/sync-calendar.ts`
- Create: `plugins/plugin-weasley-clock/tests/sync-calendar.test.ts`

The workhorse: given an `oauth_calendars` row, pull events via `events.list` (incremental if `sync_token` exists, full otherwise), upsert/soft-delete into `synced_events`, save the new `sync_token`.

- [ ] **Step 1: Write the failing tests**

`plugins/plugin-weasley-clock/tests/sync-calendar.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { syncCalendar, type CalendarRow, type SyncContext } from "../src/lib/sync-calendar";

function mkStore(): any {
	const rows = new Map<string, any>();
	return {
		async put(id: string, data: any) { rows.set(id, { id, data }); },
		async get(id: string) {
			const r = rows.get(id);
			return r ? { id, data: r.data } : null;
		},
		async delete(id: string) { rows.delete(id); },
		async query(_filter: any) {
			return { items: Array.from(rows.values()) };
		},
		_size: () => rows.size,
		_rows: () => Array.from(rows.values()),
	};
}

function mkCal(overrides: Partial<CalendarRow> = {}): CalendarRow {
	return {
		id: "cal_acc1_primary",
		account_id: "acc1",
		calendar_id: "primary",
		summary: "Work",
		synced: 1,
		sync_token: null,
		last_resynced_at: null,
		expose_titles: 1,
		...overrides,
	};
}

function ctxWith(fetchImpl: typeof fetch, syncedEventsStore: any, calendarsStore: any): SyncContext {
	return {
		storage: { synced_events: syncedEventsStore, oauth_calendars: calendarsStore } as any,
		getAccessToken: async () => "FAKE_ACCESS_MOCK",
		fetchImpl,
	};
}

test("first run — no sync_token, full fetch, upserts all events, saves returned nextSyncToken", async () => {
	const cal = mkCal();
	const syncedEvents = mkStore();
	const cals = mkStore();
	await cals.put(cal.id, cal);
	const fetchImpl = (async (url: any) => {
		assert.ok(!String(url).includes("syncToken="), "first run should NOT send syncToken");
		return new Response(JSON.stringify({
			items: [
				{ id: "e1", status: "confirmed", summary: "Meeting",
					start: { dateTime: "2026-04-23T10:00:00+07:00" },
					end: { dateTime: "2026-04-23T11:00:00+07:00" } },
			],
			nextSyncToken: "SYNC_TOKEN_V1",
		}), { status: 200 });
	}) as typeof fetch;

	await syncCalendar(cal, ctxWith(fetchImpl, syncedEvents, cals));

	const rows = syncedEvents._rows();
	assert.equal(rows.length, 1);
	assert.equal(rows[0].data.external_uid, "e1");
	const cal2 = await cals.get(cal.id);
	assert.equal(cal2.data.sync_token, "SYNC_TOKEN_V1");
	assert.ok(cal2.data.last_resynced_at);
});

test("subsequent run — existing sync_token, incremental fetch; cancelled event soft-deleted", async () => {
	const cal = mkCal({ sync_token: "OLD" });
	const syncedEvents = mkStore();
	const cals = mkStore();
	await cals.put(cal.id, cal);
	// Seed an existing event that will be cancelled
	await syncedEvents.put("gcal_acc1_primary_e1", {
		external_uid: "e1",
		deleted: 0,
		title: "Meeting",
		source_type: "gcal",
		gcal_account_id: "acc1",
		gcal_calendar_id: "primary",
	});

	const fetchImpl = (async (url: any) => {
		assert.ok(String(url).includes("syncToken=OLD"), "subsequent run should send old sync_token");
		return new Response(JSON.stringify({
			items: [
				{ id: "e1", status: "cancelled",
					start: { dateTime: "2026-04-23T10:00:00+07:00" },
					end: { dateTime: "2026-04-23T11:00:00+07:00" } },
			],
			nextSyncToken: "SYNC_TOKEN_V2",
		}), { status: 200 });
	}) as typeof fetch;

	await syncCalendar(cal, ctxWith(fetchImpl, syncedEvents, cals));

	const evt = await syncedEvents.get("gcal_acc1_primary_e1");
	assert.equal(evt.data.deleted, 1);
	assert.equal((await cals.get(cal.id)).data.sync_token, "SYNC_TOKEN_V2");
});

test("410 Gone — clears sync_token and returns early (next run does full resync)", async () => {
	const cal = mkCal({ sync_token: "STALE" });
	const syncedEvents = mkStore();
	const cals = mkStore();
	await cals.put(cal.id, cal);
	const fetchImpl = (async () => new Response("gone", { status: 410 })) as typeof fetch;

	await syncCalendar(cal, ctxWith(fetchImpl, syncedEvents, cals));

	assert.equal((await cals.get(cal.id)).data.sync_token, null);
});

test("non-ok, non-410 — sets last_resynced_at NOT updated (leaves calendar in error-visible state)", async () => {
	const cal = mkCal({ sync_token: "OK", last_resynced_at: "2026-04-22T00:00:00Z" });
	const syncedEvents = mkStore();
	const cals = mkStore();
	await cals.put(cal.id, cal);
	const fetchImpl = (async () => new Response("server error", { status: 500 })) as typeof fetch;

	await syncCalendar(cal, ctxWith(fetchImpl, syncedEvents, cals));

	const c = await cals.get(cal.id);
	assert.equal(c.data.sync_token, "OK");  // preserved
	assert.equal(c.data.last_resynced_at, "2026-04-22T00:00:00Z");  // unchanged
	assert.equal(syncedEvents._size(), 0);  // no writes
});
```

- [ ] **Step 2: Run — should fail**

```bash
node --import tsx --test plugins/plugin-weasley-clock/tests/sync-calendar.test.ts
```

- [ ] **Step 3: Implement `plugins/plugin-weasley-clock/src/lib/sync-calendar.ts`**

```ts
import { mapGoogleEvent, type GoogleEvent } from "./events-map";

export interface CalendarRow {
	id: string;
	account_id: string;
	calendar_id: string;
	summary: string;
	synced: 0 | 1;
	sync_token: string | null;
	last_resynced_at: string | null;
	expose_titles: 0 | 1;
}

export interface SyncContext {
	storage: {
		synced_events: { put(id: string, data: any): Promise<void>; get(id: string): Promise<{ id: string; data: any } | null>; query(f: any): Promise<any> };
		oauth_calendars: { put(id: string, data: any): Promise<void>; get(id: string): Promise<{ id: string; data: any } | null> };
	};
	getAccessToken: () => Promise<string>;
	fetchImpl?: typeof fetch;
}

export interface SyncResult {
	status: "ok" | "error" | "sync_token_invalidated";
	eventsProcessed: number;
	nextSyncToken: string | null;
}

export async function syncCalendar(cal: CalendarRow, ctx: SyncContext): Promise<SyncResult> {
	const fetchImpl = ctx.fetchImpl ?? fetch;
	const accessToken = await ctx.getAccessToken();

	const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.calendar_id)}/events`;
	let pageToken: string | null = null;
	let nextSyncToken: string | null = null;
	let processed = 0;

	for (;;) {
		const params = new URLSearchParams({ showDeleted: "true", singleEvents: "true", maxResults: "250" });
		if (cal.sync_token && !pageToken) params.set("syncToken", cal.sync_token);
		if (!cal.sync_token && !pageToken) {
			// Initial fetch: 90-day backfill to avoid slurping full history
			const min = new Date(Date.now() - 90 * 86400 * 1000).toISOString();
			params.set("timeMin", min);
		}
		if (pageToken) params.set("pageToken", pageToken);

		const res = await fetchImpl(`${base}?${params.toString()}`, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});

		if (res.status === 410) {
			// Google invalidated our syncToken — clear and bail; next run does full resync
			await ctx.storage.oauth_calendars.put(cal.id, { ...cal, sync_token: null });
			return { status: "sync_token_invalidated", eventsProcessed: processed, nextSyncToken: null };
		}
		if (!res.ok) {
			// Don't update sync_token or last_resynced_at — leave calendar visibly behind
			return { status: "error", eventsProcessed: processed, nextSyncToken: null };
		}

		const body = (await res.json()) as { items?: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string };
		for (const evt of body.items ?? []) {
			const row = mapGoogleEvent(evt, { accountId: cal.account_id, calendarId: cal.calendar_id });
			await ctx.storage.synced_events.put(row.id, row);
			processed++;
		}
		if (body.nextPageToken) {
			pageToken = body.nextPageToken;
			continue;
		}
		nextSyncToken = body.nextSyncToken ?? null;
		break;
	}

	// Persist the new sync_token + last_resynced_at on the calendar row
	await ctx.storage.oauth_calendars.put(cal.id, {
		...cal,
		sync_token: nextSyncToken ?? cal.sync_token,
		last_resynced_at: new Date().toISOString(),
	});

	return { status: "ok", eventsProcessed: processed, nextSyncToken };
}
```

- [ ] **Step 4: Run — pass**

```bash
node --import tsx --test plugins/plugin-weasley-clock/tests/sync-calendar.test.ts
```

Expected: 4 pass, 0 fail.

- [ ] **Step 5: Sync + commit**

```bash
cp plugins/plugin-weasley-clock/src/lib/sync-calendar.ts node_modules/plugin-weasley-clock/src/lib/sync-calendar.ts
git add plugins/plugin-weasley-clock/src/lib/sync-calendar.ts plugins/plugin-weasley-clock/tests/sync-calendar.test.ts
git commit -m "feat(weasley-clock): per-calendar incremental sync with syncToken + 410 fallback"
```

---

## Task 5: Scheduled hook + sync-now route + dispatch

Wire the cron trigger. Uses the approach identified in Task 1. This task assumes Option B (wrangler-level `triggers.crons` + src/worker.ts scheduled handler + plugin route); if Task 1 found EmDash has a native `scheduled:` hook, replace the route-dispatch pattern accordingly.

**Files:**
- Modify: `plugins/plugin-weasley-clock/src/sandbox-entry.ts` — add `cron/sync-all` route
- Modify: `src/worker.ts` — add `scheduled(event, env, ctx)` handler that fetches our plugin's cron route
- Modify: `wrangler.jsonc` — add `triggers.crons: ["*/5 * * * *"]`

- [ ] **Step 1: Add the sync-all route to `sandbox-entry.ts`**

Inside the `routes:` object, after the existing `calendars/toggle` route, add:

```ts
"cron/sync-all": {
	// public: false means EmDash-admin-auth required. Wrangler's scheduled()
	// handler calls this via service binding / same-worker fetch with a
	// synthetic admin context, so the auth gate is bypassed internally.
	// If that ends up not working, switch to public:true + a shared secret
	// header check (SYNC_SECRET). Keep public:false for now.
	public: false,
	handler: async (_routeCtx: any, ctx: PluginContext) => {
		const { syncCalendar } = await import("./lib/sync-calendar");
		const { ensureFreshAccessToken } = await import("./lib/token-refresh");

		const encKey = (ctx.env as any).OAUTH_ENC_KEY;
		const clientId = (ctx.env as any).GOOGLE_OAUTH_CLIENT_ID;
		const clientSecret = (ctx.env as any).GOOGLE_OAUTH_CLIENT_SECRET;
		if (!encKey || !clientId || !clientSecret) return { error: "OAuth env not configured" };

		const accs = await (ctx.storage as any).oauth_accounts.query({});
		const cals = await (ctx.storage as any).oauth_calendars.query({});
		const accountsById = new Map<string, any>();
		for (const r of (accs.items ?? accs ?? [])) accountsById.set(r.id, r.data);

		const summary: Array<{ calendarId: string; status: string; events: number }> = [];

		for (const cr of (cals.items ?? cals ?? [])) {
			const cal = cr.data;
			if (!cal.synced) continue;
			const acc = accountsById.get(cal.account_id);
			if (!acc || acc.status !== "active") {
				summary.push({ calendarId: cal.id, status: "skipped_inactive_account", events: 0 });
				continue;
			}
			try {
				// Refresh token if needed; persist the updated row if refreshed
				const { access_token, refreshed, updatedRow } = await ensureFreshAccessToken(acc, {
					encKey, clientId, clientSecret,
				});
				if (refreshed && updatedRow) {
					await (ctx.storage as any).oauth_accounts.put(updatedRow.id, updatedRow);
				}
				const result = await syncCalendar(cal, {
					storage: ctx.storage as any,
					getAccessToken: async () => access_token,
				});
				summary.push({ calendarId: cal.id, status: result.status, events: result.eventsProcessed });
			} catch (err: any) {
				const msg = String(err?.message ?? err);
				if (/invalid_grant/i.test(msg)) {
					// Mark account revoked; calendars under it skip on next run
					await (ctx.storage as any).oauth_accounts.put(acc.id, {
						...acc,
						status: "revoked",
						last_sync_error: msg,
						revoked_at: new Date().toISOString(),
					});
					summary.push({ calendarId: cal.id, status: "account_revoked", events: 0 });
				} else {
					await (ctx.storage as any).oauth_accounts.put(acc.id, {
						...acc,
						last_sync_error: msg,
					});
					summary.push({ calendarId: cal.id, status: "error", events: 0 });
				}
				ctx.log.info(`sync-all: ${cal.id} failed: ${msg}`);
			}
		}
		return { ok: true, summary };
	},
},
```

- [ ] **Step 2: Add a per-account `sync-now` route (for the admin UI button)**

After `cron/sync-all`, add:

```ts
"sync-now": {
	public: false,
	handler: async (routeCtx: any, ctx: PluginContext) => {
		const { account_id } = (routeCtx.input ?? {}) as { account_id?: string };
		if (!account_id) return { error: "Expected { account_id }" };
		// Reuse cron/sync-all logic but scoped to one account. Simplest: fetch
		// just this account's calendars and loop. Duplicates the inner body of
		// cron/sync-all to avoid introducing a shared helper under time pressure;
		// if this stays long-term, extract a syncOneAccount() function.
		const { syncCalendar } = await import("./lib/sync-calendar");
		const { ensureFreshAccessToken } = await import("./lib/token-refresh");
		const encKey = (ctx.env as any).OAUTH_ENC_KEY;
		const clientId = (ctx.env as any).GOOGLE_OAUTH_CLIENT_ID;
		const clientSecret = (ctx.env as any).GOOGLE_OAUTH_CLIENT_SECRET;
		const accRow = await (ctx.storage as any).oauth_accounts.get(account_id);
		if (!accRow) return { error: "Account not found" };
		const acc = accRow.data;
		const cals = await (ctx.storage as any).oauth_calendars.query({});
		const matching = ((cals.items ?? cals ?? []) as any[]).filter(
			(r: any) => r.data.account_id === account_id && r.data.synced,
		);
		let total = 0;
		try {
			const { access_token, refreshed, updatedRow } = await ensureFreshAccessToken(acc, {
				encKey, clientId, clientSecret,
			});
			if (refreshed && updatedRow) await (ctx.storage as any).oauth_accounts.put(updatedRow.id, updatedRow);
			for (const cr of matching) {
				const result = await syncCalendar(cr.data, {
					storage: ctx.storage as any,
					getAccessToken: async () => access_token,
				});
				total += result.eventsProcessed;
			}
			return { ok: true, events: total };
		} catch (err: any) {
			const msg = String(err?.message ?? err);
			if (/invalid_grant/i.test(msg)) {
				await (ctx.storage as any).oauth_accounts.put(acc.id, {
					...acc, status: "revoked", last_sync_error: msg, revoked_at: new Date().toISOString(),
				});
			}
			return { error: msg };
		}
	},
},
```

- [ ] **Step 3: Wire wrangler cron trigger**

Open `wrangler.jsonc`. Add at the top level (alongside `routes`, `d1_databases`, etc.):

```jsonc
"triggers": {
  "crons": ["*/5 * * * *"]
}
```

If a `triggers` key already exists (e.g. for chronicle), merge the arrays.

- [ ] **Step 4: Add the scheduled handler to `src/worker.ts`**

Read `src/worker.ts` to see its current shape. If it exports a default Astro worker, wrap it with:

```ts
// Original Astro/EmDash worker stays as the default export for fetch.
// We add a scheduled() handler that invokes our plugin's cron route.
import handler from "./your-existing-handler"; // keep whatever import was there

export default {
	fetch: handler.fetch,
	async scheduled(event: ScheduledEvent, env: any, ctx: any) {
		ctx.waitUntil(
			fetch(
				// Self-invocation via the route's public URL.
				// In dev, use the Astro server URL; in prod, huuloc.com.
				// NOTE: requires a shared secret for auth — see Step 5.
				new Request(
					`https://huuloc.com/_emdash/api/plugins/weasley-clock/cron/sync-all`,
					{
						method: "POST",
						headers: { "X-Sync-Secret": env.SYNC_SECRET ?? "" },
						body: "{}",
					},
				),
			).then(async (res) => {
				const body = await res.text();
				console.log(`[cron] sync-all: ${res.status} ${body.slice(0, 500)}`);
			}).catch((err) => {
				console.error(`[cron] sync-all failed: ${err?.message ?? err}`);
			}),
		);
	},
};
```

Adjust the exact shape to match the existing worker. If the Astro adapter exports the worker as a plain object `{ fetch }`, the pattern above is correct. If it exports a class, wrap it differently — verify by reading `src/worker.ts` first.

- [ ] **Step 5: Switch the cron route to check a shared secret instead of admin auth**

In `sandbox-entry.ts`, update the `cron/sync-all` route's `public` flag and add secret verification at the top of the handler:

```ts
"cron/sync-all": {
	public: true,  // internally auth'd via X-Sync-Secret header
	handler: async (routeCtx: any, ctx: PluginContext) => {
		const provided = routeCtx.request?.headers?.get?.("X-Sync-Secret");
		const expected = (ctx.env as any).SYNC_SECRET;
		if (!expected || provided !== expected) return { error: "Forbidden" };
		// ... rest of the handler body from Step 1 ...
	},
},
```

Add `SYNC_SECRET` to Cloudflare secrets:

```bash
wrangler secret put SYNC_SECRET
# paste a random 32-char string (operator action)
```

Add it to `src/env.d.ts`:

```ts
SYNC_SECRET: string;
```

And to `.dev.vars` for local dev.

- [ ] **Step 6: Sync + commit**

```bash
cp plugins/plugin-weasley-clock/src/sandbox-entry.ts node_modules/plugin-weasley-clock/src/sandbox-entry.ts
git add plugins/plugin-weasley-clock/src/sandbox-entry.ts src/worker.ts wrangler.jsonc src/env.d.ts
git commit -m "feat(weasley-clock): scheduled cron sync + per-account sync-now route + shared-secret auth"
```

---

## Task 6: Astro-side event helper — merge synced_events with family_events

**Files:**
- Create: `src/utils/weasleyClockEvents.ts`
- Create: `tests/utils/weasleyClockEvents.test.ts`

The Weasley Clock page already queries `family_events` collection via `getEmDashCollection`. Now we also need to read `synced_events` (plugin storage). Adapt the shape to a union type so the views can render both without caring about origin.

- [ ] **Step 1: Write the failing tests**

`tests/utils/weasleyClockEvents.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeEventSources, type RenderableEvent } from "../../src/utils/weasleyClockEvents";
import type { FamilyOccurrence } from "../../src/utils/familyEvents";

test("mergeEventSources: returns empty when no events", () => {
	assert.deepEqual(mergeEventSources([], []), []);
});

test("mergeEventSources: solo synced events — preserved with source:'synced'", () => {
	const synced = [
		{
			id: "gcal_a1_primary_e1",
			external_uid: "e1",
			title: "Sprint review",
			starts_at: "2026-04-23T03:00:00.000Z",
			ends_at: "2026-04-23T04:00:00.000Z",
			all_day: 0,
			location: "Hanoi",
			description: null,
			source_type: "gcal",
			gcal_account_id: "a1",
			gcal_calendar_id: "primary",
			deleted: 0,
		},
	];
	const merged: RenderableEvent[] = mergeEventSources([], synced as any);
	assert.equal(merged.length, 1);
	assert.equal(merged[0].source, "synced");
	assert.equal(merged[0].title, "Sprint review");
	assert.equal(merged[0].allDay, false);
});

test("mergeEventSources: interleaves family and synced events in chronological order", () => {
	const family: FamilyOccurrence[] = [
		{
			event: {
				id: "evt1", title_en: "Tam birthday", title_vi: "Sinh nhật Tâm",
				event_type: "birthday", date_calendar: "solar", month: 4, day: 25,
				origin_year: 1992, visibility: "household",
			},
			date: new Date("2026-04-24T17:00:00Z"),  // HCMC midnight of Apr 25
			nth: 34,
		},
	];
	const synced = [
		{
			id: "gcal_a1_primary_work",
			external_uid: "work",
			title: "Work meeting",
			starts_at: "2026-04-23T03:00:00.000Z",
			ends_at: "2026-04-23T04:00:00.000Z",
			all_day: 0,
			location: null, description: null, source_type: "gcal",
			gcal_account_id: "a1", gcal_calendar_id: "primary", deleted: 0,
		},
	];
	const merged = mergeEventSources(family, synced as any);
	assert.equal(merged.length, 2);
	// Earliest first
	assert.equal(merged[0].source, "synced");
	assert.equal(merged[0].title, "Work meeting");
	assert.equal(merged[1].source, "family");
	assert.match(merged[1].title, /Sinh nhật|Tam birthday/);
});
```

- [ ] **Step 2: Run — fail**

```bash
node --import tsx --test tests/utils/weasleyClockEvents.test.ts
```

- [ ] **Step 3: Implement `src/utils/weasleyClockEvents.ts`**

```ts
import type { FamilyOccurrence } from "./familyEvents";

export interface SyncedEventRecord {
	id: string;
	external_uid: string;
	title: string | null;
	starts_at: string;  // ISO UTC
	ends_at: string;
	all_day: 0 | 1;
	location: string | null;
	description: string | null;
	source_type: "gcal" | "ics";
	gcal_account_id?: string;
	gcal_calendar_id?: string;
	deleted: 0 | 1;
}

export type EventSource = "family" | "synced";

export interface RenderableEvent {
	id: string;
	source: EventSource;
	title: string;
	subtitle?: string;
	date: Date;       // HCMC local start (for family: always midnight; for synced: actual start instant)
	endDate: Date;
	allDay: boolean;
	category: "giỗ" | "birthday" | "anniversary" | "cultural" | "milestone" | "work" | "flight" | "other";
	// raw backing record — views can reach in for anything unusual
	raw: FamilyOccurrence | SyncedEventRecord;
}

function familyCategory(occ: FamilyOccurrence): RenderableEvent["category"] {
	switch (occ.event.event_type) {
		case "death_anniv": return "giỗ";
		case "birthday": return "birthday";
		case "wedding_anniv": return "anniversary";
		case "cultural": return "cultural";
		case "milestone": return "milestone";
	}
	return "other";
}

// Phase 2a.5: synced events default to "work" tint; Phase 3 could map calendar→category.
function syncedCategory(_evt: SyncedEventRecord): RenderableEvent["category"] {
	return "work";
}

function familyTitle(occ: FamilyOccurrence): string {
	// Prefer VI if available; falls back to EN.
	return occ.event.title_vi || occ.event.title_en || "(untitled)";
}

export function mergeEventSources(
	family: FamilyOccurrence[],
	synced: SyncedEventRecord[],
): RenderableEvent[] {
	const out: RenderableEvent[] = [];

	for (const occ of family) {
		out.push({
			id: `family_${occ.event.id}_${occ.date.toISOString().slice(0, 10)}`,
			source: "family",
			title: familyTitle(occ),
			subtitle: occ.nth != null ? `${occ.nth}th` : undefined,
			date: new Date(occ.date),
			endDate: new Date(occ.date.getTime() + 86400_000),
			allDay: true,
			category: familyCategory(occ),
			raw: occ,
		});
	}

	for (const evt of synced) {
		if (evt.deleted) continue;
		out.push({
			id: evt.id,
			source: "synced",
			title: evt.title ?? "(untitled)",
			subtitle: evt.location ?? undefined,
			date: new Date(evt.starts_at),
			endDate: new Date(evt.ends_at),
			allDay: evt.all_day === 1,
			category: syncedCategory(evt),
			raw: evt,
		});
	}

	out.sort((a, b) => a.date.getTime() - b.date.getTime());
	return out;
}
```

- [ ] **Step 4: Run — pass**

```bash
node --import tsx --test tests/utils/weasleyClockEvents.test.ts
```

Expected: 3 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add src/utils/weasleyClockEvents.ts tests/utils/weasleyClockEvents.test.ts
git commit -m "feat(weasley-clock): merge family + synced events into a renderable union type"
```

---

## Task 7: Weasley Clock page reads synced_events from plugin storage

**Files:**
- Modify: `src/pages/nydus/weasley-clock/index.astro` — augment existing family-events query with a synced-events query, pass merged list to views

The page currently calls `materialiseFamilyEvents(events, windowStart, windowEnd)` and passes the resulting `FamilyOccurrence[]` to view components. Extend it to also query `synced_events` from plugin storage in the same time window.

- [ ] **Step 1: Read the current page**

Open `src/pages/nydus/weasley-clock/index.astro` to confirm the current shape.

- [ ] **Step 2: Replace the materialise call with a merged-events pipeline**

Inside the frontmatter, after the existing `const occurrences = materialiseFamilyEvents(...)` line, add:

```ts
import { mergeEventSources, type SyncedEventRecord } from "../../../utils/weasleyClockEvents";

// Fetch synced events from plugin storage. EmDash exposes plugin storage
// through Astro.locals.emdash.plugins.<id>.storage.<namespace>.
let syncedEvents: SyncedEventRecord[] = [];
try {
	const storage = (Astro.locals as any).emdash?.plugins?.["weasley-clock"]?.storage;
	if (storage?.synced_events) {
		const all = await storage.synced_events.query({});
		const items = (all.items ?? all ?? []) as Array<{ id: string; data: any }>;
		const windowStartMs = windowStart.getTime();
		const windowEndMs = windowEnd.getTime();
		syncedEvents = items
			.map((r) => ({ ...r.data, id: r.id } as SyncedEventRecord))
			.filter((e) =>
				e.source_type && !e.deleted &&
				new Date(e.starts_at).getTime() <= windowEndMs &&
				new Date(e.ends_at).getTime() >= windowStartMs,
			);
	}
} catch (err) {
	console.error("Failed to fetch synced events:", err);
}

const renderable = mergeEventSources(occurrences, syncedEvents);
```

(Keep `occurrences` for now — existing tests reference it. The views need a slight change in Task 8 to consume `renderable` instead.)

For this task's commit, pass `renderable` to the views but keep a fallback. In the `<Base>` block:

```astro
{view === "day" && <DayView anchor={anchor} occurrences={occurrences} synced={syncedEvents} />}
{view === "week" && <WeekView anchor={anchor} occurrences={occurrences} synced={syncedEvents} />}
{view === "month" && <MonthView anchor={anchor} occurrences={occurrences} synced={syncedEvents} />}
{view === "year" && <YearView anchor={anchor} occurrences={occurrences} synced={syncedEvents} />}
```

Views that don't use the `synced` prop yet will ignore it. Task 8+ will wire them up.

- [ ] **Step 3: Dev boot sanity**

```bash
pkill -f "emdash dev" 2>/dev/null; sleep 2
(timeout 40 npx emdash dev > /tmp/dev-t7.log 2>&1 &)
sleep 30
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://localhost:4321/nydus/weasley-clock?view=week"
pkill -f "emdash dev" 2>/dev/null
grep -iE "synced|error" /tmp/dev-t7.log | head -5
git checkout HEAD -- emdash-env.d.ts 2>/dev/null
```

Expected HTTP 200. No new errors in the log beyond pre-existing Vite optimiser noise.

- [ ] **Step 4: Commit**

```bash
git add src/pages/nydus/weasley-clock/index.astro
git commit -m "feat(weasley-clock): page queries synced_events alongside family events"
```

---

## Task 8: Render synced events in DayView (timed blocks + all-day pins)

**Files:**
- Modify: `src/components/weasley-clock/DayView.astro` — render timed synced events in the currently-placeholder hourly column
- Modify: `src/components/weasley-clock/DayCell.astro` (no change; DayCell is for Week/Month; DayView has its own layout)

- [ ] **Step 1: Update DayView to accept synced events**

Open `src/components/weasley-clock/DayView.astro`. Update the Props interface:

```ts
interface Props {
	anchor: Date;
	occurrences: FamilyOccurrence[];
	synced?: SyncedEventRecord[];
}
```

Add the import at the top of the frontmatter:

```ts
import type { SyncedEventRecord } from "../../utils/weasleyClockEvents";
```

In the hourly column area (currently just empty `<div class="wc-day-view__hour-body"></div>` per hour), add logic that places synced events by time. Replace the existing `<section class="wc-day-view__hours">` block with:

```astro
<section class="wc-day-view__hours">
  {hours.map((h) => {
    const blockStart = new Date(anchor);
    blockStart.setHours(h, 0, 0, 0);
    const blockEnd = new Date(blockStart);
    blockEnd.setHours(h + 1);
    const eventsInHour = (synced ?? []).filter((e) => {
      if (e.all_day) return false;
      const s = new Date(e.starts_at).getTime();
      return s >= blockStart.getTime() && s < blockEnd.getTime();
    });
    return (
      <div class="wc-day-view__hour">
        <div class="wc-day-view__hour-label">{String(h).padStart(2, "0")}:00</div>
        <div class="wc-day-view__hour-body">
          {eventsInHour.map((e) => {
            const startStr = new Date(e.starts_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
            return (
              <div class="wc-day-view__event">
                <div class="wc-day-view__event-title">{e.title}</div>
                <div class="wc-day-view__event-meta">{startStr}{e.location ? ` · ${e.location}` : ""}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  })}
</section>
```

Add CSS in the `<style>` block:

```css
.wc-day-view__event {
  padding: 4px 6px;
  background: rgba(74, 108, 143, 0.25);
  border-left: 2px solid #4a6c8f;
  margin: 2px 0;
  border-radius: 1px;
}
.wc-day-view__event-title { font-size: 11px; color: #e8dcc4; }
.wc-day-view__event-meta { font-size: 9px; color: #8b6914; margin-top: 1px; }
```

Also render all-day synced events in the existing all-day section. In the `<section class="wc-day-view__allday">` block, after the existing `{occurrences.map(...)}` loop, add:

```astro
{(synced ?? []).filter((e) => {
  if (!e.all_day) return false;
  const s = new Date(e.starts_at);
  return s.toDateString() === anchor.toDateString();
}).map((e) => (
  <EventChip title={e.title} subtitle={e.location ?? undefined} category="other" />
))}
```

- [ ] **Step 2: Verify via dev boot**

```bash
pkill -f "emdash dev" 2>/dev/null; sleep 2
(timeout 40 npx emdash dev > /tmp/dev-t8.log 2>&1 &)
sleep 30
curl -s -o /tmp/day.html -w "HTTP %{http_code}\n" "http://localhost:4321/nydus/weasley-clock?view=day"
pkill -f "emdash dev" 2>/dev/null
grep -cE "wc-day-view__event|wc-day-view__hour" /tmp/day.html
git checkout HEAD -- emdash-env.d.ts 2>/dev/null
```

Expected HTTP 200. Grep should show > 0 matches (confirms the hourly structure is there).

- [ ] **Step 3: Commit**

```bash
git add src/components/weasley-clock/DayView.astro
git commit -m "feat(weasley-clock): DayView renders timed synced events in the hourly column"
```

---

## Task 9: Render synced events in WeekView + MonthView

**Files:**
- Modify: `src/components/weasley-clock/WeekView.astro`
- Modify: `src/components/weasley-clock/MonthView.astro`

- [ ] **Step 1: Update WeekView to include synced events in each day cell**

Open `src/components/weasley-clock/WeekView.astro`. Add prop + import:

```ts
import type { SyncedEventRecord } from "../../utils/weasleyClockEvents";

interface Props {
	anchor: Date;
	occurrences: FamilyOccurrence[];
	synced?: SyncedEventRecord[];
}
```

Currently each day builds `occurrences` from `FamilyOccurrence[]`. We need to also filter the synced events per day. Replace the `days.push({...})` loop body with:

```ts
const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const familyToday = occurrences.filter((o) => sameDay(o.date, d));
const syncedToday = (synced ?? []).filter((e) => {
	if (e.deleted) return false;
	const s = new Date(e.starts_at);
	return s >= dayStart && s <= dayEnd;
});
days.push({
	date: d,
	occurrences: familyToday,
	synced: syncedToday,
	isToday: sameDay(d, today),
});
```

Update the JSX map:

```astro
{days.map((d) => <DayCell date={d.date} occurrences={d.occurrences} synced={d.synced} isToday={d.isToday} variant="week" />)}
```

- [ ] **Step 2: Update DayCell to accept + render synced events**

Open `src/components/weasley-clock/DayCell.astro`. Add prop + import:

```ts
import type { SyncedEventRecord } from "../../utils/weasleyClockEvents";

interface Props {
	date: Date;
	occurrences: FamilyOccurrence[];
	synced?: SyncedEventRecord[];
	isToday?: boolean;
	isDimmed?: boolean;
	variant?: "week" | "month";
}
```

After the existing `{occurrences.map(...)}` block inside `<ul class="wc-day__events">`, append:

```astro
{(synced ?? []).map((evt) => (
  <li>
    <EventChip
      title={evt.title ?? "(untitled)"}
      subtitle={evt.location ?? undefined}
      category="other"
      size={variant === "week" ? "full" : "chip"}
    />
  </li>
))}
```

- [ ] **Step 3: Update MonthView similarly**

Open `src/components/weasley-clock/MonthView.astro`. Add the prop + filter inside the `for` loop over `cells`:

```ts
const syncedToday = (synced ?? []).filter((e) => {
	if (e.deleted) return false;
	const s = new Date(e.starts_at);
	return s.toDateString() === d.toDateString();
});
cells.push({
	date: d,
	occurrences: occurrences.filter((o) => sameDay(o.date, d)),
	synced: syncedToday,
	isToday: sameDay(d, today),
	isDimmed: d.getMonth() !== anchor.getMonth(),
});
```

And update the cell rendering to pass `synced`:

```astro
{row.map((c) => (
	c.isToday
		? <DayCell date={c.date} occurrences={c.occurrences} synced={c.synced} isToday={c.isToday} isDimmed={c.isDimmed} variant="month" />
		: (
			<a class="wc-month__cell-link" href={`/nydus/weasley-clock?view=day&anchor=${c.date.toISOString().slice(0, 10)}`}>
				<DayCell date={c.date} occurrences={c.occurrences} synced={c.synced} isToday={false} isDimmed={c.isDimmed} variant="month" />
			</a>
		)
))}
```

- [ ] **Step 4: Dev boot verify**

```bash
pkill -f "emdash dev" 2>/dev/null; sleep 2
(timeout 40 npx emdash dev > /tmp/dev-t9.log 2>&1 &)
sleep 30
curl -s -o /dev/null -w "week HTTP %{http_code}\n" "http://localhost:4321/nydus/weasley-clock?view=week"
curl -s -o /dev/null -w "month HTTP %{http_code}\n" "http://localhost:4321/nydus/weasley-clock?view=month"
pkill -f "emdash dev" 2>/dev/null
git checkout HEAD -- emdash-env.d.ts 2>/dev/null
```

Expected: both HTTP 200.

- [ ] **Step 5: Commit**

```bash
git add src/components/weasley-clock/WeekView.astro src/components/weasley-clock/MonthView.astro src/components/weasley-clock/DayCell.astro
git commit -m "feat(weasley-clock): WeekView + MonthView + DayCell render synced events"
```

---

## Task 10: YearView heatmap includes synced events

**Files:**
- Modify: `src/components/weasley-clock/YearView.astro`

- [ ] **Step 1: Extend YearView**

Open `src/components/weasley-clock/YearView.astro`. Add prop:

```ts
import type { SyncedEventRecord } from "../../utils/weasleyClockEvents";

interface Props {
	anchor: Date;
	occurrences: FamilyOccurrence[];
	synced?: SyncedEventRecord[];
}
```

The current implementation builds `byDate` map from `occurrences`. Extend it to include synced events:

```ts
// Build byDate map combining both sources
const byDate = new Map<string, { count: number; dominant: "family" | "synced"; category: string }>();
for (const occ of occurrences) {
	const key = occ.date.toISOString().slice(0, 10);
	const cur = byDate.get(key);
	byDate.set(key, { count: (cur?.count ?? 0) + 1, dominant: "family", category: occ.event.event_type });
}
for (const evt of synced ?? []) {
	if (evt.deleted) continue;
	const key = new Date(evt.starts_at).toISOString().slice(0, 10);
	const cur = byDate.get(key);
	byDate.set(key, {
		count: (cur?.count ?? 0) + 1,
		dominant: cur?.dominant ?? "synced",  // family wins tie
		category: cur?.category ?? "work",
	});
}
```

Adjust the cell-tint function to take this richer record:

```ts
function cellStyle(entry: { count: number; dominant: string; category: string } | undefined): string {
	if (!entry) return "background:#2a1f15;";
	const alpha = Math.min(0.3 + entry.count * 0.15, 1);
	const base = entry.dominant === "synced"
		? `rgba(74,108,143,${alpha})`
		: (entry.category === "death_anniv" ? `rgba(201,169,97,${alpha})`
			: entry.category === "birthday" ? `rgba(85,107,47,${alpha})`
			: `rgba(166,122,62,${alpha})`);
	return `background:${base};`;
}

function monthCells(month: number): { date: Date; entry: typeof byDate extends Map<any, infer V> ? V : never }[] {
	const days = new Date(year, month + 1, 0).getDate();
	const out: { date: Date; entry: any }[] = [];
	for (let d = 1; d <= days; d++) {
		const date = new Date(year, month, d);
		const key = date.toISOString().slice(0, 10);
		out.push({ date, entry: byDate.get(key) });
	}
	return out;
}
```

Update the cell rendering inside the `{monthCells(i).map(...)}` block:

```astro
{monthCells(i).map((c) => (
	<a
		class="wc-year__cell"
		style={cellStyle(c.entry)}
		href={`/nydus/weasley-clock?view=day&anchor=${c.date.toISOString().slice(0, 10)}`}
		title={c.entry ? `${c.entry.count} event${c.entry.count > 1 ? "s" : ""}` : ""}
	></a>
))}
```

- [ ] **Step 2: Dev boot check**

```bash
pkill -f "emdash dev" 2>/dev/null; sleep 2
(timeout 40 npx emdash dev > /tmp/dev-t10.log 2>&1 &)
sleep 30
curl -s -o /dev/null -w "year HTTP %{http_code}\n" "http://localhost:4321/nydus/weasley-clock?view=year"
pkill -f "emdash dev" 2>/dev/null
git checkout HEAD -- emdash-env.d.ts 2>/dev/null
```

Expected: HTTP 200.

- [ ] **Step 3: Commit**

```bash
git add src/components/weasley-clock/YearView.astro
git commit -m "feat(weasley-clock): YearView heatmap includes synced events"
```

---

## Task 11: Reauth banner + per-account sync button in admin

**Files:**
- Modify: `plugins/plugin-weasley-clock/src/admin/feeds.tsx`
- Modify: `plugins/plugin-weasley-clock/src/sandbox-entry.ts` — `accounts/list` returns additional fields (`last_sync_error`, `last_synced_at`)

- [ ] **Step 1: Update accounts/list to return error + sync timestamps**

In `sandbox-entry.ts`, find the `accounts/list` handler. Update the `accountsList` mapping:

```ts
const accountsList = ((accs.items ?? accs ?? []) as any[]).map((r: any) => ({
	id: r.id,
	account_email: r.data.account_email,
	display_name: r.data.display_name,
	status: r.data.status,
	connected_at: r.data.connected_at,
	last_synced_at: r.data.last_synced_at ?? null,
	last_sync_error: r.data.last_sync_error ?? null,
}));
```

- [ ] **Step 2: Extend `feeds.tsx` with banner + sync-now button**

Open `plugins/plugin-weasley-clock/src/admin/feeds.tsx`. Update the `Account` interface:

```tsx
interface Account {
	id: string;
	account_email: string;
	display_name: string | null;
	status: string;
	connected_at: string | null;
	last_synced_at: string | null;
	last_sync_error: string | null;
}
```

After the `loading` check, add a banner section:

```tsx
const revokedAccounts = accounts.filter((a) => a.status === "revoked");
const erroredAccounts = accounts.filter((a) => a.status !== "revoked" && a.last_sync_error);

// Inside the returned JSX, before the <section><h2>Google accounts</h2>:
{revokedAccounts.length > 0 && (
	<div style={{ padding: 12, background: "#40191b", border: "1px solid #a04040", borderRadius: 4, marginBottom: 12, color: "#ffb6a0" }}>
		<strong>Reauth required:</strong> {revokedAccounts.map((a) => a.account_email).join(", ")}. Revoke access in Google settings, then click Connect again to re-grant.
	</div>
)}
{erroredAccounts.length > 0 && (
	<div style={{ padding: 12, background: "#3a2a1f", border: "1px solid #a67a3e", borderRadius: 4, marginBottom: 12, color: "#e8dcc4" }}>
		<strong>Sync errors on:</strong> {erroredAccounts.map((a) => a.account_email).join(", ")}. Try clicking <em>Sync now</em> per account; persistent errors may need reauth.
	</div>
)}
```

Add the Sync-now button on each account card. Find the account card render and add alongside the existing status badge:

```tsx
<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
	<button onClick={() => syncAccount(acc.id)} disabled={syncing.has(acc.id)} style={{ fontSize: 11, padding: "4px 8px" }}>
		{syncing.has(acc.id) ? "Syncing…" : "Sync now"}
	</button>
	<span style={{ fontSize: 11, color: acc.status === "active" ? "#6a6" : "#c66" }}>{acc.status}</span>
</div>
```

Add the `syncing` state and handler near the other state hooks:

```tsx
const [syncing, setSyncing] = useState<Set<string>>(new Set());

async function syncAccount(accountId: string) {
	setSyncing((s) => new Set([...s, accountId]));
	try {
		const res = await fetch(`${API_BASE}/sync-now`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ account_id: accountId }),
		});
		const data = await res.json();
		if (data.error) alert(`Sync failed: ${data.error}`);
	} finally {
		setSyncing((s) => { const n = new Set(s); n.delete(accountId); return n; });
		refresh();
	}
}
```

- [ ] **Step 3: Sync + dev-boot check**

```bash
cp plugins/plugin-weasley-clock/src/sandbox-entry.ts node_modules/plugin-weasley-clock/src/sandbox-entry.ts
cp plugins/plugin-weasley-clock/src/admin/feeds.tsx node_modules/plugin-weasley-clock/src/admin/feeds.tsx
pkill -f "emdash dev" 2>/dev/null; sleep 2
(timeout 40 npx emdash dev > /tmp/dev-t11.log 2>&1 &)
sleep 30
curl -s -o /dev/null -w "admin HTTP %{http_code}\n" "http://localhost:4321/_emdash/admin/weasley-clock/feeds"
pkill -f "emdash dev" 2>/dev/null
git checkout HEAD -- emdash-env.d.ts 2>/dev/null
```

Expected: HTTP 302 (redirect to login) or 200 (if already logged in). Either is fine at this layer.

- [ ] **Step 4: Commit**

```bash
git add plugins/plugin-weasley-clock/src/sandbox-entry.ts plugins/plugin-weasley-clock/src/admin/feeds.tsx
git commit -m "feat(weasley-clock): reauth banner + per-account Sync now button"
```

---

## Task 12: Full-stack verification

No new code — just run all the gates + produce a summary.

- [ ] **Step 1: Full test suite**

```bash
node --import tsx --test 'plugins/plugin-weasley-clock/tests/**/*.test.ts' 'tests/utils/*.test.ts' 'tests/pages/weasley-clock.test.ts' 2>&1 | tail -12
```

Expected: all tests pass. Count should be previous total (123) + 16 new from this phase (4 token-refresh + 5 events-map + 4 sync-calendar + 3 weasleyClockEvents) = 139 total. If the count is different, investigate before proceeding.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck 2>&1 | grep -E "plugin-weasley-clock|src/utils/weasleyClockEvents|src/components/weasley-clock|src/pages/nydus" | head -10
```

Expected: empty (no new errors in our files).

- [ ] **Step 3: Production build**

```bash
bun run build 2>&1 | tail -6
```

Expected: "Build complete" / "Server built in N s".

- [ ] **Step 4: Push + PR status**

```bash
git push
gh pr view 68 --json url,state,mergeable --jq '.'
```

Expected: PR #68 updates with the new commits. CI re-runs.

- [ ] **Step 5: Handoff summary**

Post a PR comment (`gh pr comment 68 --body '...'`) summarising:
- What was added in P2a.4–6 (sync cron + rendering + admin UX)
- Manual verification steps for the reviewer (= Loc): open feeds admin, connect Google, toggle a calendar, wait 5 min or click Sync now, then confirm events appear on `/nydus/weasley-clock`
- Known-unknowns: cron dispatch path (Task 1's findings) may need prod-runtime verification; `scheduled()` in src/worker.ts is untested against Cloudflare's actual cron trigger

---

## Self-review against the spec

| Spec section | Plan task |
|---|---|
| P2a.4 token refresh | Task 2 |
| P2a.4 events.list + syncToken | Task 4 |
| P2a.4 synced_events writes | Task 3 + Task 4 |
| P2a.4 5-min cron | Task 5 (wrangler triggers.crons + src/worker.ts scheduled) |
| P2a.4 revocation on invalid_grant | Task 5 (cron/sync-all handler sets status=revoked) |
| P2a.5 dashboard shows timed synced events | Task 8 (DayView) |
| P2a.5 dashboard shows synced in Week/Month/Year | Tasks 9 + 10 |
| P2a.5 merge family + synced events | Task 6 (mergeEventSources) + Task 7 (page query) |
| P2a.6 revocation banner + Sync now | Task 11 |
| §Security scope downgrade | Phase 2a Foundations handled this at token-exchange; refresh preserves scope (Task 2 stores tokens.scope from refresh response) |
| §Security log hygiene | Task 2 + Task 4 + Task 5 — no raw tokens logged |
| §Testing sync_token invalidation | Task 4 Step 1 third test |
| §Testing invalid_grant path | Task 2 Step 1 third test |

### Placeholder scan

Searched for `TBD`, `TODO`, `FIXME`, `XXX`, `<fill`, `<insert`. Two `XXXX` strings appear in security-sensitive test patterns (tampering ciphertext) — legitimate. No plan-failure placeholders.

### Type consistency check

- `OAuthAccountRow` used in Task 2 test + Task 5's sandbox-entry imports (matches plugin-storage row shape).
- `SyncedEventRow` from Task 3 flows into Task 4 (via `mapGoogleEvent`) and Task 5 (via `syncCalendar.storage.synced_events.put`).
- `SyncedEventRecord` from Task 6 is the Astro-side read shape — slightly differs from plugin-side `SyncedEventRow` (no `synced_at`). Both intentional: plugin stores `synced_at`, page doesn't need it.
- `RenderableEvent` from Task 6 is the union type flowing into views in Tasks 8-10; views currently consume `SyncedEventRecord` via `synced` prop (bypassing RenderableEvent for this first pass — a future cleanup). Not a bug; documented in each task's code.
- `FamilyOccurrence` unchanged from Phase 1.

### Scope check

This plan is ONE subsystem (calendar sync + rendering) in three layers — data path, UI, admin UX. Not decomposable further without hurting the product experience (e.g., sync without rendering is useless to the user). Ship as one PR update.

---

## Execution handoff

**Plan complete, saved to `docs/superpowers/plans/2026-04-24-weasley-clock-phase-2a-sync-render.md`.**

12 tasks, ~16 new tests. Expected total test count after full execution: ~139 (was 123 at end of Foundations).

Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, spec + code quality review between tasks. Higher fidelity but we've seen the worktree-bungle risk three times this session.
2. **Inline Execution** — I implement tasks 2-11 inline (Task 1 is reconnaissance I'll do directly). Faster; skips per-task review overhead. Appropriate because most of the work is mechanical TDD from spec-exact code.

Given user chose "full stack" (implement alongside the already-pending #68), **my lean is inline for tasks 2–11, with a final spec + build + test verification pass as Task 12.** Rationale: the code blocks in this plan are complete and reviewed once by me; another review pass per task would mostly rubber-stamp. Reserve agent cycles for any task that fails verification.

If the user prefers the full subagent-driven rigour, I'll switch.
