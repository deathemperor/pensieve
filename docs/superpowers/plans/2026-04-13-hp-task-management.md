# HP Task Management Showcase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up 6 task tracking systems (Todoist, GitHub Issues, Linear, Notion, claude-session-tracker, TASKS.md) with HP theming, unified D1 storage, and 3 showcase surfaces (RoR dashboard, diary integration, dedicated Task Observatory page).

**Architecture:** Each external system gets its MCP server (or native CLI). A `log-task.sh` hook mirrors every task write into a D1 `tasks` table. Showcase pages read only from D1. CLAUDE.md routing rules determine which system gets each task type.

**Tech Stack:** Astro SSR, Cloudflare D1, wrangler CLI, Claude Code MCP servers (Todoist, Linear, Notion), `gh` CLI, claude-session-tracker

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `.claude/hooks/log-task.sh` | Create | Shell script to insert task mirror rows into D1 |
| `.claude/settings.json` | Modify | No changes needed (log-task.sh is called manually per CLAUDE.md) |
| `CLAUDE.md` | Modify:44+ | Add task routing rules section |
| `AGENTS.md` | Modify:44+ | Mirror CLAUDE.md routing rules |
| `TASKS.md` | Create | In-repo task checklist (Marauder's Parchment) |
| `src/data/site-routes.json` | Modify | Add task-observatory route |
| `src/pages/room-of-requirement/task-observatory.astro` | Create | Dedicated task dashboard page |
| `src/pages/room-of-requirement/index.astro` | Modify:165+ | Add Task Observatory section with 6 HP system cards |

---

### Task 1: D1 Schema — Create `tasks` table

**Files:**
- None (D1 migration via wrangler CLI)

- [ ] **Step 1: Create the tasks table on remote D1**

```bash
npx wrangler d1 execute pensieve-db --remote --command "CREATE TABLE IF NOT EXISTS tasks (
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
);"
```

Expected: Table created successfully.

- [ ] **Step 2: Add indexes**

```bash
npx wrangler d1 execute pensieve-db --remote --command "CREATE INDEX IF NOT EXISTS idx_tasks_hp_system ON tasks(hp_system);"
npx wrangler d1 execute pensieve-db --remote --command "CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);"
npx wrangler d1 execute pensieve-db --remote --command "CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);"
```

Expected: 3 indexes created.

- [ ] **Step 3: Verify table exists**

```bash
npx wrangler d1 execute pensieve-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name='tasks';"
```

Expected: One row with `tasks`.

- [ ] **Step 4: Also create table on local D1 for dev**

```bash
npx wrangler d1 execute pensieve-db --local --command "CREATE TABLE IF NOT EXISTS tasks (
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
);"
npx wrangler d1 execute pensieve-db --local --command "CREATE INDEX IF NOT EXISTS idx_tasks_hp_system ON tasks(hp_system);"
npx wrangler d1 execute pensieve-db --local --command "CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);"
npx wrangler d1 execute pensieve-db --local --command "CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);"
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: create D1 tasks table for HP task management showcase

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

Note: No files to commit here since D1 migrations are runtime. If there are no staged changes, skip this commit.

---

### Task 2: `log-task.sh` hook script

**Files:**
- Create: `.claude/hooks/log-task.sh`

- [ ] **Step 1: Create the hook script**

```bash
#!/bin/bash
# Mirrors a task write into the D1 tasks table
# Usage: .claude/hooks/log-task.sh <hp_system> <title> [external_id] [external_url] [route_reason] [body]
#
# hp_system: remembrall | marauders-map | owls | room-of-requirement | pensieve-strands | marauders-parchment
# Maps to external_tool automatically:
#   remembrall -> todoist
#   marauders-map -> github-issues
#   owls -> linear
#   room-of-requirement -> notion
#   pensieve-strands -> session-tracker
#   marauders-parchment -> tasks-md

HP_SYSTEM="$1"
TITLE="$2"
EXTERNAL_ID="${3:-}"
EXTERNAL_URL="${4:-}"
ROUTE_REASON="${5:-}"
BODY="${6:-}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

[ -z "$HP_SYSTEM" ] && echo "Error: hp_system required" && exit 1
[ -z "$TITLE" ] && echo "Error: title required" && exit 1

# Map HP system to external tool
case "$HP_SYSTEM" in
  remembrall) EXTERNAL_TOOL="todoist" ;;
  marauders-map) EXTERNAL_TOOL="github-issues" ;;
  owls) EXTERNAL_TOOL="linear" ;;
  room-of-requirement) EXTERNAL_TOOL="notion" ;;
  pensieve-strands) EXTERNAL_TOOL="session-tracker" ;;
  marauders-parchment) EXTERNAL_TOOL="tasks-md" ;;
  *) echo "Error: unknown hp_system '$HP_SYSTEM'" && exit 1 ;;
esac

# Generate ULID-style ID (timestamp + random)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
ID="task_$(date +%s)_$(head -c 4 /dev/urandom | xxd -p)"

# Escape single quotes for SQL
SQL_TITLE=$(echo "$TITLE" | sed "s/'/''/g")
SQL_BODY=$(echo "$BODY" | sed "s/'/''/g")
SQL_EXT_ID=$(echo "$EXTERNAL_ID" | sed "s/'/''/g")
SQL_EXT_URL=$(echo "$EXTERNAL_URL" | sed "s/'/''/g")
SQL_REASON=$(echo "$ROUTE_REASON" | sed "s/'/''/g")

npx wrangler d1 execute pensieve-db --remote --command \
  "INSERT INTO tasks (id, title, body, hp_system, external_tool, external_id, external_url, status, route_reason, created_at) VALUES ('$ID', '$SQL_TITLE', '$SQL_BODY', '$HP_SYSTEM', '$EXTERNAL_TOOL', '$SQL_EXT_ID', '$SQL_EXT_URL', 'open', '$SQL_REASON', '$TIMESTAMP');"

echo "Task logged: [$HP_SYSTEM] $TITLE -> $EXTERNAL_TOOL"
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x .claude/hooks/log-task.sh
```

- [ ] **Step 3: Test with a sample insert**

```bash
.claude/hooks/log-task.sh "marauders-map" "Test task from log-task.sh" "test-1" "https://github.com/deathemperor/death-pensieve/issues/1" "testing hook"
```

Expected: `Task logged: [marauders-map] Test task from log-task.sh -> github-issues`

- [ ] **Step 4: Verify the row landed in D1**

```bash
npx wrangler d1 execute pensieve-db --remote --command "SELECT id, title, hp_system, external_tool FROM tasks LIMIT 5;"
```

Expected: One row with the test task.

- [ ] **Step 5: Delete the test row**

```bash
npx wrangler d1 execute pensieve-db --remote --command "DELETE FROM tasks WHERE title = 'Test task from log-task.sh';"
```

- [ ] **Step 6: Commit**

```bash
git add .claude/hooks/log-task.sh
git commit -m "feat: add log-task.sh hook for HP task management D1 mirroring

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: MCP Server Configuration

**Files:**
- None (CLI configuration, stored in user's Claude settings)

- [ ] **Step 1: Add Todoist MCP server (Remembrall)**

```bash
claude mcp add --transport http todoist https://ai.todoist.net/mcp
```

Follow browser auth prompt. After auth, create a project named "Remembrall" in Todoist.

- [ ] **Step 2: Add Linear MCP server (O.W.L.s)**

```bash
claude mcp add --transport http linear https://mcp.linear.app/mcp
```

Follow browser auth prompt. After auth, create a project named "O.W.L.s" in Linear.

- [ ] **Step 3: Add Notion MCP server (Room of Requirement)**

```bash
claude mcp add --transport http notion https://mcp.notion.com/mcp
```

Follow browser auth prompt. After auth, create a database named "Room of Requirement" in Notion.

- [ ] **Step 4: Install claude-session-tracker (Pensieve Strands)**

```bash
npx claude-session-tracker
```

Follow setup prompts. This auto-installs SessionEnd hooks and creates a private GitHub repo for session logs.

- [ ] **Step 5: Verify MCP servers are configured**

```bash
claude mcp list
```

Expected: todoist, linear, notion listed. Session-tracker hooks visible in settings.

Note: These steps require interactive auth — the user must complete them manually. Claude cannot authenticate on their behalf.

---

### Task 4: TASKS.md — The Marauder's Parchment

**Files:**
- Create: `TASKS.md`

- [ ] **Step 1: Create TASKS.md**

```markdown
# The Marauder's Parchment

> I solemnly swear that I am up to no good.

## Active

_No active tasks. The castle is quiet._

## Done

_No completed tasks yet._

---

> Mischief managed.
```

- [ ] **Step 2: Commit**

```bash
git add TASKS.md
git commit -m "feat: add TASKS.md (Marauder's Parchment) for in-repo task tracking

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: CLAUDE.md Routing Rules

**Files:**
- Modify: `CLAUDE.md`:44+
- Modify: `AGENTS.md`:44+

- [ ] **Step 1: Add routing rules to CLAUDE.md**

Add the following after the existing rules section (after the line about root-level pages):

```markdown

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
```

- [ ] **Step 2: Mirror the same rules into AGENTS.md**

Copy the exact same "Task Routing (HP Systems)" section into AGENTS.md at the same location.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md AGENTS.md
git commit -m "feat: add HP task routing rules to CLAUDE.md and AGENTS.md

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Task Observatory Page

**Files:**
- Create: `src/pages/room-of-requirement/task-observatory.astro`

- [ ] **Step 1: Create the page**

This page queries the D1 `tasks` table directly (not via EmDash collection) and renders all tasks with HP system filtering.

```astro
---
export const prerender = false;

import Base from "../../layouts/Base.astro";
import { getCurrentLang } from "../../utils/lang";

const lang = getCurrentLang(Astro);
const isVi = lang === "vi";

// Query tasks from D1 directly
const db = Astro.locals.runtime?.env?.DB;
let tasks: any[] = [];

if (db) {
  const result = await db.prepare(
    "SELECT * FROM tasks ORDER BY created_at DESC"
  ).all();
  tasks = result.results ?? [];
}

Astro.cache.set({ maxAge: 60, sMaxAge: 120 });

// HP system metadata
const hpSystems = [
  { slug: "remembrall", name: "Remembrall", tool: "Todoist", color: "#e5534b", routes: isVi ? "Suy nghĩ nhanh, nhắc nhở" : "Quick thoughts, reminders" },
  { slug: "marauders-map", name: "Marauder's Map", tool: "GitHub Issues", color: "#d4a843", routes: isVi ? "Lỗi code, yêu cầu tính năng" : "Code bugs, feature requests" },
  { slug: "owls", name: "O.W.L.s", tool: "Linear", color: "#7c3aed", routes: isVi ? "Dự án lớn, lộ trình" : "Epics, roadmap" },
  { slug: "room-of-requirement", name: "Room of Requirement", tool: "Notion", color: "#3fb950", routes: isVi ? "Ghi chú nghiên cứu, quyết định thiết kế" : "Research notes, design decisions" },
  { slug: "pensieve-strands", name: "Pensieve Strands", tool: "Session Tracker", color: "#58a6ff", routes: isVi ? "Nhật ký phiên tự động" : "Automatic session trail" },
  { slug: "marauders-parchment", name: "Marauder's Parchment", tool: "TASKS.md", color: "#d2a679", routes: isVi ? "Việc cần làm ngay trong repo" : "Immediate in-repo actions" },
];

// Counts per system
const systemCounts = hpSystems.map(sys => ({
  ...sys,
  total: tasks.filter(t => t.hp_system === sys.slug).length,
  open: tasks.filter(t => t.hp_system === sys.slug && t.status === 'open').length,
  done: tasks.filter(t => t.hp_system === sys.slug && t.status === 'done').length,
}));

const totalOpen = tasks.filter(t => t.status === 'open').length;
const totalDone = tasks.filter(t => t.status === 'done').length;

const statusLabels: Record<string, Record<string, string>> = {
  en: { open: "Open", in_progress: "In Progress", done: "Done" },
  vi: { open: "Mở", in_progress: "Đang Làm", done: "Xong" },
};
---

<Base
  title={isVi ? "Đài Quan Sát Nhiệm Vụ" : "Task Observatory"}
  description={isVi ? "Tất cả hệ thống theo dõi nhiệm vụ trong một giao diện" : "All task tracking systems in one view"}
  breadcrumbs={[
    { label: "Room of Requirement", href: "/room-of-requirement" },
    { label: isVi ? "Đài Quan Sát" : "Task Observatory" },
  ]}
>
  <section class="to-hero">
    <div class="to-hero-inner">
      <div class="to-rule" />
      <span class="to-label">{isVi ? "Nhiệm Vụ" : "Tasks"}</span>
      <h1 class="to-title">{isVi ? "Đài Quan Sát Nhiệm Vụ" : "Task Observatory"}</h1>
      <p class="to-subtitle">
        {isVi
          ? "Sáu hệ thống phép thuật, mỗi hệ thống phục vụ một mục đích riêng. Tất cả được quan sát từ một nơi."
          : "Six magical systems, each serving a different purpose. All observed from one place."}
      </p>
      <div class="to-stats">
        <span class="to-stat">
          <span class="to-stat-value">{tasks.length}</span>
          <span class="to-stat-label">{isVi ? "tổng cộng" : "total"}</span>
        </span>
        <span class="to-stat-dot" />
        <span class="to-stat">
          <span class="to-stat-value">{totalOpen}</span>
          <span class="to-stat-label">{isVi ? "đang mở" : "open"}</span>
        </span>
        <span class="to-stat-dot" />
        <span class="to-stat">
          <span class="to-stat-value">{totalDone}</span>
          <span class="to-stat-label">{isVi ? "hoàn thành" : "done"}</span>
        </span>
      </div>

      <div class="to-system-chips">
        {systemCounts.map(sys => (
          <button class="to-chip" data-filter={sys.slug} style={`--chip-color: ${sys.color};`}>
            <span class="to-chip-dot" />
            {sys.name}
            <span class="to-chip-count">{sys.total}</span>
          </button>
        ))}
      </div>
    </div>
  </section>

  <section class="to-systems">
    <div class="to-inner">
      <div class="to-grid">
        {systemCounts.map(sys => (
          <div class="to-system-card" style={`--sys-color: ${sys.color};`}>
            <div class="to-system-header">
              <span class="to-system-dot" />
              <span class="to-system-name">{sys.name}</span>
            </div>
            <span class="to-system-tool">{sys.tool}</span>
            <span class="to-system-routes">{sys.routes}</span>
            <div class="to-system-stats">
              <span>{sys.open} {isVi ? "mở" : "open"}</span>
              <span class="to-system-sep">/</span>
              <span>{sys.done} {isVi ? "xong" : "done"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>

  <section class="to-tasks">
    <div class="to-inner">
      <h2 class="to-section-heading">{isVi ? "Tất Cả Nhiệm Vụ" : "All Tasks"}</h2>

      {tasks.length === 0 ? (
        <p class="to-empty">{isVi ? "Chưa có nhiệm vụ nào. Lâu đài còn yên tĩnh." : "No tasks yet. The castle is quiet."}</p>
      ) : (
        <div class="to-task-list">
          {tasks.map(task => {
            const sys = hpSystems.find(s => s.slug === task.hp_system);
            return (
              <article class="to-task" data-system={task.hp_system} data-status={task.status} style={`--task-color: ${sys?.color ?? 'var(--color-accent)'};`}>
                <div class="to-task-header">
                  <span class="to-task-system">
                    <span class="to-task-dot" />
                    {sys?.name ?? task.hp_system}
                  </span>
                  <span class={`to-task-status to-status-${task.status}`}>
                    {statusLabels[lang]?.[task.status] ?? task.status}
                  </span>
                </div>
                <h3 class="to-task-title">{task.title}</h3>
                {task.body && <p class="to-task-body">{task.body}</p>}
                <div class="to-task-meta">
                  {task.route_reason && (
                    <span class="to-task-badge">{task.route_reason}</span>
                  )}
                  <span class="to-task-badge to-task-tool">{sys?.tool ?? task.external_tool}</span>
                  {task.external_url && (
                    <a href={task.external_url} class="to-task-link" target="_blank" rel="noopener">
                      {isVi ? "Xem" : "View"} &rarr;
                    </a>
                  )}
                  <time class="to-task-date">
                    {new Date(task.created_at).toLocaleString(isVi ? "vi-VN" : "en-US", {
                      timeZone: "Asia/Ho_Chi_Minh",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  </section>
</Base>

<style>
  .to-hero { border-bottom: 1px solid var(--color-border); }
  .to-hero-inner { max-width: var(--wide-width); margin: 0 auto; padding: var(--spacing-16) var(--spacing-8); }
  .to-rule { width: 24px; height: 1px; background: var(--color-accent); margin-bottom: var(--spacing-5); }
  .to-label { display: block; font-family: var(--font-sans); font-size: var(--font-size-xs); font-weight: 500; text-transform: uppercase; letter-spacing: var(--tracking-wider); color: var(--color-muted); margin-bottom: var(--spacing-4); }
  .to-title { font-family: var(--font-display); font-size: clamp(1.875rem, 3.5vw, 3rem); font-weight: var(--font-weight-display); line-height: 1.1; letter-spacing: -0.022em; color: var(--color-text); margin: 0 0 var(--spacing-5); }
  .to-subtitle { font-family: var(--font-sans); font-size: var(--font-size-base); line-height: var(--leading-relaxed); color: var(--color-text-secondary); max-width: 55ch; margin: 0 0 var(--spacing-6); }

  .to-stats { display: flex; align-items: center; gap: var(--spacing-4); font-family: var(--font-mono); font-size: var(--font-size-sm); color: var(--color-muted); }
  .to-stat { display: flex; align-items: baseline; gap: var(--spacing-2); }
  .to-stat-value { font-weight: 600; color: var(--color-text); font-size: var(--font-size-lg); }
  .to-stat-dot { width: 3px; height: 3px; border-radius: 50%; background: currentColor; opacity: 0.5; }

  .to-system-chips { display: flex; flex-wrap: wrap; gap: var(--spacing-2); margin-top: var(--spacing-4); }
  .to-chip { --chip-color: var(--color-accent); display: inline-flex; align-items: center; gap: var(--spacing-2); padding: 2px var(--spacing-3); font-family: var(--font-mono); font-size: var(--font-size-xs); color: var(--chip-color); background: color-mix(in srgb, var(--chip-color) 10%, transparent); border: 1px solid color-mix(in srgb, var(--chip-color) 20%, transparent); border-radius: var(--radius-full, 9999px); line-height: 1.6; cursor: pointer; transition: background var(--transition-fast); }
  .to-chip:hover { background: color-mix(in srgb, var(--chip-color) 18%, transparent); }
  .to-chip[aria-pressed="true"] { outline: 1.5px solid var(--chip-color); outline-offset: 1px; background: color-mix(in srgb, var(--chip-color) 20%, transparent); }
  .to-chip-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--chip-color); }
  .to-chip-count { font-weight: 600; }

  /* Systems grid */
  .to-systems { border-bottom: 1px solid var(--color-border); }
  .to-inner { max-width: var(--wide-width); margin: 0 auto; padding: var(--spacing-12) var(--spacing-8); }
  .to-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--spacing-4); }

  .to-system-card { display: flex; flex-direction: column; gap: var(--spacing-1); padding: var(--spacing-5); background: var(--color-surface-elevated); border: 1px solid var(--color-border); border-radius: var(--radius-lg); border-left: 2px solid var(--sys-color); transition: border-color var(--transition-fast); }
  .to-system-card:hover { border-color: color-mix(in srgb, var(--sys-color) 50%, var(--color-border)); border-left-color: var(--sys-color); }
  .to-system-header { display: flex; align-items: center; gap: var(--spacing-2); }
  .to-system-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--sys-color); }
  .to-system-name { font-family: var(--font-display); font-size: var(--font-size-base); font-weight: var(--font-weight-display); color: var(--color-text); }
  .to-system-tool { font-family: var(--font-mono); font-size: var(--font-size-xs); color: var(--sys-color); }
  .to-system-routes { font-family: var(--font-sans); font-size: var(--font-size-xs); color: var(--color-text-secondary); line-height: var(--leading-relaxed); }
  .to-system-stats { font-family: var(--font-mono); font-size: var(--font-size-xs); color: var(--color-muted); margin-top: var(--spacing-2); }
  .to-system-sep { opacity: 0.4; margin: 0 var(--spacing-1); }

  /* Task list */
  .to-tasks { border-bottom: 1px solid var(--color-border); }
  .to-section-heading { font-family: var(--font-display); font-size: var(--font-size-lg); font-weight: var(--font-weight-display); letter-spacing: -0.012em; color: var(--color-text); margin: 0 0 var(--spacing-6); }
  .to-empty { font-family: var(--font-sans); font-size: var(--font-size-sm); color: var(--color-muted); font-style: italic; }

  .to-task-list { display: flex; flex-direction: column; gap: var(--spacing-3); }

  .to-task { padding: var(--spacing-5); background: var(--color-surface-elevated); border: 1px solid var(--color-border); border-radius: var(--radius-lg); border-left: 2px solid var(--task-color); transition: border-color var(--transition-fast); }
  .to-task:hover { border-color: color-mix(in srgb, var(--task-color) 50%, var(--color-border)); border-left-color: var(--task-color); }
  .to-task[hidden] { display: none; }

  .to-task-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-2); }
  .to-task-system { display: inline-flex; align-items: center; gap: var(--spacing-2); font-family: var(--font-mono); font-size: var(--font-size-xs); color: var(--task-color); font-weight: 500; }
  .to-task-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--task-color); }

  .to-task-status { font-family: var(--font-mono); font-size: 11px; padding: 1px var(--spacing-2); border-radius: 3px; line-height: 1.6; }
  .to-status-open { background: color-mix(in srgb, #58a6ff 12%, transparent); color: #58a6ff; border: 1px solid color-mix(in srgb, #58a6ff 20%, transparent); }
  .to-status-in_progress { background: color-mix(in srgb, #d4a843 12%, transparent); color: #d4a843; border: 1px solid color-mix(in srgb, #d4a843 20%, transparent); }
  .to-status-done { background: color-mix(in srgb, #3fb950 12%, transparent); color: #3fb950; border: 1px solid color-mix(in srgb, #3fb950 20%, transparent); }

  .to-task-title { font-family: var(--font-display); font-size: var(--font-size-base); font-weight: var(--font-weight-display); color: var(--color-text); margin: 0 0 var(--spacing-2); letter-spacing: -0.011em; }
  .to-task-body { font-family: var(--font-sans); font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: var(--leading-relaxed); margin: 0 0 var(--spacing-3); }

  .to-task-meta { display: flex; gap: var(--spacing-2); flex-wrap: wrap; align-items: center; }
  .to-task-badge { display: inline-block; padding: 1px var(--spacing-2); font-family: var(--font-mono); font-size: 11px; border-radius: 3px; line-height: 1.6; background: color-mix(in srgb, var(--color-muted) 10%, transparent); color: var(--color-muted); border: 1px solid color-mix(in srgb, var(--color-muted) 15%, transparent); }
  .to-task-tool { background: color-mix(in srgb, var(--task-color) 10%, transparent); color: var(--task-color); border-color: color-mix(in srgb, var(--task-color) 20%, transparent); }
  .to-task-link { font-family: var(--font-mono); font-size: var(--font-size-xs); color: var(--color-accent); text-decoration: none; margin-left: auto; }
  .to-task-link:hover { text-decoration: underline; }
  .to-task-date { font-family: var(--font-mono); font-size: 11px; color: var(--color-muted); }

  @media (max-width: 900px) {
    .to-hero-inner { padding: var(--spacing-12) var(--spacing-6); }
    .to-inner { padding: var(--spacing-10) var(--spacing-6); }
  }

  @media (max-width: 600px) {
    .to-hero-inner { padding: var(--spacing-10) var(--spacing-5); }
    .to-inner { padding: var(--spacing-8) var(--spacing-5); }
    .to-grid { grid-template-columns: 1fr; }
  }
</style>

<script is:inline>
(function () {
  const chips = document.querySelectorAll('[data-filter]');
  const tasks = document.querySelectorAll('.to-task[data-system]');
  let activeFilter = null;

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const system = chip.dataset.filter;

      if (activeFilter === system) {
        activeFilter = null;
        chips.forEach(c => c.setAttribute('aria-pressed', 'false'));
        tasks.forEach(t => t.hidden = false);
      } else {
        activeFilter = system;
        chips.forEach(c => c.setAttribute('aria-pressed', c.dataset.filter === system ? 'true' : 'false'));
        tasks.forEach(t => {
          t.hidden = t.dataset.system !== system;
        });
      }
    });
  });
})();
</script>
```

- [ ] **Step 2: Verify dev server renders the page**

```bash
# Dev server should already be running
# Navigate to http://localhost:4321/room-of-requirement/task-observatory
```

Expected: Page renders with empty state ("No tasks yet. The castle is quiet."), 6 system cards all showing 0/0, and filter chips.

- [ ] **Step 3: Commit**

```bash
git add src/pages/room-of-requirement/task-observatory.astro
git commit -m "feat: add Task Observatory page with HP system cards and filtering

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Room of Requirement Dashboard Section

**Files:**
- Modify: `src/pages/room-of-requirement/index.astro`

- [ ] **Step 1: Add D1 query and HP system data to the frontmatter**

Add after the `plugins` array (line 92), before the closing `---`:

```astro
// Task Observatory data from D1
const db = Astro.locals.runtime?.env?.DB;
let taskSystems: { slug: string; name: string; tool: string; color: string; routes: string; open: number; done: number }[] = [];

const hpSystemDefs = [
  { slug: "remembrall", name: "Remembrall", tool: "Todoist", color: "#e5534b", routes: isVi ? "Suy nghĩ nhanh, nhắc nhở" : "Quick thoughts, reminders" },
  { slug: "marauders-map", name: "Marauder's Map", tool: "GitHub Issues", color: "#d4a843", routes: isVi ? "Lỗi code, yêu cầu tính năng" : "Code bugs, feature requests" },
  { slug: "owls", name: "O.W.L.s", tool: "Linear", color: "#7c3aed", routes: isVi ? "Dự án lớn, lộ trình" : "Epics, roadmap" },
  { slug: "room-of-requirement", name: "Room of Requirement", tool: "Notion", color: "#3fb950", routes: isVi ? "Ghi chú nghiên cứu, quyết định thiết kế" : "Research notes, design decisions" },
  { slug: "pensieve-strands", name: "Pensieve Strands", tool: "Session Tracker", color: "#58a6ff", routes: isVi ? "Nhật ký phiên tự động" : "Automatic session trail" },
  { slug: "marauders-parchment", name: "Marauder's Parchment", tool: "TASKS.md", color: "#d2a679", routes: isVi ? "Việc cần làm ngay trong repo" : "Immediate in-repo actions" },
];

if (db) {
  try {
    const counts = await db.prepare(
      "SELECT hp_system, status, COUNT(*) as count FROM tasks GROUP BY hp_system, status"
    ).all();
    const countMap = new Map<string, { open: number; done: number }>();
    for (const row of (counts.results ?? []) as any[]) {
      const existing = countMap.get(row.hp_system) ?? { open: 0, done: 0 };
      if (row.status === 'open' || row.status === 'in_progress') existing.open += row.count;
      else if (row.status === 'done') existing.done += row.count;
      countMap.set(row.hp_system, existing);
    }
    taskSystems = hpSystemDefs.map(sys => ({
      ...sys,
      open: countMap.get(sys.slug)?.open ?? 0,
      done: countMap.get(sys.slug)?.done ?? 0,
    }));
  } catch {
    taskSystems = hpSystemDefs.map(sys => ({ ...sys, open: 0, done: 0 }));
  }
} else {
  taskSystems = hpSystemDefs.map(sys => ({ ...sys, open: 0, done: 0 }));
}
```

- [ ] **Step 2: Add the Task Observatory section to the HTML**

Add before the closing `</Base>` tag (after the Source section, before the House-Elves section — around line 178):

```astro
  <section class="room-section">
    <div class="room-inner">
      <h2 class="section-heading">{isVi ? "Đài Quan Sát Nhiệm Vụ" : "Task Observatory"}</h2>
      <p class="section-desc">
        {isVi
          ? "Sáu hệ thống phép thuật theo dõi mọi nhiệm vụ, từ suy nghĩ thoáng qua đến dự án lớn."
          : "Six magical systems tracking every task, from fleeting thoughts to grand projects."}
      </p>
      <div class="tech-grid">
        {taskSystems.map(sys => (
          <div class="tech-card task-sys-card" style={`--sys-color: ${sys.color};`}>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style={`width: 8px; height: 8px; border-radius: 50%; background: ${sys.color}; flex-shrink: 0;`} />
              <span class="tech-name">{sys.name}</span>
            </div>
            <span class="tech-role" style={`color: ${sys.color};`}>{sys.tool}</span>
            <span class="tech-desc">{sys.routes}</span>
            <span style="font-family: var(--font-mono); font-size: 11px; color: var(--color-muted); margin-top: 4px;">
              {sys.open} {isVi ? "mở" : "open"} / {sys.done} {isVi ? "xong" : "done"}
            </span>
          </div>
        ))}
      </div>
      <a href="/room-of-requirement/task-observatory" class="diary-link" style="margin-top: var(--spacing-6); display: inline-block;">
        {isVi ? "Xem tất cả nhiệm vụ" : "View all tasks"} &rarr;
      </a>
    </div>
  </section>
```

- [ ] **Step 3: Add the task-sys-card border-left style**

Add to the `<style>` block:

```css
  .task-sys-card {
    border-left: 2px solid var(--sys-color);
  }

  .task-sys-card:hover {
    border-left-color: var(--sys-color);
  }
```

- [ ] **Step 4: Verify on dev server**

Navigate to `http://localhost:4321/room-of-requirement`. The Task Observatory section should appear with 6 system cards showing 0 open / 0 done each.

- [ ] **Step 5: Commit**

```bash
git add src/pages/room-of-requirement/index.astro
git commit -m "feat: add Task Observatory dashboard section to Room of Requirement

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Site Routes Update

**Files:**
- Modify: `src/data/site-routes.json`

- [ ] **Step 1: Add task-observatory route**

Add to the `static` array:

```json
{ "path": "/room-of-requirement/task-observatory", "title": "Task Observatory", "priority": "0.6" }
```

- [ ] **Step 2: Commit**

```bash
git add src/data/site-routes.json
git commit -m "feat: add task-observatory to site routes

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Diary Integration — Extend Pre-Push Hook

**Files:**
- Modify: `.claude/hooks/pre-push-diary.sh`

- [ ] **Step 1: Add task buffer reading to the pre-push hook**

After the existing buffer counting (around line 26, after `USAGE_COUNT`), add:

```bash
TASKS_LOG="$REPO_ROOT/.session/tasks.jsonl"
TASK_COUNT=0
[ -f "$TASKS_LOG" ] && TASK_COUNT=$(wc -l < "$TASKS_LOG" | tr -d ' ')
```

Update the output section (around line 34) to include task count:

Change:
```bash
echo "This session has $PROMPT_COUNT prompt(s), $INSIGHT_COUNT insight(s), $PLAN_COUNT plan(s), and $USAGE_COUNT usage log(s)."
```

To:
```bash
echo "This session has $PROMPT_COUNT prompt(s), $INSIGHT_COUNT insight(s), $PLAN_COUNT plan(s), $USAGE_COUNT usage log(s), and $TASK_COUNT task(s)."
```

Add after the usage section output (around line 54):

```bash
if [ "$TASK_COUNT" -gt 0 ]; then
  echo "=== TASKS ROUTED ==="
  cat "$TASKS_LOG"
  echo ""
fi
```

Update the cleanup instruction (line 61) to include tasks:

Change:
```bash
echo "5. After all diary entries are written, clear the buffers: rm -f $PROMPTS $INSIGHTS $PLANS $USAGE"
```

To:
```bash
echo "5. After all diary entries are written, clear the buffers: rm -f $PROMPTS $INSIGHTS $PLANS $USAGE $TASKS_LOG"
```

- [ ] **Step 2: Create `log-task-session.sh`** — a companion to `log-task.sh` that also logs to `.session/tasks.jsonl` for diary inclusion

Actually, simpler approach: modify `log-task.sh` to also append to `.session/tasks.jsonl`. Add before the `npx wrangler` line:

```bash
# Also log to session buffer for diary integration
mkdir -p "$REPO_ROOT/.session"
echo "{\"ts\":\"$TIMESTAMP\",\"hp_system\":\"$HP_SYSTEM\",\"tool\":\"$EXTERNAL_TOOL\",\"title\":$(echo "$TITLE" | jq -Rs .)}" >> "$REPO_ROOT/.session/tasks.jsonl"
```

- [ ] **Step 3: Commit**

```bash
git add .claude/hooks/pre-push-diary.sh .claude/hooks/log-task.sh
git commit -m "feat: integrate task routing into diary pre-push hook

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Geminio Pass — Verify Translations

**Files:**
- All files from Tasks 6-7 (already include bilingual strings)

- [ ] **Step 1: Invoke Geminio agent**

Run the Geminio agent on the two new/modified pages to verify all user-facing text has EN/VI versions:

- `src/pages/room-of-requirement/task-observatory.astro`
- `src/pages/room-of-requirement/index.astro`

- [ ] **Step 2: Fix any missing translations identified by Geminio**

- [ ] **Step 3: Commit if changes were needed**

```bash
git add src/pages/room-of-requirement/task-observatory.astro src/pages/room-of-requirement/index.astro
git commit -m "fix: add missing i18n translations for Task Observatory

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: End-to-End Verification

- [ ] **Step 1: Insert a real test task via log-task.sh**

```bash
.claude/hooks/log-task.sh "marauders-map" "Fix broken link on about page" "42" "https://github.com/deathemperor/death-pensieve/issues/42" "code bug"
```

- [ ] **Step 2: Insert a second task for a different system**

```bash
.claude/hooks/log-task.sh "remembrall" "Review Linear pricing for O.W.L.s system" "" "" "quick thought"
```

- [ ] **Step 3: Verify Task Observatory page shows both tasks**

Navigate to `http://localhost:4321/room-of-requirement/task-observatory`. Should show 2 tasks with different HP system colors, filter chips working.

- [ ] **Step 4: Verify Room of Requirement dashboard shows counts**

Navigate to `http://localhost:4321/room-of-requirement`. Task Observatory section should show 1 open for Marauder's Map, 1 open for Remembrall.

- [ ] **Step 5: Clean up test tasks**

```bash
npx wrangler d1 execute pensieve-db --remote --command "DELETE FROM tasks WHERE title LIKE '%Fix broken link%' OR title LIKE '%Review Linear%';"
```

---

## Self-Review Checklist

**Spec coverage:**
- D1 schema (Task 1) ✓
- log-task.sh hook (Task 2) ✓
- MCP server config (Task 3) ✓
- claude-session-tracker (Task 3, step 4) ✓
- TASKS.md (Task 4) ✓
- CLAUDE.md routing rules (Task 5) ✓
- Task Observatory page (Task 6) ✓
- RoR dashboard section (Task 7) ✓
- Site routes (Task 8) ✓
- Diary integration (Task 9) ✓
- Geminio pass (Task 10) ✓
- HP system colors match spec ✓
- All 6 systems covered ✓

**Placeholder scan:** No TBDs, TODOs, or "implement later" found.

**Type consistency:** `hp_system` slug values are consistent across log-task.sh, task-observatory.astro, index.astro, and CLAUDE.md. Color values match across all files. `hpSystems`/`hpSystemDefs` arrays are identical in structure.
