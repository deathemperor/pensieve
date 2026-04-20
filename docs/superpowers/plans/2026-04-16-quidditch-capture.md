# Quidditch Capture Pipeline (Plan B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Plan A's fixture data with a real full-fidelity capture pipeline — Claude Code session transcripts, renders, and artifact refs get published to R2 + D1 on `git push`, and the Quidditch per-animation page reads from them.

**Architecture:** Five new `.claude/hooks/` scripts buffer session data into `.session/animation-*` files. On `git push`, an extended pre-push hook invokes `scripts/publish-animations.ts` which runs redaction, computes source-history with checksum checkpoints, uploads to R2 under `animations/<slug>/<session-id>/`, inserts rows into `animation_sessions` / `animation_artifact_refs` in D1, and clears the buffers. The per-animation page swaps `loadFixture` for `loadFromR2` (Cloudflare R2 binding access via `locals.runtime.env.MEDIA`).

**Tech Stack:** TypeScript, Puppeteer (headless Chromium), Cloudflare R2 (binding `MEDIA`), D1 (binding `DB`, database `pensieve-db`), shell (bash + jq), `node --test` via tsx. All subprocess spawning uses the arg-array form of node:child_process (no shell-substitution risk).

**Reference spec:** `docs/superpowers/specs/2026-04-16-quidditch-animation-playground-design.md`

**Plan A prerequisite (already shipped on main):**
- D1 tables `animation_sessions`, `animation_chapters`, `animation_artifact_refs`
- EmDash `animations` collection + placeholder entry
- Per-animation page with raw viewer
- `/animation-preview/[slug]` route for snap helper
- `src/lib/animations/load-fixture.ts` — the seam Plan B replaces

**Out of scope for this plan** (deferred to Phase 3):
- Four-pane replay UI (conversation / tool timeline / code state / live render)
- Sparse-keyframe source-history optimization (MVP uses full snapshots per edit)
- Iframe sandbox + CSP + DOMPurify integration
- Render-snapshot playback in the UI (PNGs captured but not displayed in Plan B)

---

## File Structure

**Created:**
- `.claude/hooks/start-animation-build.sh` — session marker
- `.claude/hooks/post-tool-use-animation.sh` — PostToolUse capture
- `.claude/hooks/user-prompt-submit-animation.sh` — UserPromptSubmit capture
- `.claude/hooks/snap-animation.sh` — Puppeteer render helper (wrapper)
- `.claude/hooks/finish-animation-build.sh` — session seal
- `scripts/redact-transcript.ts` — secret scrubbing + path normalization
- `scripts/source-history.ts` — build file-state per cursor with checksum checkpoints
- `scripts/publish-animations.ts` — orchestrator (buffer → redact → source-history → R2 → D1)
- `scripts/snap-animation.ts` — Puppeteer worker invoked by the shell wrapper
- `scripts/chapter.ts` — chapter annotation CLI
- `src/lib/animations/load-from-r2.ts` — R2-backed transcript loader
- `tests/animations/redact.test.ts`
- `tests/animations/source-history.test.ts`
- `tests/animations/publish.test.ts`
- `tests/animations/chapter-cli.test.ts`
- `tests/animations/capture-integration.test.ts`

**Modified:**
- `.claude/settings.json` — register animation hooks on UserPromptSubmit + PostToolUse
- `.claude/hooks/pre-push-diary.sh` — call publisher before diary block
- `src/pages/hogwarts/quidditch/[slug].astro` — swap loadFixture → loadFromR2 with fixture fallback
- `package.json` — add puppeteer

**D1 schema:** already in place from Plan A.

**R2 layout:**
```
MEDIA bucket:
  animations/<slug>/<session-id>/
    transcript.jsonl.gz
    source-history.json.gz
    renders/
      manifest.json
      cursor-NNNNNNN.png
```

---

## Tasks overview

Fifteen bite-sized tasks, each with TDD cycle where applicable. Full task bodies follow the same pattern Plan A used: each task lists Files (create/modify), then numbered steps (write failing test, run, implement, run passing test, commit).

**Task 1 — Install Puppeteer.** `bun add -d puppeteer@^23.0.0`, smoke-test the import, commit.

**Task 2 — Redaction library.** `scripts/redact-transcript.ts` + `tests/animations/redact.test.ts`. Six unit tests cover: absolute-path normalization to `<repo>`, token scrubbing for `ghp_`/`sk-`/`xoxb-`/`AKIA` patterns, env-assignment scrubbing (`TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL=…`), allowlist enforcement (only `src/animations/`, `public/`, `.md`/`.txt`/`.astro`/`.ts` get their contents preserved — other file reads get `[REDACTED:env-contents]`), innocuous code passing through intact, prompt-entry normalization. Function signatures: `redactEntry(entry, opts): RawEntry` and `redactAll(entries, opts): RawEntry[]` where `RedactionOptions = { repoRoot, allowlistPrefixes, allowlistExtensions }`. Visible `[REDACTED:<reason>]` markers always.

**Task 3 — Source-history computation.** `scripts/source-history.ts` + tests. Four tests: captures file states for Write/Edit, ignores edits outside slug prefix, `reconstructStateAt` returns latest state at-or-before the cursor, checksum-mismatch throws when `verifyChecksums: true`. MVP stores full file state per cursor (not sparse keyframes) — optimization deferred. Uses `createHash('sha256')` for checkpoints. Functions: `buildSourceHistory(entries, slugPrefix, opts): SourceHistory` and `reconstructStateAt(history, cursor): Record<string, string>`. `SourceHistory = { slugPrefix, cursors: { [cursor]: { cursor, files: { [path]: content } } } }`. Edit application is a simple indexOf-based string replace; no match = state unchanged.

**Task 4 — `start-animation-build.sh` hook.** Creates `.session/active-animation-build` marker with `{slug, sessionId, startedAt}`, creates empty transcript at `.session/animation-transcripts/<sessionId>.jsonl`. Usage: `.claude/hooks/start-animation-build.sh <slug>`. Smoke-test verifies marker + empty jsonl created; clean up after.

**Task 5 — `post-tool-use-animation.sh` hook.** Reads tool event from stdin (Claude Code passes JSON), appends entry to active session's transcript with cursor=current-line-count, ts=UTC-now, kind=tool, tool/input/output extracted via jq. No-ops if no active-animation-build marker. For Write/Edit tool calls on paths under `src/animations/`, computes sha256 checksum of on-disk file and attaches as `postStateChecksum`. Uses `flock` on `.lock` sibling file to prevent torn writes under parallel Claude runs. Smoke-test: start → send fake tool event → verify one JSONL line appears; clean up.

**Task 6 — `user-prompt-submit-animation.sh` hook.** Same pattern as Task 5 but for `.prompt` field of the stdin JSON. Kind=prompt, content=prompt text. No-ops if no marker. Smoke-test in same way.

**Task 7 — Puppeteer snap worker + shell wrapper.** `scripts/snap-animation.ts` uses `puppeteer.launch({headless:true, args:['--no-sandbox','--disable-setuid-sandbox']})`, navigates to the URL, waits `networkidle0` + configurable `waitMs` (default 2000), captures viewport PNG, writes to file. `.claude/hooks/snap-animation.sh` resolves session + cursor from marker, verifies dev server is up at `http://localhost:<port>/animation-preview/<slug>`, spawns the worker via `node --import tsx` with arg-array (no shell). Output file: `.session/animation-renders/<sessionId>/cursor-<padded-cursor>.png`. Smoke-test: boot dev → start build → snap → verify PNG exists; clean up.

**Task 8 — `finish-animation-build.sh` hook.** Reads active marker, validates cursor continuity (every line's cursor = N-th 0-indexed), writes a `<sessionId>.session.json` descriptor with `{slug, sessionId, startedAt, endedAt, toolCallCount}`, removes the active marker. Blocks with exit 1 if cursor discontinuity is detected. Smoke-test: start → two mock tool calls → finish → verify descriptor; clean up.

**Task 9 — Wire `.claude/settings.json`.** Extend the existing `UserPromptSubmit` entry (matcher `""`) to also run `user-prompt-submit-animation.sh` alongside the existing `log-prompt.sh`. Add a new `PostToolUse` matcher entry with `""` (matches all tools) that runs `post-tool-use-animation.sh` — the existing `Bash`-only matcher stays untouched. Validate the JSON after editing.

**Task 10 — Publish orchestrator + tests.** `scripts/publish-animations.ts` + `tests/animations/publish.test.ts`. Two tests: `prepareSession` produces compressed artifacts + source history from redacted entries; cursor gaps throw. Exported `prepareSession({slug, sessionId, transcriptLines, repoRoot}): PreparedSession` — the `main()` entrypoint iterates `.session/animation-transcripts/*.session.json`, for each runs `prepareSession`, uploads `transcript.jsonl.gz` + `source-history.json.gz` to R2 via `wrangler r2 object put pensieve-media/<key> --file <tmp>` (using `execFileSync` with arg-array — never a shell-substitution string), uploads renders, builds manifest.json, inserts an `animation_sessions` row + `animation_artifact_refs` rows for insights in the session's time window (matched to nearest-cursor-by-timestamp), deletes the source transcript + descriptor + renders dir. Runs as the pre-push publisher.

**Task 11 — Extend `pre-push-diary.sh`.** After the early-return for non-`git push` commands, insert a block: if `.session/animation-transcripts/*.session.json` exists, `cd` to repo root and run `node --import tsx scripts/publish-animations.ts`. Exit 2 if the publisher fails — push aborts. Validate bash syntax with `bash -n`.

**Task 12 — R2-backed loader.** `src/lib/animations/load-from-r2.ts`: query D1 for the latest `published=1` session for the slug, fetch `transcript.jsonl.gz` from R2 via the `MEDIA` binding's `.get(key)` method, decompress with `DecompressionStream('gzip')` (available in Cloudflare Workers runtime), parse with the existing `parseTranscript`, fetch chapters from D1. Fallback to `loadFixture(slug)` when `env` is undefined, no session row exists, or the R2 object is missing. Exports `loadFromR2(slug, env)` with signature matching `loadFixture`'s return shape.

**Task 13 — Swap page loader.** In `src/pages/hogwarts/quidditch/[slug].astro`, change the import from `loadFixture` to `loadFromR2`, change the call to `await loadFromR2(slug, (Astro.locals as any).runtime?.env)`. Typecheck + smoke-test that `curl http://localhost:4321/hogwarts/quidditch/placeholder` still returns 200 with v1 static snitch content (fixture fallback works when no R2 data exists yet).

**Task 14 — Chapter CLI + tests.** `scripts/chapter.ts` + `tests/animations/chapter-cli.test.ts`. Two tests: `buildAddSql` properly escapes single quotes in label/description; `buildListSql` filters by session_id and orders by sort_order. Subcommands: `add --session <id> --at <cursor> --label "..." [--note "..."] [--order N]`, `list --session <id>`, `remove --id <chapter-id>`. All SQL built with the arg-array form passed to `wrangler d1 execute` (no shell interpolation).

**Task 15 — Full-pipeline integration test.** `tests/animations/capture-integration.test.ts`: drives `start → 3 post-tool-use calls → 1 user-prompt-submit → finish` by shelling into the hooks with stdin payloads, then feeds the produced transcript through `prepareSession` and asserts the resulting `toolCallCount=3`, source history has the expected file states, and compressed artifacts are non-empty. Backs up/restores any pre-existing `.session/` state so the test doesn't stomp on real work.

---

## Key design decisions (for reviewers)

- **MVP skips sparse-keyframe source-history** — full file state per edit is simpler and fine for transcripts up to ~2000 cursors. Phase 3 can retrofit keyframes if scrub latency matters.
- **Insights → artifact_refs by timestamp window** — the existing `log-insight.sh` writes `.session/insights.jsonl` with `{ts, insight}`. We match timestamp to nearest-preceding cursor and store inline via `artifact_inline_text`. No schema change, no coupling to `ec_diary`.
- **Hooks are shell scripts, not TypeScript** — matches the existing `log-*.sh` pattern, zero startup cost, plays nicely with Claude Code's hook invocation contract (stdin JSON → exit code).
- **Visible redaction markers** — `[REDACTED:<reason>]` always, never silent. Preserves learner trust.
- **Fixture fallback is permanent** — if R2 has no data for a slug, page renders the on-disk fixture. This means the placeholder keeps working forever, and new animations can be seeded as fixtures before the real session lands.
- **Publisher is idempotent at the row level** — `INSERT OR REPLACE INTO animation_sessions` on a session id. Re-running the publisher on an already-published session updates the row without dup-ing.
- **All subprocess calls use arg-array form** — `execFileSync("npx", [...])` never `execSync("npx ...")`. Enforced by the repo's security hook.

---

## Verification checklist (before marking plan complete)

- [ ] `bun run test` → all pass (Plan A's 11 + new 12 ≈ 23 tests)
- [ ] `bun run typecheck` → no new errors under `src/lib/animations/` or `scripts/`
- [ ] `bash -n .claude/hooks/*.sh` → clean on every hook script
- [ ] `python3 -m json.tool < .claude/settings.json > /dev/null` → settings.json validates
- [ ] Manual smoke: `start-animation-build → post-tool-use ×N → user-prompt-submit ×M → snap-animation → finish-animation-build → git push` (with a throwaway slug) yields rows in `animation_sessions` and objects in R2 under `animations/<slug>/<session>/`
- [ ] `curl http://localhost:4321/hogwarts/quidditch/placeholder` renders via fixture fallback when no R2 data exists
- [ ] Pre-push hook aborts the push if the publisher throws
- [ ] Redacted transcripts on R2 contain no absolute `/Users/...` paths or token patterns

## Handoff to Phase 3

Once Plan B merges:
- A recorded session lives at `/hogwarts/quidditch/<slug>` with the raw viewer reading it from R2
- The four-pane replay UI (Phase 3) builds on top of this data — it reads the same R2 transcript + source-history, adds the iframe live-render pane, tool-timeline scrubber, filter pills, sparse-keyframe optimization
- The first real animation build (e.g. Snitch trail) can happen anytime after Plan B ships — record with the hooks, annotate chapters via the CLI, push, done
