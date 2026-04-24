# Weasley Clock Booking — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working public booking flow on huuloc.com — guest visits `/book/<slug>`, picks a slot from times computed against Loc's synced calendars, fills name+email, gets confirmed with a Google Calendar event + Resend confirmation email.

**Architecture:** Astro SSR pages + EmDash plugin storage + existing weasley-clock OAuth tokens for Google Calendar writes + existing Resend plugin for email. Pure availability engine is a unit-tested function; everything else is thin I/O around it.

**Tech Stack:** TypeScript, Astro 6 SSR, Cloudflare Workers + D1 + KV, EmDash, React (slot-picker island), Resend plugin.

**Scope of Phase 1 (from spec §"Delivery phases"):**
- availability_rules + bookings collections (extend `storage.ts`)
- `meeting_types.host_account_ids` schema extension + seed update
- Default availability rule seed (7 days/week 09:00–17:30 Asia/Ho_Chi_Minh)
- `computeSlots` pure function with tests
- `/book` index page, audience-filtered
- `/book/[slug]` slot picker page (React island)
- `POST /api/weasley-clock/bookings/slots` — slots API
- `POST /api/weasley-clock/bookings` — create booking (revalidate + GCal insert + email)
- `/book/confirmed/[id]` — post-booking landing
- KV rate limit (5 attempts/IP/hour)
- i18n VI + EN
- `src/data/site-routes.json` update

**Phase 2+ (out of this plan):** cancel/reschedule, reminders cron, API keys, webhooks, round-robin.

---

## File structure

```
src/lib/weasley-clock/
  storage.ts                  # ADD collections: availability_rules, bookings
  availability.ts             # NEW computeSlots()
  booking-create.ts           # NEW createBooking() — GCal insert + D1 write + email
  rate-limit.ts               # NEW KV-backed counter
tests/weasley-clock/
  availability.test.ts        # NEW unit tests for computeSlots
src/pages/book/
  index.astro                 # NEW audience-filtered meeting type list
  [slug].astro                # NEW slot picker page
  confirmed/[id].astro        # NEW post-booking landing
src/components/book/
  SlotPicker.tsx              # NEW React island
  BookingForm.astro           # NEW name/email/answers form
src/pages/api/weasley-clock/bookings/
  slots.ts                    # NEW POST: compute slots for a date window
  index.ts                    # NEW POST: create booking
seed/seed.json                # UPDATE meeting_types fields + add default availability_rule
src/data/site-routes.json     # UPDATE add /book entries
```

---

## Task 1: Extend storage collections

**Files:**
- Modify: `src/lib/weasley-clock/storage.ts`

- [ ] **Step 1: Add types**

```ts
export interface AvailabilityRuleData {
	label: string;
	timezone: string;
	// Weekly pattern: mon..sun keyed days, each a list of HH:MM intervals.
	weekly_hours: {
		mon: { start: string; end: string }[];
		tue: { start: string; end: string }[];
		wed: { start: string; end: string }[];
		thu: { start: string; end: string }[];
		fri: { start: string; end: string }[];
		sat: { start: string; end: string }[];
		sun: { start: string; end: string }[];
	};
	// YYYY-MM-DD → replacement intervals (or [] to mean "blocked that day")
	date_overrides?: Record<string, { start: string; end: string }[]>;
}

export interface BookingData {
	meeting_type_id: string;
	host_account_id: string;
	slot_start_iso: string;
	slot_end_iso: string;
	timezone: string;
	guest_name: string;
	guest_email: string;
	guest_answers: Record<string, string>;
	gcal_event_id: string | null;
	status: "confirmed" | "cancelled";
	cancel_token: string;
	reschedule_token: string;
	created_at: string;
	cancelled_at: string | null;
	reminded_at: string | null;
}
```

- [ ] **Step 2: Add to `collections()` factory**

```ts
export function collections(db: D1Database) {
	return {
		oauth_accounts: new Collection<OAuthAccountData>(db, "oauth_accounts"),
		oauth_calendars: new Collection<OAuthCalendarData>(db, "oauth_calendars"),
		oauth_state: new Collection<OAuthStateData>(db, "oauth_state"),
		availability_rules: new Collection<AvailabilityRuleData>(db, "availability_rules"),
		bookings: new Collection<BookingData>(db, "bookings"),
	};
}
```

- [ ] **Step 3: Update plugin descriptor storage namespaces**

File: `plugins/plugin-weasley-clock/src/index.ts` — add to `storage`:
```ts
availability_rules: { indexes: ["timezone"] },
bookings: {
	indexes: [
		"meeting_type_id",
		"host_account_id",
		"slot_start_iso",
		"status",
		"cancel_token",
		"reschedule_token",
	],
},
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/weasley-clock/storage.ts plugins/plugin-weasley-clock/src/index.ts
git commit -m "feat(weasley-clock): add availability_rules + bookings collections"
```

---

## Task 2: Extend meeting_types schema + seed defaults

**Files:**
- Modify: `seed/seed.json`

- [ ] **Step 1: Add `host_account_ids` field to meeting_types schema**

Locate the `"slug": "meeting_types"` collection and add this field to its `fields` array:

```json
{ "slug": "host_account_ids", "label": "Host Account IDs (JSON array)", "type": "string" }
```

JSON string for MVP; stored as a JSON-stringified array. Round-robin code parses it. Future: EmDash native multi-reference field.

- [ ] **Step 2: Validate seed**

```bash
npx emdash seed seed/seed.json --validate
```
Expected: `Valid`.

- [ ] **Step 3: Commit**

```bash
git add seed/seed.json
git commit -m "feat(weasley-clock): add host_account_ids field to meeting_types"
```

---

## Task 3: Write `computeSlots` pure function

**Files:**
- Create: `src/lib/weasley-clock/availability.ts`
- Create: `tests/weasley-clock/availability.test.ts`

- [ ] **Step 1: Write failing test — basic free day**

`tests/weasley-clock/availability.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeSlots } from "../../src/lib/weasley-clock/availability";

describe("computeSlots", () => {
	it("returns 30-min slots across a full free day in the rule's tz", () => {
		const rule = {
			label: "Default",
			timezone: "Asia/Ho_Chi_Minh",
			weekly_hours: {
				mon: [{ start: "09:00", end: "17:30" }],
				tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
			},
		};
		// Monday 2026-05-04 in Asia/Ho_Chi_Minh → UTC 02:00 start
		const slots = computeSlots({
			rule,
			busyWindows: [],
			durationMin: 30,
			bufferBeforeMin: 0,
			bufferAfterMin: 0,
			minNoticeHrs: 0,
			maxAdvanceDays: 365,
			rangeStartIso: "2026-05-04T00:00:00Z",
			rangeEndIso: "2026-05-04T23:59:59Z",
			nowIso: "2026-01-01T00:00:00Z",
		});
		// 09:00–17:30 = 8.5 hours → 17 30-min slots
		expect(slots.length).toBe(17);
		expect(slots[0].start_iso).toBe("2026-05-04T02:00:00.000Z");
		expect(slots[16].start_iso).toBe("2026-05-04T10:00:00.000Z");
	});
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npx vitest run tests/weasley-clock/availability.test.ts`
Expected: `FAIL` — module not found.

- [ ] **Step 3: Minimal implementation**

`src/lib/weasley-clock/availability.ts`:

```ts
import type { AvailabilityRuleData } from "./storage";

export interface BusyWindow { start_iso: string; end_iso: string; }
export interface Slot { start_iso: string; end_iso: string; }

export interface ComputeSlotsInput {
	rule: AvailabilityRuleData;
	busyWindows: BusyWindow[];
	durationMin: number;
	bufferBeforeMin: number;
	bufferAfterMin: number;
	minNoticeHrs: number;
	maxAdvanceDays: number;
	rangeStartIso: string;
	rangeEndIso: string;
	nowIso: string;
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function computeSlots(input: ComputeSlotsInput): Slot[] {
	const {
		rule, busyWindows, durationMin,
		bufferBeforeMin, bufferAfterMin,
		minNoticeHrs, maxAdvanceDays,
		rangeStartIso, rangeEndIso, nowIso,
	} = input;

	const now = new Date(nowIso).getTime();
	const minStart = now + minNoticeHrs * 3600_000;
	const maxStart = now + maxAdvanceDays * 86400_000;

	const rangeStart = new Date(rangeStartIso).getTime();
	const rangeEnd = new Date(rangeEndIso).getTime();

	// Expand rule into free intervals per day (UTC) by walking each date in the range.
	const free: { start: number; end: number }[] = [];
	for (let t = rangeStart; t < rangeEnd; t += 86400_000) {
		const d = new Date(t);
		const ymd = toYmdInTz(d, rule.timezone);
		const override = rule.date_overrides?.[ymd];
		const dayKey = DAY_KEYS[dowInTz(d, rule.timezone)];
		const intervals = override ?? rule.weekly_hours[dayKey] ?? [];
		for (const iv of intervals) {
			const startMs = ymdHmToUtcMs(ymd, iv.start, rule.timezone);
			const endMs = ymdHmToUtcMs(ymd, iv.end, rule.timezone);
			if (endMs > rangeStart && startMs < rangeEnd) {
				free.push({ start: Math.max(startMs, rangeStart), end: Math.min(endMs, rangeEnd) });
			}
		}
	}

	// Subtract busy windows (expand with buffers).
	const busy = busyWindows.map((b) => ({
		start: new Date(b.start_iso).getTime() - bufferAfterMin * 60_000,
		end: new Date(b.end_iso).getTime() + bufferBeforeMin * 60_000,
	}));
	const trimmed: { start: number; end: number }[] = [];
	for (const iv of free) {
		let pieces = [iv];
		for (const b of busy) {
			const next: typeof pieces = [];
			for (const p of pieces) {
				if (b.end <= p.start || b.start >= p.end) { next.push(p); continue; }
				if (b.start > p.start) next.push({ start: p.start, end: b.start });
				if (b.end < p.end) next.push({ start: b.end, end: p.end });
			}
			pieces = next;
		}
		trimmed.push(...pieces);
	}

	// Slice into fixed-duration slots.
	const slots: Slot[] = [];
	const durMs = durationMin * 60_000;
	for (const iv of trimmed) {
		const boundary = Math.ceil(iv.start / (15 * 60_000)) * (15 * 60_000);
		for (let s = boundary; s + durMs <= iv.end; s += durMs) {
			if (s < minStart || s > maxStart) continue;
			slots.push({
				start_iso: new Date(s).toISOString(),
				end_iso: new Date(s + durMs).toISOString(),
			});
		}
	}
	return slots;
}

// Helpers use Intl.DateTimeFormat with the rule's timezone to resolve local YMD/DOW.
function toYmdInTz(d: Date, tz: string): string {
	const fmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: tz });
	return fmt.format(d);
}
function dowInTz(d: Date, tz: string): number {
	const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz });
	const key = fmt.format(d).toLowerCase().slice(0, 3);
	return { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }[key] ?? 0;
}
function ymdHmToUtcMs(ymd: string, hm: string, tz: string): number {
	// Use a local Date constructed in the tz, then back-calc UTC via Intl offset.
	const [Y, M, D] = ymd.split("-").map(Number);
	const [h, m] = hm.split(":").map(Number);
	// Guess UTC based on tz offset at that instant.
	const guess = Date.UTC(Y, M - 1, D, h, m);
	const tzOffsetMin = getTzOffsetMin(new Date(guess), tz);
	return guess - tzOffsetMin * 60_000;
}
function getTzOffsetMin(d: Date, tz: string): number {
	const utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
	const local = new Date(d.toLocaleString("en-US", { timeZone: tz }));
	return Math.round((local.getTime() - utc.getTime()) / 60_000);
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `npx vitest run tests/weasley-clock/availability.test.ts`
Expected: `PASS` (1).

- [ ] **Step 5: Add more tests: busy subtraction, buffer, min-notice, max-advance, date override, multiple intervals per day**

Add to `availability.test.ts`:

```ts
it("subtracts busy windows with buffers", () => { /* ... */ });
it("drops slots inside min_notice window", () => { /* ... */ });
it("drops slots beyond max_advance_days", () => { /* ... */ });
it("applies date_overrides to replace that day's hours", () => { /* ... */ });
it("handles multiple intervals in one day (lunch break)", () => { /* ... */ });
```

Write each with concrete assertions. Run after each.

- [ ] **Step 6: Commit**

```bash
git add src/lib/weasley-clock/availability.ts tests/weasley-clock/availability.test.ts
git commit -m "feat(weasley-clock): availability engine — computeSlots with tests"
```

---

## Task 4: Seed the default availability rule + update existing meeting_types

**Files:**
- Modify: `seed/seed.json`

- [ ] **Step 1: Add an `availability_rules` entry** (if seed supports direct D1 seeds for plugin storage; else script it via a one-off migration)

The `_plugin_storage` table is populated at runtime, not via seed.json. Easier: write a lightweight bootstrap endpoint or include it in the plugin's `plugin:install` hook.

Use plugin `plugin:install` hook in `plugins/plugin-weasley-clock/src/sandbox-entry.ts`:

```ts
"plugin:install": {
	handler: async (_event: unknown, ctx: PluginContext) => {
		ctx.log.info("weasley-clock: installing defaults");
		const rules = ctx.storage.availability_rules;
		const existing = await rules.get("default");
		if (!existing) {
			await rules.put("default", {
				label: "Default — daily 09:00-17:30 ICT",
				timezone: "Asia/Ho_Chi_Minh",
				weekly_hours: {
					mon: [{ start: "09:00", end: "17:30" }],
					tue: [{ start: "09:00", end: "17:30" }],
					wed: [{ start: "09:00", end: "17:30" }],
					thu: [{ start: "09:00", end: "17:30" }],
					fri: [{ start: "09:00", end: "17:30" }],
					sat: [{ start: "09:00", end: "17:30" }],
					sun: [{ start: "09:00", end: "17:30" }],
				},
			});
		}
	},
},
```

Note: plugin sandbox ctx doesn't have `env.DB`, but it does have `ctx.storage.<namespace>` — use that.

- [ ] **Step 2: Commit**

```bash
git add plugins/plugin-weasley-clock/src/sandbox-entry.ts
git commit -m "feat(weasley-clock): seed default availability rule on plugin install"
```

---

## Task 5: Rate limit helper

**Files:**
- Create: `src/lib/weasley-clock/rate-limit.ts`

- [ ] **Step 1: Implement**

```ts
export async function checkRateLimit(
	kv: KVNamespace,
	key: string,
	limit: number,
	windowSec: number,
): Promise<{ allowed: boolean; remaining: number }> {
	const full = `wc-rl:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
	const current = parseInt((await kv.get(full)) ?? "0");
	if (current >= limit) return { allowed: false, remaining: 0 };
	await kv.put(full, String(current + 1), { expirationTtl: windowSec * 2 });
	return { allowed: true, remaining: limit - current - 1 };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/weasley-clock/rate-limit.ts
git commit -m "feat(weasley-clock): KV-backed rate limiter"
```

---

## Task 6: Slots API endpoint

**Files:**
- Create: `src/pages/api/weasley-clock/bookings/slots.ts`

- [ ] **Step 1: Implement**

```ts
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { collections } from "../../../../lib/weasley-clock/storage";
import { computeSlots, type BusyWindow } from "../../../../lib/weasley-clock/availability";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	try {
		const body = await request.json() as {
			meeting_type_id: string;
			range_start_iso: string;
			range_end_iso: string;
			guest_timezone?: string;
		};
		const db = (env as any).DB;
		const c = collections(db);

		// Load meeting type (EmDash content, not plugin storage). Use getEmDashCollection or a direct D1 select of emdash's content table.
		const mt = await loadMeetingType(db, body.meeting_type_id);
		if (!mt) return json({ error: "Meeting type not found" }, 404);

		const hostIds: string[] = JSON.parse(mt.host_account_ids || "[]");
		if (hostIds.length === 0) return json({ error: "No host configured" }, 500);

		// For MVP single-host: use first host
		const hostId = hostIds[0];
		const availId = mt.availability_id || "default";
		const rule = await c.availability_rules.get(availId);
		if (!rule) return json({ error: "Availability rule missing" }, 500);

		// Busy windows from synced_events for host's enabled calendars, in window.
		const cals = (await c.oauth_calendars.list())
			.filter((r) => r.data.account_id === hostId && r.data.synced === 1);
		const calIds = new Set(cals.map((r) => r.data.calendar_id));
		const allEvents = await db.prepare(
			`SELECT json_extract(data, '$.starts_at') AS s, json_extract(data, '$.ends_at') AS e,
			        json_extract(data, '$.gcal_calendar_id') AS cid, json_extract(data, '$.deleted') AS del
			 FROM _plugin_storage WHERE plugin_id='weasley-clock' AND collection='synced_events'`,
		).all<{ s: string; e: string; cid: string; del: number }>();
		const busy: BusyWindow[] = (allEvents.results ?? [])
			.filter((r) => calIds.has(r.cid) && !r.del)
			.map((r) => ({ start_iso: r.s, end_iso: r.e }));

		const slots = computeSlots({
			rule: rule.data,
			busyWindows: busy,
			durationMin: Number(mt.duration_min ?? 30),
			bufferBeforeMin: Number(mt.buffer_before ?? 0),
			bufferAfterMin: Number(mt.buffer_after ?? 0),
			minNoticeHrs: Number(mt.min_notice_hrs ?? 2),
			maxAdvanceDays: Number(mt.max_advance_days ?? 60),
			rangeStartIso: body.range_start_iso,
			rangeEndIso: body.range_end_iso,
			nowIso: new Date().toISOString(),
		});
		return json({ slots, host_id: hostId, timezone: rule.data.timezone });
	} catch (err: any) {
		console.error("[wc/slots]", err);
		return json({ error: err?.message ?? "Internal error" }, 500);
	}
};

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function loadMeetingType(db: any, id: string): Promise<any | null> {
	// EmDash stores collection content in a table; use its read API.
	// TODO: verify the exact read path during implementation — likely `getEmDashCollection("meeting_types")` then find by id.
	return null; // placeholder — implement during task execution
}
```

- [ ] **Step 2: Resolve `loadMeetingType` impl**

Inspect EmDash content access patterns during implementation. Likely: import `getEmDashCollection` and filter in memory, or use the emdash admin API with an internal fetch. Pick whichever is idiomatic in this codebase (there are reference usages in `src/pages/nydus/weasley-clock/index.astro`).

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/weasley-clock/bookings/slots.ts
git commit -m "feat(weasley-clock): POST /bookings/slots — returns available slots"
```

---

## Task 7: Create booking endpoint (GCal insert + email)

**Files:**
- Create: `src/lib/weasley-clock/booking-create.ts`
- Create: `src/pages/api/weasley-clock/bookings/index.ts`

- [ ] **Step 1: booking-create.ts — core logic**

```ts
import type { D1Database } from "@cloudflare/workers-types";
import { collections, type BookingData } from "./storage";
import { computeSlots } from "./availability";
import { decryptToken, encryptToken } from "./crypto";
import { refreshAccessToken } from "./token-refresh";

export interface CreateBookingInput {
	db: D1Database;
	kv: KVNamespace;
	encKey: string;
	clientId: string;
	clientSecret: string;
	meetingTypeId: string;
	slotStartIso: string;
	guestName: string;
	guestEmail: string;
	guestAnswers: Record<string, string>;
	guestTimezone: string;
}

export async function createBooking(input: CreateBookingInput): Promise<{ bookingId: string; cancelToken: string; rescheduleToken: string }> {
	// 1. Load meeting type (TBD: helper)
	// 2. Re-run computeSlots for the slot's day, verify slot is in set
	// 3. Decrypt host's access_token (refresh if near expiry)
	// 4. POST to Google Calendar events.insert — NO conferenceData
	// 5. Write bookings row with gcal_event_id
	// 6. Return tokens for the caller to stitch cancel/reschedule URLs
	// ... full body written during execution ...
}
```

- [ ] **Step 2: POST /api/weasley-clock/bookings**

```ts
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createBooking } from "../../../../lib/weasley-clock/booking-create";
import { checkRateLimit } from "../../../../lib/weasley-clock/rate-limit";
import { sendConfirmationEmail } from "../../../../lib/weasley-clock/email";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	try {
		const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
		const rl = await checkRateLimit((env as any).SESSION, `book:${ip}`, 5, 3600);
		if (!rl.allowed) return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), { status: 429, headers: { "Content-Type": "application/json" } });

		const body = await request.json() as {
			meeting_type_id: string;
			slot_start_iso: string;
			guest_name: string;
			guest_email: string;
			guest_answers?: Record<string, string>;
			guest_timezone: string;
		};

		const { bookingId, cancelToken, rescheduleToken } = await createBooking({
			db: (env as any).DB,
			kv: (env as any).SESSION,
			encKey: (env as any).OAUTH_ENC_KEY,
			clientId: (env as any).GOOGLE_OAUTH_CLIENT_ID,
			clientSecret: (env as any).GOOGLE_OAUTH_CLIENT_SECRET,
			meetingTypeId: body.meeting_type_id,
			slotStartIso: body.slot_start_iso,
			guestName: body.guest_name,
			guestEmail: body.guest_email,
			guestAnswers: body.guest_answers ?? {},
			guestTimezone: body.guest_timezone,
		});

		await sendConfirmationEmail({ bookingId, cancelToken, rescheduleToken });

		return new Response(JSON.stringify({
			booking_id: bookingId,
			confirmed_url: `/book/confirmed/${bookingId}`,
		}), { status: 201, headers: { "Content-Type": "application/json" } });
	} catch (err: any) {
		console.error("[wc/bookings/create]", err);
		return new Response(JSON.stringify({ error: err?.message ?? "Internal error" }), { status: 500, headers: { "Content-Type": "application/json" } });
	}
};
```

- [ ] **Step 3: sendConfirmationEmail helper via Resend**

Look at `plugin-resend` API; call it with VI+EN template (language chosen by guest's locale, default VI). Sender: `loctruongh@gmail.com` (verified in Resend). Subject: `Booking confirmed · <meeting title>`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/weasley-clock/booking-create.ts src/lib/weasley-clock/email.ts src/pages/api/weasley-clock/bookings/index.ts
git commit -m "feat(weasley-clock): POST /bookings — Google Calendar insert + confirmation email"
```

---

## Task 8: Public `/book` index page

**Files:**
- Create: `src/pages/book/index.astro`
- Modify: `src/data/site-routes.json`

- [ ] **Step 1: Server-render meeting types filtered by audience**

```astro
---
export const prerender = false;
import { getEmDashCollection } from "emdash";
import Base from "../../layouts/Base.astro";
import { getCurrentLang } from "../../utils/lang";

const lang = getCurrentLang(Astro);
const isVi = lang === "vi";
const url = new URL(Astro.request.url);
const audience = url.searchParams.get("audience") ?? "public";

const { entries, cacheHint } = await getEmDashCollection("meeting_types");
Astro.cache.set(cacheHint);

const visible = entries.filter((e: any) => {
	try { return (JSON.parse(e.audience_tags || "[]") as string[]).includes(audience); } catch { return false; }
});

const t = {
	title: isVi ? "Đặt lịch với Loc" : "Book time with Loc",
	pick: isVi ? "Chọn loại cuộc hẹn" : "Pick a meeting type",
	minutes: isVi ? "phút" : "min",
};
---
<Base title={t.title}>
	<main class="book-index">
		<h1>{t.title}</h1>
		<p>{t.pick}</p>
		<ul>
			{visible.map((mt: any) => (
				<li>
					<a href={`/book/${mt.meeting_slug}`}>
						<strong>{isVi ? mt.title_vi : mt.title_en}</strong>
						<span>{mt.duration_min} {t.minutes}</span>
					</a>
				</li>
			))}
		</ul>
	</main>
</Base>

<style>
	.book-index { max-width: 720px; margin: 40px auto; padding: 0 20px; color: #e8dcc4; font-family: "Inter Tight", sans-serif; }
	.book-index ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 12px; }
	.book-index a { display: flex; justify-content: space-between; padding: 16px; border: 1px solid #2a1f15; background: #110c08; text-decoration: none; color: inherit; }
	.book-index a:hover { border-color: #c9a961; }
</style>
```

- [ ] **Step 2: Add to site-routes.json**

```json
{ "path": "/book", "title_en": "Book time with Loc", "title_vi": "Đặt lịch với Loc" }
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/book/index.astro src/data/site-routes.json
git commit -m "feat(weasley-clock): public /book index — audience-filtered meeting types"
```

---

## Task 9: Slot picker page

**Files:**
- Create: `src/pages/book/[slug].astro`
- Create: `src/components/book/SlotPicker.tsx`

- [ ] **Step 1: Page shell — loads meeting type server-side, hydrates React picker**

```astro
---
export const prerender = false;
import { getEmDashCollection } from "emdash";
import Base from "../../layouts/Base.astro";
import SlotPicker from "../../components/book/SlotPicker";
import { getCurrentLang } from "../../utils/lang";

const { slug } = Astro.params;
const { entries, cacheHint } = await getEmDashCollection("meeting_types");
Astro.cache.set(cacheHint);
const mt = entries.find((e: any) => e.meeting_slug === slug);
if (!mt) return Astro.redirect("/book");

const lang = getCurrentLang(Astro);
---
<Base title={lang === "vi" ? mt.title_vi : mt.title_en}>
	<main class="book-pick">
		<h1>{lang === "vi" ? mt.title_vi : mt.title_en}</h1>
		<p>{mt.duration_min} {lang === "vi" ? "phút" : "minutes"}</p>
		<SlotPicker
			client:only="react"
			meetingTypeId={mt.id}
			durationMin={mt.duration_min}
			lang={lang}
		/>
	</main>
</Base>

<style>
	.book-pick { max-width: 820px; margin: 40px auto; padding: 0 20px; color: #e8dcc4; font-family: "Inter Tight", sans-serif; }
</style>
```

- [ ] **Step 2: SlotPicker React island**

```tsx
import { useEffect, useState } from "react";

interface Props { meetingTypeId: string; durationMin: number; lang: "vi" | "en"; }

export default function SlotPicker({ meetingTypeId, durationMin, lang }: Props) {
	const [monthAnchor, setMonthAnchor] = useState(() => new Date());
	const [slots, setSlots] = useState<{ start_iso: string; end_iso: string }[]>([]);
	const [selected, setSelected] = useState<string | null>(null);
	const [guestTz] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);

	useEffect(() => {
		const first = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
		const last = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 0, 23, 59, 59);
		fetch("/api/weasley-clock/bookings/slots", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				meeting_type_id: meetingTypeId,
				range_start_iso: first.toISOString(),
				range_end_iso: last.toISOString(),
				guest_timezone: guestTz,
			}),
		})
			.then((r) => r.json())
			.then((d) => setSlots(d.slots ?? []));
	}, [monthAnchor, meetingTypeId]);

	// Render: calendar-grid of dates with slot counts; click a date to expand slot list;
	// click a slot → setSelected; render <BookingForm> below when selected.
	// Implementation details: day-picker using synced/computed dates, time-of-day list.
	// ...
	return null; // filled during execution
}
```

- [ ] **Step 3: BookingForm** — name, email, dynamic custom questions from meeting_type. POST to `/api/weasley-clock/bookings`. On success, `location.href = response.confirmed_url`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/book/[slug].astro src/components/book/SlotPicker.tsx src/components/book/BookingForm.astro
git commit -m "feat(weasley-clock): slot picker page + React island"
```

---

## Task 10: Confirmation landing page

**Files:**
- Create: `src/pages/book/confirmed/[id].astro`
- Modify: `src/data/site-routes.json` (no new entries — dynamic route)

- [ ] **Step 1: Render booking summary from D1**

```astro
---
export const prerender = false;
import { env } from "cloudflare:workers";
import Base from "../../../layouts/Base.astro";
import { collections } from "../../../lib/weasley-clock/storage";

const { id } = Astro.params;
const c = collections((Astro.locals as any).runtime?.env?.DB ?? (env as any).DB);
const booking = await c.bookings.get(id!);
if (!booking) return Astro.redirect("/book");
---
<Base title="Booking confirmed">
	<main class="book-ok">
		<h1>You're booked ✓</h1>
		<p>A confirmation email is on its way to <strong>{booking.data.guest_email}</strong>.</p>
		<p>When: <time>{booking.data.slot_start_iso}</time></p>
	</main>
</Base>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/book/confirmed/[id].astro
git commit -m "feat(weasley-clock): /book/confirmed/[id] landing page"
```

---

## Task 11: i18n pass + final site-routes

**Files:**
- Modify: all new `.astro` files — ensure both VI and EN copy are present on every user-facing string.
- Verify `src/data/site-routes.json` has `/book` (home index of booking). Per-slug and per-booking-id routes are dynamic, no sitemap entry needed.

- [ ] **Step 1: i18n audit**

Grep for English-only strings in new files, add Vietnamese equivalents. Sender+email templates need VI+EN too.

```bash
grep -r "You're booked\|Book time\|Pick a meeting" src/pages/book/ src/components/book/
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/book src/components/book src/data/site-routes.json
git commit -m "feat(weasley-clock): i18n + site-routes update for /book"
```

---

## Task 12: End-to-end smoke test

- [ ] **Step 1: Deploy via PR merge**
- [ ] **Step 2: Navigate to `https://huuloc.com/book?audience=public`** — see list of meeting types.
- [ ] **Step 3: Click one** — slot picker loads, slots appear for today/tomorrow.
- [ ] **Step 4: Pick a slot, fill form, submit** — expect 201, redirect to `/book/confirmed/<id>`.
- [ ] **Step 5: Check Loc's Google Calendar** — event created with guest as attendee, no Meet link.
- [ ] **Step 6: Check Loc's Gmail** — confirmation email received (sent from `loctruongh@gmail.com`).
- [ ] **Step 7: Check `synced_events` after 5 min** — the new booking appears via sync, shows on Weasley Clock dashboard.

---

## Self-review

- Every new user-facing string has VI + EN? ☐
- Every page that queries EmDash collection has `Astro.cache.set(cacheHint)`? ☐
- No static generation on booking routes (all `prerender = false`)? ☐
- No `target="_blank"` on any in-site `href`? ☐
- No `localhost:3000` URLs? ☐
- `src/data/site-routes.json` has `/book`? ☐
- Rate limit enforced on `POST /bookings`? ☐
- All thrown errors wrapped in try/catch returning real Response (Astro Cloudflare adapter re-runs handlers on throw — lesson from OAuth callback bug)? ☐
- `meeting_types.host_account_ids` parsed defensively? ☐

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-25-weasley-clock-booking-phase-1.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.
**2. Inline Execution** — batch in this session with checkpoints.

Which?
