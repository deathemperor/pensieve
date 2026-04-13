#!/bin/bash
# PostToolUse hook — fires after `git commit`, writes diary entry to D1 directly
# No agent dispatch. No instructions. Just does it.

INPUT=$(cat)
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Only process commits with Claude attribution (check the actual commit, not stdout)
FULL_MSG=$(git -C "$REPO_ROOT" log -1 --format="%B" 2>/dev/null)
echo "$FULL_MSG" | grep -q "Co-Authored-By: Claude" || exit 0

PROMPTS="$REPO_ROOT/.session/prompts.jsonl"
INSIGHTS="$REPO_ROOT/.session/insights.jsonl"

# Commit metadata
COMMIT_HASH=$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null)
COMMIT_TITLE=$(git -C "$REPO_ROOT" log -1 --format="%s" 2>/dev/null)
COMMIT_BODY=$(git -C "$REPO_ROOT" log -1 --format="%b" 2>/dev/null | grep -v "Co-Authored-By" | head -5)
COMMIT_FILES=$(git -C "$REPO_ROOT" diff-tree --no-commit-id --name-only -r HEAD 2>/dev/null | head -10 | tr '\n' ', ' | sed 's/,$//')
TODAY=$(date +%Y-%m-%d)
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Determine entry type
ENTRY_TYPE="build"
echo "$COMMIT_TITLE" | grep -qi "^fix" && ENTRY_TYPE="fix"
echo "$COMMIT_TITLE" | grep -qi "^deploy\|^ci" && ENTRY_TYPE="deploy"

# Escape for SQL
sql_escape() { echo "$1" | sed "s/'/''/g"; }

SQL_TITLE=$(sql_escape "$COMMIT_TITLE")
SQL_BODY=$(sql_escape "$COMMIT_BODY")

# Collect prompts
SQL_PROMPTS=""
if [ -f "$PROMPTS" ]; then
  SQL_PROMPTS=$(python3 -c "
import sys, json
lines = []
for line in open('$PROMPTS'):
    try:
        d = json.loads(line.strip())
        p = d.get('prompt', '').strip()
        if p: lines.append(p)
    except: pass
print('\n'.join(lines)[:2000])
" 2>/dev/null | sed "s/'/''/g")
fi

# Collect insights into summary
SUMMARY="$SQL_BODY"
if [ -f "$INSIGHTS" ]; then
  INSIGHT_TEXT=$(python3 -c "
import sys, json
lines = []
for line in open('$INSIGHTS'):
    try:
        d = json.loads(line.strip())
        i = d.get('insight', '').strip()
        if i: lines.append(i)
    except: pass
print(' | '.join(lines)[:2000])
" 2>/dev/null | sed "s/'/''/g")
  [ -n "$INSIGHT_TEXT" ] && SUMMARY="$SUMMARY $INSIGHT_TEXT"
fi
[ -n "$COMMIT_FILES" ] && SUMMARY="$SUMMARY Files: $COMMIT_FILES"

# Auto-calculate tokens from today's session JSONLs
PROJECT_DIR="$HOME/.claude/projects/-Users-deathemperor-death-pensieve"
TOKEN_DATA="0 0 0 0"
if [ -d "$PROJECT_DIR" ]; then
  TOKEN_DATA=$(find "$PROJECT_DIR" -name "*.jsonl" -newermt "$TODAY" 2>/dev/null | while read jsonl; do
    grep '"usage"' "$jsonl" 2>/dev/null
  done | python3 -c "
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
cost = int(round((inp * 1.5 + out * 7.5 + cache * 0.1875) / 1000))
print(f'{inp} {out} {cache} {cost}')
" 2>/dev/null)
fi
read T_IN T_OUT T_CACHE T_COST <<< "${TOKEN_DATA:-0 0 0 0}"

# Generate ID
ID="dc_$(date +%s)_$(head -c 4 /dev/urandom | xxd -p)"
SLUG="$TODAY-$(echo "$COMMIT_TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | head -c 60)"

# CC version
CC_VERSION=$(claude --version 2>/dev/null | head -1 | sed 's/ .*//' || echo "unknown")

# Write to D1
npx wrangler d1 execute pensieve-db --remote --command \
  "INSERT INTO ec_diary (id, slug, status, title, date, entry_type, prompt, summary, model, claude_code, input_tokens, output_tokens, cache_read, cost, created_at, updated_at, published_at) VALUES ('$ID', '$SLUG', 'published', '$SQL_TITLE', '$TODAY', '$ENTRY_TYPE', '$SQL_PROMPTS', '$SUMMARY', 'claude-opus-4-6', '$CC_VERSION', $T_IN, $T_OUT, $T_CACHE, $T_COST, '$TS', '$TS', '$TS');" \
  > /dev/null 2>&1

# Clear only prompts (consumed by this entry). Insights persist across commits.
rm -f "$PROMPTS"

exit 0
