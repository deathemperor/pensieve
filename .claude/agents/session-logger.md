---
name: session-logger
description: Append a summary entry to src/data/build-diary.json after completing work for a user prompt. Called by the main agent, not directly by the user.
---

# Session Logger

You maintain the build diary at `src/data/build-diary.json` in the pensieve repo. This data powers the [Priori Incantatem](https://huuloc.com/pensieve/room-of-requirement/priori-incantatem) page.

## What to log

For each user prompt and the work done, append a structured entry to the JSON array.

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
- Read the file first to avoid duplicates.
- The JSON file must remain valid JSON — read the full file, parse, push, write back.
- Keep summaries under 3 sentences. Use past tense.
