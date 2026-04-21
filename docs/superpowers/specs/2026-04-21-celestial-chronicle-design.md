# The Celestial Chronicle — Design

- **Author**: Loc (with Claude)
- **Date**: 2026-04-21
- **Status**: Approved design, awaiting implementation plan
- **Related**: `/pensieve/memories/*` (post collection), `priori-incantatem` (diary pattern reference)

## 1. Purpose

A personal, public calendar of Loc's life events — births, losses, moves, milestones, notable trips — rendered as a magical, Harry-Potter-flavored *star chart + ledger* at `/pensieve/chronicle`. Visitors see the sky; Loc and family see their lived years pinned to it. Entries cross-reference the posts that discuss them and external URLs when relevant.

**Not goals (v1):** a full place-atlas view with a geographic map, subscription/invite gating for sensitive entries, social features (comments on entries), or automatic date publishing without human review.

## 2. User-facing surface

### 2.1 Route and layout

- **URL**: `/pensieve/chronicle` (bilingual via existing lang middleware, same as memories)
- **Public**: yes, indexed, in sitemap, RSS-ignorable
- **Listed in**: `src/data/site-routes.json` under `static` with priority `0.7`

### 2.2 The page (split view, from the locked mockup)

```
┌───────────────────────────────────────────────────────────────┐
│  The Celestial Chronicle   —   Loc's life, plotted in stars   │
│  (bilingual subtitle)                                          │
│                                                                │
│  ┌───────────── Astrolabe canvas ─────────────┐  ┌ Ledger ───┐│
│  │                                            │  │ MMIV      ││
│  │     ☆            ★                         │  │   Met her ││
│  │          ✦                                 │  │           ││
│  │   ☆             ✦  (pulse)                 │  │ MMXV      ││
│  │        ✦                                   │  │   Left    ││
│  │            ★                               │  │   VNG …   ││
│  │                                            │  │           ││
│  │   rings = years · angle = month            │  │ MMXVIII   ││
│  │   ( zoom + pan controls in bottom-right )  │  │   …       ││
│  └────────────────────────────────────────────┘  └───────────┘│
│  Legend · hover-link help · "open Atlas (v2)" stub            │
└───────────────────────────────────────────────────────────────┘
```

- **Left pane (the Sky)**: concentric rings (one ring per year that has entries), stars placed at angle = month-of-year. Star color = category color. Hover a star → the matching ledger entry highlights and scrolls into view, and vice-versa.
- **Right pane (the Ledger)**: Chronicle-style list, Roman-numeral dates, italic poetic subtitle, optional reference link to a post/URL. Grouped by year heading.
- **Footer**: legend (category dots), hover-link hint. (The `visibility` field exists in the model for a future gated-entries feature but has no UI in v1.)

### 2.3 Zoom / pan model (scalability)

Rings = years works for 5–15 populated years; breaks at 30+. Plan:

- **Default view**: shows the 5 most recent populated years as rings. Older years roll up into a single dim halo labeled `…earlier (N events)` inside the innermost ring. The halo is clickable and zoom-expands into real rings.
- **Zoom out** (`−` button or pinch / scroll): expands to more years as outer rings.
- **Zoom in** (`+` or pinch): focuses on fewer years with more angular breathing room for close-dated events.
- **Pan (drag sky)**: rotates the starfield — purely cosmetic, does not alter time axis.
- **"Jump to year"**: a muted dropdown in the top-right of the canvas; selecting a year centers that ring.

Dense months (e.g., 2021-05 has Papaya + Dad within 17 days) get a small cluster-offset so stars don't overlap. Clustering algorithm: if two stars within the same year-month fall within 4° of each other, fan them along the month arc by ±3° each.

### 2.4 Entry detail

Clicking a star OR an entry opens a **detail modal** (not a new route — keeps the canvas alive):

- Full bilingual title and subtitle.
- Date in both ISO and Roman-numeral form.
- Location block (if present): name, city, country, and a static map thumbnail. Provider choice (Mapbox static API, OpenStreetMap tile composite, or prerendered PNG uploaded to R2) is deferred to the implementation plan — the spec only requires a single low-contrast dark-theme image sized ~320×160.
- Linked posts (list of memory-pages with links).
- External URL (e.g., the Old Trafford match page).
- Category pill with its accent.
- Close returns to the canvas with the source star still highlighted.

## 3. Data model

### 3.1 New EmDash collection: `chronicle`

Added to `seed/seed.json`. Fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | `string` | Y | Required by EmDash base; mirror of `title_en` for search. |
| `title_en` | `string` | Y | English title — e.g., "Proposed at Buckingham Palace". |
| `title_vi` | `string` | Y | Vietnamese title — e.g., "Cầu hôn trước cổng Buckingham". Same event, two names. |
| `subtitle_en` | `text` | N | Italic poetic line in English. |
| `subtitle_vi` | `text` | N | Italic poetic line in Vietnamese. |
| `event_date` | `string` | Y | ISO string `YYYY-MM-DD`. When precision is `month`, day is `01`. When `year`, month+day are `01-01`. Keeps sortability. |
| `date_precision` | `string` | Y | One of `day`, `month`, `year`. Used for display (render "V · MMXV" for month-only, hide day). |
| `category` | `string` | Y | One of `milestone`, `family`, `work`, `loss`, `love`, `travel`, `threshold`. Maps to accent color. |
| `location` | `portableText` \| `object` | N | Stored as a small JSON block via `object`-typed field if EmDash supports; otherwise a simple `text` field with a structured body: `name, city, country, lat, lng`. (See §3.4 on this decision.) |
| `linked_post_ids` | `string` | N | Comma-separated EmDash post ULIDs. A future migration to EmDash's relation field type can replace this. |
| `external_url` | `string` | N | E.g., match detail page for Old Trafford. |
| `external_url_label` | `string` | N | Display label for the external URL (default: domain). |
| `source` | `string` | Y | One of `manual`, `post-scan`, `google-maps`, `google-photos`. Shown only in admin. |
| `source_id` | `string` | N | Dedupe key for ingestion pipelines (post ULID, Google place_id, Google photo id). |
| `visibility` | `string` | N | `public` (default) or `sealed`. All v1 entries default to `public` and render fully. Field exists for future gating — reduces migration cost. |

All entries use EmDash's standard `status` (`draft` | `published`) and `publishedAt` from the collection `supports: ["drafts", "revisions", "search"]`. Ingestion produces drafts; only `published` entries render on the Chronicle.

### 3.2 Categories and colors

Accent hex values reuse the existing palette from `src/themes/`:

| Category | Hex | Rationale |
|---|---|---|
| milestone | `#d4a843` (gold) | Ceremonial, honorific. |
| family | `#5e6ad2` (indigo) | Warm, close. |
| work | `#3fb950` (green) | Growth, labor. |
| loss | `#b54b3c` (terracotta) | Earth, grounded grief — not black, not red. |
| love | `#c678dd` (violet) | Soft, intimate. |
| travel | `#2aa198` (teal) | Horizon, sea. |
| threshold | `#f7a65a` (amber) | Doorway, transition — leaving VNG, joining Papaya. |

Defined in `src/themes/chronicleCategories.ts` alongside `categoryThemes.ts`. Each category has `{ slug, hex, label_en, label_vi, symbol }` where `symbol` is the ledger glyph (default `✦`; `loss` uses a sealed dot `●`; `travel` uses `✧`).

### 3.3 Date precision display rules

- `day`: "XIV · XII · MMXXI" (Roman day · Roman month · Roman year)
- `month`: "V · MMXV" (Roman month · Roman year, no day)
- `year`: "MMIV" (Roman year only)

Conversion helpers in `src/utils/romanDate.ts` — pure functions, no external deps.

### 3.4 Location storage — pragmatic choice

EmDash's `image` field type is a structured object. For `location`, one of:

- **A (preferred)**: introduce a structured-object field type in EmDash for `location`. Matches how images are modeled, cleanest at read time.
- **B (fallback)**: store as a single `text` field with a documented JSON convention `{"name":"Buckingham Palace","city":"London","country":"GB","lat":51.501,"lng":-0.142}`. Parse at render time. Cheaper to ship; loses admin-UI structure.

Final choice gets made during implementation planning after checking EmDash's current schema capabilities. Spec assumes B unless A is trivial.

## 4. Ingestion pipelines

All three pipelines land candidates in the `chronicle` collection with `status: 'draft'`. None auto-publish. Admin UI (EmDash's built-in collection view) is the review queue.

### 4.1 Manual entry

- Use EmDash's built-in collection admin.
- No custom code needed beyond the seed schema.

### 4.2 Post-scan

**Trigger**: EmDash content hook on post save/publish (see `creating-plugins` skill).

**Logic**:
1. Walk the Portable Text of the saved post.
2. Extract text, run date-pattern matcher (below).
3. For each matched `(date, context_snippet, precision)`:
   - If a `chronicle` entry exists with same `event_date` and `source_id` containing this post ULID → skip (already linked).
   - If an entry exists with the same `event_date` but *no* link to this post → append the post ULID to its `linked_post_ids` (as a link-augmentation, not a new entry).
   - Otherwise: create a `draft` entry with `source: 'post-scan'`, `source_id: <post_ulid>`, `title_*: context_snippet (first 60 chars)`, `linked_post_ids: <post_ulid>`.

**Patterns matched** (in `src/utils/dateExtract.ts`):
- `DD/MM/YYYY` and `D/M/YYYY` (Vietnamese-style, primary)
- `YYYY-MM-DD` (ISO)
- `Month YYYY` — English month names, precision=`month`
- `tháng M năm YYYY` and `tháng M/YYYY` — Vietnamese month, precision=`month`
- Year-only mentions are **not** auto-extracted (too noisy)

**Safeguards**:
- Dates inside quoted text (Portable Text blockquote) are skipped — they're usually citations, not lived events.
- Dates in the future (>today) are skipped.
- A `source_id`-based dedupe ensures re-saving a post doesn't create duplicate drafts.

### 4.3 Google Takeout ingestion

CLI scripts in `scripts/chronicle/`:

- `ingest-gmaps.ts` — reads `Semantic Location History/YYYY/YYYY_MONTH.json` from a Google Takeout Maps export. Extracts `placeVisit` entries with duration > 2 hours. Writes draft Chronicle entries via the EmDash admin API (see `emdash-cli` skill for the write pattern).
- `ingest-gphotos.ts` — reads `*.json` sidecars from a Google Photos Takeout export. Groups photos by `(date, approximate-location)` into sessions. Each session becomes one draft entry. The first photo of the session is suggested as the `featured_image` (once we add that field in a later iteration).

Both scripts:
- **Dedupe** by `source_id` before inserting.
- **Require review** — everything lands as `draft`. Admin then decides which to publish, which to dismiss, which to merge with an existing entry.
- **Are one-shot** — run locally against a Takeout zip. No live sync. Re-runnable safely due to dedupe.

## 5. Rendering architecture

### 5.1 Server-rendered Astro page

`src/pages/pensieve/chronicle.astro` — follows the project rule that CMS-driven pages are `output: "server"`. No `getStaticPaths`. Calls `getEmDashCollection("chronicle")`, filters to `published`, sorts by `event_date` descending.

Always calls `Astro.cache.set(cacheHint)`.

### 5.2 Client-side canvas rendering

The Astrolabe canvas is DOM-based (not `<canvas>`):
- Rings are `<div>`s with `border-radius: 50%`.
- Stars are absolutely-positioned `<span>`s with computed `left`/`top` from `(year, month)` → `(ring-radius, angle)`.
- Hover / active state via `data-` attributes; cross-highlight driven by small inline `<script>`.
- Zoom is implemented via a CSS custom-property `--zoom-scale` on the canvas that scales ring radii and font sizes. Pan is a `transform: rotate()` on the inner `<div>`.

Why DOM not canvas: respects the existing project conventions (Astro + plain HTML/CSS, no new rendering lib), and a few dozen stars don't warrant `<canvas>`.

### 5.3 Components

- `src/components/chronicle/ChronicleSky.astro` — left pane, renders rings + stars.
- `src/components/chronicle/ChronicleLedger.astro` — right pane, grouped entries.
- `src/components/chronicle/ChronicleLegend.astro` — category legend.
- `src/components/chronicle/ChronicleEntryDetail.astro` — the modal opened on star/entry click. Accepts the entry as a prop, rendered once per entry and toggled via client script.
- `src/components/chronicle/ChronicleZoomControls.astro` — zoom buttons + year jump.
- Shared styles in `src/styles/chronicle.css` — category CSS variables, shared typography, responsive breakpoints.

Client-side glue script in `src/components/chronicle/chronicle-client.ts` — star↔entry sync, zoom/pan handlers, modal open/close. Kept under 150 lines; no framework.

## 6. Conventions the calendar must not violate

From `CLAUDE.md`:
- `entry.id` = slug, `entry.data.id` = ULID. Chronicle entries use slug for URLs (none needed here since we don't have per-entry pages in v1); ULIDs in `linked_post_ids` are post ULIDs.
- All Chronicle entries must come from EmDash via `getEmDashCollection`. Never read D1 directly from the page.
- Every page with EmDash queries calls `Astro.cache.set(cacheHint)`.
- All in-site links use `link()` helper (prepends `/pensieve/`). External URLs use raw `href` with `target="_blank"` + `rel="noopener"`.
- Bilingual: the page respects `getCurrentLang(Astro)` and picks `title_<lang>`, `subtitle_<lang>`. Missing translations fall back to the other language with a muted "(translation pending)" badge in the ledger entry, not on the star tooltip.
- `src/data/site-routes.json` gets updated with `/pensieve/chronicle`.
- VI+EN parity: all new user-facing copy on the page (legend, zoom-control labels, help text, modal buttons) has both translations.

## 7. Security and privacy

- **All v1 entries are public.** The `visibility` field exists for future gating; nothing on the page branches on it yet.
- **Location coordinates are public but coarsened**. Store lat/lng to 2 decimal places (~1 km precision), not 6. Loses "house-level" precision intentionally.
- **External URLs** are rendered with `rel="noopener noreferrer"` and `target="_blank"`.
- **Post-scan hook** runs server-side in the EmDash worker, not in-browser. User input in post bodies never drives code paths beyond regex matching; no template-string evaluation. Match results are trimmed and HTML-escaped before being written as draft titles.
- **Takeout scripts** run locally against a user-provided zip. No network calls, no third-party APIs invoked on behalf of site visitors.
- **CSP**: the inline mini-script in `chronicle-client.ts` will need a nonce matching the existing site CSP pattern (same approach as the priori-incantatem page).

## 8. Out of scope (v1)

- **Atlas view** (geographic map with pins) — v2. `location` data is captured now so v2 doesn't require a migration.
- **Per-entry public permalink pages** — v2. Detail modal covers v1.
- **User-provided RSS for the Chronicle** — v2.
- **Entry comments** — posts have comments; Chronicle entries don't.
- **Auto-publishing from post-scan or Takeout ingestion** — deliberately human-gated.
- **Year-only auto-extraction** from posts — too noisy.
- **Featured images** on entries — Chronicle stays text-first in v1. Add later if the Atlas view needs them.

## 9. Testing approach

- **Unit**: `romanDate` conversion (edge cases: year 2000, year 1999, months I–XII), `dateExtract` (each regex pattern, blockquote skipping, future-date filtering, dedupe).
- **Integration**: a test post with known dates runs through the post-scan hook and verifies draft entries appear.
- **Visual/manual**: browser smoke test on `/pensieve/chronicle` with the seed's sample entries, at EN and VI, at narrow and wide viewports. Confirm star↔entry hover mapping, zoom in/out, entry modal open/close.
- **Type**: `npx emdash types` regenerates types for the new collection; the page imports must type-check.
- **Link integrity**: `linked_post_ids` → `getEntry` each target; 404 if missing is a test failure.

## 10. Seed data for v1

Eight confirmed entries go into `seed/seed.json`:

| Date | Precision | Category | Title EN | Title VI |
|---|---|---|---|---|
| 2004-03-15 | day | love | Met her — DAITY_JEWEL | Gặp bạn ấy — DAITY_JEWEL |
| 2015-03-13 | day | threshold | Left VNG | Rời VNG |
| 2015-05-01 | month | work | Founded GVN Studio | Lập GVN Studio |
| 2018-03-31 | day | milestone | Old Trafford, on my birthday (United won) | Old Trafford, đúng sinh nhật (MU thắng) |
| 2018-04-02 | day | love | Proposed at Buckingham Palace | Cầu hôn trước cổng Buckingham |
| 2021-05-04 | day | threshold | Joined Papaya | Vào Papaya |
| 2021-05-21 | day | loss | Dad | Ba |
| 2021-12-14 | day | family | Ngọc Linh Đan arrived (Fawn · Nai) | Ngọc Linh Đan chào đời (Fawn · Nai) |

External URL for 2018-03-31: match detail to be filled in during implementation (Premier League result for Man Utd on 2018-03-31 — a Saturday home fixture vs Swansea, final 2–0).

## 11. Open items for the implementation plan

These are deliberate unknowns that writing-plans will resolve, not design choices:

- Exact EmDash hook API shape for post-save (`creating-plugins` skill will know).
- Whether EmDash supports a `relation` or `object` field type yet for `location` and `linked_post_ids` — determines §3.4.
- Final Zoom math (ring radius formula as a function of zoom-scale and populated-year-count).
- Exact icon set for categories in the admin UI.
- How `src/data/site-routes.json` entries should render for bilingual — whether we add one or two rows.
