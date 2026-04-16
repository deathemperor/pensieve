# Quidditch — Animation Playground with Full-Fidelity Build Diary

## Overview

A new section at `/hogwarts/quidditch/` where finished web animations are displayed alongside a **full-fidelity replay** of the Claude Code build session that produced them. The pedagogical promise: every tool call, every prompt, every file edit, every intermediate state is preserved — and scrubbable, so non-animators can watch the end-to-end process at any granularity they want.

Activates the "Quidditch Pitch — Coming soon" tile on the pensieve home page (`src/pages/index.astro:132`).

### The core contract

*The transcript is the artifact.* An animation without a captured Claude Code session transcript cannot be published through this pipeline by design — the teaching value is the process, not just the output. If we ever want to publish externally-authored animations, that's a separate data-model conversation (see Phase 4+ backlog).

### Design rationale — why this shape

Loc's stated advantage as a trainer rests on letting learners see **every** detail of a process. Past attempts to record build processes with any sampling (curated chapters, hook-on-edits-only, git-commit-as-frame) lost the pedagogically valuable micro-steps. This design captures **100% of the session JSONL** Claude Code already writes to `~/.claude/projects/…`, then layers optional curation (chapters, artifact pointers) *on top of* the full record. Storage is lossless; curation is a view filter.

## Architecture Overview

### Three surfaces

| Route | Purpose |
| --- | --- |
| `/hogwarts/quidditch/` | Landing: grid of animation tiles (Linear-style dark, matches site palette) |
| `/hogwarts/quidditch/[slug]` | Per-animation: live hero component at top, **Replay** panel below |
| `/hogwarts/quidditch/[slug]/raw` | Phase-1 fallback: no-frills JSONL viewer for the same session |

### Four lifecycles

1. **Authoring** — Claude builds the animation inside pensieve at `src/animations/<slug>/`. Every tool call in that session writes to `.session/animation-transcripts/<session-id>.jsonl`. Renders captured by a helper script between iterations.
2. **Publish** — `git push` triggers the existing diary hook extension: flushes transcripts to R2, metadata + chapters + artifact refs to D1.
3. **Curation** — post-build, Claude annotates chapters via CLI (`npx tsx scripts/chapter.ts`). Full transcript is untouched.
4. **Playback** — visitor opens the per-animation page; SSR returns hero + chapter list; client-side replay UI lazy-fetches JSONL on scrubber interaction.

### Stack consistency

| Concern | Pick | Rationale |
| --- | --- | --- |
| Content metadata | **EmDash collection `animations`** | Matches site pattern; visible in admin UI |
| Transcripts + renders | **R2** | Blob-scale, cheap, read-heavy |
| Sessions + chapters + artifact refs | **D1** | Structured, joinable, small |
| Capture | **`.claude/hooks/*.sh` + `.session/` buffer + pre-push flush** | Matches existing `log-plan.sh` / `log-insight.sh` / `log-doc.sh` pattern |
| Routes | **Entries in `src/data/site-routes.json`** | Sitemap + llms.txt + ai-plugin.json auto-include |

## Data Model

### EmDash collection `animations`

```yaml
fields:
  title: string            # "Snitch trail (SVG path morph)"
  description: text        # one-liner for index + meta
  tags: list<string>       # ["css", "svg", "keyframes"]
  status: select           # "wip" | "complete"
  heroComponent: string    # "src/animations/snitch-trail/index.astro"
  ogImage: image           # social card
  primarySessionId: string # which session's transcript is the public diary
```

### D1 tables

```sql
CREATE TABLE animation_sessions (
  id TEXT PRIMARY KEY,                    -- Claude Code session-id
  animation_slug TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  tool_call_count INTEGER DEFAULT 0,
  duration_ms INTEGER,
  transcript_r2_key TEXT NOT NULL,        -- "animations/<slug>/<session-id>/transcript.jsonl.gz"
  renders_manifest_r2_key TEXT,
  transcript_size_bytes INTEGER,          -- for R5 quota monitoring
  redacted INTEGER DEFAULT 0,             -- kill-switch: 1 = null out R2 key on read
  published INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE animation_chapters (
  id TEXT PRIMARY KEY,                    -- ULID
  session_id TEXT NOT NULL REFERENCES animation_sessions(id),
  cursor_index INTEGER NOT NULL,
  label TEXT NOT NULL,                    -- "v2 added easing"
  description TEXT,                       -- pedagogical note
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE animation_artifact_refs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES animation_sessions(id),
  cursor_index INTEGER NOT NULL,
  artifact_type TEXT NOT NULL,            -- "plan" | "insight" | "doc"
  artifact_id TEXT,                       -- see "Existing artifact plumbing" below
  artifact_inline_text TEXT,              -- fallback when no first-class row exists (insights today)
  created_at TEXT NOT NULL
);

CREATE INDEX idx_chapters_session ON animation_chapters(session_id, sort_order);
CREATE INDEX idx_artifact_refs_session ON animation_artifact_refs(session_id, cursor_index);
CREATE INDEX idx_sessions_slug ON animation_sessions(animation_slug, published);
```

### R2 layout

```
animations/<slug>/<session-id>/
  transcript.jsonl.gz          # full session (~400KB–1.5MB typical gzipped)
  source-history.json.gz       # reconstructed file state per cursor (sparse keyframes + diffs)
  renders/
    manifest.json              # [{ cursor_index, r2_key, width, height }, ...]
    cursor-0000047.png
    cursor-0000063.png
    ...
```

### Existing artifact plumbing (verified against current D1 + hooks)

The `animation_artifact_refs` table connects to the current diary pipeline. Observed state (as of 2026-04-16):

- **Plans** (`log-plan.sh`) — buffer to `.session/plans.jsonl`; pre-push flush writes each plan as a **separate row in `ec_diary`** with `entry_type IN ('ultraplan','plan')`. First-class referencable: `artifact_id = ec_diary.id`.
- **Insights** (`log-insight.sh`) — buffer to `.session/insights.jsonl`; pre-push flush **collapses all insights from a session into the `summary` field of that session's build entry in `ec_diary`**. Not individually addressable today. Two resolution paths:
  1. **Phase 1 approach (recommended)**: store insights as `artifact_inline_text` on `animation_artifact_refs` (no FK to ec_diary), keyed by cursor index. The insight text lives on the ref row itself. Keeps existing hook unchanged.
  2. **Phase 4+ alternative**: extend `log-insight.sh` to also write to a new `ec_insights` table with first-class rows. Retrofits the existing diary. Out of scope for MVP.
- **Docs** (`log-doc.sh`) — writes directly to `design_docs` (verified: `name=design_docs` exists in D1). First-class referencable: `artifact_id = design_docs.id`.

### Key data-model decisions

- **Chapters reference cursor indices, not timestamps** — scrubbing is deterministic and robust to re-encoding.
- **Artifact refs use `artifact_id` for first-class rows (plans, docs) and `artifact_inline_text` fallback for insights** — matches existing diary plumbing without forcing a retrofit. Exactly one of `artifact_id` or `artifact_inline_text` is populated per row.
- **`source-history.json.gz` is derived, not authored** — computed once on publish from the Edit/Write diff stream.
- **Per-animation storage budget**: ~4 MB in R2 (1 MB transcript + 1 MB source-history + ~2 MB renders). 50 animations = 200 MB, well within free tier.

## Capture Pipeline

### Hooks

| Hook | Trigger | Purpose |
| --- | --- | --- |
| `start-animation-build.sh <slug>` | Manual (Claude runs at session start) | Writes `.session/active-animation-build` marker. Without it, capture is a no-op |
| `claude-hooks/post-tool-use.sh` | Claude Code `PostToolUse` | Append `{ cursor, ts, tool, input, output, fileDiffs[] }` to `.session/animation-transcripts/<session-id>.jsonl` |
| `claude-hooks/user-prompt-submit.sh` | Claude Code `UserPromptSubmit` | Append prompt entry to same JSONL |
| `snap-animation.sh <slug>` | Manual (Claude at render-worthy moments) | **Puppeteer** headless Chromium against Astro dev-server preview route `/_animation-preview/<slug>`; PNG to `.session/animation-renders/<session-id>/cursor-<N>.png` |
| `finish-animation-build.sh <slug>` | Manual (Claude at session end) | Marks session complete, clears active marker |
| Pre-push diary hook (**extension**) | `git push` | Flushes animation transcripts alongside plans/insights/docs |

### Redaction pass (pre-R2, post-local-buffer)

- **Path normalization**: `/Users/deathemperor/…` → `<repo>/…`
- **Secret scrubbing regex**: `sk-…`, `ghp_…`, `xoxb-…`, `AKIA…`, generic `(TOKEN|KEY|SECRET|PASSWORD)=…` env-var assignments
- **`.env*` content blocklist**: any Read/Bash output containing `.env*` contents is replaced with `[REDACTED:env-contents]`
- **File-body allowlist**: file contents surface in transcripts only for `src/animations/**`, `public/**`, and `*.md` / `*.txt` in the repo. Other file reads succeed during the session but are marked `[REDACTED:file-out-of-scope]` in the published form.
- **Visible markers**: redactions always leave `[REDACTED:<reason>]` so learners know the record is complete and a thing was there.

The raw `.session/` buffer stays local (gitignored); only the redacted form ever lands in R2.

### Source-history computation (on publish)

1. Walk the JSONL, apply each Edit/Write op to a virtual FS scoped to `src/animations/<slug>/`
2. Store file state as JSON patches against the previous cursor (RFC 6902)
3. **Sparse keyframes**: every 50 cursors, store a full snapshot; diffs between
4. **Checksum checkpoint**: hash reconstructed state at each keyframe against a hash captured by the `PostToolUse` hook at the corresponding tool-call boundary. Mismatch aborts publish.
5. Gzip and upload to R2

### Chapter annotation CLI

```
npx tsx scripts/chapter.ts add \
  --session <id> --at <cursor> \
  --label "v2 added easing" \
  --note "Switched from linear to cubic-bezier(0.34, 1.56, 0.64, 1)..."
```

Also supports: `list`, `edit`, `remove`, `reorder`, and `--auto` mode that proposes chapter boundaries at detected inflection points (first render after a Write, first successful run after errors, tool-call rate cluster boundaries).

### Idempotency + safety

- Hooks use `flock` on the buffer file; `set -euo pipefail`
- Publish is idempotent (D1 upsert on session id; R2 keys include content hashes)
- Hook errors log to `.session/hook-errors.log` and block push until resolved
- `finish-animation-build.sh` validates cursor-count continuity before marking session complete

## Replay UI

### State model

Single atom: `{ cursor: int, playing: bool, speed: number, filters: {...} }`. Every pane is a pure function of this state. URL-synced: `/hogwarts/quidditch/<slug>?cursor=127&chapter=v2-easing`.

### Desktop layout (≥ 1024px)

```
┌─────────────────────────────────┬───────────────────────────┐
│  1. CONVERSATION                │  3. CODE STATE            │
│  (transcript ↑ to cursor)       │  (Shiki HL, file tabs,    │
│                                 │   diff badges)            │
├─────────────────────────────────┼───────────────────────────┤
│                                 │  4. LIVE RENDER           │
│                                 │  (sandboxed iframe;       │
│                                 │   PNG fallback)           │
├─────────────────────────────────┴───────────────────────────┤
│  2. TOOL TIMELINE                                           │
│  ● ● ● ● ●  ▲"v1 static"  ● ● ● ●  ▲"v2 easing"             │
│  [◂◂] [▶] [▸▸]  speed: 1x  ▢ reads  ▣ edits  ▣ bash         │
└──────────────────────────────────────────────────────────────┘
```

Mobile (< 768px): panes stack vertically — conversation → code → render — timeline pinned to viewport bottom. Swipe steps cursor.

### Pane behavior

- **Conversation**: filter pills (`all` / `prompts` / `edits+writes` / `bash` / `agent`); reads/greps hidden by default. Tool calls as collapsible `<details>`.
- **Tool Timeline**: native `<input type="range">` styled over a color-coded dot strip. Chapter markers as vertical gridlines with rotated labels. Artifact markers (📋 💡 📄) below the strip, click opens drawer.
- **Code State**: file tabs, Shiki-highlighted, SSR for cursor=0, client-swap on scrub. `d` toggles diff view.
- **Live Render**: `<iframe sandbox="allow-scripts" srcdoc={reconstructedHTML}>`. Fallback to nearest PNG if source is syntactically broken at this cursor. "Pin render" freezes pane while scrubbing elsewhere.
- **Chapter rail** (left-side collapsible): click = jump. `n`/`p` = next/prev.
- **Artifact drawer** (right-side slide-in): triggers when cursor crosses a plan/insight/doc marker; full content inline + "Open in source" link.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `←` / `→` | step cursor |
| `Shift+←/→` | prev / next chapter |
| `Space` | play / pause |
| `,` / `.` | speed down / up |
| `R` | jump to latest cursor |
| `T` | cycle code tabs |
| `D` | toggle diff view |
| `F` | focus filter input |
| `?` | show shortcut overlay |

### Performance budget

- Initial SSR payload: ≤ 60 KB JS + ≤ 30 KB CSS + HTML for hero, chapter list, cursor-0 code/render
- Scrub response: < 50 ms to any cursor on a 5-year-old MacBook (sparse keyframes make this viable)
- Transcript fetch: lazy on first scrub interaction; progressive activation after first 100 entries
- PNGs: `loading="lazy"` + IntersectionObserver

### Security boundary

- Iframe `sandbox="allow-scripts"` only — no `allow-same-origin`, no `allow-top-navigation`, no `allow-forms`
- CSP in `srcdoc`: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:;` — blocks network egress
- All non-iframe transcript text rendered via **DOMPurify** (no raw `innerHTML`)
- Pen-test case in the test suite: transcript containing `<script>window.parent.postMessage('owned')` must fail to reach parent

### Accessibility

- `prefers-reduced-motion`: auto-play disabled, scrub without interpolation, transitions instant
- ARIA live region announces cursor changes ("cursor 127 of 312, chapter 2 of 5: v2 easing, tool: Edit")
- Focus visible on all interactive elements; tab order flows top-to-bottom, left-to-right
- All controls keyboard-operable; no drag-only interactions

## Phased Milestones

### Phase 1 — Scaffold + capture + raw viewer

**Goal**: prove the pipeline end-to-end. Ugly but complete.

Ships: landing page, per-animation page with raw JSONL viewer, EmDash collection, D1 migrations, R2 binding, all capture hooks, pre-push hook extension, redaction pass with tests, `snap-animation.sh`, chapter CLI, source-history computation with checksum checkpoints, one placeholder animation, site-routes.json update, Quidditch tile on index switches from coming-soon to live.

Acceptance:
- [ ] Fresh clone runs `npm run dev` end-to-end
- [ ] Test session captures → `git push` → data lives in D1/R2 → page renders
- [ ] Redaction tests pass with a fake-secret corpus
- [ ] Lighthouse ≥ 90 on landing
- [ ] Iframe sandbox verified (pen-test case)
- [ ] Sitemap + llms.txt include new routes

### Phase 2 — First real recording

**Recommended**: "Snitch trail (SVG path morph + CSS)" — visually strong, scope-manageable, lore-appropriate.

Ships: `src/animations/snitch-trail/` built *on camera* via Phase 1 hooks; internal brainstorm + plan captured in the same session (meta-honest — learners watch the design process); chapters annotated post-build; plans/insights/docs logged throughout; `git push` publishes.

Acceptance:
- [ ] Snitch trail hero renders smoothly
- [ ] Raw viewer has the full transcript (every tool call)
- [ ] Chapters meaningful (5–10 telling the story)
- [ ] Artifact refs wire up correctly
- [ ] No redaction false positives; no leaks
- [ ] Short retrospective doc (`docs/superpowers/specs/<date>-phase1-viewer-retro.md`) capturing what Phase 1's raw viewer got wrong — informs Phase 3 design

### Phase 3 — Polish into four-pane replay

Designed against **real** Phase 2 transcript data, not hypothetical shapes.

Ships: four panes wired to single cursor atom; scrubber with chapter gridlines + artifact markers + filter pills + transport; URL cursor sync; sparse-keyframe reconstruction (< 50 ms scrub); lazy transcript fetch; full keyboard set + `?` overlay; mobile stacked layout with swipe; a11y pass; iframe hardening + DOMPurify; learning-mode contribution points (filter defaults, chapter granularity contract).

Acceptance:
- [ ] Four panes stay synced under every interaction path
- [ ] Scrub < 50 ms to any cursor
- [ ] Lighthouse a11y ≥ 95, perf ≥ 90
- [ ] Snitch-trail playback in new UI subjectively + measurably better than raw viewer
- [ ] Iframe escape / XSS pen-tests pass

### Between-phase gates

- **Phase 1 → 2**: merge, deploy, smoke-test placeholder. Only then start Phase 2.
- **Phase 2 → 3**: complete Snitch trail; write retrospective; *then* design four-pane implementation details.

## Out of Scope (MVP)

Explicit non-goals. Each of these challenges either a design assumption or execution focus:

- **No EmDash admin UI for chapters** — CLI is sufficient
- **No animation search, tag browser, cross-animation compare**
- **No "remix"/editable forks** — breaks the "transcript is the artifact" contract
- **No video export of the scrub**
- **No live/streaming recording** — all playback is post-hoc
- **No non-Claude-Code authoring** — hand-coded animations can't publish here by design

## Phase 4+ Backlog

Each item gets its own brainstorm → spec → plan → implement cycle. None moves forward without that gate.

1. **Discovery** (Phase 4) — search, tag browser, cross-animation compare. Purely additive over Phase 3's data model.
2. **Video export** (Phase 5) — headless-render the scrub to MP4/GIF for social shares; Worker-side ffmpeg job.
3. **EmDash admin UI for chapters** (Phase 6) — graduates the CLI to a web form. Only if the CLI becomes friction.
4. **Remix / editable forks** (philosophical gate) — challenges the "transcript is artifact" contract. Three viable data-model options (diverging fork, inherited+continuation, transcript-less copy) each with trade-offs. Defer until post-MVP data on what remixing means to learners.
5. **Non-Claude authoring** (philosophical gate) — for imported or hand-coded animations. Options: no-diary import, retroactive pseudo-transcript from git history, or a separate collection type. Wants its own brainstorm.
6. **Live streaming recording** (philosophical gate) — scrubbing a session that hasn't ended yet is an unsolved UX problem. Defer until the novelty case is understood after several post-hoc replays ship.

## Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| R1 | Secret leakage in published transcripts | Medium | **Critical** | Redaction with unit tests; `.env*` blocklist; file allowlist; **manual review gate on first 3 publishes**; kill-switch via `animation_sessions.redacted` |
| R2 | Iframe escape / XSS via transcript content | Low | High | `sandbox="allow-scripts"` only; CSP in `srcdoc`; DOMPurify on all non-iframe transcript text; pen-test case in tests |
| R3 | Transcript size blows R2 / bundle budget | Medium | Medium | Gzip in R2; lazy-fetch on interaction; sparse keyframes bound reconstruction; warn-at-20MB threshold |
| R4 | Hook failures silently drop data | Medium | High | `flock` + `set -euo pipefail`; errors logged to `.session/hook-errors.log`; pre-push blocks on errors; cursor-continuity validation on finish |
| R5 | Redaction false positives destroy pedagogy | Medium | Medium | Visible `[REDACTED:…]` markers; positive-case unit tests; human scan post-publish |
| R6 | Source-history drifts from actual file state | Low | High | Checksum checkpoints at every sparse keyframe; publish aborts on mismatch |
| R7 | Orphaned renders in R2 | Low | Low | Prefix-keyed blobs; `scripts/animation-gc.ts` prunes unpublished sessions > 30 days |
| R8 | Curator burnout (sessions ship unchaptered) | Medium | Medium | Chapters optional; raw viewer works without them; `--auto` mode in chapter CLI proposes boundaries |
| R9 | Scope creep from Phase 4+ backlog | Medium | Medium | Out-of-scope table is authoritative; each item gated by its own brainstorm |
| R10 | Astro + iframe `srcdoc` hydration mismatch | Low | Medium | `snap-animation.sh` uses the prod iframe+CSP pipeline — if it snaps locally, it renders in prod |

### The two risks to watch closest

- **R1 (secret leakage)** is a one-way door. Everything else is recoverable; a published secret isn't. The first-3-publishes manual review exists to tune redaction patterns while stakes are low.
- **R6 (source-history drift)** silently undermines the product promise if it fails. Checksum checkpoints make silent corruption loud.

## References

- Existing precedent: `docs/superpowers/specs/2026-04-14-hogwarts-library-design.md` (sub-page under `/hogwarts/`)
- Existing hook pattern: `.claude/hooks/log-plan.sh`, `log-insight.sh`, `log-doc.sh` (CLAUDE.md)
- Existing Quidditch tile: `src/pages/index.astro:132` (currently "coming soon")
- Existing routes manifest: `src/data/site-routes.json`
- Research source: session-transcripts at `~/.claude/projects/-Users-deathemperor-death-pensieve/*.jsonl` (already-captured raw material — this spec surfaces and publishes them, doesn't invent new capture)
- Security library recommendation: DOMPurify for XSS sanitation (per secure-by-default guidance)
- Open-source replay-tool research conclusion: rrweb, Motion Canvas, and similar tools are the wrong shape for *iteration-based* replay (they're for continuous session replay or animation authoring). DIY (iframed `srcdoc` + sparse-keyframe source history + four-pane cursor UI) is the right fit given the EmDash + Cloudflare stack.
