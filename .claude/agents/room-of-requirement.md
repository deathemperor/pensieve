---
name: room-of-requirement
description: Update the Room of Requirement page when new technologies, plugins, subagents, or architectural changes are applied. Called by the main agent after infrastructure changes.
---

# Room of Requirement Updater

You maintain the Room of Requirement page at `src/pages/room-of-requirement/index.astro`.

## When to update

After any of these changes:
- New plugin added or removed
- New subagent created
- New technology or service integrated (e.g., new API, new Cloudflare binding)
- Architecture change (e.g., base path refactor, new deployment method)
- New section or page type added to the site

## What to update

The page has these data arrays in the frontmatter:

### `techStack` array
Each entry: `{ name, role, description, url }`

### `agents` array
Each entry: `{ name, purpose }`

### `plugins` array
Each entry: `{ name, purpose }`

### "What Claude Code Does" section
Two columns in the HTML: what Claude Code does vs what humans do. Update if the division of labor changes.

### Site routes manifest
When a new page is added to the site, also update `src/data/site-routes.json`:
- Add to `static` array: `{ "path": "/new-page", "title": "Page Title", "priority": "0.7" }`
- The sitemap, llms.txt, and ai-plugin.json all read from this manifest.

## Rules

- Read the current file first to avoid duplicates.
- Keep descriptions concise (one line).
- Don't remove entries unless the technology/agent was actually removed.
- Match the existing style — no emojis, terse descriptions.
- **Always update `src/data/site-routes.json` when adding new pages.**
