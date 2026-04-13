#!/bin/bash
# Stop hook — after each Claude response, check if a new commit was made
# If so, write a diary entry for it automatically via the priori-incantatem agent
# This ensures diary entries are created AS work happens, not batched on push

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LAST_COMMIT_FILE="$REPO_ROOT/.session/last-diary-commit"
PROMPTS="$REPO_ROOT/.session/prompts.jsonl"
INSIGHTS="$REPO_ROOT/.session/insights.jsonl"

# Get the latest commit hash
CURRENT_COMMIT=$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null)
[ -z "$CURRENT_COMMIT" ] && exit 0

# Check if we already logged this commit
if [ -f "$LAST_COMMIT_FILE" ]; then
  LAST_LOGGED=$(cat "$LAST_COMMIT_FILE")
  [ "$LAST_LOGGED" = "$CURRENT_COMMIT" ] && exit 0
fi

# New commit detected — check if it's ours (not a merge/pull)
COMMIT_MSG=$(git -C "$REPO_ROOT" log -1 --format="%s" 2>/dev/null)
echo "$COMMIT_MSG" | grep -q "Co-Authored-By: Claude" || exit 0

# Get commit details for the diary prompt
COMMIT_TITLE=$(git -C "$REPO_ROOT" log -1 --format="%s" 2>/dev/null)
COMMIT_BODY=$(git -C "$REPO_ROOT" log -1 --format="%b" 2>/dev/null)
COMMIT_FILES=$(git -C "$REPO_ROOT" diff-tree --no-commit-id --name-only -r HEAD 2>/dev/null | head -20)

# Gather recent prompts (since last diary commit)
PROMPT_COUNT=0
[ -f "$PROMPTS" ] && PROMPT_COUNT=$(wc -l < "$PROMPTS" | tr -d ' ')

INSIGHT_COUNT=0
[ -f "$INSIGHTS" ] && INSIGHT_COUNT=$(wc -l < "$INSIGHTS" | tr -d ' ')

# Build the output for Claude to use
echo "NEW COMMIT DETECTED — write a diary entry."
echo ""
echo "Commit: $CURRENT_COMMIT"
echo "Title: $COMMIT_TITLE"
[ -n "$COMMIT_BODY" ] && echo "Body: $COMMIT_BODY"
echo "Files: $COMMIT_FILES"
echo "Buffered: $PROMPT_COUNT prompt(s), $INSIGHT_COUNT insight(s)"
echo ""
echo "Dispatch the priori-incantatem agent to write a diary entry for this commit."
echo "After writing, update $LAST_COMMIT_FILE with: $CURRENT_COMMIT"

# Save current commit as logged (even if diary write fails, prevent spam)
mkdir -p "$REPO_ROOT/.session"
echo "$CURRENT_COMMIT" > "$LAST_COMMIT_FILE"

# Don't block — exit 0 so Claude can continue
exit 0
