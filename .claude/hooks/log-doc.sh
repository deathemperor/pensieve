#!/bin/bash
# Mirror a design doc to D1.
# Usage: .claude/hooks/log-doc.sh <title> <doc_type> <project> <file_path> [<summary>] [<prompt>] [<notion_url>]
# doc_type: spec | plan
# project: slug like "hp-task-management" or "hogwarts-library"

set -euo pipefail

TITLE="$1"
DOC_TYPE="$2"
PROJECT="$3"
FILE_PATH="$4"
SUMMARY="${5:-}"
PROMPT="${6:-}"
NOTION_URL="${7:-}"

ID="doc_$(date +%s)_$$"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
LINE_COUNT=0
if [ -f "$FILE_PATH" ]; then
  LINE_COUNT=$(wc -l < "$FILE_PATH" | tr -d ' ')
fi

npx wrangler d1 execute pensieve-db --remote --command \
  "INSERT INTO design_docs (id, title, doc_type, project, summary, prompt, file_path, notion_url, line_count, created_at)
   VALUES ('$ID', '$(echo "$TITLE" | sed "s/'/''/g")', '$DOC_TYPE', '$PROJECT', '$(echo "$SUMMARY" | sed "s/'/''/g")', '$(echo "$PROMPT" | sed "s/'/''/g")', '$FILE_PATH', '$NOTION_URL', $LINE_COUNT, '$NOW');"
