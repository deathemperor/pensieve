This is an EmDash site -- a CMS built on Astro with a full admin UI.

## Commands

```bash
npx emdash dev        # Start dev server (runs migrations, seeds, generates types)
npx emdash types      # Regenerate TypeScript types from schema
npx emdash seed seed/seed.json --validate  # Validate seed file
```

The admin UI is at `http://localhost:4321/_emdash/admin`.

## Key Files

| File                     | Purpose                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `astro.config.mjs`       | Astro config with `emdash()` integration, database, and storage                  |
| `src/live.config.ts`     | EmDash loader registration (boilerplate -- don't modify)                         |
| `seed/seed.json`         | Schema definition + demo content (collections, fields, taxonomies, menus, widgets) |
| `emdash-env.d.ts`      | Generated types for collections (auto-regenerated on dev server start)             |
| `src/layouts/Base.astro` | Base layout with EmDash wiring (menus, search, page contributions)               |
| `src/pages/`             | Astro pages -- all server-rendered                                                 |

## Skills

Agent skills are in `.agents/skills/`. Load them when working on specific tasks:

- **building-emdash-site** -- Querying content, rendering Portable Text, schema design, seed files, site features (menus, widgets, search, SEO, comments, bylines). Start here.
- **creating-plugins** -- Building EmDash plugins with hooks, storage, admin UI, API routes, and Portable Text block types.
- **emdash-cli** -- CLI commands for content management, seeding, type generation, and visual editing flow.

## Rules

- All content pages must be server-rendered (`output: "server"`). No `getStaticPaths()` for CMS content.
- Image fields are objects (`{ src, alt }`), not strings. Use `<Image image={...} />` from `"emdash/ui"`.
- `entry.id` is the slug (for URLs). `entry.data.id` is the database ULID (for API calls like `getEntryTerms`).
- Always call `Astro.cache.set(cacheHint)` on pages that query content.
- Taxonomy names in queries must match the seed's `"name"` field exactly (e.g., `"category"` not `"categories"`).
- **When adding new pages**: update `src/data/site-routes.json`. The sitemap, llms.txt, and ai-plugin.json all read from it. Content from EmDash collections is automated.
- **Diary is automated via hooks**. A `PreToolUse` hook on `git push` blocks the push if there are unlogged session data, and provides prompts/insights/plans for writing diary entries. After writing entries to remote D1 and clearing `.session/` buffers, retry the push.
- **After every `★ Insight` block**, log it by running: `.claude/hooks/log-insight.sh "the insight text"`. This is MANDATORY — every insight must be persisted to `.session/insights.jsonl` so the diary hook can include it. Insights apply to ALL substantive work — code writing, plan reviews, architecture critiques, debugging sessions, research — not just code changes.
- **After every plan** (ultraplan, brainstorming, architecture decisions, implementation plans), log it by running: `.claude/hooks/log-plan.sh "plan title" "full plan details with all decisions, trade-offs, and rationale"`. Plans are the most valuable diary content — they capture WHY decisions were made. Each plan becomes its own diary entry with `entry_type='plan'`. Preserve the full structure: options considered, trade-offs weighed, decisions made, and reasoning. Never abbreviate plans.
- **Log token usage** before every push by running: `.claude/hooks/log-usage.sh <input_tokens> <output_tokens> <cache_read> <cost_cents>`. Get numbers from conversation metadata or `/stats`. Calculate cost: Opus $15/M input, $75/M output, $1.875/M cache read. This data goes into the diary entry's token fields.
- Blog posts are at `/pensieve/memories/[slug]` (not `/posts/`). The collection name in EmDash is still "posts" but the URL path is "memories".
- Root-level pages (Room of Requirement, Trương) use absolute paths, not `link()`. The `link()` helper always prepends `/pensieve/`.

## Task Routing (HP Systems)

When you identify a task, bug, reminder, or follow-up during a session, route it to the appropriate HP system:

| Type | HP System | Command |
|------|-----------|---------|
| Quick thought, reminder, "do later" | Remembrall (Todoist) | Use todoist MCP, project "Remembrall" |
| Code bug, feature request, dev work | Marauder's Map (GitHub Issues) | `gh issue create --label marauders-map --title "..." --body "..."` |
| Epic, roadmap, multi-session project | O.W.L.s (Linear) | Use linear MCP, project "O.W.L.s" |
| Research note, design decision, reference | Room of Requirement (Notion) | Use notion MCP, database "Room of Requirement" |
| Immediate next action, in-repo checklist | Marauder's Parchment (TASKS.md) | Edit `TASKS.md` directly |

Pensieve Strands (session-tracker) runs automatically on session end — no manual routing needed.

**After writing to any external system, ALWAYS mirror to D1:**
`.claude/hooks/log-task.sh "<hp_system>" "<title>" "<external_id>" "<external_url>" "<route_reason>"`

**To close a task:** Update the external system, then:
`npx wrangler d1 execute pensieve-db --remote --command "UPDATE tasks SET status='done', closed_at='$(date -u +%Y-%m-%dT%H:%M:%SZ)' WHERE id='<task_id>';"`
