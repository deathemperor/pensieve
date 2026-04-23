# Weasley Clock Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working `/hogwarts/weasley-clock` dashboard that renders hand-entered family events (including Vietnamese lunar recurrence for giỗ) in Week / Month / Day / Year views with every date shown in both Gregorian (dương lịch) and lunar (âm lịch) calendars. No external sync, no booking — that's Phase 2+.

**Architecture:** Hybrid per spec §Architectural pattern. This phase only creates the EmDash collections (`family_events`, `meeting_types`) and the Weasley Clock dashboard page + its components. The `plugin-weasley-clock` package is scaffolded as empty in this phase — it gains actual hook/storage logic in Phase 2 (sync) onward. Dashboard is SSR with `?view=` query-param; view switcher posts the new URL via a tiny inline script (no React island needed yet). Lunar conversion is pure-function using Hồ Ngọc Đức's tables, vendored.

**Tech Stack:** Astro 6 (SSR), EmDash 0.5, node:test with tsx, TypeScript, Cloudflare Workers runtime. No new runtime deps (only a vendored data table for lunar conversion).

**Spec:** `docs/superpowers/specs/2026-04-23-weasley-clock-time-turner-design.md`

---

## File structure for Phase 1

**Created:**
- `plugins/plugin-weasley-clock/package.json` — plugin manifest (follows `plugin-pensieve-engage` shape)
- `plugins/plugin-weasley-clock/tsconfig.json`
- `plugins/plugin-weasley-clock/src/index.ts` — `PluginDescriptor` (empty capabilities in Phase 1)
- `plugins/plugin-weasley-clock/src/sandbox-entry.ts` — `definePlugin` scaffold (no hooks in Phase 1)
- `src/utils/lunar.ts` — `solarToLunar` / `lunarToSolar` pure functions + `formatDualDate`
- `src/utils/lunar-table.ts` — Hồ Ngọc Đức table data (1900–2100)
- `src/utils/flightDetect.ts` — regex-based flight detector
- `src/utils/familyEvents.ts` — materialisation helper: given a date range, return occurrences
- `src/components/weasley-clock/ClockWidget.astro` — small artifact, family-status line
- `src/components/weasley-clock/DualDate.astro` — big Gregorian + small lunar pair
- `src/components/weasley-clock/EventChip.astro` — single event bar with title + meta
- `src/components/weasley-clock/DayCell.astro` — shared cell (dual-date header + list of EventChips)
- `src/components/weasley-clock/Header.astro` — sticky nav (clock + range nav + D/W/M/Y segmented switcher)
- `src/components/weasley-clock/WeekView.astro`
- `src/components/weasley-clock/MonthView.astro`
- `src/components/weasley-clock/DayView.astro`
- `src/components/weasley-clock/YearView.astro`
- `src/pages/hogwarts/weasley-clock/index.astro` — the page entry
- `tests/utils/lunar.test.ts` — Tết 1900–2100 golden + sampled dates + leap-month cases
- `tests/utils/flightDetect.test.ts`
- `tests/utils/familyEvents.test.ts`

**Modified:**
- `astro.config.mjs` — register `weasleyClockPlugin()` (empty plugin is fine; confirms wiring)
- `package.json` — add `"plugin-weasley-clock": "file:./plugins/plugin-weasley-clock"`
- `seed/seed.json` — add `family_events` and `meeting_types` collections (meeting_types schema added now so types propagate even though we don't render bookings this phase)
- `src/data/site-routes.json` — add `/hogwarts/weasley-clock` static route

---

## Task 1: Scaffold the empty plugin package

**Why first:** Locks in the plugin ID and wires it into `astro.config.mjs`. Later phases add hooks, storage, admin pages. An empty plugin that merely registers is valid and proves wiring.

**Files:**
- Create: `plugins/plugin-weasley-clock/package.json`
- Create: `plugins/plugin-weasley-clock/tsconfig.json`
- Create: `plugins/plugin-weasley-clock/src/index.ts`
- Create: `plugins/plugin-weasley-clock/src/sandbox-entry.ts`
- Modify: `package.json` (add dep)
- Modify: `astro.config.mjs` (register plugin + exclude from Vite optimizeDeps)

- [ ] **Step 1: Create `plugins/plugin-weasley-clock/package.json`**

```json
{
	"name": "plugin-weasley-clock",
	"version": "0.1.0",
	"private": true,
	"type": "module",
	"exports": {
		".": "./src/index.ts",
		"./sandbox": "./src/sandbox-entry.ts"
	},
	"peerDependencies": {
		"emdash": "^0.1.0 || ^0.5.0"
	}
}
```

- [ ] **Step 2: Create `plugins/plugin-weasley-clock/tsconfig.json`**

Copy the shape of `plugins/plugin-pensieve-engage/tsconfig.json`:

```bash
cp plugins/plugin-pensieve-engage/tsconfig.json plugins/plugin-weasley-clock/tsconfig.json
```

- [ ] **Step 3: Create `plugins/plugin-weasley-clock/src/index.ts`**

```ts
import type { PluginDescriptor } from "emdash";

export function weasleyClockPlugin(): PluginDescriptor {
	return {
		id: "weasley-clock",
		version: "0.1.0",
		format: "standard",
		entrypoint: "plugin-weasley-clock/sandbox",
		options: {},
		capabilities: [],
		allowedHosts: [],
		storage: {},
		adminPages: [],
	};
}
```

- [ ] **Step 4: Create `plugins/plugin-weasley-clock/src/sandbox-entry.ts`**

```ts
import { definePlugin } from "emdash";

export default definePlugin({
	setup() {
		// Phase 1: empty. Later phases register hooks, cron, admin pages.
	},
});
```

- [ ] **Step 5: Add to root `package.json` dependencies**

Open `/Users/deathemperor/death/pensieve/package.json` and add inside `"dependencies"`, alphabetically next to `"plugin-resend"`:

```json
"plugin-weasley-clock": "file:./plugins/plugin-weasley-clock",
```

- [ ] **Step 6: Install**

Run: `bun install`
Expected: installs the local file: package, no errors.

- [ ] **Step 7: Register in `astro.config.mjs`**

Open `/Users/deathemperor/death/pensieve/astro.config.mjs`. Add import next to the other plugin imports:

```js
import { weasleyClockPlugin } from "plugin-weasley-clock";
```

Inside `emdash({ ... plugins: [...] })`, add the plugin:

```js
plugins: [formsPlugin(), resendPlugin(), pensieveEngagePlugin(), weasleyClockPlugin()],
```

And extend both `optimizeDeps.exclude` arrays (in `vite.optimizeDeps.exclude` and `vite.ssr.noExternal`) by adding `"plugin-weasley-clock"` — follow the existing pattern for `plugin-pensieve-engage`.

- [ ] **Step 8: Boot the dev server once to verify the plugin registers cleanly**

Run: `npx emdash dev`
Expected: server starts without errors. Look in the stdout for the plugin appearing in the loaded-plugins list. Kill with `Ctrl+C` after confirming.

- [ ] **Step 9: Commit**

```bash
git add plugins/plugin-weasley-clock package.json astro.config.mjs
git commit -m "feat(weasley-clock): scaffold empty plugin package"
```

---

## Task 2: Vendor the lunar conversion table

**Why:** The module in Task 3 depends on this static data. Separating the big numeric table from the logic keeps `lunar.ts` readable.

**Files:**
- Create: `src/utils/lunar-table.ts`

**Background:** Hồ Ngọc Đức's published tables encode, for each lunisolar year, a packed integer describing (a) the Gregorian date of Tết (lunar month 1 day 1), (b) the leap month if any, and (c) the month-length pattern (29 or 30 days per month across 12 or 13 lunar months). The canonical table covers Vietnamese time zone (UTC+7) and runs 1900–2100. Copy the table from the public reference (attribution in a comment).

- [ ] **Step 1: Create `src/utils/lunar-table.ts` with the 1900–2100 packed-year data**

Source: Hồ Ngọc Đức's "Âm lịch Việt Nam" (https://www.informatik.uni-leipzig.de/~duc/amlich/). Use his 201-entry array representing years 1900–2100 as packed 24-bit integers (year_info[idx] where idx = year − 1900). Packing convention: bits 0-4 = Tết day-of-month (Gregorian), bits 5-8 = Tết month (Gregorian), bits 9-12 = leap-month (0 = no leap), bits 13-24 = bit-mask of month lengths (1 = 30 days, 0 = 29).

```ts
// Hồ Ngọc Đức's Vietnamese lunar table, 1900–2100.
// Reference: https://www.informatik.uni-leipzig.de/~duc/amlich/
// Each entry packs: [Tết day (5 bits) | Tết month (4) | leap-month (4) | month-length mask (12)].
// Index 0 = year 1900; length = 201.
export const YEAR_INFO: readonly number[] = [
	// Engineer: paste the full 201-element array from Đức's canonical source.
	// The array itself is public data; file a separate commit for provenance.
] as const;

export const TABLE_START_YEAR = 1900;
export const TABLE_END_YEAR = 2100;
```

- [ ] **Step 2: Write a sanity check test (will stay skipped until Task 3's module exists)**

This is a placeholder test that asserts the table length; once Task 3 lands, Task 3's tests will cover the actual conversion correctness.

Create `tests/utils/lunar-table.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR_INFO, TABLE_START_YEAR, TABLE_END_YEAR } from "../../src/utils/lunar-table";

test("YEAR_INFO covers 1900-2100 inclusive", () => {
	assert.equal(YEAR_INFO.length, TABLE_END_YEAR - TABLE_START_YEAR + 1);
	assert.equal(TABLE_START_YEAR, 1900);
	assert.equal(TABLE_END_YEAR, 2100);
});
```

- [ ] **Step 3: Run the test**

Run: `npm test -- --test-only-name='YEAR_INFO'`
Expected: FAIL until the table is pasted. After pasting the 201-element array, PASS.

- [ ] **Step 4: Commit**

```bash
git add src/utils/lunar-table.ts tests/utils/lunar-table.test.ts
git commit -m "feat(lunar): vendor Hồ Ngọc Đức's 1900-2100 lunar year table"
```

---

## Task 3: Lunar conversion module (TDD)

**Why:** Core to the entire UI — every date render depends on it, and recurring giỗ events need correct lunar → Gregorian.

**Files:**
- Create: `src/utils/lunar.ts`
- Create: `tests/utils/lunar.test.ts`

The module exports:

```ts
export interface LunarDate { year: number; month: number; day: number; isLeapMonth: boolean }
export function solarToLunar(gregorian: Date): LunarDate | null;
export function lunarToSolar(l: { year: number; month: number; day: number; isLeapMonth?: boolean }): Date | null;
export function formatDualDate(date: Date, opts?: { lang?: "vi" | "en" }): { gregorian: string; lunar: string };
```

Returns `null` when outside the table range (1900–2100).

- [ ] **Step 1: Write the failing test — canonical Tết dates**

Create `tests/utils/lunar.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { solarToLunar, lunarToSolar, formatDualDate } from "../../src/utils/lunar";

// Gold reference: well-known Tết Nguyên Đán dates in Vietnam (UTC+7 clock).
const KNOWN_TET: Record<number, string> = {
	2000: "2000-02-05",
	2005: "2005-02-09",
	2010: "2010-02-14",
	2015: "2015-02-19",
	2020: "2020-01-25",
	2023: "2023-01-22",
	2024: "2024-02-10",
	2025: "2025-01-29",
	2026: "2026-02-17",
	2027: "2027-02-06",
	2030: "2030-02-03",
};

test("lunarToSolar: Tết day-1 month-1 matches known Gregorian dates", () => {
	for (const [y, expected] of Object.entries(KNOWN_TET)) {
		const year = Number(y);
		const out = lunarToSolar({ year, month: 1, day: 1 });
		assert.ok(out, `year ${year} should convert`);
		const iso = out!.toISOString().slice(0, 10);
		assert.equal(iso, expected, `Tết ${year}`);
	}
});

test("solarToLunar: on a Tết date returns { month:1, day:1 }", () => {
	for (const [y, iso] of Object.entries(KNOWN_TET)) {
		const date = new Date(iso + "T00:00:00+07:00");
		const l = solarToLunar(date);
		assert.ok(l, `year ${y} should convert`);
		assert.equal(l!.month, 1, `Tết ${y} lunar month`);
		assert.equal(l!.day, 1, `Tết ${y} lunar day`);
	}
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- --test-only-name='lunar'`
Expected: FAIL — `solarToLunar` / `lunarToSolar` not defined.

- [ ] **Step 3: Implement `src/utils/lunar.ts`**

This is a direct port of Đức's conversion algorithm. Paste the canonical JS implementation (MIT-compatible reference from https://github.com/vanthao03596/lunar-calendar-vietnam or equivalent) and adapt to TS. Key entry points:

```ts
import { YEAR_INFO, TABLE_START_YEAR, TABLE_END_YEAR } from "./lunar-table";

export interface LunarDate {
	year: number;
	month: number;
	day: number;
	isLeapMonth: boolean;
}

function inRange(year: number): boolean {
	return year >= TABLE_START_YEAR && year <= TABLE_END_YEAR;
}

// Returns the Gregorian midnight (UTC+7) Date for given lunar date, or null if out of range.
export function lunarToSolar(l: {
	year: number;
	month: number;
	day: number;
	isLeapMonth?: boolean;
}): Date | null {
	if (!inRange(l.year)) return null;
	// ... Đức's algorithm: look up YEAR_INFO[l.year - 1900], decode leap-month,
	// walk forward from Tết by (month * monthLen + day - 1) days.
	// Return new Date(Date.UTC(...) - 7 * 3600 * 1000) to anchor to UTC+7 midnight.
}

export function solarToLunar(date: Date): LunarDate | null {
	// Convert UTC instant to Asia/Ho_Chi_Minh date, then walk the table.
	// Returns null if the resulting lunar year is outside TABLE_START_YEAR..TABLE_END_YEAR.
}

export function formatDualDate(
	date: Date,
	opts: { lang?: "vi" | "en" } = {},
): { gregorian: string; lunar: string } {
	const lang = opts.lang ?? "vi";
	const greg = new Intl.DateTimeFormat(lang === "vi" ? "vi-VN" : "en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "Asia/Ho_Chi_Minh",
	}).format(date);
	const l = solarToLunar(date);
	const lunar = l
		? `${l.day}/${l.month}${l.isLeapMonth ? " nhuận" : ""}`
		: "—";
	return { gregorian: greg, lunar };
}
```

(The engineer pastes the actual algorithm body from Đức's public source — about 60 lines of arithmetic on the packed year info. Keep variable names matching Đức's reference comments, for reviewability.)

- [ ] **Step 4: Run the tests — now passing**

Run: `npm test -- --test-only-name='lunar'`
Expected: PASS for both Tết tests.

- [ ] **Step 5: Add out-of-range + leap-month tests**

Append to `tests/utils/lunar.test.ts`:

```ts
test("solarToLunar: outside 1900-2100 returns null", () => {
	assert.equal(solarToLunar(new Date("1899-12-31T00:00:00+07:00")), null);
	assert.equal(solarToLunar(new Date("2101-01-01T00:00:00+07:00")), null);
});

test("lunarToSolar: outside 1900-2100 returns null", () => {
	assert.equal(lunarToSolar({ year: 1899, month: 1, day: 1 }), null);
	assert.equal(lunarToSolar({ year: 2101, month: 1, day: 1 }), null);
});

test("lunar leap-month 2025 — tháng 6 nhuận exists", () => {
	// 2025 has a leap 6th month per Đức's table.
	// First day of leap-6 is known.
	const leapStart = lunarToSolar({ year: 2025, month: 6, day: 1, isLeapMonth: true });
	assert.ok(leapStart, "leap 6/2025 should exist");
	const regularStart = lunarToSolar({ year: 2025, month: 6, day: 1, isLeapMonth: false });
	assert.ok(regularStart, "regular 6/2025 should exist");
	assert.notEqual(leapStart!.toISOString(), regularStart!.toISOString());
});

test("formatDualDate: 2026-04-23 renders brackets in Vietnamese", () => {
	const out = formatDualDate(new Date("2026-04-23T00:00:00+07:00"));
	assert.match(out.gregorian, /\b23\b/);
	assert.match(out.lunar, /^\d+\/\d+$/);
});
```

- [ ] **Step 6: Run all lunar tests**

Run: `npm test -- --test-only-name='lunar'`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/utils/lunar.ts tests/utils/lunar.test.ts
git commit -m "feat(lunar): solarToLunar + lunarToSolar + formatDualDate"
```

---

## Task 4: Flight detector utility (TDD)

**Files:**
- Create: `src/utils/flightDetect.ts`
- Create: `tests/utils/flightDetect.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/utils/flightDetect.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectFlight } from "../../src/utils/flightDetect";

test("detectFlight: positive cases (IATA flight codes)", () => {
	assert.ok(detectFlight("SQ186 SGN → HAN"));
	assert.ok(detectFlight("VN255 Hanoi to Saigon"));
	assert.ok(detectFlight("BL6020"));
	assert.ok(detectFlight("BA 42"));
	assert.ok(detectFlight("QF9 London"));
});

test("detectFlight: negative cases", () => {
	assert.ok(!detectFlight("Sprint review with PM team"));
	assert.ok(!detectFlight("1:1 Linh"));
	assert.ok(!detectFlight(""));
	assert.ok(!detectFlight("123 ABC"));
	assert.ok(!detectFlight("Meeting at ABC123 tower"));
});

test("detectFlight: returns object with code and trimmed title", () => {
	const hit = detectFlight("SQ186 HAN → SGN");
	assert.deepEqual(hit, { code: "SQ186", rest: "HAN → SGN" });
});
```

- [ ] **Step 2: Run — should fail**

Run: `npm test -- --test-only-name='detectFlight'`
Expected: FAIL — `detectFlight` undefined.

- [ ] **Step 3: Implement `src/utils/flightDetect.ts`**

```ts
// Best-effort IATA flight-code detector. Looks for an uppercase 2-letter
// airline code followed by 2–4 digits at the start of the string.
// Misses ICAO (3-letter) codes, which rarely appear in consumer booking
// confirmations. Case-insensitive: airline codes are canonically uppercase.
const FLIGHT_RE = /^([A-Z]{2})\s?(\d{2,4})\b\s*(.*)$/;

export interface FlightMatch {
	code: string; // e.g. "SQ186"
	rest: string; // title remainder after the code
}

export function detectFlight(title: string): FlightMatch | null {
	if (!title) return null;
	const m = title.match(FLIGHT_RE);
	if (!m) return null;
	return { code: m[1] + m[2], rest: m[3].trim() };
}
```

- [ ] **Step 4: Run — should pass**

Run: `npm test -- --test-only-name='detectFlight'`
Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/flightDetect.ts tests/utils/flightDetect.test.ts
git commit -m "feat(utils): flightDetect — IATA flight-code regex detector"
```

---

## Task 5: Family events collection in seed.json

**Files:**
- Modify: `seed/seed.json`

The spec's `family_events` schema translated into EmDash's field types. Same for `meeting_types` — we add both now so the generated types in `emdash-env.d.ts` are ready for later phases even though this phase only renders `family_events`.

- [ ] **Step 1: Open `seed/seed.json` and find the `"collections": [...]` array**

Locate the end of the existing collections (after `"diary"` and any others). Preserve existing entries untouched.

- [ ] **Step 2: Append the `family_events` collection**

Insert this object into the `collections` array (comma-separated from prior entries):

```json
{
	"slug": "family_events",
	"label": "Family Events",
	"labelSingular": "Family Event",
	"supports": ["search"],
	"fields": [
		{ "slug": "title_en", "label": "Title (EN)", "type": "string", "required": true, "searchable": true },
		{ "slug": "title_vi", "label": "Title (VI)", "type": "string", "required": true, "searchable": true },
		{ "slug": "event_type", "label": "Type", "type": "string", "required": true, "options": ["birthday", "death_anniv", "wedding_anniv", "cultural", "milestone"] },
		{ "slug": "date_calendar", "label": "Calendar", "type": "string", "required": true, "options": ["solar", "lunar"] },
		{ "slug": "month", "label": "Month (1-12)", "type": "number", "required": true },
		{ "slug": "day", "label": "Day (1-31)", "type": "number", "required": true },
		{ "slug": "is_leap_month", "label": "Is Leap Month (lunar origin year only)", "type": "boolean" },
		{ "slug": "origin_year", "label": "Origin Year (birth / death / wedding)", "type": "number" },
		{ "slug": "person_name", "label": "Person Name", "type": "string" },
		{ "slug": "relationship", "label": "Relationship", "type": "string" },
		{ "slug": "notes", "label": "Notes", "type": "portableText" },
		{ "slug": "visibility", "label": "Visibility", "type": "string", "required": true, "options": ["household", "public"] },
		{ "slug": "reminder_days_before", "label": "Reminder Days Before (JSON array)", "type": "string" },
		{ "slug": "photo", "label": "Photo", "type": "image" }
	]
}
```

(Note: `reminder_days_before` is stored as a JSON-serialised string because EmDash's schema in this codebase doesn't yet expose array-of-number fields. The UI layer parses it with `JSON.parse` and default `[7, 1]`.)

- [ ] **Step 3: Append the `meeting_types` collection**

Insert immediately after `family_events`:

```json
{
	"slug": "meeting_types",
	"label": "Meeting Types",
	"labelSingular": "Meeting Type",
	"supports": ["search"],
	"fields": [
		{ "slug": "slug", "label": "Slug", "type": "string", "required": true, "searchable": true },
		{ "slug": "title_en", "label": "Title (EN)", "type": "string", "required": true },
		{ "slug": "title_vi", "label": "Title (VI)", "type": "string", "required": true },
		{ "slug": "description_en", "label": "Description (EN)", "type": "portableText" },
		{ "slug": "description_vi", "label": "Description (VI)", "type": "portableText" },
		{ "slug": "duration_min", "label": "Duration (min)", "type": "number", "required": true },
		{ "slug": "audience_tags", "label": "Audience Tags (JSON array)", "type": "string", "required": true },
		{ "slug": "availability_id", "label": "Availability Rule ID", "type": "string" },
		{ "slug": "buffer_before", "label": "Buffer Before (min)", "type": "number" },
		{ "slug": "buffer_after", "label": "Buffer After (min)", "type": "number" },
		{ "slug": "min_notice_hrs", "label": "Min Notice (hours)", "type": "number" },
		{ "slug": "max_advance_days", "label": "Max Advance (days)", "type": "number" },
		{ "slug": "questions", "label": "Custom Questions (JSON)", "type": "string" },
		{ "slug": "color", "label": "Color (hex)", "type": "string" }
	]
}
```

- [ ] **Step 4: Validate the seed**

Run: `npx emdash seed seed/seed.json --validate`
Expected: validation passes (no schema errors).

- [ ] **Step 5: Regenerate types**

Run: `npx emdash types`
Expected: `emdash-env.d.ts` updates with new `FamilyEventsEntry` and `MeetingTypesEntry` types.

- [ ] **Step 6: Commit**

```bash
git add seed/seed.json emdash-env.d.ts
git commit -m "feat(seed): add family_events + meeting_types collections"
```

---

## Task 6: Family event materialisation helper (TDD)

Takes the `family_events` collection + a date range, emits concrete occurrences in that range, expanding lunar dates to their Gregorian instance for the relevant year(s).

**Files:**
- Create: `src/utils/familyEvents.ts`
- Create: `tests/utils/familyEvents.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/utils/familyEvents.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { materialiseFamilyEvents } from "../../src/utils/familyEvents";
import type { FamilyEventRecord } from "../../src/utils/familyEvents";

const GRANDFATHER_GIO: FamilyEventRecord = {
	id: "evt_1",
	title_en: "Grandfather's giỗ",
	title_vi: "Giỗ Ông Nội",
	event_type: "death_anniv",
	date_calendar: "lunar",
	month: 3,
	day: 15,
	is_leap_month: false,
	origin_year: 2019,
	person_name: "Ông Nội Trương Văn Hương",
	relationship: "grandfather (paternal)",
	visibility: "household",
	reminder_days_before: "[7,1]",
};

const TAM_BIRTHDAY: FamilyEventRecord = {
	id: "evt_2",
	title_en: "Tam birthday",
	title_vi: "Sinh nhật Tâm",
	event_type: "birthday",
	date_calendar: "solar",
	month: 4,
	day: 25,
	origin_year: 1992,
	person_name: "Tâm",
	visibility: "household",
};

test("materialiseFamilyEvents: solar birthday materialises on same solar date", () => {
	const start = new Date("2026-04-01T00:00:00+07:00");
	const end = new Date("2026-04-30T23:59:59+07:00");
	const out = materialiseFamilyEvents([TAM_BIRTHDAY], start, end);
	assert.equal(out.length, 1);
	assert.equal(out[0].date.toISOString().slice(0, 10), "2026-04-25");
	assert.equal(out[0].nth, 34); // 2026 - 1992
});

test("materialiseFamilyEvents: lunar giỗ — 2026 lands on solar Apr 26", () => {
	const start = new Date("2026-04-01T00:00:00+07:00");
	const end = new Date("2026-04-30T23:59:59+07:00");
	const out = materialiseFamilyEvents([GRANDFATHER_GIO], start, end);
	assert.equal(out.length, 1);
	assert.equal(out[0].date.toISOString().slice(0, 10), "2026-04-26");
	assert.equal(out[0].nth, 7); // 2026 - 2019
});

test("materialiseFamilyEvents: event outside range is excluded", () => {
	const start = new Date("2026-05-01T00:00:00+07:00");
	const end = new Date("2026-05-31T23:59:59+07:00");
	const out = materialiseFamilyEvents([TAM_BIRTHDAY], start, end);
	assert.equal(out.length, 0);
});

test("materialiseFamilyEvents: multi-year window returns one occurrence per year", () => {
	const start = new Date("2025-04-01T00:00:00+07:00");
	const end = new Date("2027-04-30T23:59:59+07:00");
	const out = materialiseFamilyEvents([TAM_BIRTHDAY], start, end);
	assert.equal(out.length, 3); // 2025, 2026, 2027
	assert.deepEqual(
		out.map((o) => o.date.toISOString().slice(0, 10)),
		["2025-04-25", "2026-04-25", "2027-04-25"],
	);
});
```

- [ ] **Step 2: Run — should fail**

Run: `npm test -- --test-only-name='materialiseFamilyEvents'`
Expected: FAIL — module not defined.

- [ ] **Step 3: Implement `src/utils/familyEvents.ts`**

```ts
import { lunarToSolar } from "./lunar";

export interface FamilyEventRecord {
	id: string;
	title_en: string;
	title_vi: string;
	event_type: "birthday" | "death_anniv" | "wedding_anniv" | "cultural" | "milestone";
	date_calendar: "solar" | "lunar";
	month: number;
	day: number;
	is_leap_month?: boolean;
	origin_year?: number;
	person_name?: string;
	relationship?: string;
	visibility: "household" | "public";
	reminder_days_before?: string; // JSON-serialised number[]
	photo?: { src: string; alt: string };
}

export interface FamilyOccurrence {
	event: FamilyEventRecord;
	date: Date; // Gregorian midnight Asia/Ho_Chi_Minh
	nth: number | null; // occurrence count (1st, 2nd, ...) if origin_year set
}

// Returns occurrences of every event that falls within [start, end].
// Lunar events are converted per-year; leap-month origin years observe
// on regular month in subsequent years (Vietnamese convention).
export function materialiseFamilyEvents(
	events: FamilyEventRecord[],
	start: Date,
	end: Date,
): FamilyOccurrence[] {
	const out: FamilyOccurrence[] = [];
	const startYear = new Date(start.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })).getFullYear();
	const endYear = new Date(end.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })).getFullYear();

	for (const evt of events) {
		for (let year = startYear; year <= endYear; year++) {
			let occurrenceDate: Date | null = null;

			if (evt.date_calendar === "solar") {
				// Feb-29 birthdays fall back to Feb 28 in non-leap years.
				let day = evt.day;
				if (evt.month === 2 && evt.day === 29 && !isLeapYear(year)) {
					day = 28;
				}
				occurrenceDate = new Date(Date.UTC(year, evt.month - 1, day) - 7 * 3600 * 1000);
			} else {
				// Lunar: origin-year leap-month flag applies only to that year.
				// For all subsequent years, observe on the regular month.
				occurrenceDate = lunarToSolar({
					year,
					month: evt.month,
					day: evt.day,
					isLeapMonth: false,
				});
			}

			if (occurrenceDate && occurrenceDate >= start && occurrenceDate <= end) {
				const nth = evt.origin_year ? year - evt.origin_year : null;
				out.push({ event: evt, date: occurrenceDate, nth });
			}
		}
	}

	out.sort((a, b) => a.date.getTime() - b.date.getTime());
	return out;
}

function isLeapYear(y: number): boolean {
	return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}
```

- [ ] **Step 4: Run — should pass**

Run: `npm test -- --test-only-name='materialiseFamilyEvents'`
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/familyEvents.ts tests/utils/familyEvents.test.ts
git commit -m "feat(family-events): materialise solar+lunar occurrences across a date range"
```

---

## Task 7: Atomic components — DualDate, EventChip, ClockWidget

All three are pure-presentational Astro components, reused across views.

**Files:**
- Create: `src/components/weasley-clock/DualDate.astro`
- Create: `src/components/weasley-clock/EventChip.astro`
- Create: `src/components/weasley-clock/ClockWidget.astro`

- [ ] **Step 1: Create `DualDate.astro`**

```astro
---
import { formatDualDate } from "../../utils/lunar";

interface Props {
	date: Date;
	size?: "lg" | "md" | "sm";
	lang?: "vi" | "en";
}

const { date, size = "md", lang = "vi" } = Astro.props;
const { gregorian, lunar } = formatDualDate(date, { lang });
---
<span class={`dual-date dual-date--${size}`}>
	<span class="dual-date__greg">{gregorian}</span>
	<span class="dual-date__lunar">{lunar}</span>
</span>

<style>
	.dual-date { display: inline-flex; gap: 6px; align-items: baseline; }
	.dual-date__greg { color: var(--wc-ink, #e8dcc4); }
	.dual-date__lunar { color: var(--wc-ink-dim, #8b6914); font-size: 0.7em; }
	.dual-date--lg .dual-date__greg { font-size: 18px; font-weight: 600; }
	.dual-date--md .dual-date__greg { font-size: 13px; }
	.dual-date--sm .dual-date__greg { font-size: 11px; }
</style>
```

- [ ] **Step 2: Create `EventChip.astro`**

```astro
---
import { detectFlight } from "../../utils/flightDetect";

interface Props {
	title: string;
	subtitle?: string;
	category: "giỗ" | "birthday" | "anniversary" | "cultural" | "milestone" | "flight" | "other";
	size?: "full" | "chip";
}

const { title, subtitle, category, size = "full" } = Astro.props;
const flight = detectFlight(title);
const icon: Record<string, string> = {
	"giỗ": "✦",
	"birthday": "🎂",
	"anniversary": "❖",
	"cultural": "✶",
	"milestone": "◈",
	"flight": "✈",
	"other": "•",
};
const effectiveCategory = flight ? "flight" : category;
---
<div class={`wc-chip wc-chip--${effectiveCategory} wc-chip--${size}`}>
	<div class="wc-chip__title">
		<span class="wc-chip__icon">{icon[effectiveCategory]}</span>
		<span>{title}</span>
	</div>
	{size === "full" && subtitle && <div class="wc-chip__sub">{subtitle}</div>}
</div>

<style>
	.wc-chip { padding: 3px 5px; border-radius: 1px; border-left: 2px solid var(--chip-tint); background: color-mix(in srgb, var(--chip-tint) 20%, transparent); }
	.wc-chip__title { font-size: 10px; color: var(--wc-ink, #e8dcc4); }
	.wc-chip__sub { font-size: 8px; color: var(--wc-ink-dim, #8b6914); margin-top: 2px; }
	.wc-chip__icon { margin-right: 4px; }
	.wc-chip--giỗ { --chip-tint: #c9a961; }
	.wc-chip--birthday { --chip-tint: #556b2f; }
	.wc-chip--anniversary { --chip-tint: #a0524f; }
	.wc-chip--cultural { --chip-tint: #b67a3c; }
	.wc-chip--milestone { --chip-tint: #6f8ba3; }
	.wc-chip--flight { --chip-tint: #a67a3e; }
	.wc-chip--other { --chip-tint: #6b5638; }
	.wc-chip--chip { padding: 1px 3px; font-size: 8px; }
</style>
```

- [ ] **Step 3: Create `ClockWidget.astro`**

```astro
---
interface Props {
	locStatus?: string;
	tamStatus?: string;
}
const { locStatus = "work", tamStatus = "home" } = Astro.props;
---
<div class="wc-clock">
	<svg viewBox="0 0 100 100" width="44" height="44">
		<circle cx="50" cy="50" r="46" fill="radial-gradient(#2a1f15,#0f0a06)" stroke="#8b6914" stroke-width="3"/>
		<line x1="50" y1="50" x2="80" y2="40" stroke="#c9a961" stroke-width="2"/>
		<line x1="50" y1="50" x2="35" y2="75" stroke="#a67a3e" stroke-width="2"/>
		<circle cx="50" cy="50" r="3" fill="#c9a961"/>
	</svg>
	<div class="wc-clock__label">
		<div class="wc-clock__name">THE WEASLEY CLOCK</div>
		<div class="wc-clock__status">LOC · {locStatus.toUpperCase()} · TAM · {tamStatus.toUpperCase()}</div>
	</div>
</div>

<style>
	.wc-clock { display: flex; align-items: center; gap: 10px; }
	.wc-clock__name { font-size: 9px; color: #6b5638; letter-spacing: 2px; }
	.wc-clock__status { font-size: 11px; color: #c9a961; margin-top: 2px; }
</style>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/weasley-clock/
git commit -m "feat(weasley-clock): DualDate + EventChip + ClockWidget atoms"
```

---

## Task 8: Weasley Clock page skeleton + route

**Files:**
- Create: `src/pages/hogwarts/weasley-clock/index.astro`
- Modify: `src/data/site-routes.json`

The page queries `family_events`, materialises a window matching the active view, and dispatches to the right view component.

- [ ] **Step 1: Create `src/pages/hogwarts/weasley-clock/index.astro`**

```astro
---
export const prerender = false;

import { getEmDashCollection } from "emdash";
import Base from "../../../layouts/Base.astro";
import Header from "../../../components/weasley-clock/Header.astro";
import WeekView from "../../../components/weasley-clock/WeekView.astro";
import MonthView from "../../../components/weasley-clock/MonthView.astro";
import DayView from "../../../components/weasley-clock/DayView.astro";
import YearView from "../../../components/weasley-clock/YearView.astro";
import { materialiseFamilyEvents, type FamilyEventRecord } from "../../../utils/familyEvents";

type View = "day" | "week" | "month" | "year";

const url = new URL(Astro.request.url);
const viewParam = (url.searchParams.get("view") as View) ?? "week";
const view: View = ["day", "week", "month", "year"].includes(viewParam) ? viewParam : "week";

const anchorParam = url.searchParams.get("anchor"); // ISO date "YYYY-MM-DD"
const anchor = anchorParam ? new Date(anchorParam + "T00:00:00+07:00") : new Date();

const { entries: rawEvents, cacheHint } = await getEmDashCollection("family_events");
Astro.cache.set(cacheHint);

const events: FamilyEventRecord[] = rawEvents.map((e: any) => ({
	id: e.id,
	title_en: e.title_en,
	title_vi: e.title_vi,
	event_type: e.event_type,
	date_calendar: e.date_calendar,
	month: e.month,
	day: e.day,
	is_leap_month: !!e.is_leap_month,
	origin_year: e.origin_year,
	person_name: e.person_name,
	relationship: e.relationship,
	visibility: e.visibility,
	reminder_days_before: e.reminder_days_before,
	photo: e.photo,
}));

const { windowStart, windowEnd } = computeWindow(view, anchor);
const occurrences = materialiseFamilyEvents(events, windowStart, windowEnd);

function computeWindow(v: View, a: Date): { windowStart: Date; windowEnd: Date } {
	const d = new Date(a);
	if (v === "day") {
		return { windowStart: startOfDay(d), windowEnd: endOfDay(d) };
	}
	if (v === "week") {
		const dow = d.getDay() === 0 ? 6 : d.getDay() - 1; // Mon=0
		const mon = new Date(d); mon.setDate(d.getDate() - dow);
		const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
		return { windowStart: startOfDay(mon), windowEnd: endOfDay(sun) };
	}
	if (v === "month") {
		const first = new Date(d.getFullYear(), d.getMonth(), 1);
		const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
		return { windowStart: startOfDay(first), windowEnd: endOfDay(last) };
	}
	// year
	return {
		windowStart: new Date(d.getFullYear(), 0, 1),
		windowEnd: new Date(d.getFullYear(), 11, 31, 23, 59, 59),
	};
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
---
<Base title="The Weasley Clock" description="Family calendar · dương & âm lịch">
	<Header view={view} anchor={anchor} />
	<main class="wc-main">
		{view === "day" && <DayView anchor={anchor} occurrences={occurrences} />}
		{view === "week" && <WeekView anchor={anchor} occurrences={occurrences} />}
		{view === "month" && <MonthView anchor={anchor} occurrences={occurrences} />}
		{view === "year" && <YearView anchor={anchor} occurrences={occurrences} />}
	</main>
</Base>

<style is:global>
	.wc-main { max-width: 1280px; margin: 0 auto; padding: 16px; }
</style>
```

- [ ] **Step 2: Create stub Header / WeekView / MonthView / DayView / YearView**

Create each file as a minimal placeholder for now (Task 9–13 will flesh them out). This step lets the page render without errors.

`src/components/weasley-clock/Header.astro`:

```astro
---
interface Props { view: "day" | "week" | "month" | "year"; anchor: Date; }
const { view, anchor } = Astro.props;
---
<div class="wc-header">stub header · {view} · {anchor.toISOString().slice(0, 10)}</div>
```

Each of `WeekView.astro`, `MonthView.astro`, `DayView.astro`, `YearView.astro`:

```astro
---
import type { FamilyOccurrence } from "../../utils/familyEvents";
interface Props { anchor: Date; occurrences: FamilyOccurrence[]; }
const { anchor, occurrences } = Astro.props;
---
<div class="wc-view-stub">stub · {occurrences.length} occurrences</div>
```

- [ ] **Step 3: Update `src/data/site-routes.json`**

Open the file and add to the `static` array (keep alphabetical by path within the `/hogwarts` block):

```json
{ "path": "/hogwarts/weasley-clock", "title": "The Weasley Clock", "priority": "0.7" },
```

Insert between `"/hogwarts/library"` and `"/hogwarts/games/"`.

- [ ] **Step 4: Boot dev server + verify page renders**

Run: `npx emdash dev`
Open: `http://localhost:4321/hogwarts/weasley-clock`
Expected: page loads with "stub header · week · <today>" + "stub · N occurrences" (N = 0 unless you've seeded any family_events). No console errors.

Stop the server with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add src/pages/hogwarts/weasley-clock src/components/weasley-clock/Header.astro src/components/weasley-clock/WeekView.astro src/components/weasley-clock/MonthView.astro src/components/weasley-clock/DayView.astro src/components/weasley-clock/YearView.astro src/data/site-routes.json
git commit -m "feat(weasley-clock): page skeleton + view routing via ?view= query param"
```

---

## Task 9: Week view (the default view, full fidelity)

**Files:**
- Modify: `src/components/weasley-clock/WeekView.astro`
- Create: `src/components/weasley-clock/DayCell.astro` (shared with Month view)

- [ ] **Step 1: Create `DayCell.astro`** — the cell used by both Week and Month

```astro
---
import DualDate from "./DualDate.astro";
import EventChip from "./EventChip.astro";
import type { FamilyOccurrence } from "../../utils/familyEvents";

interface Props {
	date: Date;
	occurrences: FamilyOccurrence[];
	isToday?: boolean;
	isDimmed?: boolean; // e.g. prev/next month padding in month view
	variant?: "week" | "month";
}
const { date, occurrences, isToday, isDimmed, variant = "week" } = Astro.props;

function chipCategoryFor(ev: FamilyOccurrence): "giỗ" | "birthday" | "anniversary" | "cultural" | "milestone" | "other" {
	switch (ev.event.event_type) {
		case "death_anniv": return "giỗ";
		case "birthday": return "birthday";
		case "wedding_anniv": return "anniversary";
		case "cultural": return "cultural";
		case "milestone": return "milestone";
		default: return "other";
	}
}
---
<div class={`wc-day ${isToday ? "wc-day--today" : ""} ${isDimmed ? "wc-day--dim" : ""} wc-day--${variant}`}>
	<header class="wc-day__head">
		<DualDate date={date} size={variant === "week" ? "lg" : "md"} />
	</header>
	<ul class="wc-day__events">
		{occurrences.map((occ) => (
			<li>
				<EventChip
					title={occ.event.title_vi || occ.event.title_en}
					subtitle={occ.nth ? `${occ.nth}th · ${occ.event.relationship ?? ""}` : occ.event.relationship ?? ""}
					category={chipCategoryFor(occ)}
					size={variant === "week" ? "full" : "chip"}
				/>
			</li>
		))}
	</ul>
</div>

<style>
	.wc-day { border: 1px solid #2a1f15; padding: 8px; min-height: 160px; }
	.wc-day--month { min-height: 70px; padding: 4px; }
	.wc-day--today { border: 2px solid #c9a961; background: #201810; }
	.wc-day--dim { color: #6b5638; }
	.wc-day__head { margin-bottom: 6px; }
	.wc-day__events { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
</style>
```

- [ ] **Step 2: Replace the stub `WeekView.astro`**

```astro
---
import DayCell from "./DayCell.astro";
import type { FamilyOccurrence } from "../../utils/familyEvents";

interface Props { anchor: Date; occurrences: FamilyOccurrence[]; }
const { anchor, occurrences } = Astro.props;

// Compute Mon..Sun for the week containing anchor
const dow = anchor.getDay() === 0 ? 6 : anchor.getDay() - 1;
const monday = new Date(anchor); monday.setDate(anchor.getDate() - dow); monday.setHours(0, 0, 0, 0);

const days: { date: Date; occurrences: FamilyOccurrence[]; isToday: boolean }[] = [];
const today = new Date();
for (let i = 0; i < 7; i++) {
	const d = new Date(monday); d.setDate(monday.getDate() + i);
	const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
	days.push({
		date: d,
		occurrences: occurrences.filter((o) => sameDay(o.date, d)),
		isToday: sameDay(d, today),
	});
}
---
<div class="wc-week">
	{days.map((d) => <DayCell date={d.date} occurrences={d.occurrences} isToday={d.isToday} variant="week" />)}
</div>

<style>
	.wc-week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
</style>
```

- [ ] **Step 3: Verify in browser**

Run: `npx emdash dev`
Open: `http://localhost:4321/hogwarts/weasley-clock`
Expected: 7 day cells rendering Mon–Sun, today outlined in brass, any family events you've seeded appear as chips. Dual date (big Gregorian / small lunar) on each cell header.

If you haven't seeded any family events yet, open the EmDash admin at `http://localhost:4321/_emdash/admin`, go to `Family Events`, and add one test event (e.g., Tam birthday 25/4 solar, origin year 1992) to verify rendering.

Stop server.

- [ ] **Step 4: Commit**

```bash
git add src/components/weasley-clock/DayCell.astro src/components/weasley-clock/WeekView.astro
git commit -m "feat(weasley-clock): WeekView + shared DayCell — full-fidelity agenda in grid"
```

---

## Task 10: Month view with auto-grow-today row

**Files:**
- Modify: `src/components/weasley-clock/MonthView.astro`

- [ ] **Step 1: Replace the stub `MonthView.astro`**

```astro
---
import DayCell from "./DayCell.astro";
import type { FamilyOccurrence } from "../../utils/familyEvents";

interface Props { anchor: Date; occurrences: FamilyOccurrence[]; }
const { anchor, occurrences } = Astro.props;

const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
const lastOfMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);

// Grid starts on Monday. Pad with prev-month days as needed.
const dowFirst = firstOfMonth.getDay() === 0 ? 6 : firstOfMonth.getDay() - 1;
const gridStart = new Date(firstOfMonth); gridStart.setDate(firstOfMonth.getDate() - dowFirst);

const cells: { date: Date; occurrences: FamilyOccurrence[]; isToday: boolean; isDimmed: boolean }[] = [];
const today = new Date();
for (let i = 0; i < 42; i++) {
	const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
	const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
	cells.push({
		date: d,
		occurrences: occurrences.filter((o) => sameDay(o.date, d)),
		isToday: sameDay(d, today),
		isDimmed: d.getMonth() !== anchor.getMonth(),
	});
	if (d > lastOfMonth && (i + 1) % 7 === 0) break;
}

// Group into rows of 7
const rows: typeof cells[] = [];
for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

const headings = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
---
<div class="wc-month">
	<div class="wc-month__headings">
		{headings.map((h, i) => <div class={`wc-month__head ${i === 6 ? "wc-month__head--sun" : ""}`}>{h}</div>)}
	</div>
	{rows.map((row) => {
		const hasToday = row.some((c) => c.isToday);
		return (
			<div class={`wc-month__row ${hasToday ? "wc-month__row--today" : ""}`}>
				{row.map((c) => <DayCell date={c.date} occurrences={c.occurrences} isToday={c.isToday} isDimmed={c.isDimmed} variant="month" />)}
			</div>
		);
	})}
</div>

<style>
	.wc-month__headings { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 4px; }
	.wc-month__head { padding: 4px; text-align: center; color: #8b6914; font-size: 9px; letter-spacing: 1px; }
	.wc-month__head--sun { color: #c9a961; }
	.wc-month__row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 2px; }
	/* Auto-grow-today: the row containing today gets the week-view cell height */
	.wc-month__row--today :global(.wc-day--month) { min-height: 160px; padding: 8px; }
	.wc-month__row--today :global(.wc-day--month .wc-chip) { padding: 3px 5px; font-size: 10px; }
</style>
```

- [ ] **Step 2: Verify in browser**

Run: `npx emdash dev`
Open: `http://localhost:4321/hogwarts/weasley-clock?view=month`
Expected: Month grid with today's *row* growing to the week-view cell height; all other rows compressed. Prev/next month padding days rendered dimmer.

- [ ] **Step 3: Commit**

```bash
git add src/components/weasley-clock/MonthView.astro
git commit -m "feat(weasley-clock): MonthView with auto-grow-today row"
```

---

## Task 11: Day view (hourly column)

**Files:**
- Modify: `src/components/weasley-clock/DayView.astro`

- [ ] **Step 1: Replace the stub `DayView.astro`**

```astro
---
import DualDate from "./DualDate.astro";
import EventChip from "./EventChip.astro";
import type { FamilyOccurrence } from "../../utils/familyEvents";

interface Props { anchor: Date; occurrences: FamilyOccurrence[]; }
const { anchor, occurrences } = Astro.props;

// Phase 1: no timed events (sync comes in Phase 2). Show all-day family events pinned to top.
const hours = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 – 23:00
---
<div class="wc-day-view">
	<header class="wc-day-view__head">
		<DualDate date={anchor} size="lg" />
	</header>
	<section class="wc-day-view__allday">
		<div class="wc-day-view__label">ALL DAY</div>
		{occurrences.length === 0 && <div class="wc-day-view__empty">— quiet today —</div>}
		{occurrences.map((occ) => (
			<EventChip
				title={occ.event.title_vi || occ.event.title_en}
				subtitle={occ.event.relationship ?? undefined}
				category={occ.event.event_type === "death_anniv" ? "giỗ" : occ.event.event_type === "birthday" ? "birthday" : "other"}
			/>
		))}
	</section>
	<section class="wc-day-view__hours">
		{hours.map((h) => (
			<div class="wc-day-view__hour">
				<div class="wc-day-view__hour-label">{String(h).padStart(2, "0")}:00</div>
				<div class="wc-day-view__hour-body">{/* Phase 2 will render timed synced events here */}</div>
			</div>
		))}
	</section>
</div>

<style>
	.wc-day-view { max-width: 720px; margin: 0 auto; }
	.wc-day-view__head { margin-bottom: 16px; }
	.wc-day-view__allday { padding: 12px; background: #1f1710; border: 1px solid #2a1f15; margin-bottom: 12px; }
	.wc-day-view__label { font-size: 9px; color: #8b6914; letter-spacing: 2px; margin-bottom: 8px; }
	.wc-day-view__empty { font-size: 11px; color: #6b5638; font-style: italic; }
	.wc-day-view__hour { display: grid; grid-template-columns: 60px 1fr; border-bottom: 1px solid #2a1f15; min-height: 40px; align-items: center; }
	.wc-day-view__hour-label { font-size: 10px; color: #8b6914; padding-left: 8px; }
	.wc-day-view__hour-body { padding: 4px; }
</style>
```

- [ ] **Step 2: Verify**

Run: `npx emdash dev`
Open: `http://localhost:4321/hogwarts/weasley-clock?view=day`
Expected: dual-date header, "ALL DAY" section with the day's family events or "— quiet today —", empty hour rows 06:00 → 23:00.

- [ ] **Step 3: Commit**

```bash
git add src/components/weasley-clock/DayView.astro
git commit -m "feat(weasley-clock): DayView with all-day pins + placeholder hourly column"
```

---

## Task 12: Year view (12-month heatmap)

**Files:**
- Modify: `src/components/weasley-clock/YearView.astro`

- [ ] **Step 1: Replace the stub `YearView.astro`**

```astro
---
import type { FamilyOccurrence } from "../../utils/familyEvents";

interface Props { anchor: Date; occurrences: FamilyOccurrence[]; }
const { anchor, occurrences } = Astro.props;

const year = anchor.getFullYear();
const MONTH_LABELS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// Group occurrences by ISO date for O(1) lookup
const byDate = new Map<string, FamilyOccurrence[]>();
for (const occ of occurrences) {
	const key = occ.date.toISOString().slice(0, 10);
	const bucket = byDate.get(key) ?? [];
	bucket.push(occ);
	byDate.set(key, bucket);
}

function categoryTint(occ: FamilyOccurrence): string {
	switch (occ.event.event_type) {
		case "death_anniv": return "rgba(201,169,97,VAR)";
		case "birthday": return "rgba(85,107,47,VAR)";
		case "wedding_anniv": return "rgba(160,82,79,VAR)";
		case "cultural": return "rgba(182,122,60,VAR)";
		default: return "rgba(166,122,62,VAR)";
	}
}

function cellStyle(count: number, dominant: FamilyOccurrence | null): string {
	if (!dominant) return "background:#2a1f15;";
	const alpha = Math.min(0.3 + count * 0.2, 1);
	return `background:${categoryTint(dominant).replace("VAR", String(alpha))};`;
}

function monthCells(month: number): { date: Date; occs: FamilyOccurrence[] }[] {
	const days = new Date(year, month + 1, 0).getDate();
	const out: { date: Date; occs: FamilyOccurrence[] }[] = [];
	for (let d = 1; d <= days; d++) {
		const date = new Date(year, month, d);
		const key = date.toISOString().slice(0, 10);
		out.push({ date, occs: byDate.get(key) ?? [] });
	}
	return out;
}
---
<div class="wc-year">
	{MONTH_LABELS.map((label, i) => (
		<div class="wc-year__month">
			<div class="wc-year__month-label">{label}</div>
			<div class="wc-year__grid">
				{monthCells(i).map((c) => {
					const dom = c.occs[0] ?? null;
					return (
						<a
							class="wc-year__cell"
							style={cellStyle(c.occs.length, dom)}
							href={`/hogwarts/weasley-clock?view=day&anchor=${c.date.toISOString().slice(0, 10)}`}
							title={c.occs.map((o) => o.event.title_vi || o.event.title_en).join("\n")}
						></a>
					);
				})}
			</div>
		</div>
	))}
</div>

<style>
	.wc-year { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; max-width: 1100px; margin: 0 auto; }
	.wc-year__month-label { font-size: 10px; color: #c9a961; letter-spacing: 1px; margin-bottom: 4px; }
	.wc-year__grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; }
	.wc-year__cell { aspect-ratio: 1; display: block; background: #2a1f15; }
	.wc-year__cell:hover { outline: 1px solid #c9a961; }
</style>
```

- [ ] **Step 2: Verify**

Run: `npx emdash dev`
Open: `http://localhost:4321/hogwarts/weasley-clock?view=year`
Expected: 4-col × 3-row layout of 12 mini-month grids, cells tinted where events exist, hovering highlights a cell, clicking navigates to `?view=day&anchor=...`.

- [ ] **Step 3: Commit**

```bash
git add src/components/weasley-clock/YearView.astro
git commit -m "feat(weasley-clock): YearView — 12-month heatmap, click to drill"
```

---

## Task 13: Header bar — clock, range nav, D/W/M/Y switcher, keyboard

**Files:**
- Modify: `src/components/weasley-clock/Header.astro`

- [ ] **Step 1: Replace the stub `Header.astro`**

```astro
---
import ClockWidget from "./ClockWidget.astro";

interface Props { view: "day" | "week" | "month" | "year"; anchor: Date; }
const { view, anchor } = Astro.props;

function shiftAnchor(direction: -1 | 1): string {
	const d = new Date(anchor);
	if (view === "day") d.setDate(d.getDate() + direction);
	if (view === "week") d.setDate(d.getDate() + direction * 7);
	if (view === "month") d.setMonth(d.getMonth() + direction);
	if (view === "year") d.setFullYear(d.getFullYear() + direction);
	return d.toISOString().slice(0, 10);
}

function viewUrl(v: "day" | "week" | "month" | "year"): string {
	return `/hogwarts/weasley-clock?view=${v}&anchor=${anchor.toISOString().slice(0, 10)}`;
}

function rangeLabel(): string {
	if (view === "year") return String(anchor.getFullYear());
	if (view === "month") return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(anchor);
	if (view === "week") return `Week of ${anchor.toISOString().slice(0, 10)}`;
	return anchor.toISOString().slice(0, 10);
}
---
<header class="wc-header">
	<ClockWidget />
	<nav class="wc-header__nav">
		<a class="wc-header__btn" href={`/hogwarts/weasley-clock?view=${view}&anchor=${shiftAnchor(-1)}`}>←</a>
		<span class="wc-header__range">{rangeLabel()}</span>
		<a class="wc-header__btn" href={`/hogwarts/weasley-clock?view=${view}&anchor=${shiftAnchor(1)}`}>→</a>
		<a class="wc-header__btn wc-header__btn--today" href={`/hogwarts/weasley-clock?view=${view}`}>TODAY</a>
	</nav>
	<div class="wc-header__switch" role="tablist">
		<a role="tab" aria-selected={view === "day"} href={viewUrl("day")}>D</a>
		<a role="tab" aria-selected={view === "week"} href={viewUrl("week")}>W</a>
		<a role="tab" aria-selected={view === "month"} href={viewUrl("month")}>M</a>
		<a role="tab" aria-selected={view === "year"} href={viewUrl("year")}>Y</a>
	</div>
</header>

<script is:inline define:vars={{ viewData: { view, anchor: anchor.toISOString().slice(0, 10) } }}>
	document.addEventListener("keydown", (e) => {
		if (e.target && (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) return;
		const base = `/hogwarts/weasley-clock`;
		const map = { "1": "day", "d": "day", "2": "week", "w": "week", "3": "month", "m": "month", "4": "year", "y": "year" };
		if (map[e.key]) {
			location.href = `${base}?view=${map[e.key]}&anchor=${viewData.anchor}`;
		} else if (e.key === "t") {
			location.href = `${base}?view=${viewData.view}`;
		}
	});
</script>

<style>
	.wc-header { display: flex; align-items: center; gap: 16px; padding: 12px 16px; background: #1a1410; border-bottom: 1px solid #2a1f15; flex-wrap: wrap; position: sticky; top: 0; z-index: 10; }
	.wc-header__nav { display: flex; align-items: center; gap: 8px; flex: 1; }
	.wc-header__btn { background: #2a1f15; color: #c9a961; border: 1px solid #8b6914; padding: 6px 10px; font-size: 10px; letter-spacing: 1px; text-decoration: none; border-radius: 2px; }
	.wc-header__btn--today { border-color: #3a2a1f; color: #6b5638; }
	.wc-header__range { font-size: 11px; color: #c9a961; letter-spacing: 1px; min-width: 120px; text-align: center; }
	.wc-header__switch { display: flex; border: 1px solid #8b6914; border-radius: 2px; overflow: hidden; }
	.wc-header__switch a { padding: 6px 10px; font-size: 10px; letter-spacing: 1px; background: #2a1f15; color: #6b5638; text-decoration: none; }
	.wc-header__switch a[aria-selected="true"] { background: #c9a961; color: #1a1410; font-weight: bold; }
</style>
```

- [ ] **Step 2: Verify**

Run: `npx emdash dev`
Open: `http://localhost:4321/hogwarts/weasley-clock`
Expected:
- Sticky header with clock widget, range nav, and active D/W/M/Y tab highlighted
- Arrow buttons shift by day/week/month/year depending on active view
- "TODAY" returns to current anchor
- Pressing `1`/`2`/`3`/`4` or `d`/`w`/`m`/`y` switches view
- Pressing `t` jumps to today

- [ ] **Step 3: Commit**

```bash
git add src/components/weasley-clock/Header.astro
git commit -m "feat(weasley-clock): header with clock + range nav + D/W/M/Y switcher + kbd shortcuts"
```

---

## Task 14: Click-to-popover on month view cells

**Files:**
- Modify: `src/components/weasley-clock/MonthView.astro`

Click a non-today cell in month view → jump to `?view=day&anchor=<date>`. Simpler than a floating popover, SSR-friendly, and consistent with year-view drill behaviour. (A true floating popover can ship in a future phase if the jump feels too heavy.)

- [ ] **Step 1: Wrap each non-today `DayCell` in an anchor tag**

Open `src/components/weasley-clock/MonthView.astro`. Modify the row-rendering block:

Replace:

```astro
{row.map((c) => <DayCell date={c.date} occurrences={c.occurrences} isToday={c.isToday} isDimmed={c.isDimmed} variant="month" />)}
```

With:

```astro
{row.map((c) => (
	c.isToday
		? <DayCell date={c.date} occurrences={c.occurrences} isToday={c.isToday} isDimmed={c.isDimmed} variant="month" />
		: (
			<a class="wc-month__cell-link" href={`/hogwarts/weasley-clock?view=day&anchor=${c.date.toISOString().slice(0, 10)}`}>
				<DayCell date={c.date} occurrences={c.occurrences} isToday={false} isDimmed={c.isDimmed} variant="month" />
			</a>
		)
))}
```

Add to the `<style>` block:

```css
.wc-month__cell-link { display: block; text-decoration: none; color: inherit; }
.wc-month__cell-link:hover :global(.wc-day--month) { background: #1f1710; }
```

- [ ] **Step 2: Verify**

Run: `npx emdash dev`
Open: `http://localhost:4321/hogwarts/weasley-clock?view=month`
Expected: hovering a non-today cell darkens it slightly; clicking navigates to day view for that date.

- [ ] **Step 3: Commit**

```bash
git add src/components/weasley-clock/MonthView.astro
git commit -m "feat(weasley-clock): month cells link to day view (click-to-drill)"
```

---

## Task 15: Integration test — page renders with real collection

**Files:**
- Create: `tests/pages/weasley-clock.test.ts`

A smoke test that renders the page's inner logic without spinning up a full Astro server, verifying the materialisation glue between collection → view.

- [ ] **Step 1: Write the test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { materialiseFamilyEvents, type FamilyEventRecord } from "../../src/utils/familyEvents";

test("Weasley Clock glue: collection → materialise produces chips for current month", () => {
	const events: FamilyEventRecord[] = [
		{
			id: "e1",
			title_en: "Tam birthday",
			title_vi: "Sinh nhật Tâm",
			event_type: "birthday",
			date_calendar: "solar",
			month: 4,
			day: 25,
			origin_year: 1992,
			visibility: "household",
		},
	];
	const start = new Date("2026-04-01T00:00:00+07:00");
	const end = new Date("2026-04-30T23:59:59+07:00");
	const occs = materialiseFamilyEvents(events, start, end);
	assert.equal(occs.length, 1);
	assert.equal(occs[0].nth, 34);
	assert.equal(occs[0].event.title_vi, "Sinh nhật Tâm");
});
```

- [ ] **Step 2: Run**

Run: `npm test -- --test-only-name='Weasley Clock glue'`
Expected: PASS.

- [ ] **Step 3: Full test suite**

Run: `npm test`
Expected: all existing tests + new tests all PASS.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: clean — no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add tests/pages/weasley-clock.test.ts
git commit -m "test(weasley-clock): smoke test for collection→materialise glue"
```

---

## Task 16: Seed a few sample family events via admin UI

Not a code task — manual verification step. Do this before declaring Phase 1 shipped.

- [ ] **Step 1: Boot dev server**

Run: `npx emdash dev`

- [ ] **Step 2: Open EmDash admin**

Open: `http://localhost:4321/_emdash/admin`

- [ ] **Step 3: Create at least 3 family events**

1. A solar birthday (Tam, Apr 25, origin 1992)
2. A lunar giỗ (e.g., lunar 3/15, death_anniv, origin 2019)
3. A cultural event (Tết: lunar 1/1, cultural, no origin_year)

- [ ] **Step 4: Verify each event appears correctly**

Navigate to `/hogwarts/weasley-clock` and:
- Week view shows the birthday in its solar week
- Month view shows all three as chips with correct dual-date cells
- Year view has tinted cells on Apr 25, the computed lunar 3/15 date, and Tết date
- Clicking a tinted cell drops into day view showing the correct event(s)

If any of these fail, fix before considering Phase 1 complete.

- [ ] **Step 5: Commit the committed fixture (optional)**

If you want the sample events tracked for teammates:

```bash
# Only if you exported the events back into seed.json; otherwise skip.
git add seed/seed.json
git commit -m "chore(seed): sample family events for Weasley Clock demo"
```

---

## Task 17: Bilingual string audit + Tam admin access check

Per CLAUDE.md: "New user-facing strings in only one locale" is a review flag. Sweep what we added.

- [ ] **Step 1: Audit strings we introduced**

Using Grep, find English-only strings in the new components:

```bash
grep -rn "TODAY\|ALL DAY\|quiet today" src/components/weasley-clock/
grep -rn "WeasleyClock\|Weasley Clock" src/pages/hogwarts/weasley-clock/
```

- [ ] **Step 2: Where a bilingual pair is needed, use `getCurrentLang` + localised string**

For strings that are surfaced to users (e.g., "quiet today", "ALL DAY", the page title, the TODAY button), add a `lang`-aware version. Pattern from `src/pages/room-of-requirement/mirror-of-erised.astro`:

```ts
import { getCurrentLang } from "../../utils/lang";
const lang = getCurrentLang(Astro);
const isVi = lang === "vi";

const strings = {
	today: isVi ? "HÔM NAY" : "TODAY",
	allDay: isVi ? "CẢ NGÀY" : "ALL DAY",
	quiet: isVi ? "— yên tĩnh hôm nay —" : "— quiet today —",
	// ...
};
```

Pipe strings through the components as props, or localise at render site.

- [ ] **Step 3: Confirm Tam has an EmDash admin account**

Open: `http://localhost:4321/_emdash/admin/users` (or whichever EmDash admin-user path this version exposes).

If Tam (`tam@huuloc.com`) is not yet an admin, add her now — the whole point of the household model is she can edit `family_events` from day one.

(This is a config action, not a code change — no commit needed unless the EmDash version requires a seed-file entry for admin users.)

- [ ] **Step 4: Commit bilingual fixes**

```bash
git add src/components/weasley-clock/ src/pages/hogwarts/weasley-clock/
git commit -m "i18n(weasley-clock): bilingual EN/VI strings"
```

---

## Task 18: Final Phase 1 verification

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all pass.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: successful production build — Cloudflare Workers output in `dist/`, no errors.

- [ ] **Step 4: Manual browser walkthrough (golden path)**

Boot dev server. For each view (D/W/M/Y), verify:
- Dual dates render correctly (Gregorian big + lunar small) everywhere
- Today is outlined/highlighted in every view
- Range nav (← →) shifts by the right unit
- `D/W/M/Y` segmented control and keyboard shortcuts `1/2/3/4` and `d/w/m/y` work
- `t` key returns to today
- Year view → click a tinted cell → day view for that date
- Month view → click a non-today cell → day view for that date
- Lunar giỗ event appears on correct computed Gregorian date
- Solar birthday shows correct "Nth" label (e.g. "turning 34" / "34th")

- [ ] **Step 5: Commit anything outstanding + tag**

```bash
git status
# If anything uncommitted, commit with descriptive messages.
git tag -a weasley-clock-phase-1 -m "Weasley Clock Phase 1: family events dashboard"
```

Phase 1 complete. Next phase (sync) gets its own plan.

---

## Self-review against the spec

Before declaring this plan done, a fresh-eyes pass against `docs/superpowers/specs/2026-04-23-weasley-clock-time-turner-design.md`:

| Spec section | Plan task |
|-----|----|
| §Architecture — plugin scaffold | Task 1 |
| §Data model — `family_events` collection | Task 5 |
| §Data model — `meeting_types` collection | Task 5 (schema only; render in Phase 3) |
| §Data model — plugin D1 tables | **Not in this phase** (Phase 2+) |
| §Data flow — lunar conversion module | Tasks 2–3 |
| §Recurrence materialisation | Task 6 |
| §Flights — render-time detection | Tasks 4 + 7 (used in EventChip) |
| §UI — Weasley Clock Week view | Task 9 |
| §UI — Weasley Clock Month view (auto-grow-today) | Task 10 |
| §UI — Weasley Clock Day view | Task 11 |
| §UI — Weasley Clock Year view | Task 12 |
| §UI — Header + segmented D/W/M/Y + keyboard | Task 13 |
| §UI — month cell popover (simplified to click-jump) | Task 14 |
| §UI — both dates everywhere | Task 7 (DualDate) + used in all views |
| §UI — ClockWidget in header | Task 7 + Task 13 |
| §Rules — site-routes.json updated | Task 8 |
| §Rules — bilingual EN/VI | Task 17 |
| §Rules — `output: "server"` / `prerender=false` | Task 8 (`export const prerender = false`) |
| §Rules — `Astro.cache.set(cacheHint)` | Task 8 |
| §Operational — Tam's admin access | Task 17 |
| §Testing — unit tests for lunar, flight, family events | Tasks 3, 4, 6 |
| §Testing — integration smoke test | Task 15 |
| §Phase 1 deliverable — working dashboard | Task 18 |

**Explicitly NOT in this phase (deferred to their own plans):**
- Sync cron + ICS parser + `ics_sources` / `synced_events` tables (Phase 2)
- Availability rules + booking API + `bookings` table (Phase 3)
- Private ICS feed endpoint + `private_feeds` table (Phase 4)
- Time-Turner booking surfaces `/hogwarts/time-turner/*` (Phases 3 + 5)
- Email reminders (Phase 6)
- Plugin admin pages under `/_emdash/admin/weasley-clock/*` (Phase 6)

No placeholder `TBD`/`TODO` strings in any task. Type names consistent (`FamilyEventRecord`, `FamilyOccurrence`, `LunarDate`). All file paths exact and aligned to the existing repo layout.
