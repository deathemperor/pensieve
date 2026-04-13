#!/bin/bash
# PostToolUse hook — appends session logs to PR body after `gh pr create`

INPUT=$(cat)
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Only process gh pr create commands
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
echo "$COMMAND" | grep -qE 'gh\s+pr\s+create' || exit 0

# Find the PR we just created (most recent by this user)
PR_NUM=$(gh pr list --author @me --state open --limit 1 --json number -q '.[0].number' 2>/dev/null)
[ -z "$PR_NUM" ] && exit 0

# Check if logs are already appended (idempotent)
CURRENT_BODY=$(gh pr view "$PR_NUM" --json body -q '.body' 2>/dev/null)
echo "$CURRENT_BODY" | grep -q "## Session Logs" && exit 0

# Collect session data
PROMPTS_FILE="$REPO_ROOT/.session/prompts.jsonl"
INSIGHTS_FILE="$REPO_ROOT/.session/insights.jsonl"
PLANS_FILE="$REPO_ROOT/.session/plans.jsonl"

LOGS=$(python3 -c "
import json, os

sections = []

def read_jsonl(path, key):
    if not os.path.isfile(path):
        return []
    items = []
    for line in open(path):
        try:
            d = json.loads(line.strip())
            v = d.get(key, '').strip()
            if v:
                items.append(v)
        except:
            pass
    return items

prompts = read_jsonl('$PROMPTS_FILE', 'prompt')
if prompts:
    sections.append('### Prompts\n' + '\n'.join(f'- {p}' for p in prompts))

insights = read_jsonl('$INSIGHTS_FILE', 'insight')
if insights:
    sections.append('### Insights\n' + '\n'.join(f'- {i}' for i in insights))

plans = read_jsonl('$PLANS_FILE', 'title')
if plans:
    sections.append('### Plans\n' + '\n'.join(f'- {p}' for p in plans))

if sections:
    print('\n\n'.join(sections))
" 2>/dev/null)

[ -z "$LOGS" ] && exit 0

# Append logs to PR body
NEW_BODY="$CURRENT_BODY

---

## Session Logs

$LOGS"

gh pr edit "$PR_NUM" --body "$NEW_BODY" > /dev/null 2>&1

exit 0
