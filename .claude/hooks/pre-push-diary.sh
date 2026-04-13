#!/bin/bash
# PreToolUse hook for Bash — intercepts `git push` and requires diary flush
# Reads .session/prompts.jsonl + .session/insights.jsonl
# Blocks push if there's unwritten session data; lets it through if buffers are empty

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.command // empty')
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Only care about git push
echo "$COMMAND" | grep -qE '^\s*git\s+push' || exit 0

PROMPTS="$REPO_ROOT/.session/prompts.jsonl"
INSIGHTS="$REPO_ROOT/.session/insights.jsonl"

# Count lines in each buffer
PROMPT_COUNT=0
INSIGHT_COUNT=0
[ -f "$PROMPTS" ] && PROMPT_COUNT=$(wc -l < "$PROMPTS" | tr -d ' ')
[ -f "$INSIGHTS" ] && INSIGHT_COUNT=$(wc -l < "$INSIGHTS" | tr -d ' ')

# Nothing to flush — let the push through
[ "$PROMPT_COUNT" -eq 0 ] && [ "$INSIGHT_COUNT" -eq 0 ] && exit 0

# Build diary data for Claude
echo "DIARY ENTRY REQUIRED before pushing."
echo ""
echo "This session has $PROMPT_COUNT prompt(s) and $INSIGHT_COUNT insight(s) to record."
echo ""
echo "=== PROMPTS ==="
[ -f "$PROMPTS" ] && cat "$PROMPTS"
echo ""
echo "=== INSIGHTS ==="
[ -f "$INSIGHTS" ] && cat "$INSIGHTS"
echo ""
echo "=== INSTRUCTIONS ==="
echo "1. Write a diary entry to the remote D1 database using: npx wrangler d1 execute pensieve-db --remote --command \"INSERT INTO ec_diary ...\""
echo "2. Use the prompts and insights above as the content. Title should summarize the session's work."
echo "3. After the diary entry is written, clear the buffers: rm -f $PROMPTS $INSIGHTS"
echo "4. Then retry: git push"

# Block the push (exit 2 = block with message)
exit 2
