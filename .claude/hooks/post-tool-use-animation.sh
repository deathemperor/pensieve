#!/bin/bash
# PostToolUse hook — appends a tool-call entry to the active animation
# build's transcript. No-op if no active-animation-build marker.
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
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
TOOL_INPUT=$(echo "$INPUT" | jq -c '.tool_input // {}')
TOOL_OUTPUT=$(echo "$INPUT" | jq -c '.tool_response // .output // {}')

CHECKSUM_OBJ="{}"
if [ "$TOOL" = "Write" ] || [ "$TOOL" = "Edit" ]; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
  if [ -n "$FILE_PATH" ] && [ -f "$REPO_ROOT/$FILE_PATH" ] && [[ "$FILE_PATH" == src/animations/* ]]; then
    HASH=$(shasum -a 256 "$REPO_ROOT/$FILE_PATH" | awk '{print $1}')
    CHECKSUM_OBJ=$(jq -nc --arg fp "$FILE_PATH" --arg h "$HASH" '{($fp): $h}')
  fi
fi

ENTRY=$(jq -nc \
  --argjson cursor "$CURSOR" \
  --arg ts "$TS" \
  --arg tool "$TOOL" \
  --argjson input "$TOOL_INPUT" \
  --argjson output "$TOOL_OUTPUT" \
  --argjson checksum "$CHECKSUM_OBJ" \
  '{cursor: $cursor, ts: $ts, kind: "tool", tool: $tool, input: $input, output: $output, postStateChecksum: $checksum}')

# Claude Code hooks fire sequentially per session, so a plain append is safe.
# If we ever see parallel writes, switch to `lockf` (macOS) or `flock` (Linux).
echo "$ENTRY" >> "$TRANSCRIPT"

exit 0
