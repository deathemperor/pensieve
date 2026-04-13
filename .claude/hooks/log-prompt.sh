#!/bin/bash
# Logs each user prompt to .session/prompts.jsonl
INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty')
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

[ -z "$PROMPT" ] && exit 0

mkdir -p "$REPO_ROOT/.session"
echo "{\"ts\":\"$TIMESTAMP\",\"prompt\":$(jq -n --arg v "$PROMPT" '$v')}" >> "$REPO_ROOT/.session/prompts.jsonl"

exit 0
