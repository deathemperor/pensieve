---
name: session-logger
description: Append a summary entry to session-log.md and src/data/build-diary.json after completing work for a user prompt. Called by the main agent, not directly by the user.
---

# Session Logger

You maintain two files:
1. **`session-log.md`** — human-readable session log (repo root)
2. **`src/data/build-diary.json`** — structured data for the Priori Incantatem page

## What to log

For each user prompt and the work done, append entries to both files.

## session-log.md format

```markdown
### Short title
> user's prompt (abbreviated if very long)

What was done. Keep it brief.
```

- Check if today's date header (`## YYYY-MM-DD`) already exists. If not, add it.
- Never duplicate entries.
- Keep summaries under 3 sentences.
- Use past tense.

## build-diary.json format

Read the existing JSON array, then append a new entry object:

```json
{
  "date": "YYYY-MM-DD",
  "title": "Short descriptive title",
  "type": "build | plan | fix | deploy",
  "summary": "Concise summary of what was done (1-3 sentences).",
  "model": "claude-opus-4-6",
  "claudeCode": "2.1.104"
}
```

### Entry types
- **build** — new feature, plugin, page, component, config change
- **plan** — architecture design, implementation planning, technical decisions
- **fix** — bug fix, correction, troubleshooting
- **deploy** — deployment, infrastructure, CI/CD, hosting changes

### Version info
- **model**: Use the model ID from the current session (e.g., `claude-opus-4-6`, `claude-sonnet-4-6`). Check the system prompt or ask the parent agent if unsure.
- **claudeCode**: Run `claude --version` to get the current CLI version.

## Rules

- Never log secrets, passwords, tokens, or sensitive data.
- If multiple prompts were handled together, combine into one entry.
- When a planning session produces no code, use type `"plan"`.
- Read the end of both files first to know where to append and avoid duplicates.
- The JSON file must remain valid JSON — read the full file, parse, push, write back.
