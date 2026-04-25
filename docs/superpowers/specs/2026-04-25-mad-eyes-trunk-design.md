# Mad-Eye's Trunk — Design Spec

**Goal:** Add a 12th themed page to the Room of Requirement that catalogues
Loc's daily-driver toolkit across macOS, iPhone, and CLI. Frame the page as
his personal arsenal — wand-tier tools at the top, the rest of the trunk
below. Each item shows real frequency data sourced honestly (last-used
timestamps from the OS, not self-reported), an official icon, a one-line
"incantation" describing its role, and a link to the homepage.

**Scope includes:**

- Static TS data file (`src/data/arsenal.ts`) with ~80 entries across three
  platforms.
- One Astro page at `/room-of-requirement/the-trunk` with hero band, Wands
  section (10 hero cards), and Trunk section (filterable inventory grid).
- Bilingual EN/VI throughout (per site convention).
- Fully SSR, no client framework, no JS framework — vanilla CSS for the
  filter tabs.
- Three one-shot data-gathering scripts in `scripts/` (committed, re-runnable,
  not part of build): macOS scan, CLI scan, iPhone manual entry helper.
- Local icon assets under `public/arsenal/icons/{macos,iphone,cli}/<slug>.{png|svg}`.
- New tile on the Room of Requirement index pointing here.
- New entry in `src/data/site-routes.json` for sitemap/llms.txt/ai-plugin.json.

**Scope excludes:**

- EmDash collection (deliberately static — content has no editorial workflow,
  diff-reviewable in PRs is the right surface).
- Auto-refresh of usage data on page load (data is curated and committed; the
  scan scripts re-run on demand when Loc wants to refresh).
- Personal admin UI for editing entries (Loc edits the TS file in his IDE
  while pairing).
- Search / sort / per-category drill-down beyond the platform filter tabs.
- Per-item detail pages — homepage URL is the only outbound link.

---

## Architecture

Pure Astro SSR page on the existing Cloudflare Workers + EmDash stack. No
runtime dependencies added. No EmDash collection. No D1 read.

```
src/data/arsenal.ts                              ← typed data (~80 entries)
public/arsenal/icons/macos/<slug>.png            ← 256px PNG, sips-extracted
public/arsenal/icons/iphone/<slug>.png           ← 256px PNG, iTunes Search API
public/arsenal/icons/cli/<slug>.svg              ← simple-icons SVG, fallback monogram
src/pages/room-of-requirement/the-trunk.astro    ← imports + renders
scripts/scan-macos-apps.ts                       ← one-shot, generates draft TS
scripts/scan-cli-tools.ts                        ← one-shot, generates draft TS
scripts/fetch-app-store-icons.ts                 ← one-shot, downloads iPhone icons
src/data/site-routes.json                        ← add the route entry
src/pages/room-of-requirement/index.astro        ← add tile linking here
```

---

## Data model

```ts
// src/data/arsenal.ts
export type ArsenalPlatform = "macos" | "iphone" | "cli";

export type ArsenalCategory =
  | "ai"        // Claude, Cursor, etc.
  | "editor"    // VS Code, IDEs
  | "terminal"  // Ghostty, iTerm
  | "messenger" // Zalo, Telegram, Slack, Messages
  | "finance"   // Techcombank, MoMo, UOB
  | "media"     // YouTube, Music, Photos
  | "dev"       // GitHub, git, gh, ripgrep
  | "system"    // Settings, Find My, Clock
  | "reading"   // Hacki, Reddit, VnExpress, Daily Mail
  | "journal"   // Day One, Obsidian
  | "transit"   // Google Maps, Grab
  | "shopping"  // App Store
  | "social";   // X, Facebook, LinkedIn, Messenger

export type ArsenalFrequency =
  | "today"
  | "this_week"
  | "this_month"
  | "rare";

export type ArsenalTier = "wand" | "inventory";

export interface ArsenalItem {
  slug: string;                          // url-safe id, also icon filename
  title: string;                         // display name
  platform: ArsenalPlatform;
  category: ArsenalCategory;
  tier: ArsenalTier;
  icon: string;                          // /arsenal/icons/<platform>/<slug>.<ext>
  homepageUrl: string;                   // outbound link
  role: { en: string; vi: string };      // one-line incantation
  note?: { en: string; vi: string };     // 2-3 sentences, wand-tier only
  frequency: ArsenalFrequency;
  lastUsedAt?: string;                   // ISO date — informational only, not displayed
}

export const arsenal: ArsenalItem[] = [/* … ~80 entries … */];
```

**Tier rule:** ~10 wands, hand-curated by Loc from the data scripts'
proposals. Everything else is `inventory`. The wand selection is editorial,
not algorithmic — frequency data informs but doesn't decide.

**Why TS over JSON or markdown:** TS gives compile-time validation of enum
values and the bilingual-pair shape. Adding an entry with a typo in
`platform` or missing the `vi` half of `role` becomes a build error instead
of a runtime missing-render. EmDash's seed.json is already 1.5MB and
unrelated content; this stays out.

---

## Data gathering scripts

All three live in `scripts/`, are run on demand by Loc (or me when pairing),
and emit *draft* TS blocks that get pasted into `src/data/arsenal.ts` and
hand-edited. They are not part of `npx emdash dev` and don't run in CI.

### `scripts/scan-macos-apps.ts`

Enumerates `/Applications` and `~/Applications`. For each `.app` bundle:

1. Read `Info.plist` for the canonical name and bundle id.
2. Read `kMDItemLastUsedDate` via `mdls -name kMDItemLastUsedDate -raw`.
3. Extract `.icns` → 256px PNG via `sips -s format png -Z 256 …`, write to
   `public/arsenal/icons/macos/<slug>.png`.
4. Bucket `lastUsedAt` into `today` / `this_week` / `this_month` / `rare`
   relative to "today".
5. Emit a TS block to stdout, sorted by recency, with placeholder `role`
   pairs that Loc fills in.

Skips system/Apple internal apps unless they're notable (`Photos`, `Mail`,
`Find My`, `Calendar`, `Settings`).

### `scripts/scan-cli-tools.ts`

1. Run `brew list --formula` for the canonical install list.
2. Walk `~/.local/bin`, `~/.cargo/bin`, mise/asdf shims for binaries not
   covered by brew.
3. Parse `~/.zsh_history` (last ~10k commands), tokenize the first word per
   line, count occurrences. Anything with <3 occurrences gets dropped (one-off
   experiments don't earn a slot).
4. For each survivor, fetch the simple-icons SVG by slug; if missing, write a
   monogram SVG in the accent color.
5. Frequency bucket: top 10 cmds → `today`, 11-30 → `this_week`, 31-80 →
   `this_month`, rest → `rare`.
6. Emit draft TS with placeholder roles.

### `scripts/fetch-app-store-icons.ts`

For each iPhone app named in the screenshots Loc provided (encoded as a
local input list at the top of the script):

1. Hit iTunes Search API:
   `https://itunes.apple.com/search?term=<name>&entity=software&country=vn&limit=1`
2. Pull `artworkUrl512`, save to `public/arsenal/icons/iphone/<slug>.png`.
3. Pull `trackViewUrl` for `homepageUrl` (or use the developer's site if
   known better).
4. Bucket frequency from the screenshot's "Last used" column: `Today` →
   `today`, `Yesterday` → `this_week`, `<date within 7d>` → `this_week`,
   `<date within 30d>` → `this_month`, else `rare`.

**Re-runnability:** If Loc reinstalls something or wants a fresh snapshot,
re-run the relevant script. Output is a new draft block; he diffs it
against the current `arsenal.ts` and merges what's new.

---

## Page composition

`src/pages/room-of-requirement/the-trunk.astro` follows the same wiring as
sibling pages (`diagon-alley.astro`, `mirror-of-erised.astro`):

```astro
---
export const prerender = false;

import Base from "../../layouts/Base.astro";
import { getCurrentLang } from "../../utils/lang";
import { arsenal } from "../../data/arsenal";

const lang = getCurrentLang(Astro);
const isVi = lang === "vi";

const wands = arsenal.filter((i) => i.tier === "wand");
const inventory = arsenal.filter((i) => i.tier === "inventory");
const counts = {
  total: arsenal.length,
  wands: wands.length,
  macos: arsenal.filter((i) => i.platform === "macos").length,
  iphone: arsenal.filter((i) => i.platform === "iphone").length,
  cli: arsenal.filter((i) => i.platform === "cli").length,
};
---
```

No `Astro.cache.set` — there is no EmDash query. The Workers edge can cache
the response via standard `Cache-Control` headers if needed (added in
implementation if cold-start times warrant).

### Page sections

1. **Hero band**
   - Title: "Mad-Eye's Trunk" / "Rương Mắt Điên" (Inter Tight 700)
   - Subtitle paragraph (locked copy, see § 4 below)
   - Inline counts row: `10 wands · 47 macOS · 30 iPhone · 22 spells`
   - Last-updated date (derived from latest commit to `arsenal.ts` at build
     time, or hardcoded — implementation choice)

2. **§ Wands** — heading + 10-card grid
   - Mobile: 2 col. Desktop: 5 col. Cards ~200×260.
   - Card anatomy:
     - SVG rune corners in the category accent color (4 corner ornaments,
       small — not a full border, just corner marks)
     - 96px icon, centered
     - Title in Inter Tight 600
     - Italic role line, em-dash framed: `— role text —`
     - Bottom row: frequency dots + platform tag
   - Hover: parchment-colored overlay slides up from the bottom, revealing
     the `note` paragraph and a `Visit →` CTA. Whole card is the link to
     `homepageUrl` (opens new tab, `rel="noopener"`).

3. **§ The Trunk** — heading + filter tabs + dense inventory grid
   - Tabs: `All · macOS · iPhone · Spells` (counts in labels)
   - Tabs are pure CSS via `<input type="radio">` + `:checked ~ ` selectors
     (works without JS).
   - Mobile: 3 col. Desktop: 6 col. Cards ~120×140.
   - Card anatomy:
     - Plain bordered tile (1px subtle border, dark canvas inside)
     - 48px icon
     - Title beneath in smaller Inter Tight
     - Frequency dot top-right
     - Whole card is the link

4. **Footer line** — "← Back to the Room of Requirement" link.

### Frequency dot scale

Visual ranking that doesn't require reading text:

| Frequency | Visual |
|---|---|
| `today` | filled circle, full opacity, category accent color |
| `this_week` | filled circle, 60% opacity |
| `this_month` | filled circle, 30% opacity |
| `rare` | empty ring, 1px outline |

### Category accent palette

Aligns with the locked Pensieve visual system memory (Linear-influenced,
6 specific accents already chosen at site level). For the trunk page the
mapping is:

| Category | Accent |
|---|---|
| ai | violet |
| editor | teal |
| terminal | amber |
| dev | emerald |
| messenger | sky |
| finance | green |
| media | rose |
| system | slate |
| reading | indigo |
| journal | gold |
| transit | orange |
| shopping | mint |
| social | coral |

Exact hex picked during implementation against the existing site palette
(no new colors invented — pull from what's already used).

---

## Bilingual copy (locked)

| Element | EN | VI |
|---|---|---|
| Page title | Mad-Eye's Trunk | Rương Mắt Điên |
| Hero subtitle | The kit Loc opens every morning. Wand-tier daily drivers, then the rest of the compartment. | Bộ đồ Lộc mở ra mỗi sáng. Lớp đũa phép chính, rồi đến phần còn lại trong rương. |
| § Wands heading | Wands | Đũa Phép |
| § Trunk heading | The Trunk | Trong Rương |
| Tab labels | All · macOS · iPhone · Spells | Tất Cả · macOS · iPhone · Bùa Chú |
| Frequency legend | today · this week · this month · rare | hôm nay · tuần này · tháng này · hiếm khi |
| Hover CTA | Visit → | Truy cập → |
| Back link | ← Back to the Room of Requirement | ← Trở lại Căn Phòng Yêu Cầu |

**Role-line tone:** short, present-tense verb, evocative not cute. One
fragment, no period. If a tool resists the metaphor (`Settings`, `App Store`),
state the role plainly — the page should *charm*, not *cosplay*.

**Note paragraph (wand-tier only):** 2-3 sentences explaining why this tool
earned a wand slot. Personal. Drafted by me as I generate data, edited by
Loc before commit.

---

## Magical theming details

The "prestige" feel is carried by **frame, not icon**. Real recognizable
icons stay; the magic is in:

- **Rune corners** — small SVG flourishes at card corners (different glyph
  per category, drawn once and tinted via `currentColor`)
- **Em-dash typography** — role lines are framed with em-dashes, signature
  of the "Em" in EmDash and an unmistakable typographic signal
- **Parchment overlay on hover** — tonal paper color over the dark card,
  text in a darker ink color, a subtle inner shadow
- **Page intro language** — first-person framing positions the page as a
  *loadout*, not a directory

No emojis, no Comic-Sans-of-fantasy fonts, no glow effects. The dark canvas
+ Inter Tight + accent restraint already does the prestige work; theming is
the seasoning.

---

## Files to create / modify

### Create

```
src/data/arsenal.ts                                       (new — typed data)
src/pages/room-of-requirement/the-trunk.astro             (new — page)
public/arsenal/icons/macos/*.png                          (new — generated)
public/arsenal/icons/iphone/*.png                         (new — generated)
public/arsenal/icons/cli/*.svg                            (new — generated)
scripts/scan-macos-apps.ts                                (new — one-shot)
scripts/scan-cli-tools.ts                                 (new — one-shot)
scripts/fetch-app-store-icons.ts                          (new — one-shot)
```

### Modify

```
src/data/site-routes.json                                 (+1 route entry)
src/pages/room-of-requirement/index.astro                 (+1 tile)
```

---

## Risks & open questions

1. **simple-icons coverage for CLI tools** — most popular CLIs are covered
   (`git`, `node`, `python`, `docker`, `gh`, `rg`/ripgrep) but some
   esoteric ones (`mise`, `direnv`) may not be. Fallback: monogram SVG
   in the accent color, generated from the first letter. **Mitigation:**
   accept fallback, looks consistent enough.
2. **iTunes Search API regional results** — searching for `Zalo` or
   `MoMo` may not return the VN App Store version first. **Mitigation:**
   pin `country=vn` in the query; manually verify each result against
   the screenshot before committing the icon.
3. **App Store TOS for icon redistribution** — using official app icons
   for editorial reference (a personal "tools I use" page) falls under
   nominative fair use; not a commercial use. Same as how every
   "my stack" personal site works. **Mitigation:** `rel="noopener"`
   outbound link to homepage, no implication of endorsement.
4. **`mdls` last-used timestamps unreliable for some apps** — Spotlight
   indexing may not cover every app, particularly ones launched only via
   Dock. **Mitigation:** when `kMDItemLastUsedDate` is null but the app
   exists, default to `rare`; let Loc override.
5. **Page might feel sparse on mobile** — 2-col wand grid on a small
   screen may need to be 1-col with side-by-side icon + text rather than
   icon-on-top. **Mitigation:** decide during implementation against
   actual content density.

---

## Build sequence (not a plan — that's writing-plans' job, but a sketch)

1. Run the three data-gathering scripts; emit drafts.
2. Loc curates: picks 10 wands, edits role + note text, deletes irrelevant
   inventory items.
3. Implement the page (vanilla Astro + CSS).
4. Add tile to Room of Requirement index.
5. Add route entry to `site-routes.json`.
6. Visual QA on real content in dev server.
7. Done. Ship.
