#!/bin/bash
# Logs each user prompt to .session/prompts.jsonl (structured) and session-log.md (human-readable)
INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

[ -z "$PROMPT" ] && exit 0

mkdir -p "$REPO_ROOT/.session"

# Structured log — one JSON line per prompt
echo "{\"ts\":\"$TIMESTAMP\",\"prompt\":$(echo "$PROMPT" | jq -Rs .)}" >> "$REPO_ROOT/.session/prompts.jsonl"

# Human-readable log (keep for backwards compat)
LOG_FILE="$REPO_ROOT/session-log.md"
TODAY=$(date +"%Y-%m-%d")
if ! grep -q "^## $TODAY" "$LOG_FILE" 2>/dev/null; then
  echo "" >> "$LOG_FILE"
  echo "## $TODAY" >> "$LOG_FILE"
fi
echo "" >> "$LOG_FILE"
echo "### [$(date +"%Y-%m-%d %H:%M")] Prompt" >> "$LOG_FILE"
echo "$PROMPT" >> "$LOG_FILE"

exit 0
