#!/bin/bash
# Appends an insight to .session/insights.jsonl
# Usage: .claude/hooks/log-insight.sh "insight text here"
INSIGHT="$1"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

[ -z "$INSIGHT" ] && exit 0

mkdir -p "$REPO_ROOT/.session"
echo "{\"ts\":\"$TIMESTAMP\",\"insight\":$(jq -n --arg v "$INSIGHT" '$v')}" >> "$REPO_ROOT/.session/insights.jsonl"

exit 0
