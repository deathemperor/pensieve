#!/bin/bash
# PreToolUse hook for Bash — intercepts `git push` and requires diary flush
# Reads .session/ buffers + auto-calculates token usage from session JSONL
# Blocks push if there's unwritten session data; lets it through if buffers are empty

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.command // empty')
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Only care about git push
echo "$COMMAND" | grep -qE '^\s*git\s+push' || exit 0

PROMPTS="$REPO_ROOT/.session/prompts.jsonl"
INSIGHTS="$REPO_ROOT/.session/insights.jsonl"
PLANS="$REPO_ROOT/.session/plans.jsonl"
USAGE="$REPO_ROOT/.session/usage.jsonl"
TASKS_LOG="$REPO_ROOT/.session/tasks.jsonl"

# Count lines in each buffer
PROMPT_COUNT=0
INSIGHT_COUNT=0
PLAN_COUNT=0
USAGE_COUNT=0
TASK_COUNT=0
[ -f "$PROMPTS" ] && PROMPT_COUNT=$(wc -l < "$PROMPTS" | tr -d ' ')
[ -f "$INSIGHTS" ] && INSIGHT_COUNT=$(wc -l < "$INSIGHTS" | tr -d ' ')
[ -f "$PLANS" ] && PLAN_COUNT=$(wc -l < "$PLANS" | tr -d ' ')
[ -f "$USAGE" ] && USAGE_COUNT=$(wc -l < "$USAGE" | tr -d ' ')
[ -f "$TASKS_LOG" ] && TASK_COUNT=$(wc -l < "$TASKS_LOG" | tr -d ' ')

# Nothing to flush — let the push through
[ "$PROMPT_COUNT" -eq 0 ] && [ "$INSIGHT_COUNT" -eq 0 ] && [ "$PLAN_COUNT" -eq 0 ] && exit 0

# Auto-calculate token usage from session JSONL files
# Find all session JSONLs for this project, sum usage from assistant messages
PROJECT_DIR="$HOME/.claude/projects/-Users-deathemperor-death-pensieve"
AUTO_INPUT=0
AUTO_OUTPUT=0
AUTO_CACHE=0

if [ -d "$PROJECT_DIR" ]; then
  # Sum tokens from all session JSONLs modified today
  TODAY=$(date +%Y-%m-%d)
  for jsonl in "$PROJECT_DIR"/*.jsonl; do
    [ -f "$jsonl" ] || continue
    # Only process files modified today
    FILE_DATE=$(stat -f "%Sm" -t "%Y-%m-%d" "$jsonl" 2>/dev/null)
    [ "$FILE_DATE" = "$TODAY" ] || continue

    TOKENS=$(grep '"usage"' "$jsonl" 2>/dev/null | python3 -c "
import sys, json
inp, out, cache = 0, 0, 0
for line in sys.stdin:
    try:
        d = json.loads(line)
        u = d.get('message', {}).get('usage', {})
        if u:
            inp += u.get('input_tokens', 0)
            out += u.get('output_tokens', 0)
            cache += u.get('cache_read_input_tokens', 0)
    except: pass
print(f'{inp} {out} {cache}')
" 2>/dev/null)
    if [ -n "$TOKENS" ]; then
      read T_IN T_OUT T_CACHE <<< "$TOKENS"
      AUTO_INPUT=$((AUTO_INPUT + T_IN))
      AUTO_OUTPUT=$((AUTO_OUTPUT + T_OUT))
      AUTO_CACHE=$((AUTO_CACHE + T_CACHE))
    fi
  done
fi

# Calculate cost in cents: Opus $15/M input, $75/M output, $1.875/M cache
if [ "$AUTO_INPUT" -gt 0 ] || [ "$AUTO_OUTPUT" -gt 0 ]; then
  AUTO_COST=$(python3 -c "
inp, out, cache = $AUTO_INPUT, $AUTO_OUTPUT, $AUTO_CACHE
cost_cents = (inp * 1.5 + out * 7.5 + cache * 0.1875) / 1000
print(int(round(cost_cents)))
" 2>/dev/null)
  [ -z "$AUTO_COST" ] && AUTO_COST=0
else
  AUTO_COST=0
fi

# Build diary data for Claude
echo "DIARY ENTRY REQUIRED before pushing."
echo ""
echo "This session has $PROMPT_COUNT prompt(s), $INSIGHT_COUNT insight(s), $PLAN_COUNT plan(s), and $TASK_COUNT task(s)."
echo ""

# Show auto-calculated token usage
if [ "$AUTO_INPUT" -gt 0 ] || [ "$AUTO_OUTPUT" -gt 0 ]; then
  echo "=== TOKEN USAGE (auto-calculated from session JSONL) ==="
  echo "  input_tokens:  $AUTO_INPUT"
  echo "  output_tokens: $AUTO_OUTPUT"
  echo "  cache_read:    $AUTO_CACHE"
  echo "  cost_cents:    $AUTO_COST"
  echo ""
fi

if [ "$PLAN_COUNT" -gt 0 ]; then
  echo "=== PLANS (write SEPARATE diary entries with entry_type='ultraplan' or 'plan') ==="
  cat "$PLANS"
  echo ""
fi

echo "=== PROMPTS ==="
[ -f "$PROMPTS" ] && cat "$PROMPTS"
echo ""
echo "=== INSIGHTS ==="
[ -f "$INSIGHTS" ] && cat "$INSIGHTS"
echo ""

if [ "$TASK_COUNT" -gt 0 ]; then
  echo "=== TASKS ROUTED ==="
  cat "$TASKS_LOG"
  echo ""
fi

echo "=== INSTRUCTIONS ==="
echo "1. Token usage is auto-calculated above. Use those numbers directly for input_tokens, output_tokens, cache_read, and cost fields in diary entries."
echo "2. Write diary entries to the remote D1 database using: npx wrangler d1 execute pensieve-db --remote --command \"INSERT INTO ec_diary ...\""
echo "3. For PLANS: write a SEPARATE diary entry per plan with entry_type='ultraplan' (for ultraplan sessions) or 'plan' (for local planning). The plan details go in the 'summary' field (full text, preserve structure)."
echo "4. For the session work: write one diary entry with entry_type='build' (or 'fix'/'deploy'). Title summarizes the session. Prompts go in 'prompt' field, insights in 'summary'. Include the auto-calculated token usage above."
echo "5. After all diary entries are written, clear the buffers: rm -f $PROMPTS $INSIGHTS $PLANS $USAGE $TASKS_LOG"
echo "6. Then retry: git push"

# Block the push (exit 2 = block with message)
exit 2
