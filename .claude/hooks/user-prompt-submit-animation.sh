#!/bin/bash
# UserPromptSubmit hook — appends a prompt entry to the active animation
# build's transcript. No-op if no active marker.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MARKER="$REPO_ROOT/.session/active-animation-build"
[ -f "$MARKER" ] || exit 0

SESSION_ID=$(jq -r '.sessionId' < "$MARKER")
TRANSCRIPT="$REPO_ROOT/.session/animation-transcripts/$SESSION_ID.jsonl"
[ -f "$TRANSCRIPT" ] || exit 0

INPUT=$(cat)

CURSOR=$(wc -l < "$TRANSCRIPT" | tr -d ' ')
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // .user_prompt // empty')
[ -z "$PROMPT" ] && exit 0

ENTRY=$(jq -nc \
  --argjson cursor "$CURSOR" \
  --arg ts "$TS" \
  --arg content "$PROMPT" \
  '{cursor: $cursor, ts: $ts, kind: "prompt", content: $content}')

echo "$ENTRY" >> "$TRANSCRIPT"

exit 0
