#!/usr/bin/env bash
# Sync HOL content from ~/death/hol/data/forum.db into Cloudflare D1.
#
# Usage:
#   scripts/hol-sync.sh              # local D1 only
#   scripts/hol-sync.sh --remote     # also push to production D1
#
# Requires the hol exporter to have been run in ~/death/hol first.
set -euo pipefail

HOL_REPO="${HOL_REPO:-$HOME/death/hol}"
SQL_FILE="$HOL_REPO/data/forum.d1.sql"

if [ ! -f "$SQL_FILE" ]; then
  echo "regenerating $SQL_FILE..." >&2
  (cd "$HOL_REPO" && uv run python scripts/export_for_d1.py "$SQL_FILE")
fi

echo "importing into local D1..."
bunx wrangler d1 execute HOL_DB --local --file="$SQL_FILE"

if [ "${1:-}" = "--remote" ]; then
  echo "importing into REMOTE D1 (production)..."
  bunx wrangler d1 execute HOL_DB --remote --file="$SQL_FILE"
fi

echo "done."
