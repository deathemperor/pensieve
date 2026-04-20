#!/bin/bash
# Mark a Claude Code session as an animation build. Without this marker,
# the PostToolUse / UserPromptSubmit animation hooks no-op.
#
# Usage: .claude/hooks/start-animation-build.sh <slug>
set -euo pipefail

SLUG="${1:-}"
if [ -z "$SLUG" ]; then
  echo "usage: $0 <animation-slug>" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p "$REPO_ROOT/.session/animation-transcripts" \
         "$REPO_ROOT/.session/animation-renders"

SESSION_ID="sess-$(date +%s)-$$"
STARTED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

cat > "$REPO_ROOT/.session/active-animation-build" <<EOF
{"slug":"$SLUG","sessionId":"$SESSION_ID","startedAt":"$STARTED_AT"}
EOF

touch "$REPO_ROOT/.session/animation-transcripts/$SESSION_ID.jsonl"

echo "started animation build: slug=$SLUG sessionId=$SESSION_ID" >&2
