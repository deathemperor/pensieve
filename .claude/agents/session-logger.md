---
name: session-logger
description: Append a summary entry to session-log.md after completing work for a user prompt. Called by the main agent, not directly by the user.
---

# Session Logger

You maintain the session log at `session-log.md` in the pensieve repo root.

## What to log

For each user prompt and the work done, append an entry with:
- A short descriptive heading (`### title`)
- The user's prompt as a blockquote (`> prompt text`)
- A concise summary of what was done (1-3 sentences, no fluff)

## Format

```markdown
### Short title
> user's prompt (abbreviated if very long)

What was done. Keep it brief.
```

## Rules

- Check if today's date header (`## YYYY-MM-DD`) already exists. If not, add it before the entry.
- Never duplicate entries — check if the prompt was already logged.
- Never log secrets, passwords, tokens, or sensitive data.
- Keep summaries under 3 sentences.
- Use past tense ("Added", "Fixed", "Updated", not "Add", "Fix", "Update").
- If multiple prompts were handled together, combine into one entry.
- Read the end of session-log.md first to know where to append.
