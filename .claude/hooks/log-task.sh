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

# Generate unique ID
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
ID="task_$(date +%s)_$(head -c 4 /dev/urandom | xxd -p)"

# Escape single quotes for SQL
SQL_TITLE=$(echo "$TITLE" | sed "s/'/''/g")
SQL_BODY=$(echo "$BODY" | sed "s/'/''/g")
SQL_EXT_ID=$(echo "$EXTERNAL_ID" | sed "s/'/''/g")
SQL_EXT_URL=$(echo "$EXTERNAL_URL" | sed "s/'/''/g")
SQL_REASON=$(echo "$ROUTE_REASON" | sed "s/'/''/g")

# Log to session buffer for diary integration
mkdir -p "$REPO_ROOT/.session"
echo "{\"ts\":\"$TIMESTAMP\",\"hp_system\":\"$HP_SYSTEM\",\"tool\":\"$EXTERNAL_TOOL\",\"title\":$(jq -n --arg v "$TITLE" '$v')}" >> "$REPO_ROOT/.session/tasks.jsonl"

# Insert into remote D1
npx wrangler d1 execute pensieve-db --remote --command \
  "INSERT INTO tasks (id, title, body, hp_system, external_tool, external_id, external_url, status, route_reason, created_at) VALUES ('$ID', '$SQL_TITLE', '$SQL_BODY', '$HP_SYSTEM', '$EXTERNAL_TOOL', '$SQL_EXT_ID', '$SQL_EXT_URL', 'open', '$SQL_REASON', '$TIMESTAMP');"

echo "Task logged: [$HP_SYSTEM] $TITLE -> $EXTERNAL_TOOL"
