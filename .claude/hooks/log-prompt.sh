#!/bin/bash
# Logs each user prompt to session-log.md in the pensieve repo
INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TIMESTAMP=$(date +"%Y-%m-%d %H:%M")
LOG_FILE="$(dirname "$0")/../../session-log.md"

[ -z "$PROMPT" ] && exit 0

# Append under today's date header if not already present
TODAY=$(date +"%Y-%m-%d")
if ! grep -q "^## $TODAY" "$LOG_FILE" 2>/dev/null; then
  echo "" >> "$LOG_FILE"
  echo "## $TODAY" >> "$LOG_FILE"
fi

echo "" >> "$LOG_FILE"
echo "### [$TIMESTAMP] Prompt" >> "$LOG_FILE"
echo "$PROMPT" >> "$LOG_FILE"

exit 0
