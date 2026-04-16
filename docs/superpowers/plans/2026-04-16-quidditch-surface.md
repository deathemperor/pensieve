# Quidditch Surface (Plan A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the read-path surface of the animation playground — landing page, per-animation page, raw viewer reading a seeded fixture transcript, D1 schema, routes, index-tile flip — so the UI can be demoed and iterated on before the capture pipeline (Plan B) lands.

**Architecture:** Astro + EmDash server-rendered pages, new `animations` EmDash collection, three new D1 tables (`animation_sessions`, `animation_chapters`, `animation_artifact_refs`), fixture JSONL at `src/fixtures/animations/placeholder/transcript.jsonl` read server-side and streamed into a client-side scrubbable `<details>`-tree viewer. No capture, no R2 writes, no source-history reconstruction in this plan — those come in Plan B.

**Tech Stack:** Astro 6, EmDash (`@emdash-cms/cloudflare`), Cloudflare D1 (binding `DB`, database `pensieve-db`), TypeScript, `node --test` via `tsx` for tests. Subprocess calls in tests always use `execFileSync` (arg-array form — no shell).

**Reference spec:** `docs/superpowers/specs/2026-04-16-quidditch-animation-playground-design.md`

**Out of scope for this plan** (deferred to Plan B):
- Capture hooks (`start-animation-build.sh`, `post-tool-use`, `user-prompt-submit`, `snap-animation.sh`, `finish-animation-build.sh`)
- Redaction pass
- Source-history reconstruction
- `publish-animations.ts` + pre-push hook extension
- Chapter CLI (`scripts/chapter.ts`)
- Iframe live-render pane (the fourth pane of the four-pane UI — Phase 3)

---

## File Structure

**Created:**
- `tests/README.md` — test harness conventions
- `tests/animations/schema.test.ts` — D1 tables exist in remote
- `tests/animations/seed.test.ts` — seed.json has animations collection + entry
- `tests/animations/fixtures.test.ts` — fixture JSONL + chapters are well-formed
- `tests/animations/transcript.test.ts` — parseTranscript + filterByKinds
- `tests/animations/raw-viewer.test.ts` — renderEntryLabel formatting
- `tests/animations/e2e-smoke.test.ts` — full surface e2e
- `src/fixtures/animations/placeholder/transcript.jsonl`
- `src/fixtures/animations/placeholder/chapters.json`
- `src/animations/placeholder/index.astro` — placeholder hero
- `src/pages/hogwarts/quidditch/index.astro` — landing
- `src/pages/hogwarts/quidditch/[slug].astro` — per-animation page
- `src/pages/_animation-preview/[slug].astro` — dev preview route
- `src/components/animations/RawViewer.astro`
- `src/components/animations/raw-viewer-client.ts`
- `src/lib/animations/transcript.ts`
- `src/lib/animations/load-fixture.ts`
- `src/lib/animations/render-entry.ts`
- `scripts/migrate-animations.sql`

**Modified:**
- `package.json` — add `tsx`, `@types/node`, `test` script
- `seed/seed.json` — add `animations` collection + `placeholder` entry
- `src/data/site-routes.json` — add Quidditch route + `animations` collection
- `src/pages/index.astro` — Quidditch tile: `project-coming` → real link

**D1 schema changes** (applied via `npx wrangler d1 execute`):
- `animation_sessions`, `animation_chapters`, `animation_artifact_refs` tables per spec

---

## Task 1: Test harness setup

**Files:**
- Modify: `package.json`
- Create: `tests/README.md`

- [ ] **Step 1: Add tsx + test script**

Edit `package.json`. Inside `devDependencies`, add:

```jsonc
"tsx": "^4.19.0",
"@types/node": "^22.7.0"
```

Inside `scripts`, add:

```jsonc
"test": "node --import tsx --test 'tests/**/*.test.ts'"
```

- [ ] **Step 2: Install**

```bash
bun install
```
Expected: lockfile updates; `node_modules/.bin/tsx` present.

- [ ] **Step 3: Write test harness doc**

Create `tests/README.md`:

```markdown
# Tests

Pensieve uses Node's built-in test runner (`node --test`) via `tsx` for TypeScript. No jest, vitest, or other framework needed.

## Running tests

    bun run test                                    # all
    node --import tsx --test tests/animations/      # just animations

## Writing a test

    import { test } from "node:test";
    import assert from "node:assert/strict";

    test("example", () => {
      assert.equal(1 + 1, 2);
    });

## Running subprocesses in tests

Always use `execFileSync` (arg-array form — no shell). Never use `execSync` with template strings:

    // OK
    import { execFileSync } from "node:child_process";
    const out = execFileSync("npx", ["wrangler", "d1", "execute", ...], { encoding: "utf8" });

    // NOT OK — shell injection risk
    // execSync(`npx wrangler d1 execute ${db} --command "${sql}"`)

## Layout

Tests mirror `src/` paths under `tests/`. Fixture data lives in `src/fixtures/<feature>/`.
```

- [ ] **Step 4: Smoke test the runner**

Create a temporary `tests/_smoke.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";

test("harness is alive", () => {
  assert.equal(1 + 1, 2);
});
```

Run:
```bash
bun run test
```
Expected: `ok 1 - harness is alive`. Delete the file after.

- [ ] **Step 5: Commit**

```bash
rm tests/_smoke.test.ts
git add package.json bun.lockb tests/README.md
git commit -m "chore: add node --test harness for TypeScript tests

Co-Authored-By: deathemperor <loc.truongh@gmail.com>"
```

---

## Task 2: D1 schema — three animation tables

**Files:**
- Create: `scripts/migrate-animations.sql`
- Create: `tests/animations/schema.test.ts`

- [ ] **Step 1: Write the schema file**

Create `scripts/migrate-animations.sql`:

```sql
CREATE TABLE IF NOT EXISTS animation_sessions (
  id TEXT PRIMARY KEY,
  animation_slug TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  tool_call_count INTEGER DEFAULT 0,
  duration_ms INTEGER,
  transcript_r2_key TEXT NOT NULL,
  renders_manifest_r2_key TEXT,
  transcript_size_bytes INTEGER,
  redacted INTEGER DEFAULT 0,
  published INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS animation_chapters (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  cursor_index INTEGER NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES animation_sessions(id)
);

CREATE TABLE IF NOT EXISTS animation_artifact_refs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  cursor_index INTEGER NOT NULL,
  artifact_type TEXT NOT NULL,
  artifact_id TEXT,
  artifact_inline_text TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES animation_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_chapters_session ON animation_chapters(session_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_artifact_refs_session ON animation_artifact_refs(session_id, cursor_index);
CREATE INDEX IF NOT EXISTS idx_sessions_slug ON animation_sessions(animation_slug, published);
```

- [ ] **Step 2: Apply to local D1**

```bash
npx wrangler d1 execute pensieve-db --local --file scripts/migrate-animations.sql
```
Expected: `🌀 Executing on local database`; no errors.

- [ ] **Step 3: Apply to remote D1**

```bash
npx wrangler d1 execute pensieve-db --remote --file scripts/migrate-animations.sql
```
Expected: `🌀 Executing on remote database pensieve-db`; rows_written > 0 (indexes count).

- [ ] **Step 4: Write schema verification test**

Create `tests/animations/schema.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("animation tables exist in remote D1", () => {
  const out = execFileSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      "pensieve-db",
      "--remote",
      "--json",
      "--command",
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'animation_%' ORDER BY name",
    ],
    { encoding: "utf8" },
  );
  const parsed = JSON.parse(out) as Array<{
    results: Array<{ name: string }>;
  }>;
  const names = parsed[0].results.map((r) => r.name);
  assert.deepEqual(names, [
    "animation_artifact_refs",
    "animation_chapters",
    "animation_sessions",
  ]);
});
```

- [ ] **Step 5: Run test, commit**

```bash
bun run test -- tests/animations/schema.test.ts
```
Expected: PASS.

```bash
git add scripts/migrate-animations.sql tests/animations/schema.test.ts
git commit -m "feat(db): add animation_sessions/chapters/artifact_refs tables

Co-Authored-By: deathemperor <loc.truongh@gmail.com>"
```

---

## Task 3: EmDash `animations` collection + seed entry

**Files:**
- Modify: `seed/seed.json`
- Test: `tests/animations/seed.test.ts`

- [ ] **Step 1: Find the collections array**

Open `seed/seed.json` and locate `schema.collections`. Append to the collections array, after the last collection (mind the trailing comma on the previous item):

```jsonc
{
  "slug": "animations",
  "label": "Animations",
  "labelSingular": "Animation",
  "supports": ["drafts", "revisions", "search", "seo"],
  "fields": [
    {
      "slug": "title",
      "label": "Title",
      "type": "string",
      "required": true,
      "searchable": true
    },
    {
      "slug": "description",
      "label": "Description",
      "type": "text",
      "searchable": true
    },
    {
      "slug": "tags",
      "label": "Tags",
      "type": "list",
      "items": "string"
    },
    {
      "slug": "status",
      "label": "Status",
      "type": "string"
    },
    {
      "slug": "hero_component",
      "label": "Hero component path",
      "type": "string",
      "required": true
    },
    {
      "slug": "og_image",
      "label": "OG Image",
      "type": "image"
    },
    {
      "slug": "primary_session_id",
      "label": "Primary session id",
      "type": "string"
    },
    {
      "slug": "language",
      "label": "Language",
      "type": "string"
    }
  ]
}
```

- [ ] **Step 2: Add a `placeholder` entry**

In the top-level `entries` array, append:

```jsonc
{
  "collection": "animations",
  "slug": "placeholder",
  "status": "published",
  "data": {
    "title": "Placeholder — Spinning Snitch",
    "description": "A minimal CSS keyframe spinner used to prove the grid + raw viewer render end-to-end. Replaced in Plan B by the first real recorded animation.",
    "tags": ["placeholder", "css"],
    "status": "complete",
    "hero_component": "src/animations/placeholder/index.astro",
    "primary_session_id": "fixture-0000",
    "language": "en"
  }
}
```

- [ ] **Step 3: Validate + regenerate types**

```bash
npx emdash seed seed/seed.json --validate
```
Expected: `Seed file is valid`.

```bash
npx emdash types
```
Expected: `emdash-env.d.ts` updated; file contains the string `animations`.

- [ ] **Step 4: Write collection-read test**

Create `tests/animations/seed.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("seed.json defines an animations collection with required fields", () => {
  const seed = JSON.parse(readFileSync("seed/seed.json", "utf8"));
  const anim = seed.schema.collections.find(
    (c: { slug: string }) => c.slug === "animations",
  );
  assert.ok(anim, "animations collection exists");

  const fieldSlugs = anim.fields.map((f: { slug: string }) => f.slug);
  for (const required of ["title", "hero_component", "status", "language"]) {
    assert.ok(fieldSlugs.includes(required), `field "${required}" present`);
  }
});

test("seed.json has a placeholder animation entry", () => {
  const seed = JSON.parse(readFileSync("seed/seed.json", "utf8"));
  const entry = seed.entries.find(
    (e: { collection: string; slug: string }) =>
      e.collection === "animations" && e.slug === "placeholder",
  );
  assert.ok(entry, "placeholder entry exists");
  assert.equal(entry.status, "published");
  assert.equal(entry.data.hero_component, "src/animations/placeholder/index.astro");
});
```

- [ ] **Step 5: Run test, commit**

```bash
bun run test -- tests/animations/seed.test.ts
```
Expected: PASS × 2.

```bash
git add seed/seed.json emdash-env.d.ts tests/animations/seed.test.ts
git commit -m "feat(schema): add animations EmDash collection + placeholder entry

Co-Authored-By: deathemperor <loc.truongh@gmail.com>"
```

---

## Task 4: Placeholder hero animation component

**Files:**
- Create: `src/animations/placeholder/index.astro`

- [ ] **Step 1: Write the component**

Create `src/animations/placeholder/index.astro`:

```astro
---
// Placeholder animation — a minimal spinning snitch used to prove the
// playground's read-path renders end-to-end. Replaced in Plan B.
---

<div class="snitch-stage" role="img" aria-label="A spinning golden snitch icon">
  <div class="snitch">
    <div class="snitch-body"></div>
    <div class="wing wing-left"></div>
    <div class="wing wing-right"></div>
  </div>
</div>

<style>
  .snitch-stage {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: radial-gradient(circle at 50% 50%, #1b1c1d 0%, #08090a 70%);
  }

  .snitch {
    position: relative;
    width: 64px;
    height: 64px;
    animation: orbit 3.2s cubic-bezier(0.45, 0, 0.55, 1) infinite;
  }

  .snitch-body {
    position: absolute;
    inset: 16px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #ffd88a 0%, #d4a02a 60%, #8a6416 100%);
    box-shadow: 0 4px 18px rgba(212, 160, 42, 0.35);
  }

  .wing {
    position: absolute;
    top: 20px;
    width: 28px;
    height: 24px;
    background: rgba(247, 248, 248, 0.82);
    border-radius: 50% 50% 0 100%;
    transform-origin: 100% 50%;
    animation: flap 0.18s ease-in-out infinite alternate;
  }

  .wing-left { left: -10px; --x: -1; }
  .wing-right { right: -10px; --x: 1; }

  @keyframes orbit {
    0%   { transform: translate(-40px, 0)   rotate(0deg); }
    50%  { transform: translate(40px, -20px) rotate(180deg); }
    100% { transform: translate(-40px, 0)   rotate(360deg); }
  }

  @keyframes flap {
    from { transform: rotate(-18deg) scaleX(var(--x, 1)); }
    to   { transform: rotate(18deg)  scaleX(var(--x, 1)); }
  }

  @media (prefers-reduced-motion: reduce) {
    .snitch, .wing { animation: none; }
  }
</style>
```

- [ ] **Step 2: Commit** (visual check happens in Task 10)

```bash
git add src/animations/placeholder/index.astro
git commit -m "feat(animations): add placeholder spinning snitch component

Co-Authored-By: deathemperor <loc.truongh@gmail.com>"
```

---

## Task 5: Fixture transcript + chapters

**Files:**
- Create: `src/fixtures/animations/placeholder/transcript.jsonl`
- Create: `src/fixtures/animations/placeholder/chapters.json`
- Create: `tests/animations/fixtures.test.ts`

- [ ] **Step 1: Write the fixture transcript**

Create `src/fixtures/animations/placeholder/transcript.jsonl` (each line one entry):

```jsonl
{"cursor":0,"ts":"2026-04-16T09:00:00Z","kind":"prompt","content":"Build a simple spinning snitch animation for the Quidditch playground placeholder."}
{"cursor":1,"ts":"2026-04-16T09:00:12Z","kind":"tool","tool":"Read","input":{"file_path":"src/animations/placeholder/index.astro"},"output":{"status":"not_found"}}
{"cursor":2,"ts":"2026-04-16T09:00:20Z","kind":"tool","tool":"Write","input":{"file_path":"src/animations/placeholder/index.astro","content":"<div class=\"snitch-stage\">...</div>"},"output":{"status":"ok","bytes":420}}
{"cursor":3,"ts":"2026-04-16T09:00:28Z","kind":"assistant","content":"Initial static snitch rendered. Adding orbit animation next."}
{"cursor":4,"ts":"2026-04-16T09:00:40Z","kind":"tool","tool":"Edit","input":{"file_path":"src/animations/placeholder/index.astro","old_string":".snitch { }","new_string":".snitch { animation: orbit 3.2s linear infinite; }"},"output":{"status":"ok"}}
{"cursor":5,"ts":"2026-04-16T09:00:55Z","kind":"prompt","content":"The easing is too mechanical. Use a natural-feeling ease."}
{"cursor":6,"ts":"2026-04-16T09:01:02Z","kind":"tool","tool":"Edit","input":{"file_path":"src/animations/placeholder/index.astro","old_string":"animation: orbit 3.2s linear","new_string":"animation: orbit 3.2s cubic-bezier(0.45, 0, 0.55, 1)"},"output":{"status":"ok"}}
{"cursor":7,"ts":"2026-04-16T09:01:15Z","kind":"tool","tool":"Edit","input":{"file_path":"src/animations/placeholder/index.astro","old_string":"/* no wings */","new_string":".wing { animation: flap 0.18s ease-in-out infinite alternate; }"},"output":{"status":"ok"}}
{"cursor":8,"ts":"2026-04-16T09:01:30Z","kind":"assistant","content":"Wings added. Final polish: prefers-reduced-motion fallback."}
{"cursor":9,"ts":"2026-04-16T09:01:38Z","kind":"tool","tool":"Edit","input":{"file_path":"src/animations/placeholder/index.astro","old_string":"/* motion */","new_string":"@media (prefers-reduced-motion: reduce) { .snitch, .wing { animation: none; } }"},"output":{"status":"ok"}}
```

- [ ] **Step 2: Write the fixture chapters**

Create `src/fixtures/animations/placeholder/chapters.json`:

```json
[
  { "cursor_index": 2, "label": "v1 static snitch", "description": "Static SVG-like shape, no motion yet" },
  { "cursor_index": 4, "label": "v2 basic orbit", "description": "Linear orbit — mechanical feel" },
  { "cursor_index": 6, "label": "v3 natural easing", "description": "Cubic-bezier to simulate inertia" },
  { "cursor_index": 7, "label": "v4 flapping wings", "description": "Secondary wing motion for life" },
  { "cursor_index": 9, "label": "v5 a11y polish", "description": "prefers-reduced-motion fallback" }
]
```

- [ ] **Step 3: Write fixture validity test**

Create `tests/animations/fixtures.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("placeholder transcript is a well-formed JSONL with monotonic cursors", () => {
  const text = readFileSync(
    "src/fixtures/animations/placeholder/transcript.jsonl",
    "utf8",
  );
  const lines = text.trim().split("\n");
  let prev = -1;
  for (const line of lines) {
    const entry = JSON.parse(line);
    assert.ok(
      typeof entry.cursor === "number" && entry.cursor === prev + 1,
      `cursor ${entry.cursor} follows ${prev}`,
    );
    assert.ok(entry.ts, "ts present");
    assert.ok(
      ["prompt", "tool", "assistant"].includes(entry.kind),
      `kind "${entry.kind}" is valid`,
    );
    prev = entry.cursor;
  }
  assert.ok(lines.length >= 5, "fixture has at least 5 entries");
});

test("placeholder chapters all reference valid cursor indices", () => {
  const transcript = readFileSync(
    "src/fixtures/animations/placeholder/transcript.jsonl",
    "utf8",
  )
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
  const maxCursor = transcript[transcript.length - 1].cursor;

  const chapters = JSON.parse(
    readFileSync("src/fixtures/animations/placeholder/chapters.json", "utf8"),
  );
  for (const ch of chapters) {
    assert.ok(
      typeof ch.cursor_index === "number" &&
        ch.cursor_index >= 0 &&
        ch.cursor_index <= maxCursor,
      `chapter "${ch.label}" cursor ${ch.cursor_index} in range [0, ${maxCursor}]`,
    );
    assert.ok(ch.label, "label present");
  }
});
```

- [ ] **Step 4: Run tests, commit**

```bash
bun run test -- tests/animations/fixtures.test.ts
```
Expected: PASS × 2.

```bash
git add src/fixtures/animations/placeholder/ tests/animations/fixtures.test.ts
git commit -m "feat(animations): seed placeholder transcript + chapter fixtures

Co-Authored-By: deathemperor <loc.truongh@gmail.com>"
```

---

## Task 6: Transcript read utilities

**Files:**
- Create: `src/lib/animations/transcript.ts`
- Create: `src/lib/animations/load-fixture.ts`
- Test: `tests/animations/transcript.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/animations/transcript.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseTranscript,
  filterByKinds,
  type TranscriptEntry,
} from "../../src/lib/animations/transcript.ts";

const SAMPLE = [
  `{"cursor":0,"ts":"2026-04-16T09:00:00Z","kind":"prompt","content":"Hi"}`,
  `{"cursor":1,"ts":"2026-04-16T09:00:05Z","kind":"tool","tool":"Read","input":{},"output":{}}`,
  `{"cursor":2,"ts":"2026-04-16T09:00:10Z","kind":"assistant","content":"Ok"}`,
].join("\n");

test("parseTranscript yields typed entries in order", () => {
  const entries = parseTranscript(SAMPLE);
  assert.equal(entries.length, 3);
  assert.equal(entries[0].kind, "prompt");
  assert.equal(entries[1].kind, "tool");
  assert.equal(entries[2].kind, "assistant");
});

test("filterByKinds excludes unwanted kinds", () => {
  const entries: TranscriptEntry[] = parseTranscript(SAMPLE);
  const onlyPromptsAndTools = filterByKinds(entries, ["prompt", "tool"]);
  assert.equal(onlyPromptsAndTools.length, 2);
  assert.ok(!onlyPromptsAndTools.some((e) => e.kind === "assistant"));
});
```

- [ ] **Step 2: Run — expect failure**

```bash
bun run test -- tests/animations/transcript.test.ts
```
Expected: FAIL — `Cannot find module '.../transcript.ts'`.

- [ ] **Step 3: Implement the module**

Create `src/lib/animations/transcript.ts`:

```typescript
export type TranscriptEntry =
  | { cursor: number; ts: string; kind: "prompt"; content: string }
  | { cursor: number; ts: string; kind: "assistant"; content: string }
  | {
      cursor: number;
      ts: string;
      kind: "tool";
      tool: string;
      input: unknown;
      output: unknown;
    };

export type TranscriptKind = TranscriptEntry["kind"];

export function parseTranscript(jsonlText: string): TranscriptEntry[] {
  return jsonlText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TranscriptEntry);
}

export function filterByKinds(
  entries: TranscriptEntry[],
  kinds: TranscriptKind[],
): TranscriptEntry[] {
  const allow = new Set(kinds);
  return entries.filter((e) => allow.has(e.kind));
}

export function findEntryAtCursor(
  entries: TranscriptEntry[],
  cursor: number,
): TranscriptEntry | undefined {
  return entries.find((e) => e.cursor === cursor);
}
```

- [ ] **Step 4: Write the fixture loader**

Create `src/lib/animations/load-fixture.ts`:

```typescript
import { readFileSync } from "node:fs";
import { parseTranscript, type TranscriptEntry } from "./transcript.ts";

export interface FixtureChapter {
  cursor_index: number;
  label: string;
  description?: string;
}

export interface LoadedFixture {
  transcript: TranscriptEntry[];
  chapters: FixtureChapter[];
}

export function loadFixture(slug: string): LoadedFixture {
  const base = `src/fixtures/animations/${slug}`;
  const transcript = parseTranscript(
    readFileSync(`${base}/transcript.jsonl`, "utf8"),
  );
  const chapters = JSON.parse(
    readFileSync(`${base}/chapters.json`, "utf8"),
  ) as FixtureChapter[];
  return { transcript, chapters };
}
```

- [ ] **Step 5: Re-run test**

```bash
bun run test -- tests/animations/transcript.test.ts
```
Expected: PASS × 2.

- [ ] **Step 6: Commit**

```bash
git add src/lib/animations/ tests/animations/transcript.test.ts
git commit -m "feat(animations): add transcript parser + fixture loader

Co-Authored-By: deathemperor <loc.truongh@gmail.com>"
```

---

## Task 7: Entry-label helper + test

**Files:**
- Create: `src/lib/animations/render-entry.ts`
- Test: `tests/animations/raw-viewer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/animations/raw-viewer.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderEntryLabel } from "../../src/lib/animations/render-entry.ts";

test("renderEntryLabel formats tool entries with tool + first arg", () => {
  const label = renderEntryLabel({
    cursor: 3,
    ts: "2026-04-16T09:00:00Z",
    kind: "tool",
    tool: "Edit",
    input: { file_path: "src/animations/placeholder/index.astro" },
    output: {},
  });
  assert.match(label, /Edit/);
  assert.match(label, /placeholder\/index\.astro/);
});

test("renderEntryLabel formats prompts with first 60 chars", () => {
  const label = renderEntryLabel({
    cursor: 0,
    ts: "2026-04-16T09:00:00Z",
    kind: "prompt",
    content: "Build a simple spinning snitch animation for the Quidditch playground placeholder.",
  });
  assert.match(label, /prompt/i);
  assert.match(label, /Build a simple spinning/);
});

test("renderEntryLabel formats assistant messages with kind prefix", () => {
  const label = renderEntryLabel({
    cursor: 3,
    ts: "2026-04-16T09:00:00Z",
    kind: "assistant",
    content: "Initial static snitch rendered. Adding orbit animation next.",
  });
  assert.match(label, /assistant/i);
  assert.match(label, /Initial static snitch/);
});
```

- [ ] **Step 2: Run — expect failure**

```bash
bun run test -- tests/animations/raw-viewer.test.ts
```
Expected: FAIL — missing module.

- [ ] **Step 3: Implement the helper**

Create `src/lib/animations/render-entry.ts`:

```typescript
import type { TranscriptEntry } from "./transcript.ts";

export function renderEntryLabel(entry: TranscriptEntry): string {
  switch (entry.kind) {
    case "prompt":
      return `prompt · ${truncate(entry.content, 60)}`;
    case "assistant":
      return `assistant · ${truncate(entry.content, 60)}`;
    case "tool": {
      const firstArg = firstScalarArg(entry.input);
      return firstArg ? `${entry.tool} · ${firstArg}` : entry.tool;
    }
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function firstScalarArg(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  for (const v of Object.values(input as Record<string, unknown>)) {
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
  }
  return undefined;
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
bun run test -- tests/animations/raw-viewer.test.ts
```
Expected: PASS × 3.

- [ ] **Step 5: Commit**

```bash
git add src/lib/animations/render-entry.ts tests/animations/raw-viewer.test.ts
git commit -m "feat(animations): add renderEntryLabel helper

Co-Authored-By: deathemperor <loc.truongh@gmail.com>"
```

---

## Task 8: Raw viewer server component

**Files:**
- Create: `src/components/animations/RawViewer.astro`

- [ ] **Step 1: Write the component**

Create `src/components/animations/RawViewer.astro`:

```astro
---
import type { TranscriptEntry } from "../../lib/animations/transcript.ts";
import type { FixtureChapter } from "../../lib/animations/load-fixture.ts";
import { renderEntryLabel } from "../../lib/animations/render-entry.ts";

interface Props {
  transcript: TranscriptEntry[];
  chapters: FixtureChapter[];
}

const { transcript, chapters } = Astro.props;
const chaptersByIndex = new Map(chapters.map((c) => [c.cursor_index, c]));
---

<section class="raw-viewer" aria-label="Build session transcript">
  <nav class="chapters" aria-label="Chapters">
    <h2>Chapters</h2>
    <ol>
      {chapters.map((ch) => (
        <li>
          <a href={`#cursor-${ch.cursor_index}`} data-cursor={ch.cursor_index}>
            <span class="label">{ch.label}</span>
            {ch.description && <span class="desc">{ch.description}</span>}
          </a>
        </li>
      ))}
    </ol>
  </nav>

  <ol class="stream" role="list">
    {transcript.map((entry) => {
      const chapter = chaptersByIndex.get(entry.cursor);
      return (
        <li
          id={`cursor-${entry.cursor}`}
          class:list={["entry", `kind-${entry.kind}`, chapter && "has-chapter"]}
          data-cursor={entry.cursor}
        >
          {chapter && (
            <div class="chapter-marker" aria-label={`Chapter: ${chapter.label}`}>
              ▸ {chapter.label}
            </div>
          )}
          <details>
            <summary>
              <span class="cursor">#{entry.cursor}</span>
              <span class="label">{renderEntryLabel(entry)}</span>
              <time class="ts">{entry.ts}</time>
            </summary>
            <pre class="body">{JSON.stringify(entry, null, 2)}</pre>
          </details>
        </li>
      );
    })}
  </ol>
</section>

<style>
  .raw-viewer {
    display: grid;
    grid-template-columns: minmax(200px, 260px) 1fr;
    gap: 2rem;
    font-family: var(--mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: 0.8125rem;
    color: var(--text, #f7f8f8);
  }

  .chapters { position: sticky; top: 2rem; align-self: start; }
  .chapters h2 {
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--muted, #62666d);
    margin: 0 0 0.75rem;
  }
  .chapters ol { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
  .chapters a {
    display: block;
    color: var(--secondary, #8a8f98);
    text-decoration: none;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--border, rgba(255, 255, 255, 0.06));
  }
  .chapters a:hover,
  .chapters a[aria-current="true"] {
    border-color: var(--accent, #5e6ad2);
    color: var(--text, #f7f8f8);
  }
  .chapters .label { display: block; font-weight: 500; }
  .chapters .desc { display: block; font-size: 0.75rem; color: var(--muted, #62666d); margin-top: 0.25rem; }

  .stream { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.25rem; }

  .entry {
    border-left: 2px solid transparent;
    padding-left: 0.75rem;
    scroll-margin-top: 2rem;
  }
  .entry.is-current {
    border-left-color: var(--accent, #5e6ad2);
    background: rgba(94, 106, 210, 0.08);
  }

  .chapter-marker { margin: 1rem 0 0.25rem; color: var(--accent, #5e6ad2); font-weight: 500; }

  details > summary {
    cursor: pointer;
    display: grid;
    grid-template-columns: 3em 1fr auto;
    gap: 0.75rem;
    align-items: baseline;
    padding: 0.3rem 0;
  }
  .cursor { color: var(--muted, #62666d); }
  .ts { color: var(--muted, #62666d); font-size: 0.6875rem; }
  .body {
    margin: 0.25rem 0 0.5rem;
    padding: 0.75rem;
    background: var(--elevated, #141516);
    border-radius: 6px;
    overflow-x: auto;
    color: var(--secondary, #8a8f98);
  }

  .kind-prompt .label::before { content: "▸ "; color: var(--accent, #5e6ad2); }
  .kind-assistant .label::before { content: "◂ "; color: var(--muted, #62666d); }

  @media (max-width: 768px) {
    .raw-viewer { grid-template-columns: 1fr; }
    .chapters { position: static; }
  }
</style>

<script>
  import "./raw-viewer-client.ts";
</script>
```

- [ ] **Step 2: Typecheck**

```bash
bun run typecheck
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/animations/RawViewer.astro
git commit -m "feat(animations): raw transcript viewer server component

Co-Authored-By: deathemperor <loc.truongh@gmail.com>"
```

---

## Task 9: Raw viewer client scrubber

**Files:**
- Create: `src/components/animations/raw-viewer-client.ts`

- [ ] **Step 1: Write the client script**

Create `src/components/animations/raw-viewer-client.ts`:

```typescript
// Client-side scrubber for RawViewer.astro.
// Keeps the URL hash (#cursor-N) in sync with the current selection,
// supports arrow-key navigation, and highlights the chapter whose
// cursor_index is the most recent <= current cursor.

function init(): void {
  const viewer = document.querySelector<HTMLElement>(".raw-viewer");
  if (!viewer) return;

  const entries = Array.from(viewer.querySelectorAll<HTMLElement>(".entry"));
  const chapterLinks = Array.from(
    viewer.querySelectorAll<HTMLAnchorElement>(".chapters a"),
  );
  if (entries.length === 0) return;

  const cursorFromHash = (): number => {
    const m = /#cursor-(\d+)/.exec(window.location.hash);
    return m ? parseInt(m[1], 10) : 0;
  };

  const setCurrent = (cursor: number): void => {
    for (const e of entries) {
      e.classList.toggle("is-current", Number(e.dataset.cursor) === cursor);
    }

    const chapterCursors = chapterLinks
      .map((a) => Number(a.dataset.cursor))
      .sort((a, b) => a - b);
    const active = chapterCursors.filter((c) => c <= cursor).pop();
    for (const a of chapterLinks) {
      const isActive = Number(a.dataset.cursor) === active;
      if (isActive) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    }

    const next = `#cursor-${cursor}`;
    if (window.location.hash !== next) {
      history.replaceState(null, "", next);
    }
  };

  const step = (delta: number): void => {
    const current = cursorFromHash();
    const max = entries.length - 1;
    const next = Math.max(0, Math.min(max, current + delta));
    const el = viewer.querySelector<HTMLElement>(`#cursor-${next}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setCurrent(next);
  };

  window.addEventListener("hashchange", () => setCurrent(cursorFromHash()));

  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.target && (e.target as HTMLElement).closest("input,textarea,select")) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      step(-1);
    }
  });

  setCurrent(cursorFromHash());
}

document.addEventListener("DOMContentLoaded", init);
```

- [ ] **Step 2: Typecheck**

```bash
bun run typecheck
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/animations/raw-viewer-client.ts
git commit -m "feat(animations): client-side cursor scrubber + keyboard nav

Co-Authored-By: deathemperor <loc.truongh@gmail.com>"
```

---

## Task 10: Quidditch landing page

**Files:**
- Create: `src/pages/hogwarts/quidditch/index.astro`

- [ ] **Step 1: Write the page**

Create `src/pages/hogwarts/quidditch/index.astro`:

```astro
---
export const prerender = false;

import Base from "../../../layouts/Base.astro";
import { getEmDashCollection } from "emdash";
import { getCurrentLang } from "../../../utils/lang";

const currentLang = getCurrentLang(Astro);
const isVi = currentLang === "vi";

const { entries, cacheHint } = await getEmDashCollection("animations", {
  status: "published",
});

const visible = entries
  .filter((e) => (e.data.language ?? "en") === currentLang || e.data.language == null)
  .sort((a, b) => (b.data.updatedAt ?? "").localeCompare(a.data.updatedAt ?? ""));

if (cacheHint) Astro.cache.set(cacheHint);
---

<Base
  title={isVi ? "Sân Quidditch — Pensieve" : "Quidditch Pitch — Pensieve"}
  description={isVi
    ? "Xưởng thí nghiệm web animation — mỗi sản phẩm đi kèm nhật ký dựng lại toàn bộ quá trình."
    : "A playground of web animations — each paired with a full-fidelity build diary."}
  breadcrumbs={[
    { label: "Hogwarts", href: "/" },
    { label: isVi ? "Sân Quidditch" : "Quidditch Pitch" },
  ]}
>
  <section class="pitch-hero">
    <span class="room-label">Hogwarts</span>
    <h1 class="room-title">{isVi ? "Sân Quidditch" : "Quidditch Pitch"}</h1>
    <p class="room-subtitle">
      {isVi
        ? "Mỗi animation đi kèm toàn bộ transcript Claude Code — xem lại từng prompt, từng chỉnh sửa."
        : "Each animation comes with its full Claude Code session transcript — scrub any moment in the build."}
    </p>
  </section>

  <ul class="animation-grid" role="list">
    {visible.map((anim) => (
      <li>
        <a class="anim-card" href={`/hogwarts/quidditch/${anim.id}`}>
          <div class="card-head">
            <h2>{anim.data.title}</h2>
            <span class="meta">{anim.data.status ?? "complete"}</span>
          </div>
          {anim.data.description && <p class="desc">{anim.data.description}</p>}
          {anim.data.tags && (anim.data.tags as string[]).length > 0 && (
            <div class="tags">
              {(anim.data.tags as string[]).map((t) => <span class="tag">{t}</span>)}
            </div>
          )}
        </a>
      </li>
    ))}
    {visible.length === 0 && (
      <li class="empty">
        {isVi ? "Chưa có animation nào — sớm thôi." : "No animations yet — coming soon."}
      </li>
    )}
  </ul>
</Base>

<style>
  .pitch-hero { margin: 3rem 0 2.5rem; }
  .room-label {
    display: inline-block;
    font-family: var(--mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted, #62666d);
    margin-bottom: 0.75rem;
  }
  .room-title {
    font-size: clamp(2rem, 5vw, 3rem);
    letter-spacing: -0.02em;
    margin: 0 0 0.75rem;
  }
  .room-subtitle {
    max-width: 56ch;
    color: var(--secondary, #8a8f98);
    line-height: 1.6;
  }

  .animation-grid {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }
  .anim-card {
    display: block;
    background: var(--elevated, #141516);
    border: 1px solid var(--border, rgba(255, 255, 255, 0.06));
    border-radius: 12px;
    padding: 1.25rem;
    color: inherit;
    text-decoration: none;
    transition: border-color 120ms ease, transform 120ms ease;
  }
  .anim-card:hover {
    border-color: rgba(255, 255, 255, 0.18);
    transform: translateY(-1px);
  }
  .card-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.5rem;
  }
  .card-head h2 { font-size: 1.0625rem; margin: 0; }
  .card-head .meta {
    font-family: var(--mono, ui-monospace);
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted, #62666d);
  }
  .desc { color: var(--secondary, #8a8f98); margin: 0 0 0.75rem; font-size: 0.9375rem; }
  .tags { display: flex; flex-wrap: wrap; gap: 0.375rem; }
  .tag {
    font-family: var(--mono, ui-monospace);
    font-size: 0.6875rem;
    padding: 0.15rem 0.5rem;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 999px;
    color: var(--secondary, #8a8f98);
  }
  .empty {
    padding: 2rem;
    text-align: center;
    color: var(--muted, #62666d);
    border: 1px dashed var(--border, rgba(255, 255, 255, 0.06));
    border-radius: 12px;
  }
</style>
```

- [ ] **Step 2: Typecheck**

```bash
bun run typecheck
```
Expected: 0 errors.

- [ ] **Step 3: Visual check**

```bash
bun run dev
```
Navigate to `http://localhost:4321/hogwarts/quidditch/`. Expected: one `Placeholder — Spinning Snitch` tile. Kill dev server.

- [ ] **Step 4: Commit**

```bash
git add src/pages/hogwarts/quidditch/index.astro
git commit -m "feat(pages): Quidditch Pitch landing page

Co-Authored-By: deathemperor <loc.truongh@gmail.com>"
```

---

## Task 11: Per-animation page (hero + raw viewer)

**Files:**
- Create: `src/pages/hogwarts/quidditch/[slug].astro`

- [ ] **Step 1: Write the page**

Create `src/pages/hogwarts/quidditch/[slug].astro`:

```astro
---
export const prerender = false;

import Base from "../../../layouts/Base.astro";
import { getEmDashEntry } from "emdash";
import { getCurrentLang } from "../../../utils/lang";
import { loadFixture } from "../../../lib/animations/load-fixture.ts";
import RawViewer from "../../../components/animations/RawViewer.astro";

import PlaceholderHero from "../../../animations/placeholder/index.astro";

const { slug } = Astro.params;
if (!slug) return Astro.redirect("/hogwarts/quidditch/");

const currentLang = getCurrentLang(Astro);
const isVi = currentLang === "vi";

const { entry, cacheHint } = await getEmDashEntry("animations", slug);
if (!entry) return new Response("Not Found", { status: 404 });
if (cacheHint) Astro.cache.set(cacheHint);

// Plan A: load transcript/chapters from the on-disk fixture for this slug.
// Plan B replaces this with an R2 fetch keyed on entry.data.primary_session_id.
const fixture = loadFixture(slug);

// Hero component registry — explicit map. Astro can't dynamically import
// user-authored components from a runtime-computed path while keeping
// tree-shaking correct.
const HERO_COMPONENTS = {
  placeholder: PlaceholderHero,
} as const;

const Hero = (HERO_COMPONENTS as Record<string, typeof PlaceholderHero>)[slug];
---

<Base
  title={`${entry.data.title} — Quidditch`}
  description={entry.data.description ?? "Animation playground artifact"}
  breadcrumbs={[
    { label: "Hogwarts", href: "/" },
    { label: isVi ? "Sân Quidditch" : "Quidditch Pitch", href: "/hogwarts/quidditch/" },
    { label: entry.data.title },
  ]}
>
  <article class="animation-page">
    <header class="anim-head">
      <h1>{entry.data.title}</h1>
      {entry.data.description && <p class="anim-desc">{entry.data.description}</p>}
    </header>

    <section class="hero-stage" aria-label="Hero animation">
      {Hero ? <Hero /> : (
        <div class="hero-missing">
          No hero component registered for slug "{slug}". Add it to
          HERO_COMPONENTS in src/pages/hogwarts/quidditch/[slug].astro.
        </div>
      )}
    </section>

    <section class="diary-section" aria-label="Build diary">
      <div class="section-head">
        <h2>{isVi ? "Nhật ký dựng" : "Build diary"}</h2>
        <p class="section-sub">
          {isVi
            ? "Toàn bộ phiên Claude Code. Dùng ← → hoặc click chapter để di chuyển."
            : "Full Claude Code session. Use ← → or click a chapter to scrub."}
        </p>
      </div>
      <RawViewer transcript={fixture.transcript} chapters={fixture.chapters} />
    </section>
  </article>
</Base>

<style>
  .animation-page { max-width: 1080px; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
  .anim-head { margin-bottom: 2rem; }
  .anim-head h1 { font-size: clamp(1.75rem, 4vw, 2.5rem); margin: 0 0 0.5rem; letter-spacing: -0.02em; }
  .anim-desc { color: var(--secondary, #8a8f98); max-width: 60ch; margin: 0; line-height: 1.6; }

  .hero-stage {
    border: 1px solid var(--border, rgba(255, 255, 255, 0.06));
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 3rem;
  }
  .hero-missing {
    padding: 3rem;
    text-align: center;
    color: var(--muted, #62666d);
    font-family: var(--mono, ui-monospace);
    font-size: 0.875rem;
  }

  .diary-section { margin-top: 2rem; }
  .section-head { margin-bottom: 1.25rem; }
  .section-head h2 { margin: 0 0 0.25rem; font-size: 1.125rem; }
  .section-sub { color: var(--muted, #62666d); margin: 0; font-size: 0.875rem; }
</style>
```

- [ ] **Step 2: Typecheck**

```bash
bun run typecheck
```
Expected: 0 errors.

- [ ] **Step 3: Visual check**

```bash
bun run dev
```
Navigate to `http://localhost:4321/hogwarts/quidditch/placeholder`. Expected: heading + spinning snitch + diary with 10-entry transcript + 5 chapters. Press `→` a few times — entries highlight; URL hash updates. Kill dev server.

- [ ] **Step 4: Commit**

```bash
git add src/pages/hogwarts/quidditch/[slug].astro
git commit -m "feat(pages): per-animation page with hero + raw viewer

Co-Authored-By: deathemperor <loc.truongh@gmail.com>"
```

---

## Task 12: Animation preview dev route

**Files:**
- Create: `src/pages/_animation-preview/[slug].astro`

**Purpose:** A bare, chrome-less route that renders only the hero animation on a dark canvas. Used by Plan B's `snap-animation.sh` for headless Chromium snapshots. Added now so the contract exists before Plan B needs it.

- [ ] **Step 1: Write the route**

Create `src/pages/_animation-preview/[slug].astro`:

```astro
---
export const prerender = false;

import PlaceholderHero from "../../animations/placeholder/index.astro";

const { slug } = Astro.params;
if (!slug) return new Response("Not Found", { status: 404 });

const HERO_COMPONENTS = {
  placeholder: PlaceholderHero,
} as const;

const Hero = (HERO_COMPONENTS as Record<string, typeof PlaceholderHero>)[slug];
if (!Hero) return new Response(`No hero for slug "${slug}"`, { status: 404 });

Astro.response.headers.set("cache-control", "no-store");
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>{slug} preview</title>
    <meta name="robots" content="noindex, nofollow" />
    <style>
      html, body { margin: 0; padding: 0; background: #08090a; height: 100vh; }
      .stage {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100vw;
        height: 100vh;
      }
      .stage > * { max-width: min(1080px, 90vw); width: 100%; }
    </style>
  </head>
  <body>
    <main class="stage">
      <Hero />
    </main>
  </body>
</html>
```

- [ ] **Step 2: Visual check**

```bash
bun run dev
```
Navigate to `http://localhost:4321/_animation-preview/placeholder`. Expected: dark viewport with centered snitch, no navigation chrome. Kill dev server.

- [ ] **Step 3: Commit**

```bash
git add src/pages/_animation-preview/[slug].astro
git commit -m "feat(pages): bare dev preview route for animation snapshots

Co-Authored-By: deathemperor <loc.truongh@gmail.com>"
```

---

## Task 13: Site routes + index tile flip

**Files:**
- Modify: `src/data/site-routes.json`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Update site routes**

Edit `src/data/site-routes.json`. Inside `static`, insert the Quidditch entry between `/hogwarts/library` and `/Trương`:

```jsonc
{ "path": "/hogwarts/library", "title": "The Library", "priority": "0.7" },
{ "path": "/hogwarts/quidditch/", "title": "Quidditch Pitch", "priority": "0.7" },
{ "path": "/Trương", "title": "Trương Hữu Lộc — About", "priority": "0.8" }
```

Inside `collections`, add:

```jsonc
"collections": {
  "posts": { "basePath": "/pensieve/memories", "priority": "0.7" },
  "pages": { "basePath": "/pensieve/pages", "priority": "0.5" },
  "animations": { "basePath": "/hogwarts/quidditch", "priority": "0.7" }
}
```

- [ ] **Step 2: Flip the index tile**

Open `src/pages/index.astro` and find the Quidditch Pitch block (around lines 128–142). It currently reads:

```astro
<li>
  <span class="project project-coming">
    <div>
      <div class="project-head">
        <h2 class="project-name"><svg class="project-icon" ...>...</svg>Quidditch Pitch</h2>
        <span class="project-meta">Coming soon</span>
      </div>
      <p class="project-desc">
        Playgrounds, side projects, and experiments — where ideas
        take flight before they're ready for the real world.
      </p>
    </div>
    <span class="project-arrow coming-badge">soon</span>
  </span>
</li>
```

Replace with:

```astro
<li>
  <a class="project" href="/hogwarts/quidditch/">
    <div>
      <div class="project-head">
        <h2 class="project-name"><svg class="project-icon" width="16" height="16" viewBox="0 0 32 32" aria-hidden="true"><path d="M6 28 Q6 20 12 16 Q16 13 16 8" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" /><path d="M26 28 Q26 20 20 16 Q16 13 16 8" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" /><circle cx="16" cy="5" r="3" fill="none" stroke="currentColor" stroke-width="2" /></svg>Quidditch Pitch</h2>
        <span class="project-meta">Animation playground</span>
      </div>
      <p class="project-desc">
        Web animations, each paired with a full Claude Code build
        diary — scrub through every prompt and edit.
      </p>
    </div>
    <span class="project-arrow">&rarr;</span>
  </a>
</li>
```

- [ ] **Step 3: Typecheck**

```bash
bun run typecheck
```
Expected: 0 errors.

- [ ] **Step 4: Visual check**

```bash
bun run dev
```
Navigate to `http://localhost:4321/`. The Quidditch tile should now link; the "soon" badge is gone. Visit `http://localhost:4321/sitemap.xml` and confirm `/hogwarts/quidditch/` is listed. Kill dev server.

- [ ] **Step 5: Commit**

```bash
git add src/data/site-routes.json src/pages/index.astro
git commit -m "feat(routing): activate Quidditch tile + sitemap entries

Co-Authored-By: deathemperor <loc.truongh@gmail.com>"
```

---

## Task 14: End-to-end smoke test

**Files:**
- Create: `tests/animations/e2e-smoke.test.ts`

- [ ] **Step 1: Write the smoke test**

Create `tests/animations/e2e-smoke.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const DEV_URL = "http://localhost:4321";

async function waitForServer(ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${DEV_URL}/`);
      if (r.ok) return true;
    } catch {
      // not up yet
    }
    await delay(500);
  }
  return false;
}

test(
  "landing page + per-animation page render with expected content",
  { timeout: 60_000 },
  async () => {
    const dev: ChildProcess = spawn("bun", ["run", "dev"], {
      stdio: "pipe",
      env: { ...process.env, NODE_ENV: "development" },
    });

    try {
      const up = await waitForServer(30_000);
      assert.ok(up, "dev server started within 30s");

      const landing = await fetch(`${DEV_URL}/hogwarts/quidditch/`);
      assert.equal(landing.status, 200);
      const landingHtml = await landing.text();
      assert.match(landingHtml, /Quidditch Pitch/);
      assert.match(landingHtml, /Placeholder/);

      const detail = await fetch(`${DEV_URL}/hogwarts/quidditch/placeholder`);
      assert.equal(detail.status, 200);
      const detailHtml = await detail.text();
      assert.match(detailHtml, /Placeholder/);
      assert.match(detailHtml, /raw-viewer/);
      assert.match(detailHtml, /cursor-0/);
      assert.match(detailHtml, /v1 static snitch/);

      const preview = await fetch(`${DEV_URL}/_animation-preview/placeholder`);
      assert.equal(preview.status, 200);
      const previewHtml = await preview.text();
      assert.match(previewHtml, /snitch-stage/);
      assert.doesNotMatch(
        previewHtml,
        /<nav|breadcrumb/i,
        "preview route has no chrome",
      );

      const missing = await fetch(`${DEV_URL}/hogwarts/quidditch/does-not-exist`);
      assert.equal(missing.status, 404);
    } finally {
      dev.kill("SIGINT");
      await delay(500);
    }
  },
);
```

- [ ] **Step 2: Run the test**

```bash
bun run test -- tests/animations/e2e-smoke.test.ts
```
Expected: PASS. The test boots `bun run dev`, fetches four URLs, asserts, then shuts down. Allow 30–45s.

- [ ] **Step 3: Commit**

```bash
git add tests/animations/e2e-smoke.test.ts
git commit -m "test(animations): e2e smoke for Quidditch landing + detail + preview

Co-Authored-By: deathemperor <loc.truongh@gmail.com>"
```

---

## Task 15: Lighthouse baseline documentation

**Files:**
- Modify: `tests/README.md`

- [ ] **Step 1: Run lighthouse manually**

In one terminal:
```bash
bun run dev
```

In another, run lighthouse (downloads on first use):
```bash
npx --yes lighthouse http://localhost:4321/hogwarts/quidditch/ \
  --preset=desktop \
  --only-categories=performance,accessibility,seo \
  --quiet \
  --chrome-flags="--headless" \
  --output=json \
  --output-path=./lighthouse-quidditch.json
```

Parse scores:
```bash
python3 -c "
import json
d = json.load(open('lighthouse-quidditch.json'))
for k, v in d['categories'].items():
    print(f'{k}: {round(v[\"score\"]*100)}')
"
```
Expected: `performance: ≥ 90`, `accessibility: ≥ 90`, `seo: ≥ 90`.

Kill dev server.

- [ ] **Step 2: Document the baseline**

Append to `tests/README.md`:

```markdown
## Lighthouse baselines

Phase 1 acceptance — run `bun run dev`, then:

    npx --yes lighthouse http://localhost:4321/hogwarts/quidditch/ \
      --preset=desktop \
      --only-categories=performance,accessibility,seo \
      --chrome-flags="--headless" \
      --output=json \
      --output-path=./lighthouse-quidditch.json

Targets: performance ≥ 90, accessibility ≥ 90, seo ≥ 90.
```

- [ ] **Step 3: Clean + commit**

```bash
rm -f lighthouse-quidditch.json
git add tests/README.md
git commit -m "docs(tests): document Lighthouse baseline targets for Quidditch

Co-Authored-By: deathemperor <loc.truongh@gmail.com>"
```

---

## Verification Checklist (before marking plan complete)

- [ ] `bun run typecheck` → 0 errors
- [ ] `bun run test` → all tests pass
- [ ] Manual: `bun run dev`, visit `/`, click Quidditch tile → lands on grid
- [ ] Manual: click placeholder tile → spinning snitch renders, raw viewer shows 5 chapters
- [ ] Manual: press `→` repeatedly → entries highlight in sequence, URL hash updates
- [ ] Manual: click a chapter → page scrolls to that cursor
- [ ] Manual: visit `/_animation-preview/placeholder` → bare snitch on dark canvas
- [ ] `/sitemap.xml` includes `/hogwarts/quidditch/`
- [ ] Lighthouse scores on `/hogwarts/quidditch/` ≥ 90 for perf / a11y / seo
- [ ] Three D1 tables exist in remote (`animation_sessions`, `animation_chapters`, `animation_artifact_refs`)

## Handoff to Plan B

Once this plan merges:
- `src/lib/animations/load-fixture.ts` becomes the seam that Plan B replaces with an R2-backed loader. Plan B's publish script writes to R2; Plan B's page imports `loadFromR2()` instead of `loadFixture()`.
- The `_animation-preview/[slug]` route is ready for Plan B's `snap-animation.sh` to screenshot.
- The three D1 tables are ready for Plan B's `publish-animations.ts` to insert into.
- The raw viewer scrubber UI is ready; Plan B's contribution is feeding it real data.
