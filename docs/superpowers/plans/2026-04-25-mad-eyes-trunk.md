# Mad-Eye's Trunk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/room-of-requirement/the-trunk` — a static, SSR Astro page cataloguing Loc's daily-driver toolkit across macOS, iPhone, and CLI, with ~10 wand-tier hero cards and a filterable inventory grid below.

**Architecture:** Pure Astro SSR page reading a typed TS data file (`src/data/arsenal.ts`). No EmDash collection, no D1 read, no client JS framework. Filter tabs are pure CSS via `<input type="radio">` + `:has()` selectors. Three one-shot data-gathering scripts in `scripts/` emit draft entries that Loc curates by hand.

**Tech Stack:** Astro 6, TypeScript, Cloudflare Workers (SSR runtime), Inter Tight (already loaded site-wide), simple-icons (CLI SVGs), iTunes Search API (iPhone PNGs), `sips` + `mdls` (macOS extraction). Tests via `node --import tsx --test`.

**Spec:** [`docs/superpowers/specs/2026-04-25-mad-eyes-trunk-design.md`](../specs/2026-04-25-mad-eyes-trunk-design.md) (commit `a394a34c`).

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `src/data/arsenal.ts` | Type definitions + entries (single source of truth) | create |
| `tests/data/arsenal.test.ts` | Validate every entry has required fields, valid enums, wand-tier has note | create |
| `src/components/arsenal/RuneCorners.astro` | 4 SVG corner ornaments per category, tinted via `currentColor` | create |
| `src/components/arsenal/WandCard.astro` | Wand-tier hero card with rune corners + parchment hover overlay | create |
| `src/components/arsenal/InventoryCard.astro` | Plain bordered tile for inventory entries | create |
| `src/pages/room-of-requirement/the-trunk.astro` | Page composition: hero + Wands grid + Trunk grid with filter tabs | create |
| `public/arsenal/icons/macos/<slug>.png` | 256px PNG icons extracted via `sips` | create (generated) |
| `public/arsenal/icons/iphone/<slug>.png` | 512px PNG icons via iTunes Search API | create (generated) |
| `public/arsenal/icons/cli/<slug>.svg` | simple-icons SVG or monogram fallback | create (generated) |
| `scripts/scan-macos-apps.ts` | One-shot: enumerate `/Applications`, extract icons, emit draft TS | create |
| `scripts/scan-cli-tools.ts` | One-shot: brew + zsh history frequency, fetch SVGs, emit draft TS | create |
| `scripts/fetch-app-store-icons.ts` | One-shot: iTunes Search API for iPhone icons + URLs | create |
| `src/data/site-routes.json` | Add `/room-of-requirement/the-trunk` route entry | modify |
| `src/pages/room-of-requirement/index.astro` | Add tile linking to the trunk | modify |

**Subprocess safety:** All script subprocess calls use `execFileSync(cmd, [args…])` (no shell), never `execSync` with template literals. Paths from filesystem traversal can contain quotes or backticks; only the array form is safe.

---

## Task 1: Type definitions and skeleton data file

**Files:**
- Create: `src/data/arsenal.ts`

- [ ] **Step 1: Create `src/data/arsenal.ts` with types and empty array**

```ts
export type ArsenalPlatform = "macos" | "iphone" | "cli";

export type ArsenalCategory =
  | "ai"
  | "editor"
  | "terminal"
  | "messenger"
  | "finance"
  | "media"
  | "dev"
  | "system"
  | "reading"
  | "journal"
  | "transit"
  | "shopping"
  | "social";

export type ArsenalFrequency = "today" | "this_week" | "this_month" | "rare";

export type ArsenalTier = "wand" | "inventory";

export interface ArsenalItem {
	slug: string;
	title: string;
	platform: ArsenalPlatform;
	category: ArsenalCategory;
	tier: ArsenalTier;
	icon: string;
	homepageUrl: string;
	role: { en: string; vi: string };
	note?: { en: string; vi: string };
	frequency: ArsenalFrequency;
	lastUsedAt?: string;
}

export const ARSENAL_PLATFORMS: ArsenalPlatform[] = ["macos", "iphone", "cli"];

export const ARSENAL_CATEGORIES: ArsenalCategory[] = [
	"ai",
	"editor",
	"terminal",
	"messenger",
	"finance",
	"media",
	"dev",
	"system",
	"reading",
	"journal",
	"transit",
	"shopping",
	"social",
];

export const ARSENAL_FREQUENCIES: ArsenalFrequency[] = [
	"today",
	"this_week",
	"this_month",
	"rare",
];

export const arsenal: ArsenalItem[] = [];
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx astro check 2>&1 | tail -20`
Expected: no errors related to `arsenal.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/data/arsenal.ts
git commit -m "feat(trunk): add arsenal data types and empty seed"
```

---

## Task 2: Data validation test

**Files:**
- Create: `tests/data/arsenal.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
	arsenal,
	ARSENAL_CATEGORIES,
	ARSENAL_FREQUENCIES,
	ARSENAL_PLATFORMS,
	type ArsenalItem,
} from "../../src/data/arsenal";

const expectedIconExt: Record<string, string> = {
	macos: "png",
	iphone: "png",
	cli: "svg",
};

test("every arsenal entry has required fields and valid enums", () => {
	for (const item of arsenal) {
		const ctx = `slug=${item.slug ?? "<missing>"}`;
		assert.ok(item.slug, `${ctx}: missing slug`);
		assert.match(item.slug, /^[a-z0-9][a-z0-9-]*$/, `${ctx}: slug must be url-safe`);
		assert.ok(item.title, `${ctx}: missing title`);
		assert.ok(ARSENAL_PLATFORMS.includes(item.platform), `${ctx}: invalid platform`);
		assert.ok(ARSENAL_CATEGORIES.includes(item.category), `${ctx}: invalid category`);
		assert.ok(["wand", "inventory"].includes(item.tier), `${ctx}: invalid tier`);
		assert.ok(item.icon, `${ctx}: missing icon`);
		assert.ok(item.homepageUrl, `${ctx}: missing homepageUrl`);
		assert.ok(/^https?:\/\//.test(item.homepageUrl), `${ctx}: homepageUrl must be absolute`);
		assert.ok(item.role?.en && item.role?.vi, `${ctx}: role must have both en and vi`);
		assert.ok(ARSENAL_FREQUENCIES.includes(item.frequency), `${ctx}: invalid frequency`);

		const expectedExt = expectedIconExt[item.platform];
		const expectedPrefix = `/arsenal/icons/${item.platform}/${item.slug}.${expectedExt}`;
		assert.equal(
			item.icon,
			expectedPrefix,
			`${ctx}: icon path must be ${expectedPrefix}`,
		);
	}
});

test("every wand-tier entry has a bilingual note", () => {
	const wands = arsenal.filter((i: ArsenalItem) => i.tier === "wand");
	for (const w of wands) {
		assert.ok(w.note?.en && w.note?.vi, `wand ${w.slug}: must have bilingual note`);
		assert.ok(w.note.en.length >= 60, `wand ${w.slug}: en note feels too short`);
		assert.ok(w.note.vi.length >= 60, `wand ${w.slug}: vi note feels too short`);
	}
});

test("slugs are unique across the arsenal", () => {
	const seen = new Set<string>();
	for (const item of arsenal) {
		assert.ok(!seen.has(item.slug), `duplicate slug: ${item.slug}`);
		seen.add(item.slug);
	}
});

test("at most 12 wand-tier entries", () => {
	const count = arsenal.filter((i: ArsenalItem) => i.tier === "wand").length;
	assert.ok(count <= 12, `too many wands (${count}); cap is 12 — keep it scarce`);
});
```

- [ ] **Step 2: Run test to verify it passes (empty array vacuously passes)**

Run: `npm test -- tests/data/arsenal.test.ts 2>&1 | tail -10`
Expected: 4 passing tests. Assertions are vacuously true on the empty array — that is intentional. Tests start enforcing once entries are added in Task 6+.

- [ ] **Step 3: Commit**

```bash
git add tests/data/arsenal.test.ts
git commit -m "test(trunk): validate arsenal data shape"
```

---

## Task 3: macOS scan script

**Files:**
- Create: `scripts/scan-macos-apps.ts`

**Subprocess safety note:** `execFileSync(cmd, [args…])` is used throughout — never `execSync` with template literals. App paths from `readdirSync` can contain quotes or backticks and would be a shell-injection vector if passed through a shell.

- [ ] **Step 1: Create the script**

```ts
#!/usr/bin/env tsx
// scripts/scan-macos-apps.ts
//
// Scans /Applications and ~/Applications, extracts icons via `sips`,
// reads kMDItemLastUsedDate via `mdls`, and emits a draft TS block of
// ArsenalItem entries. Output is piped or pasted into src/data/arsenal.ts
// and hand-edited (role lines, note paragraphs, wand-tier picks).

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename, extname } from "node:path";

const ICON_OUT = "public/arsenal/icons/macos";
const APP_DIRS = ["/Applications", join(homedir(), "Applications")];

function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/\.app$/, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function lastUsedDate(appPath: string): string | null {
	try {
		const out = execFileSync("mdls", [
			"-name",
			"kMDItemLastUsedDate",
			"-raw",
			appPath,
		]).toString().trim();
		if (out === "(null)" || out === "") return null;
		return new Date(out).toISOString();
	} catch {
		return null;
	}
}

function bucketFrequency(iso: string | null): "today" | "this_week" | "this_month" | "rare" {
	if (!iso) return "rare";
	const ms = Date.now() - new Date(iso).getTime();
	const day = 86_400_000;
	if (ms < day) return "today";
	if (ms < 7 * day) return "this_week";
	if (ms < 30 * day) return "this_month";
	return "rare";
}

function extractIcon(appPath: string, slug: string): boolean {
	const resourcesDir = join(appPath, "Contents", "Resources");
	if (!existsSync(resourcesDir)) return false;
	const icns = readdirSync(resourcesDir).find((f) => f.endsWith(".icns"));
	if (!icns) return false;
	const icnsPath = join(resourcesDir, icns);
	const outPath = join(ICON_OUT, `${slug}.png`);
	try {
		// IMPORTANT: array args to execFileSync — no shell, no injection.
		execFileSync("sips", [
			"-s", "format", "png",
			"-Z", "256",
			icnsPath,
			"--out", outPath,
		], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

function main() {
	mkdirSync(ICON_OUT, { recursive: true });

	const apps: { name: string; path: string; lastUsed: string | null }[] = [];
	for (const dir of APP_DIRS) {
		if (!existsSync(dir)) continue;
		for (const entry of readdirSync(dir)) {
			if (!entry.endsWith(".app")) continue;
			const fullPath = join(dir, entry);
			try {
				if (!statSync(fullPath).isDirectory()) continue;
			} catch {
				continue;
			}
			apps.push({
				name: entry,
				path: fullPath,
				lastUsed: lastUsedDate(fullPath),
			});
		}
	}

	apps.sort((a, b) => {
		if (!a.lastUsed && !b.lastUsed) return a.name.localeCompare(b.name);
		if (!a.lastUsed) return 1;
		if (!b.lastUsed) return -1;
		return b.lastUsed.localeCompare(a.lastUsed);
	});

	console.log("// === DRAFT macOS entries — hand-curate before pasting into arsenal.ts ===");
	for (const app of apps) {
		const title = basename(app.name, extname(app.name));
		const slug = slugify(app.name);
		const iconOk = extractIcon(app.path, slug);
		const freq = bucketFrequency(app.lastUsed);
		console.log(`  {
    slug: ${JSON.stringify(slug)},
    title: ${JSON.stringify(title)},
    platform: "macos",
    category: "FIXME",
    tier: "inventory",
    icon: ${JSON.stringify(`/arsenal/icons/macos/${slug}.png`)},${iconOk ? "" : "  // FIXME: icon extraction failed"}
    homepageUrl: "https://FIXME",
    role: { en: "FIXME", vi: "FIXME" },
    frequency: ${JSON.stringify(freq)},${app.lastUsed ? `\n    lastUsedAt: ${JSON.stringify(app.lastUsed)},` : ""}
  },`);
	}
	console.log(`// === ${apps.length} apps emitted ===`);
}

main();
```

- [ ] **Step 2: Verify the script parses**

Run: `npx tsx --check scripts/scan-macos-apps.ts && echo OK`
Expected: `OK`.

- [ ] **Step 3: Run the script and capture output**

Run: `npx tsx scripts/scan-macos-apps.ts > /tmp/arsenal-macos-draft.ts 2>&1 && head -40 /tmp/arsenal-macos-draft.ts`
Expected: a list of `// === DRAFT macOS entries ===` followed by `{ slug: …, title: …, … }` blocks. PNGs appear under `public/arsenal/icons/macos/`.

- [ ] **Step 4: Commit the script (NOT the icons or temp draft yet)**

```bash
git add scripts/scan-macos-apps.ts
git commit -m "feat(trunk): add macOS app scan script"
```

---

## Task 4: CLI scan script

**Files:**
- Create: `scripts/scan-cli-tools.ts`

- [ ] **Step 1: Create the script**

```ts
#!/usr/bin/env tsx
// scripts/scan-cli-tools.ts
//
// Lists CLI tools from `brew list --formula`, walks ~/.local/bin and
// ~/.cargo/bin, then ranks by frequency in ~/.zsh_history. For each
// survivor, fetches a simple-icons SVG; if absent, emits a monogram
// fallback. Output is a draft TS block.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ICON_OUT = "public/arsenal/icons/cli";
const HISTORY_PATH = join(homedir(), ".zsh_history");
const MIN_USE_COUNT = 3;
const SIMPLE_ICONS_BASE = "https://cdn.jsdelivr.net/npm/simple-icons@14/icons";

function brewFormulae(): string[] {
	try {
		return execFileSync("brew", ["list", "--formula"]).toString().trim().split("\n").filter(Boolean);
	} catch {
		return [];
	}
}

function localBins(): string[] {
	const dirs = [join(homedir(), ".local/bin"), join(homedir(), ".cargo/bin")];
	const results: string[] = [];
	for (const dir of dirs) {
		if (!existsSync(dir)) continue;
		for (const entry of readdirSync(dir)) {
			try {
				const full = join(dir, entry);
				const stat = statSync(full);
				if (stat.isFile() && (stat.mode & 0o111)) results.push(entry);
			} catch {}
		}
	}
	return results;
}

function historyFrequency(): Map<string, number> {
	const counts = new Map<string, number>();
	if (!existsSync(HISTORY_PATH)) return counts;
	const lines = readFileSync(HISTORY_PATH, "utf8").split("\n");
	const sample = lines.slice(-10_000); // last ~10k commands
	for (const line of sample) {
		// zsh extended history: ": <ts>:<elapsed>;<command>"
		const cmd = line.includes(";") ? line.slice(line.indexOf(";") + 1) : line;
		const first = cmd.trim().split(/\s+/)[0];
		if (!first) continue;
		const tool = first.replace(/^sudo$/, ""); // sudo prefix gets unwrapped
		if (!tool) continue;
		counts.set(tool, (counts.get(tool) ?? 0) + 1);
	}
	return counts;
}

function bucketFromRank(rank: number): "today" | "this_week" | "this_month" | "rare" {
	if (rank < 10) return "today";
	if (rank < 30) return "this_week";
	if (rank < 80) return "this_month";
	return "rare";
}

async function fetchSimpleIcon(slug: string): Promise<string | null> {
	try {
		const res = await fetch(`${SIMPLE_ICONS_BASE}/${slug}.svg`);
		if (!res.ok) return null;
		return await res.text();
	} catch {
		return null;
	}
}

function monogramSvg(letter: string): string {
	const ch = (letter[0] ?? "?").toUpperCase();
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="currentColor" opacity="0.12"/><text x="12" y="16" font-family="Inter Tight, sans-serif" font-size="13" font-weight="600" text-anchor="middle" fill="currentColor">${ch}</text></svg>`;
}

async function main() {
	mkdirSync(ICON_OUT, { recursive: true });

	const candidates = new Set<string>([...brewFormulae(), ...localBins()]);
	const counts = historyFrequency();

	// Rank by usage count; drop anything below MIN_USE_COUNT
	const ranked = [...candidates]
		.map((tool) => ({ tool, count: counts.get(tool) ?? 0 }))
		.filter((r) => r.count >= MIN_USE_COUNT)
		.sort((a, b) => b.count - a.count);

	console.log(`// === DRAFT CLI entries (${ranked.length} survivors of ${candidates.size}) ===`);
	for (let i = 0; i < ranked.length; i++) {
		const { tool, count } = ranked[i];
		const slug = tool.toLowerCase().replace(/[^a-z0-9]+/g, "-");
		let svg = await fetchSimpleIcon(slug);
		if (!svg) svg = monogramSvg(tool);
		writeFileSync(join(ICON_OUT, `${slug}.svg`), svg);
		const freq = bucketFromRank(i);
		console.log(`  {
    slug: ${JSON.stringify(slug)},
    title: ${JSON.stringify(tool)},
    platform: "cli",
    category: "FIXME",
    tier: "inventory",
    icon: ${JSON.stringify(`/arsenal/icons/cli/${slug}.svg`)},
    homepageUrl: "https://FIXME",
    role: { en: "FIXME", vi: "FIXME" },
    frequency: ${JSON.stringify(freq)},  // count=${count}
  },`);
	}
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Verify the script parses**

Run: `npx tsx --check scripts/scan-cli-tools.ts && echo OK`
Expected: `OK`.

- [ ] **Step 3: Run the script**

Run: `npx tsx scripts/scan-cli-tools.ts > /tmp/arsenal-cli-draft.ts 2>&1 && head -30 /tmp/arsenal-cli-draft.ts`
Expected: draft block with `count=N` annotations on each entry. SVGs land in `public/arsenal/icons/cli/`.

- [ ] **Step 4: Commit**

```bash
git add scripts/scan-cli-tools.ts
git commit -m "feat(trunk): add CLI tool scan script"
```

---

## Task 5: iPhone icon fetch script

**Files:**
- Create: `scripts/fetch-app-store-icons.ts`

- [ ] **Step 1: Create the script (iPhone app list embedded from Loc's Settings > iPhone Storage screenshots)**

```ts
#!/usr/bin/env tsx
// scripts/fetch-app-store-icons.ts
//
// For each iPhone app in IPHONE_APPS below (sourced from Loc's
// Settings > iPhone Storage screenshots, sorted by Last Used Date),
// look up artwork + App Store URL via the iTunes Search API
// (country=vn, fall back to us), download the icon to
// public/arsenal/icons/iphone/, and emit a draft TS block.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ICON_OUT = "public/arsenal/icons/iphone";

type Bucket = "today" | "this_week" | "this_month" | "rare";

interface IPhoneApp {
	slug: string;          // url-safe id
	searchTerm: string;    // what to search the App Store for
	displayTitle: string;  // shown on the page
	frequency: Bucket;     // from "Last used" column in screenshot
	homepageOverride?: string; // some apps have a better homepage than App Store URL
}

const IPHONE_APPS: IPhoneApp[] = [
	// Today (28)
	{ slug: "settings", searchTerm: "iOS Settings", displayTitle: "Settings", frequency: "today", homepageOverride: "https://www.apple.com/ios/" },
	{ slug: "zalo", searchTerm: "Zalo", displayTitle: "Zalo", frequency: "today" },
	{ slug: "google-maps", searchTerm: "Google Maps", displayTitle: "Google Maps", frequency: "today" },
	{ slug: "youtube", searchTerm: "YouTube", displayTitle: "YouTube", frequency: "today" },
	{ slug: "safari", searchTerm: "Safari", displayTitle: "Safari", frequency: "today", homepageOverride: "https://www.apple.com/safari/" },
	{ slug: "github-mobile", searchTerm: "GitHub", displayTitle: "GitHub", frequency: "today" },
	{ slug: "reddit", searchTerm: "Reddit", displayTitle: "Reddit", frequency: "today" },
	{ slug: "google", searchTerm: "Google", displayTitle: "Google", frequency: "today" },
	{ slug: "messenger", searchTerm: "Messenger", displayTitle: "Messenger", frequency: "today" },
	{ slug: "claude", searchTerm: "Claude by Anthropic", displayTitle: "Claude", frequency: "today" },
	{ slug: "google-photos", searchTerm: "Google Photos", displayTitle: "Google Photos", frequency: "today" },
	{ slug: "vnexpress", searchTerm: "VnExpress", displayTitle: "VnExpress", frequency: "today" },
	{ slug: "photos", searchTerm: "Photos", displayTitle: "Photos", frequency: "today", homepageOverride: "https://www.apple.com/ios/photos/" },
	{ slug: "facebook", searchTerm: "Facebook", displayTitle: "Facebook", frequency: "today" },
	{ slug: "hacki", searchTerm: "Hacki Hacker News", displayTitle: "Hacki", frequency: "today" },
	{ slug: "music", searchTerm: "Apple Music", displayTitle: "Music", frequency: "today" },
	{ slug: "camera", searchTerm: "iOS Camera", displayTitle: "Camera", frequency: "today", homepageOverride: "https://www.apple.com/ios/" },
	{ slug: "phone", searchTerm: "iOS Phone", displayTitle: "Phone", frequency: "today", homepageOverride: "https://www.apple.com/ios/" },
	{ slug: "clock", searchTerm: "iOS Clock", displayTitle: "Clock", frequency: "today", homepageOverride: "https://www.apple.com/ios/" },
	{ slug: "find-my", searchTerm: "Find My", displayTitle: "Find My", frequency: "today" },
	{ slug: "techcombank", searchTerm: "Techcombank Mobile", displayTitle: "Techcombank", frequency: "today" },
	{ slug: "linkedin", searchTerm: "LinkedIn", displayTitle: "LinkedIn", frequency: "today" },
	{ slug: "telegram", searchTerm: "Telegram Messenger", displayTitle: "Telegram", frequency: "today" },
	{ slug: "calendar", searchTerm: "iOS Calendar", displayTitle: "Calendar", frequency: "today", homepageOverride: "https://www.apple.com/ios/" },
	{ slug: "gmail", searchTerm: "Gmail", displayTitle: "Gmail", frequency: "today" },
	{ slug: "daily-mail", searchTerm: "Daily Mail Online", displayTitle: "Daily Mail", frequency: "today" },
	{ slug: "grab", searchTerm: "Grab", displayTitle: "Grab", frequency: "today" },
	{ slug: "messages", searchTerm: "iOS Messages", displayTitle: "Messages", frequency: "today", homepageOverride: "https://www.apple.com/ios/messages/" },
	// Yesterday → this_week bucket
	{ slug: "x-twitter", searchTerm: "X formerly Twitter", displayTitle: "X", frequency: "this_week" },
	{ slug: "livescore", searchTerm: "LiveScore", displayTitle: "LiveScore", frequency: "this_week" },
	{ slug: "day-one", searchTerm: "Day One Journal", displayTitle: "Day One", frequency: "this_week" },
	{ slug: "obsidian", searchTerm: "Obsidian", displayTitle: "Obsidian", frequency: "this_week" },
	{ slug: "facetime", searchTerm: "FaceTime", displayTitle: "FaceTime", frequency: "this_week", homepageOverride: "https://www.apple.com/facetime/" },
	{ slug: "whatsapp", searchTerm: "WhatsApp Messenger", displayTitle: "WhatsApp", frequency: "this_week" },
	{ slug: "octal", searchTerm: "Octal Hacker News", displayTitle: "Octal", frequency: "this_week" },
	// 4/23/26 → this_week
	{ slug: "speedtest", searchTerm: "Speedtest by Ookla", displayTitle: "Speedtest", frequency: "this_week" },
	{ slug: "mail", searchTerm: "iOS Mail", displayTitle: "Mail", frequency: "this_week", homepageOverride: "https://www.apple.com/ios/" },
	{ slug: "slack", searchTerm: "Slack", displayTitle: "Slack", frequency: "this_week" },
	{ slug: "teams", searchTerm: "Microsoft Teams", displayTitle: "Teams", frequency: "this_week" },
	{ slug: "app-store", searchTerm: "App Store", displayTitle: "App Store", frequency: "this_week", homepageOverride: "https://www.apple.com/app-store/" },
	{ slug: "momo", searchTerm: "MoMo Vi dien tu", displayTitle: "MoMo", frequency: "this_week" },
	{ slug: "uob-tmrw", searchTerm: "UOB TMRW Vietnam", displayTitle: "UOB TMRW VN", frequency: "this_week" },
	{ slug: "wyze", searchTerm: "Wyze", displayTitle: "Wyze", frequency: "rare" },
];

interface ITunesResult {
	artworkUrl512?: string;
	artworkUrl100?: string;
	trackViewUrl?: string;
	sellerUrl?: string;
}

async function lookup(term: string): Promise<ITunesResult | null> {
	for (const country of ["vn", "us"]) {
		const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=software&country=${country}&limit=1`;
		try {
			const res = await fetch(url);
			if (!res.ok) continue;
			const data = (await res.json()) as { results?: ITunesResult[] };
			if (data.results && data.results.length > 0) return data.results[0];
		} catch {}
	}
	return null;
}

async function downloadIcon(url: string, dest: string): Promise<boolean> {
	try {
		const res = await fetch(url);
		if (!res.ok) return false;
		const buf = Buffer.from(await res.arrayBuffer());
		writeFileSync(dest, buf);
		return true;
	} catch {
		return false;
	}
}

async function main() {
	mkdirSync(ICON_OUT, { recursive: true });

	console.log(`// === DRAFT iPhone entries (${IPHONE_APPS.length}) ===`);
	for (const app of IPHONE_APPS) {
		const result = await lookup(app.searchTerm);
		const artwork = result?.artworkUrl512 ?? result?.artworkUrl100 ?? null;
		const homepage = app.homepageOverride ?? result?.sellerUrl ?? result?.trackViewUrl ?? "https://FIXME";
		let iconOk = false;
		if (artwork) {
			iconOk = await downloadIcon(artwork, join(ICON_OUT, `${app.slug}.png`));
		}
		console.log(`  {
    slug: ${JSON.stringify(app.slug)},
    title: ${JSON.stringify(app.displayTitle)},
    platform: "iphone",
    category: "FIXME",
    tier: "inventory",
    icon: ${JSON.stringify(`/arsenal/icons/iphone/${app.slug}.png`)},${iconOk ? "" : "  // FIXME: icon download failed"}
    homepageUrl: ${JSON.stringify(homepage)},
    role: { en: "FIXME", vi: "FIXME" },
    frequency: ${JSON.stringify(app.frequency)},
  },`);
	}
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Verify the script parses**

Run: `npx tsx --check scripts/fetch-app-store-icons.ts && echo OK`
Expected: `OK`.

- [ ] **Step 3: Run the script**

Run: `npx tsx scripts/fetch-app-store-icons.ts > /tmp/arsenal-iphone-draft.ts 2>&1 && ls public/arsenal/icons/iphone/ | wc -l`
Expected: draft block printed; ~40 PNGs in `public/arsenal/icons/iphone/`. Any `FIXME: icon download failed` rows must be revisited (try a different `searchTerm`).

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch-app-store-icons.ts
git commit -m "feat(trunk): add iPhone icon fetch script"
```

---

## Task 6: Populate the inventory data

**Files:**
- Modify: `src/data/arsenal.ts`
- Add: `public/arsenal/icons/{macos,iphone,cli}/*` (generated)

**Note:** This task is curation, not blind paste. The scripts emit drafts; Loc and the implementing engineer review each entry together.

- [ ] **Step 1: Curate the macOS draft into `arsenal.ts`**

Open `/tmp/arsenal-macos-draft.ts`. For each entry:
- Fill in `category` (one of the enum values)
- Fill in `homepageUrl` (look up if unsure)
- Fill in `role.en` and `role.vi` (one-line incantations — see spec § "Role-line tone")
- Drop entries that don't deserve a slot (one-off installs, abandoned utilities, system internals you never open)

Paste the curated entries into the `arsenal` array in `src/data/arsenal.ts`. All start as `tier: "inventory"`.

- [ ] **Step 2: Curate the CLI draft**

Repeat the curation pass on `/tmp/arsenal-cli-draft.ts`. Same fields. Same drop policy. Append to `arsenal`.

- [ ] **Step 3: Curate the iPhone draft**

Repeat on `/tmp/arsenal-iphone-draft.ts`. Append to `arsenal`.

- [ ] **Step 4: Run the validation tests**

Run: `npm test -- tests/data/arsenal.test.ts 2>&1 | tail -20`
Expected: all tests pass. If a test fails, the failure message identifies the offending slug; fix in place.

- [ ] **Step 5: Commit**

```bash
git add src/data/arsenal.ts public/arsenal/icons/
git commit -m "feat(trunk): populate inventory entries (macOS + iPhone + CLI)"
```

---

## Task 7: Curate wand-tier picks

**Files:**
- Modify: `src/data/arsenal.ts`

**Note:** Editorial high-stakes task. ~10 items get promoted; each gets a real bilingual `note` paragraph.

- [ ] **Step 1: Identify ~10 wand candidates**

Loc picks. Suggested anchors based on the spec's identity-signal observations:
- **Claude / Claude Code** — meta-prestige (he ships with what he uses)
- **GitHub** — developer identity
- **Day One** — connects to memoir sprint
- **Hacki** — taste-tribe signal
- **Obsidian** — knowledge management
- **Zalo** — VN cultural identity
- **Telegram** — pro-tier messenger choice
- **Techcombank** or **MoMo** — fintech competence
- **Cursor** / **VS Code** / **Ghostty** — primary editor + terminal
- **ripgrep** or **git** — signature CLI

Whittle to ≤12 (test enforces). Promote by changing `tier: "inventory"` → `tier: "wand"` and adding a `note` field.

- [ ] **Step 2: Write each wand's note paragraph**

Each note is 2-3 sentences in EN + matching VI. Personal, specific, explains *why* this earned a wand slot. Example for Claude Code:

```ts
note: {
  en: "Pair-programming partner that ships this very site with me. Replaced three hours of solo grind with sixty minutes of collaboration on most days. The arsenal page exists because of what we built together.",
  vi: "Bạn đồng hành lập trình giúp tôi xây dựng chính trang web này. Thay ba giờ cày một mình bằng sáu mươi phút cộng tác mỗi ngày. Trang vũ khí này tồn tại vì những gì chúng tôi đã làm cùng nhau.",
},
```

Tone: first-person, present tense, no humble-bragging. The note is the *why*, not the *what*.

- [ ] **Step 3: Re-run validation tests**

Run: `npm test -- tests/data/arsenal.test.ts 2>&1 | tail -10`
Expected: passes. The "wand-tier has bilingual note" assertion now has real coverage; the "≤12 wands" cap is enforced.

- [ ] **Step 4: Commit**

```bash
git add src/data/arsenal.ts
git commit -m "feat(trunk): promote wand-tier entries with bilingual notes"
```

---

## Task 8: RuneCorners SVG component

**Files:**
- Create: `src/components/arsenal/RuneCorners.astro`

- [ ] **Step 1: Create the component**

```astro
---
// src/components/arsenal/RuneCorners.astro
//
// Four small SVG rune-style corner ornaments. Tints via CSS `currentColor`
// — set the parent's `color` to the category accent and the runes pick it up.

interface Props {
	size?: number;
}
const { size = 18 } = Astro.props;
---

<span class="trunk-runes" aria-hidden="true" style={`--rune-size: ${size}px;`}>
	<svg class="trunk-rune trunk-rune-tl" viewBox="0 0 24 24"><path d="M0 8 L0 0 L8 0 M2 6 L6 2 M0 12 L4 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
	<svg class="trunk-rune trunk-rune-tr" viewBox="0 0 24 24"><path d="M16 0 L24 0 L24 8 M18 2 L22 6 M20 12 L24 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
	<svg class="trunk-rune trunk-rune-bl" viewBox="0 0 24 24"><path d="M0 16 L0 24 L8 24 M2 18 L6 22 M0 12 L4 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
	<svg class="trunk-rune trunk-rune-br" viewBox="0 0 24 24"><path d="M16 24 L24 24 L24 16 M18 22 L22 18 M20 12 L24 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
</span>

<style>
.trunk-runes {
	position: absolute;
	inset: 0;
	pointer-events: none;
}
.trunk-rune {
	position: absolute;
	width: var(--rune-size, 18px);
	height: var(--rune-size, 18px);
	opacity: 0.45;
	transition: opacity 200ms ease;
}
.trunk-rune-tl { top: 8px; left: 8px; }
.trunk-rune-tr { top: 8px; right: 8px; transform: scaleX(-1); }
.trunk-rune-bl { bottom: 8px; left: 8px; transform: scaleY(-1); }
.trunk-rune-br { bottom: 8px; right: 8px; transform: scale(-1, -1); }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npx astro check 2>&1 | grep -i rune || echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add src/components/arsenal/RuneCorners.astro
git commit -m "feat(trunk): add RuneCorners SVG ornament component"
```

---

## Task 9: WandCard component

**Files:**
- Create: `src/components/arsenal/WandCard.astro`

- [ ] **Step 1: Create the component**

```astro
---
// src/components/arsenal/WandCard.astro
//
// Wand-tier hero card: rune corners, large icon, title, italic role,
// frequency dots, and a parchment overlay on hover with the bilingual note.

import RuneCorners from "./RuneCorners.astro";
import type { ArsenalItem } from "../../data/arsenal";

interface Props {
	item: ArsenalItem;
	lang: "en" | "vi";
}
const { item, lang } = Astro.props;
const note = item.note ? item.note[lang] : "";
const role = item.role[lang];
const visitLabel = lang === "vi" ? "Truy cập →" : "Visit →";
---

<a
	class="trunk-wand"
	href={item.homepageUrl}
	target="_blank"
	rel="noopener noreferrer"
	data-category={item.category}
	data-frequency={item.frequency}
	data-platform={item.platform}
>
	<RuneCorners size={20} />
	<div class="trunk-wand-icon">
		<img src={item.icon} alt={`${item.title} icon`} loading="lazy" width="96" height="96" />
	</div>
	<h3 class="trunk-wand-title">{item.title}</h3>
	<p class="trunk-wand-role">— {role} —</p>
	<div class="trunk-wand-meta">
		<span class="trunk-dot" aria-hidden="true" />
		<span class="trunk-platform">{item.platform === "cli" ? "spell" : item.platform}</span>
	</div>
	{note && (
		<div class="trunk-wand-overlay">
			<p class="trunk-wand-note">{note}</p>
			<span class="trunk-wand-cta">{visitLabel}</span>
		</div>
	)}
</a>

<style>
.trunk-wand {
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12px;
	padding: 28px 18px 20px;
	min-height: 260px;
	border: 1px solid color-mix(in oklab, currentColor 18%, transparent);
	border-radius: 4px;
	background: rgba(255, 255, 255, 0.02);
	color: var(--trunk-accent, #d4a843);
	text-decoration: none;
	overflow: hidden;
	transition: border-color 200ms ease, transform 200ms ease;
}
.trunk-wand:hover {
	border-color: color-mix(in oklab, currentColor 38%, transparent);
	transform: translateY(-2px);
}
.trunk-wand:hover :global(.trunk-rune) { opacity: 0.85; }

.trunk-wand-icon { width: 96px; height: 96px; display: grid; place-items: center; }
.trunk-wand-icon img { width: 96px; height: 96px; object-fit: contain; filter: drop-shadow(0 1px 6px rgba(0, 0, 0, 0.4)); }

.trunk-wand-title {
	margin: 0;
	font-family: "Inter Tight", system-ui, sans-serif;
	font-weight: 600;
	font-size: 1.05rem;
	color: rgb(232, 226, 213);
	text-align: center;
}
.trunk-wand-role {
	margin: 0;
	font-style: italic;
	font-size: 0.82rem;
	color: rgb(180, 174, 160);
	text-align: center;
}
.trunk-wand-meta {
	margin-top: auto;
	display: inline-flex;
	align-items: center;
	gap: 8px;
	font-size: 0.7rem;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	color: rgb(160, 154, 140);
}
.trunk-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: currentColor;
}
.trunk-wand[data-frequency="this_week"] .trunk-dot { opacity: 0.6; }
.trunk-wand[data-frequency="this_month"] .trunk-dot { opacity: 0.3; }
.trunk-wand[data-frequency="rare"] .trunk-dot {
	background: transparent;
	border: 1px solid currentColor;
}

.trunk-wand-overlay {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	padding: 18px 16px;
	background: rgba(232, 226, 213, 0.95);
	color: rgb(28, 26, 22);
	transform: translateY(100%);
	transition: transform 240ms ease;
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.trunk-wand:hover .trunk-wand-overlay,
.trunk-wand:focus-visible .trunk-wand-overlay {
	transform: translateY(0);
}
.trunk-wand-note { margin: 0; font-size: 0.82rem; line-height: 1.45; }
.trunk-wand-cta {
	font-size: 0.72rem;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	font-weight: 600;
}

/* Category accents — applied via data-category attribute */
.trunk-wand[data-category="ai"]        { --trunk-accent: #b794f4; color: var(--trunk-accent); }
.trunk-wand[data-category="editor"]    { --trunk-accent: #4fd1c5; color: var(--trunk-accent); }
.trunk-wand[data-category="terminal"]  { --trunk-accent: #f6ad55; color: var(--trunk-accent); }
.trunk-wand[data-category="dev"]       { --trunk-accent: #68d391; color: var(--trunk-accent); }
.trunk-wand[data-category="messenger"] { --trunk-accent: #63b3ed; color: var(--trunk-accent); }
.trunk-wand[data-category="finance"]   { --trunk-accent: #38a169; color: var(--trunk-accent); }
.trunk-wand[data-category="media"]     { --trunk-accent: #fc8181; color: var(--trunk-accent); }
.trunk-wand[data-category="system"]    { --trunk-accent: #a0aec0; color: var(--trunk-accent); }
.trunk-wand[data-category="reading"]   { --trunk-accent: #7f9cf5; color: var(--trunk-accent); }
.trunk-wand[data-category="journal"]   { --trunk-accent: #d4a843; color: var(--trunk-accent); }
.trunk-wand[data-category="transit"]   { --trunk-accent: #ed8936; color: var(--trunk-accent); }
.trunk-wand[data-category="shopping"]  { --trunk-accent: #76e4f7; color: var(--trunk-accent); }
.trunk-wand[data-category="social"]    { --trunk-accent: #f687b3; color: var(--trunk-accent); }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npx astro check 2>&1 | grep -i wandcard || echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add src/components/arsenal/WandCard.astro
git commit -m "feat(trunk): add WandCard hero component with rune frame and parchment overlay"
```

---

## Task 10: InventoryCard component

**Files:**
- Create: `src/components/arsenal/InventoryCard.astro`

- [ ] **Step 1: Create the component**

```astro
---
// src/components/arsenal/InventoryCard.astro
//
// Plain bordered tile for inventory entries — small icon, title, frequency
// dot. Whole card is the homepage link.

import type { ArsenalItem } from "../../data/arsenal";

interface Props {
	item: ArsenalItem;
	lang: "en" | "vi";
}
const { item, lang } = Astro.props;
const role = item.role[lang];
---

<a
	class="trunk-inv"
	href={item.homepageUrl}
	target="_blank"
	rel="noopener noreferrer"
	data-category={item.category}
	data-frequency={item.frequency}
	data-platform={item.platform}
	title={role}
>
	<span class="trunk-dot" aria-hidden="true" />
	<img src={item.icon} alt={`${item.title} icon`} loading="lazy" width="48" height="48" />
	<span class="trunk-inv-title">{item.title}</span>
</a>

<style>
.trunk-inv {
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
	padding: 16px 10px 12px;
	min-height: 120px;
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 4px;
	color: var(--trunk-accent, #d4a843);
	text-decoration: none;
	background: rgba(255, 255, 255, 0.015);
	transition: border-color 180ms ease, background 180ms ease;
}
.trunk-inv:hover {
	border-color: color-mix(in oklab, currentColor 35%, transparent);
	background: rgba(255, 255, 255, 0.04);
}
.trunk-inv img { width: 48px; height: 48px; object-fit: contain; }
.trunk-inv-title {
	font-family: "Inter Tight", system-ui, sans-serif;
	font-size: 0.78rem;
	color: rgb(220, 214, 200);
	text-align: center;
	line-height: 1.2;
}
.trunk-dot {
	position: absolute;
	top: 8px;
	right: 8px;
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: currentColor;
}
.trunk-inv[data-frequency="this_week"] .trunk-dot { opacity: 0.6; }
.trunk-inv[data-frequency="this_month"] .trunk-dot { opacity: 0.3; }
.trunk-inv[data-frequency="rare"] .trunk-dot {
	background: transparent;
	border: 1px solid currentColor;
	width: 8px;
	height: 8px;
}

/* Same accent palette as WandCard — duplicated intentionally so each
   component owns its own styling and can be moved independently. */
.trunk-inv[data-category="ai"]        { --trunk-accent: #b794f4; color: var(--trunk-accent); }
.trunk-inv[data-category="editor"]    { --trunk-accent: #4fd1c5; color: var(--trunk-accent); }
.trunk-inv[data-category="terminal"]  { --trunk-accent: #f6ad55; color: var(--trunk-accent); }
.trunk-inv[data-category="dev"]       { --trunk-accent: #68d391; color: var(--trunk-accent); }
.trunk-inv[data-category="messenger"] { --trunk-accent: #63b3ed; color: var(--trunk-accent); }
.trunk-inv[data-category="finance"]   { --trunk-accent: #38a169; color: var(--trunk-accent); }
.trunk-inv[data-category="media"]     { --trunk-accent: #fc8181; color: var(--trunk-accent); }
.trunk-inv[data-category="system"]    { --trunk-accent: #a0aec0; color: var(--trunk-accent); }
.trunk-inv[data-category="reading"]   { --trunk-accent: #7f9cf5; color: var(--trunk-accent); }
.trunk-inv[data-category="journal"]   { --trunk-accent: #d4a843; color: var(--trunk-accent); }
.trunk-inv[data-category="transit"]   { --trunk-accent: #ed8936; color: var(--trunk-accent); }
.trunk-inv[data-category="shopping"]  { --trunk-accent: #76e4f7; color: var(--trunk-accent); }
.trunk-inv[data-category="social"]    { --trunk-accent: #f687b3; color: var(--trunk-accent); }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npx astro check 2>&1 | grep -i inventorycard || echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add src/components/arsenal/InventoryCard.astro
git commit -m "feat(trunk): add InventoryCard tile component"
```

---

## Task 11: The trunk page (hero + Wands + Trunk with CSS-only filter tabs)

**Files:**
- Create: `src/pages/room-of-requirement/the-trunk.astro`

- [ ] **Step 1: Create the page**

```astro
---
export const prerender = false;

import Base from "../../layouts/Base.astro";
import { getCurrentLang } from "../../utils/lang";
import { arsenal, type ArsenalPlatform } from "../../data/arsenal";
import WandCard from "../../components/arsenal/WandCard.astro";
import InventoryCard from "../../components/arsenal/InventoryCard.astro";

const lang = getCurrentLang(Astro);
const isVi = lang === "vi";

const wands = arsenal.filter((i) => i.tier === "wand");
const inventory = arsenal.filter((i) => i.tier === "inventory");

// Sort inventory: today → this_week → this_month → rare, then by title
const FREQ_RANK = { today: 0, this_week: 1, this_month: 2, rare: 3 } as const;
const inventorySorted = [...inventory].sort((a, b) => {
	const fa = FREQ_RANK[a.frequency];
	const fb = FREQ_RANK[b.frequency];
	if (fa !== fb) return fa - fb;
	return a.title.localeCompare(b.title);
});

function countByPlatform(p: ArsenalPlatform) {
	return arsenal.filter((i) => i.platform === p).length;
}

const counts = {
	wands: wands.length,
	macos: countByPlatform("macos"),
	iphone: countByPlatform("iphone"),
	cli: countByPlatform("cli"),
};

const tabLabels = {
	en: { all: "All", macos: "macOS", iphone: "iPhone", cli: "Spells" },
	vi: { all: "Tất Cả", macos: "macOS", iphone: "iPhone", cli: "Bùa Chú" },
};
const t = tabLabels[lang];
---

<Base
	title={isVi ? "Rương Mắt Điên — Vũ Khí" : "Mad-Eye's Trunk — Arsenal"}
	description={isVi
		? "Bộ đồ Lộc mở ra mỗi sáng. Đũa phép, bùa chú, và mọi thứ trong rương."
		: "The kit Loc opens every morning. Wands, spells, and everything else in the trunk."}
	breadcrumbs={[
		{ label: isVi ? "Căn Phòng Yêu Cầu" : "Room of Requirement", href: "/room-of-requirement" },
		{ label: isVi ? "Rương Mắt Điên" : "Mad-Eye's Trunk" },
	]}
>
	<section class="trunk-hero">
		<span class="trunk-eyebrow">{isVi ? "Rương Mắt Điên" : "Mad-Eye's Trunk"}</span>
		<h1 class="trunk-title">{isVi ? "Vũ Khí Hằng Ngày" : "The Daily Arsenal"}</h1>
		<p class="trunk-subtitle">
			{isVi
				? "Bộ đồ Lộc mở ra mỗi sáng. Lớp đũa phép chính, rồi đến phần còn lại trong rương."
				: "The kit Loc opens every morning. Wand-tier daily drivers, then the rest of the compartment."}
		</p>
		<div class="trunk-meta">
			<span><strong>{counts.wands}</strong> {isVi ? "đũa phép" : "wands"}</span>
			<span class="trunk-meta-dot" />
			<span><strong>{counts.macos}</strong> macOS</span>
			<span class="trunk-meta-dot" />
			<span><strong>{counts.iphone}</strong> iPhone</span>
			<span class="trunk-meta-dot" />
			<span><strong>{counts.cli}</strong> {isVi ? "bùa chú" : "spells"}</span>
		</div>
	</section>

	<section class="trunk-wands" aria-label={isVi ? "Đũa phép" : "Wands"}>
		<h2 class="trunk-h2">{isVi ? "Đũa Phép" : "Wands"}</h2>
		<div class="trunk-wand-grid">
			{wands.map((w) => <WandCard item={w} lang={lang} />)}
		</div>
	</section>

	<section class="trunk-trunk" aria-label={isVi ? "Trong rương" : "The Trunk"}>
		<h2 class="trunk-h2">{isVi ? "Trong Rương" : "The Trunk"}</h2>

		<form class="trunk-tabs" role="tablist" aria-label={isVi ? "Lọc theo nền tảng" : "Filter by platform"}>
			<input type="radio" id="trunk-tab-all" name="trunk-tab" value="all" checked />
			<label for="trunk-tab-all">{t.all} <span class="trunk-tab-count">{inventorySorted.length}</span></label>

			<input type="radio" id="trunk-tab-macos" name="trunk-tab" value="macos" />
			<label for="trunk-tab-macos">{t.macos} <span class="trunk-tab-count">{counts.macos}</span></label>

			<input type="radio" id="trunk-tab-iphone" name="trunk-tab" value="iphone" />
			<label for="trunk-tab-iphone">{t.iphone} <span class="trunk-tab-count">{counts.iphone}</span></label>

			<input type="radio" id="trunk-tab-cli" name="trunk-tab" value="cli" />
			<label for="trunk-tab-cli">{t.cli} <span class="trunk-tab-count">{counts.cli}</span></label>
		</form>

		<div class="trunk-inv-grid">
			{inventorySorted.map((i) => <InventoryCard item={i} lang={lang} />)}
		</div>

		<p class="trunk-legend">
			<span class="trunk-legend-dot" data-state="today" /> {isVi ? "hôm nay" : "today"}
			<span class="trunk-legend-dot" data-state="this_week" /> {isVi ? "tuần này" : "this week"}
			<span class="trunk-legend-dot" data-state="this_month" /> {isVi ? "tháng này" : "this month"}
			<span class="trunk-legend-dot" data-state="rare" /> {isVi ? "hiếm khi" : "rare"}
		</p>
	</section>

	<footer class="trunk-footer">
		<a href="/room-of-requirement">{isVi ? "← Trở lại Căn Phòng Yêu Cầu" : "← Back to the Room of Requirement"}</a>
	</footer>
</Base>

<style>
.trunk-hero {
	padding: 64px 24px 40px;
	max-width: 720px;
	margin: 0 auto;
	text-align: center;
}
.trunk-eyebrow {
	display: inline-block;
	font-size: 0.72rem;
	letter-spacing: 0.18em;
	text-transform: uppercase;
	color: rgb(180, 174, 160);
	margin-bottom: 12px;
}
.trunk-title {
	font-family: "Inter Tight", system-ui, sans-serif;
	font-weight: 700;
	font-size: clamp(2rem, 5vw, 3rem);
	margin: 0 0 16px;
	color: rgb(232, 226, 213);
}
.trunk-subtitle {
	margin: 0 0 24px;
	color: rgb(180, 174, 160);
	font-size: 1rem;
	line-height: 1.55;
}
.trunk-meta {
	display: inline-flex;
	flex-wrap: wrap;
	justify-content: center;
	align-items: center;
	gap: 12px;
	font-size: 0.85rem;
	color: rgb(180, 174, 160);
}
.trunk-meta strong { color: rgb(212, 168, 67); font-weight: 600; }
.trunk-meta-dot {
	width: 4px;
	height: 4px;
	border-radius: 50%;
	background: rgba(212, 168, 67, 0.4);
}

.trunk-h2 {
	font-family: "Inter Tight", system-ui, sans-serif;
	font-size: 1.4rem;
	font-weight: 600;
	color: rgb(232, 226, 213);
	margin: 0 0 24px;
	text-align: center;
}

.trunk-wands { padding: 32px 24px; max-width: 1200px; margin: 0 auto; }
.trunk-wand-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 16px;
}
@media (min-width: 768px) { .trunk-wand-grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1024px) { .trunk-wand-grid { grid-template-columns: repeat(5, 1fr); } }

.trunk-trunk { padding: 48px 24px 32px; max-width: 1200px; margin: 0 auto; }
.trunk-tabs {
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 6px;
	margin-bottom: 24px;
}
.trunk-tabs input[type="radio"] {
	position: absolute;
	opacity: 0;
	pointer-events: none;
}
.trunk-tabs label {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	padding: 8px 14px;
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 999px;
	font-size: 0.85rem;
	color: rgb(180, 174, 160);
	cursor: pointer;
	transition: background 180ms ease, border-color 180ms ease, color 180ms ease;
}
.trunk-tabs label:hover { color: rgb(232, 226, 213); border-color: rgba(255, 255, 255, 0.2); }
.trunk-tabs input[type="radio"]:checked + label {
	color: rgb(28, 26, 22);
	background: rgb(232, 226, 213);
	border-color: rgb(232, 226, 213);
}
.trunk-tab-count { font-size: 0.72rem; opacity: 0.7; }

.trunk-inv-grid {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 10px;
}
@media (min-width: 600px) { .trunk-inv-grid { grid-template-columns: repeat(4, 1fr); } }
@media (min-width: 900px) { .trunk-inv-grid { grid-template-columns: repeat(6, 1fr); } }

/* CSS-only filter — when a non-"all" tab is checked, hide non-matching cards.
   InventoryCard exposes data-platform on its <a class="trunk-inv">. */
.trunk-tabs:has(input[value="macos"]:checked)  ~ .trunk-inv-grid > a:not([data-platform="macos"])  { display: none; }
.trunk-tabs:has(input[value="iphone"]:checked) ~ .trunk-inv-grid > a:not([data-platform="iphone"]) { display: none; }
.trunk-tabs:has(input[value="cli"]:checked)    ~ .trunk-inv-grid > a:not([data-platform="cli"])    { display: none; }

.trunk-legend {
	margin: 28px 0 0;
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	align-items: center;
	gap: 12px;
	font-size: 0.78rem;
	color: rgb(160, 154, 140);
}
.trunk-legend-dot {
	display: inline-block;
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: rgb(212, 168, 67);
	margin-right: 4px;
}
.trunk-legend-dot[data-state="this_week"] { opacity: 0.6; }
.trunk-legend-dot[data-state="this_month"] { opacity: 0.3; }
.trunk-legend-dot[data-state="rare"] {
	background: transparent;
	border: 1px solid rgb(212, 168, 67);
}

.trunk-footer { padding: 32px 24px 64px; text-align: center; }
.trunk-footer a {
	color: rgb(180, 174, 160);
	font-size: 0.9rem;
	text-decoration: none;
}
.trunk-footer a:hover { color: rgb(232, 226, 213); }
</style>
```

- [ ] **Step 2: Run `astro check`**

Run: `npx astro check 2>&1 | tail -20`
Expected: no errors.

- [ ] **Step 3: Start dev server and visit the page**

Run: `npx emdash dev` (background) then visit `http://localhost:4321/room-of-requirement/the-trunk`.

Visual checklist:
- Hero band renders with counts
- Wands grid shows ~10 cards with rune corners + parchment hover
- Trunk grid shows inventory; tabs filter without page reload
- Frequency dot opacity matches data
- Mobile (DevTools 375px) is 2-col wands, 3-col inventory

- [ ] **Step 4: Commit**

```bash
git add src/pages/room-of-requirement/the-trunk.astro
git commit -m "feat(trunk): add the-trunk page with hero, wands grid, and CSS-only filter tabs"
```

---

## Task 12: Add tile to Room of Requirement index

**Files:**
- Modify: `src/pages/room-of-requirement/index.astro`

- [ ] **Step 1: Locate the existing tile pattern**

Run: `grep -n "diagon-alley\|mirror-of-erised" src/pages/room-of-requirement/index.astro | head -10`
Expected: line numbers showing where existing tiles are defined. Read the surrounding ~30 lines to see the exact JSX/Astro shape (tile element, classes, copy fields).

- [ ] **Step 2: Add a new tile**

In `src/pages/room-of-requirement/index.astro`, immediately after the Diagon Alley tile, insert a tile with:
- href: `/room-of-requirement/the-trunk`
- EN title: `Mad-Eye's Trunk`
- VI title: `Rương Mắt Điên`
- EN blurb: `The daily arsenal — wands, spells, and everything else in the trunk.`
- VI blurb: `Vũ khí hằng ngày — đũa phép, bùa chú, và mọi thứ trong rương.`

Match the surrounding tile pattern exactly. Don't introduce a new shape — copy the existing tile element and change href + copy. If the existing tiles use icons or sigils, pick something appropriate (a small trunk/lock SVG or a wand glyph).

- [ ] **Step 3: Verify in dev server**

Reload `http://localhost:4321/room-of-requirement/`. The new tile should appear and click through to `/room-of-requirement/the-trunk`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/room-of-requirement/index.astro
git commit -m "feat(trunk): add Mad-Eye's Trunk tile to Room of Requirement index"
```

---

## Task 13: Add route entry to site-routes.json

**Files:**
- Modify: `src/data/site-routes.json`

- [ ] **Step 1: Add the route**

In `src/data/site-routes.json`, add this entry to the `static` array (place it next to other Room of Requirement entries):

```json
{ "path": "/room-of-requirement/the-trunk", "title": "Mad-Eye's Trunk — Arsenal", "priority": "0.6" }
```

The full file must remain valid JSON — watch the trailing commas.

- [ ] **Step 2: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/data/site-routes.json'))" && echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add src/data/site-routes.json
git commit -m "feat(trunk): register /room-of-requirement/the-trunk in site routes"
```

---

## Task 14: Final visual QA + accessibility pass

**Files:** none modified unless QA surfaces issues.

- [ ] **Step 1: Reload the dev server and walk the page**

Run: `npx emdash dev` (if not already running). Open `http://localhost:4321/room-of-requirement/the-trunk`.

Checklist:
- [ ] All wand cards render their icons (open DevTools Network, look for 404s under `/arsenal/icons/`)
- [ ] Hover on a wand reveals the parchment overlay smoothly; the note paragraph is readable
- [ ] Clicking any card opens the homepage in a new tab
- [ ] Tab filter switches inventory without page reload
- [ ] Switch to VN: visit `?lang=vi` (or however language is set on this site) — every label is translated
- [ ] Mobile (DevTools 375px): wands are 2-col, inventory is 3-col, tabs wrap cleanly
- [ ] Frequency dots: walk a card per tier (`today`, `this_week`, `this_month`, `rare`) — visual difference is obvious
- [ ] Tab to focus navigation: every card is keyboard-reachable; focus ring is visible

- [ ] **Step 2: Test data validation under the real content**

Run: `npm test -- tests/data/arsenal.test.ts 2>&1 | tail -10`
Expected: all pass.

- [ ] **Step 3: Run `astro check` for the whole repo**

Run: `npx astro check 2>&1 | tail -20`
Expected: no new errors.

- [ ] **Step 4: Stage and commit any QA fixes**

If QA surfaced issues, fix in place and commit:

```bash
git add <files>
git commit -m "fix(trunk): <specific issue>"
```

If no fixes were needed, no commit. The implementation is done.

---

## Self-review

**Spec coverage:**
- ✅ Static TS data file → Task 1 + 6 + 7
- ✅ One Astro page → Task 11
- ✅ Bilingual EN/VI → Tasks 6, 7, 11, 12
- ✅ Hero + Wands + Trunk + tabs → Task 11
- ✅ Three data scripts → Tasks 3, 4, 5
- ✅ Local icon assets → Tasks 3, 4, 5 (download) + Task 6 (commit alongside data)
- ✅ Wand card with rune corners + parchment overlay → Tasks 8 + 9
- ✅ Inventory card with frequency dot → Task 10
- ✅ CSS-only filter tabs → Task 11 (uses `:has()` + `data-platform`)
- ✅ Add tile to RoR index → Task 12
- ✅ Add entry to site-routes.json → Task 13
- ✅ Validation tests → Task 2

**Placeholder scan:** no "TBD" / "TODO" / "implement later" / "similar to Task N" / vague "add error handling" steps. Every code step has actual code.

**Type consistency:** `ArsenalItem` shape is defined in Task 1 and used identically in Tasks 2, 9, 10, 11. `data-platform` attribute is set on both `WandCard` (Task 9) and `InventoryCard` (Task 10) so the CSS filter in Task 11 finds it. Frequency enum values match across data, components, CSS, and tests.

**Subprocess safety:** All `execFileSync` calls in Tasks 3 and 4 use array args; no shell interpolation of filesystem paths. Reviewed against the security-reminder hook's guidance.

Plan complete.
