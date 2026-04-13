#!/bin/bash
# PreToolUse hook for Bash — intercepts `git push` and requires diary flush
# Reads .session/prompts.jsonl + .session/insights.jsonl + .session/plans.jsonl
# Blocks push if there's unwritten session data; lets it through if buffers are empty

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.command // empty')
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Only care about git push
echo "$COMMAND" | grep -qE '^\s*git\s+push' || exit 0

PROMPTS="$REPO_ROOT/.session/prompts.jsonl"
INSIGHTS="$REPO_ROOT/.session/insights.jsonl"
PLANS="$REPO_ROOT/.session/plans.jsonl"

# Count lines in each buffer
PROMPT_COUNT=0
INSIGHT_COUNT=0
PLAN_COUNT=0
[ -f "$PROMPTS" ] && PROMPT_COUNT=$(wc -l < "$PROMPTS" | tr -d ' ')
[ -f "$INSIGHTS" ] && INSIGHT_COUNT=$(wc -l < "$INSIGHTS" | tr -d ' ')
[ -f "$PLANS" ] && PLAN_COUNT=$(wc -l < "$PLANS" | tr -d ' ')

# Nothing to flush — let the push through
[ "$PROMPT_COUNT" -eq 0 ] && [ "$INSIGHT_COUNT" -eq 0 ] && [ "$PLAN_COUNT" -eq 0 ] && exit 0

# Build diary data for Claude
echo "DIARY ENTRY REQUIRED before pushing."
echo ""
echo "This session has $PROMPT_COUNT prompt(s), $INSIGHT_COUNT insight(s), and $PLAN_COUNT plan(s) to record."
echo ""

if [ "$PLAN_COUNT" -gt 0 ]; then
  echo "=== PLANS (write SEPARATE diary entries with type 'plan' for each) ==="
  cat "$PLANS"
  echo ""
fi

echo "=== PROMPTS ==="
[ -f "$PROMPTS" ] && cat "$PROMPTS"
echo ""
echo "=== INSIGHTS ==="
[ -f "$INSIGHTS" ] && cat "$INSIGHTS"
echo ""
echo "=== INSTRUCTIONS ==="
echo "1. Write diary entries to the remote D1 database using: npx wrangler d1 execute pensieve-db --remote --command \"INSERT INTO ec_diary ...\""
echo "2. For PLANS: write a SEPARATE diary entry per plan with entry_type='plan'. The plan details go in the 'summary' field (full text, preserve structure). These are critical decision records."
echo "3. For the session work: write one diary entry with entry_type='build' (or 'fix'/'deploy'). Title summarizes the session. Prompts go in 'prompt' field, insights in 'summary'."
echo "4. After all diary entries are written, clear the buffers: rm -f $PROMPTS $INSIGHTS $PLANS"
echo "5. Then retry: git push"

# Block the push (exit 2 = block with message)
exit 2
