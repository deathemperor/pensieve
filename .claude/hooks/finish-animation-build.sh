#!/bin/bash
# Seal the active animation build session. Validates cursor continuity,
# writes an endedAt descriptor for the pre-push publisher.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MARKER="$REPO_ROOT/.session/active-animation-build"

if [ ! -f "$MARKER" ]; then
  echo "no active animation build" >&2
  exit 1
fi

SLUG=$(jq -r '.slug' < "$MARKER")
SESSION_ID=$(jq -r '.sessionId' < "$MARKER")
STARTED_AT=$(jq -r '.startedAt' < "$MARKER")
TRANSCRIPT="$REPO_ROOT/.session/animation-transcripts/$SESSION_ID.jsonl"

if [ ! -f "$TRANSCRIPT" ]; then
  echo "no transcript found for session $SESSION_ID" >&2
  exit 1
fi

LINE_COUNT=$(wc -l < "$TRANSCRIPT" | tr -d ' ')

if [ "$LINE_COUNT" -gt 0 ]; then
  EXPECTED=$(seq 0 $((LINE_COUNT - 1)) | tr '\n' ' ')
  ACTUAL=$(jq -r '.cursor' < "$TRANSCRIPT" | tr '\n' ' ')
  if [ "$EXPECTED" != "$ACTUAL" ]; then
    echo "cursor discontinuity detected in $TRANSCRIPT" >&2
    echo "expected: $EXPECTED" >&2
    echo "actual:   $ACTUAL" >&2
    exit 1
  fi
fi

ENDED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

DESCRIPTOR="$REPO_ROOT/.session/animation-transcripts/$SESSION_ID.session.json"
jq -nc \
  --arg slug "$SLUG" \
  --arg sessionId "$SESSION_ID" \
  --arg startedAt "$STARTED_AT" \
  --arg endedAt "$ENDED_AT" \
  --argjson count "$LINE_COUNT" \
  '{slug: $slug, sessionId: $sessionId, startedAt: $startedAt, endedAt: $endedAt, toolCallCount: $count}' \
  > "$DESCRIPTOR"

rm -f "$MARKER"

echo "finished animation build: slug=$SLUG sessionId=$SESSION_ID count=$LINE_COUNT" >&2
