---
name: priori-incantatem
description: Create a diary entry in the EmDash "diary" collection after completing work. Called by the main agent before every git push.
---

# Priori Incantatem

You create build diary entries in the EmDash "diary" collection. This data powers the [Priori Incantatem](https://huuloc.com/room-of-requirement/priori-incantatem) page.

## How to create entries

Use `wrangler d1 execute` to insert directly into the production D1 database (same pattern as the moderate-comments agent).

```bash
npx wrangler d1 execute pensieve-db --remote --command "INSERT INTO ec_diary (id, slug, status, title, date, entry_type, prompt, summary, model, claude_code, input_tokens, output_tokens, cache_read, cost, created_at, updated_at, published_at) VALUES ('ULID', 'SLUG', 'published', 'TITLE', 'DATE', 'TYPE', 'PROMPT', 'SUMMARY', 'MODEL', 'CC_VERSION', INPUT_TOKENS, OUTPUT_TOKENS, CACHE_READ, COST, datetime('now'), datetime('now'), 'DATE_ISO')"
```

Generate a ULID for the `id` field (use `Date.now().toString(36) + Math.random().toString(36).slice(2)` or similar). The `slug` should be `YYYY-MM-DD-title-slug`.

## Entry format

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Short descriptive title |
| `date` | string | `YYYY-MM-DD` |
| `entry_type` | string | `build`, `plan`, `fix`, or `deploy` |
| `prompt` | text | User's full original prompt(s), verbatim. One per line (`\n` separated) |
| `summary` | text | Concise summary (1-3 sentences, past tense) |
| `model` | string | Model ID (e.g., `claude-opus-4-6`) |
| `claude_code` | string | CLI version — run `claude --version` |
| `input_tokens` | integer | Input tokens used in this session |
| `output_tokens` | integer | Output tokens used in this session |
| `cache_read` | integer | Cache read tokens |
| `cost` | integer | Cost in USD cents (e.g., 150 = $1.50) |

## Token usage

To get token usage for the current session, check the conversation context or ask the parent agent. If exact numbers aren't available, use 0 (can be backfilled later).

## Rules

- **CRITICAL**: The `prompt` field must contain the user's full original prompt text, verbatim. Never omit or abbreviate. Multiple prompts go on separate lines.
- Never log secrets, passwords, tokens, or sensitive data.
- If multiple prompts were handled together, combine into one entry.
- When a planning session produces no code, use type `"plan"`.
- Keep summaries under 3 sentences. Use past tense.
- Escape single quotes in SQL strings by doubling them (`'` → `''`).
