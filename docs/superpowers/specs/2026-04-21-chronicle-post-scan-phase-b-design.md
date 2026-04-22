# Chronicle Post-Scan — Phase B Design

- **Date**: 2026-04-21
- **Status**: Approved scope, shipping as CLI (v2: upgrade to EmDash save-hook)
- **Precedes**: `2026-04-21-celestial-chronicle-design.md` (§4.2)

## Scope trim from spec

The parent spec (§4.2) specified a real **EmDash content hook on post save/publish**. For v1 of Phase B, we ship a **CLI scanner** instead: `npx tsx scripts/chronicle-scan-posts.ts`. Same regex, same safeguards, same output (draft Chronicle candidates), but triggered on demand rather than auto-fired on save.

**Why the trim:** EmDash's plugin hook system requires familiarity with sandboxed plugin runtime, capability grants, and save-lifecycle event types. Building the CLI first validates the date-extraction logic end-to-end; converting to a hook is mechanical once the logic is proven.

## Deliverables

1. `src/utils/dateExtract.ts` — pure function. Parses a plain-text blob + optional locale, returns a list of `{ isoDate, precision, context_snippet, match_offset }`. No side effects.
2. `tests/utils/dateExtract.test.ts` — unit tests for each pattern, quote-skipping, future-date filtering, calendar-invalid filtering.
3. `scripts/chronicle-scan-posts.ts` — CLI entry. Reads published posts from the local `data.db`, flattens each post's Portable Text to text, runs the extractor, prints draft Chronicle candidates (JSON, one per line) that an admin can copy into `seed/seed.json` or into EmDash admin.

## Regex patterns (in priority order)

| Pattern | Example | Precision |
|---|---|---|
| `\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b` | `14/12/2021` | day (VN-style primary) |
| `\b(\d{4})-(\d{2})-(\d{2})\b` | `2021-12-14` | day (ISO) |
| `\btháng\s*(\d{1,2})(?:\s+năm)?\s*(\d{4})\b` | `tháng 5 năm 2015` or `tháng 5/2015` | month (VN) |
| `\b(January\|February\|…\|December)\s+(\d{4})\b` | `May 2015` | month (EN) |

Year-only mentions (`in 2018`) are intentionally **not** auto-extracted — too noisy.

## Safeguards

- **Skip quoted text**: Portable Text blocks with `style === "blockquote"` are excluded from scanning. Inline marked spans within a non-quote block stay eligible — only block-level quotes are excluded.
- **Skip future dates**: compare to today at UTC midnight; any match strictly in the future is dropped.
- **Validate calendar**: use the same `Date.UTC(y, m-1, d)` round-trip that `formatRomanDate` uses — Feb 30, Apr 31, etc. are dropped.
- **Dedupe within a single scan**: if the same `(isoDate, precision, post_id)` matches multiple patterns, keep only the first.
- **Context snippet**: 60 characters centered on the match, whitespace-collapsed.

## Output shape (one JSON object per line, to stdout)

```json
{"post_id":"<post-slug>","post_title":"<title>","iso_date":"2018-03-31","precision":"day","context":"…birthday at Old Trafford, United won 2-0…","suggested_category":"milestone","suggested_entry":{"title":"…auto-suggested from context…","event_date":"2018-03-31","date_precision":"day","source":"post-scan","source_id":"<post-slug>","status":"draft"}}
```

An admin reviews stdout, copies meaningful lines into `seed/seed.json` or submits via EmDash admin.

## Non-goals for Phase B v1

- Auto-create database rows — scanning is read-only. The admin stays in the loop.
- Hook into the EmDash save pipeline — deferred to v2.
- Parse partial-year-only dates or ambiguous "summer 2015" — too noisy; punted.
- Handle multi-sentence context spans — a single 60-char window is enough.
- i18n of the category suggestion — always "milestone" in v1; admin refines at review time.

## Conventions

- Regex matching uses `str.match(RE)` — project rule flagged by security hook.
- Tests via `node:test` + `node:assert/strict`.
- CLI uses `execFileSync` with arg-array form (no template strings).
- No new npm deps; everything from the stdlib.
