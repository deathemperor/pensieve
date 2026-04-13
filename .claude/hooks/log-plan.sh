#!/bin/bash
# Appends a plan to .session/plans.jsonl
# Usage: .claude/hooks/log-plan.sh "plan title" "full plan details"
TITLE="$1"
DETAILS="$2"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

[ -z "$TITLE" ] && exit 0
[ -z "$DETAILS" ] && exit 0

mkdir -p "$REPO_ROOT/.session"
echo "{\"ts\":\"$TIMESTAMP\",\"title\":$(jq -n --arg v "$TITLE" '$v'),\"details\":$(jq -n --arg v "$DETAILS" '$v')}" >> "$REPO_ROOT/.session/plans.jsonl"

exit 0
