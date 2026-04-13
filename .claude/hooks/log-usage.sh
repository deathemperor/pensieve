#!/bin/bash
# Logs token usage to .session/usage.jsonl
# Usage: .claude/hooks/log-usage.sh <input_tokens> <output_tokens> <cache_read> <cost_cents>
INPUT_TOKENS="${1:-0}"
OUTPUT_TOKENS="${2:-0}"
CACHE_READ="${3:-0}"
COST_CENTS="${4:-0}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

mkdir -p "$REPO_ROOT/.session"
echo "{\"ts\":\"$TIMESTAMP\",\"input\":$INPUT_TOKENS,\"output\":$OUTPUT_TOKENS,\"cache\":$CACHE_READ,\"cost\":$COST_CENTS}" >> "$REPO_ROOT/.session/usage.jsonl"

exit 0
