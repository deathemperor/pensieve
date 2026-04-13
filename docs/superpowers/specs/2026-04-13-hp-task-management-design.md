# HP-Themed Task Management Showcase

All 6 task tracking systems from the ultraplan, running simultaneously with HP theming. Each system receives different task types based on its strengths. An EmDash plugin aggregates all tasks into a D1 table for unified display across 3 showcase surfaces.

## HP System Mapping

| External Tool | HP Name | Slug | Routes to it | Why this tool |
|---|---|---|---|---|
| Todoist (MCP) | Remembrall | `remembrall` | Quick thoughts, reminders, "do later" | Fast capture, mobile review, natural language dates |
| GitHub Issues (gh CLI) | Marauder's Map | `marauders-map` | Code bugs, feature requests, dev work | Lives with code, PR-linked |
| Linear (MCP) | O.W.L.s | `owls` | Epics, roadmap, multi-session projects | Cycles, structured project tracking |
| Notion (MCP) | Room of Requirement | `room-of-requirement` | Research notes, design decisions, reference docs | Rich content, flexible structure |
| claude-session-tracker | Pensieve Strands | `pensieve-strands` | Automatic session audit trail | Zero-effort, captures every session |
| TASKS.md | Marauder's Parchment | `marauders-parchment` | Immediate next actions, in-repo checklist | Version-controlled, grep-able, offline |

## Architecture

```
Claude Code Session
    |
    |-- CLAUDE.md routing rules (decide where task goes)
    |
    +-- Write to external system (MCP / gh CLI / file)
    |       |
    |       +-- Todoist via MCP
    |       +-- GitHub Issues via gh CLI
    |       +-- Linear via MCP
    |       +-- Notion via MCP
    |       +-- session-tracker (automatic, hook-based)
    |       +-- TASKS.md (direct file write)
    |
    +-- Write to D1 tasks table (via wrangler d1)
            |
            +-- Showcase surfaces read from D1 only
                    |
                    +-- Room of Requirement (dashboard section)
                    +-- Priori Incantatem (diary integration)
                    +-- /room-of-requirement/task-observatory (dedicated page)
```

## Data Layer

### D1 Schema: `tasks` table

Added to existing `pensieve-db` alongside EmDash tables.

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  hp_system TEXT NOT NULL,
  external_tool TEXT NOT NULL,
  external_id TEXT,
  external_url TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  route_reason TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  closed_at TEXT
);

CREATE INDEX idx_tasks_hp_system ON tasks(hp_system);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);
```

Not an EmDash collection -- raw D1 table managed by hooks/scripts. This avoids polluting the CMS content model with operational data.

### Why not an EmDash collection?

Tasks have CRUD lifecycle (status transitions, updates, closures). EmDash collections are designed for content (publish/draft/revisions). A raw D1 table is simpler and avoids fighting the CMS abstraction.

## MCP Server Setup

### 1. Todoist (Remembrall)

```bash
claude mcp add --transport http todoist https://ai.todoist.net/mcp
```

Create a "Remembrall" project in Todoist. Tasks created here get a D1 mirror row with `hp_system='remembrall'`.

### 2. Linear (O.W.L.s)

```bash
claude mcp add --transport http linear https://mcp.linear.app/mcp
```

Create a "Pensieve" workspace with a "O.W.L.s" project. Use for epics and multi-session tracking.

### 3. Notion (Room of Requirement)

```bash
claude mcp add --transport http notion https://mcp.notion.com/mcp
```

Create a "Room of Requirement" database in Notion workspace. For research notes and design decisions.

### 4. GitHub Issues (Marauder's Map)

No MCP needed -- `gh issue create` is native. Use label `marauders-map` on deathemperor/death-pensieve repo.

### 5. claude-session-tracker (Pensieve Strands)

```bash
npx claude-session-tracker
```

Auto-installs hooks. Sessions logged as GitHub Issues in a separate private repo. D1 mirror captures session metadata only: title (session summary), external_id (issue number), external_url (issue link), created_at. No transcripts stored in D1.

### 6. TASKS.md (Marauder's Parchment)

File at repo root. Format:

```markdown
# The Marauder's Parchment

> I solemnly swear that I am up to no good.

## Active
- [ ] Task description (route reason)

## Done
- [x] Completed task ~~(closed date)~~

> Mischief managed.
```

## Routing Hook

A shell script `.claude/hooks/log-task.sh` that Claude calls after writing to an external system:

```bash
#!/bin/bash
# Usage: .claude/hooks/log-task.sh <hp_system> <title> <external_id> <external_url> <route_reason>
# Inserts a mirror row into D1 tasks table
```

This is called manually by Claude per CLAUDE.md rules (same pattern as `log-insight.sh` and `log-plan.sh`). Not automatic -- Claude decides routing, writes to external system, then logs to D1.

## CLAUDE.md Routing Rules

Add to CLAUDE.md:

```markdown
## Task Routing (HP Systems)

When you identify a task, bug, reminder, or follow-up, route it to the appropriate system:

| Type | Route to | Command |
|------|----------|---------|
| Quick thought, reminder, "do later" | Remembrall (Todoist) | Use todoist MCP tools, project "Remembrall" |
| Code bug, feature request, dev work | Marauder's Map (GitHub Issues) | `gh issue create --label marauders-map` |
| Epic, roadmap, multi-session project | O.W.L.s (Linear) | Use linear MCP tools, project "O.W.L.s" |
| Research note, design decision, reference | Room of Requirement (Notion) | Use notion MCP tools, database "Room of Requirement" |
| Immediate next action, in-repo checklist | Marauder's Parchment (TASKS.md) | Edit TASKS.md directly |

Pensieve Strands (session-tracker) runs automatically -- no manual routing.

After writing to any external system, ALWAYS log the mirror:
`.claude/hooks/log-task.sh "<hp_system>" "<title>" "<external_id>" "<external_url>" "<route_reason>"`
```

## Showcase Surfaces

### Surface 1: Room of Requirement Dashboard Section

Add a "Task Observatory" section to `/room-of-requirement/index.astro`. Displays:

- 6 cards (one per HP system) showing:
  - HP name and icon
  - External tool name
  - Open task count
  - Most recent task title
  - What routes there (one-line description)
- Aggregate stats bar: total tasks, open/done ratio, most active system

Data source: `SELECT hp_system, COUNT(*) as count, ... FROM tasks GROUP BY hp_system`

### Surface 2: Diary Integration

When diary entries reference tasks (via session work), include task references in the diary entry summary. The priori-incantatem agent already reads `.session/` buffers -- extend the pre-push hook to also read recent task logs.

No page changes needed -- this is organic through existing diary writing flow. The hook output will mention which HP systems were used during the session.

### Surface 3: Dedicated Page `/room-of-requirement/task-observatory`

Full page showing all tasks across all 6 systems. Features:

- Filter by HP system (6 toggle chips, same pattern as diary type filters)
- Filter by status (open / in_progress / done)
- Sort by created_at (newest first)
- Each task card shows:
  - Title
  - HP system badge (color-coded)
  - External tool link (opens in new tab)
  - Route reason
  - Status
  - Created date
  - Session link (if available)
- Bilingual (EN/VI)

HP system colors (extend existing accent palette):

| HP System | Color | Icon concept |
|---|---|---|
| Remembrall | `#e5534b` (red) | Glass orb |
| Marauder's Map | `#d4a843` (gold) | Footprints |
| O.W.L.s | `#7c3aed` (purple) | Owl |
| Room of Requirement | `#3fb950` (green) | Door |
| Pensieve Strands | `#58a6ff` (blue) | Memory strand |
| Marauder's Parchment | `#d2a679` (parchment) | Scroll |

### Site Routes

Add to `src/data/site-routes.json`:

```json
{
  "path": "/room-of-requirement/task-observatory",
  "title": "Task Observatory",
  "titleVi": "Đài Quan Sát Nhiệm Vụ",
  "description": "All task tracking systems in one view",
  "descriptionVi": "Tất cả hệ thống theo dõi nhiệm vụ trong một giao diện"
}
```

## Implementation Order

1. D1 schema (create `tasks` table via wrangler)
2. `log-task.sh` hook script
3. MCP server configuration (Todoist, Linear, Notion)
4. claude-session-tracker installation
5. TASKS.md creation
6. CLAUDE.md routing rules
7. Task Observatory page (`/room-of-requirement/task-observatory`)
8. Room of Requirement dashboard section (cards on index page)
9. Diary integration (extend pre-push hook)
10. Geminio pass (EN/VI translations)
11. Site routes update

## Out of Scope

- Sync FROM external systems back to D1 (one-way write only)
- Task assignment (solo dev, no need)
- Due dates / scheduling (not the point of the showcase)
- Automated status sync (Claude updates D1 status manually when closing tasks externally)
- Notifications / alerts from external systems
