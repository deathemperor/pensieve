#!/bin/bash
# Capture a PNG render of the current animation at the current transcript cursor.
# Usage: .claude/hooks/snap-animation.sh <slug> [dev-port]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MARKER="$REPO_ROOT/.session/active-animation-build"
SLUG="${1:-}"
PORT="${2:-4321}"

if [ ! -f "$MARKER" ]; then
  echo "no active animation build -- run start-animation-build.sh first" >&2
  exit 1
fi
if [ -z "$SLUG" ]; then
  echo "usage: $0 <slug>" >&2
  exit 1
fi

SESSION_ID=$(jq -r '.sessionId' < "$MARKER")
TRANSCRIPT="$REPO_ROOT/.session/animation-transcripts/$SESSION_ID.jsonl"
CURSOR=$(wc -l < "$TRANSCRIPT" | tr -d ' ')
OUT_DIR="$REPO_ROOT/.session/animation-renders/$SESSION_ID"
OUT_FILE=$(printf "%s/cursor-%07d.png" "$OUT_DIR" "$CURSOR")

URL="http://localhost:$PORT/animation-preview/$SLUG"

if ! curl -sS -o /dev/null -w "%{http_code}" "$URL" | grep -q "^200$"; then
  echo "dev server not responding at $URL -- start bun run dev first" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
node --import tsx "$REPO_ROOT/scripts/snap-animation.ts" "$URL" "$OUT_FILE"
echo "cursor=$CURSOR snap=$OUT_FILE" >&2
