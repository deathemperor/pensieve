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

# D1 has a per-statement size limit (~1MB). Split the SQL file into chunks
# and import them sequentially.
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

python3 << PYSCRIPT
import sys
with open("$SQL_FILE", 'r') as f:
    lines = f.readlines()

# Find where INSERTs start
insert_start = None
for i, line in enumerate(lines):
    if line.startswith('INSERT INTO'):
        insert_start = i
        break

if insert_start is None:
    print("ERROR: No INSERTs found in $SQL_FILE", file=sys.stderr)
    sys.exit(1)

# Write schema
with open("$TEMP_DIR/schema.sql", 'w') as f:
    f.writelines(lines[:insert_start])

# PRAGMA foreign_keys=OFF must prefix EVERY chunk — each wrangler
# execute --file runs independently so the pragma doesn't carry across.
PRAGMA_HEADER = "PRAGMA foreign_keys = OFF;\n"

chunk_num = 1
chunk_lines = [PRAGMA_HEADER]
chunk_size = len(PRAGMA_HEADER)
max_size = 150000

for i in range(insert_start, len(lines)):
    line = lines[i]
    line_size = len(line.encode('utf-8'))

    if chunk_size + line_size > max_size and len(chunk_lines) > 1:
        with open(f"$TEMP_DIR/data_{chunk_num:03d}.sql", 'w') as f:
            f.writelines(chunk_lines)
        chunk_num += 1
        chunk_lines = [PRAGMA_HEADER]
        chunk_size = len(PRAGMA_HEADER)

    chunk_lines.append(line)
    chunk_size += line_size

if len(chunk_lines) > 1:
    with open(f"$TEMP_DIR/data_{chunk_num:03d}.sql", 'w') as f:
        f.writelines(chunk_lines)
    chunk_num += 1

print(f"Split into {chunk_num - 1} data chunks")
PYSCRIPT

echo "importing schema into local D1..."
bunx wrangler d1 execute HOL_DB --local --file="$TEMP_DIR/schema.sql" > /dev/null

echo "importing data chunks into local D1..."
for chunk in "$TEMP_DIR"/data_*.sql; do
  echo "  $(basename "$chunk")..."
  bunx wrangler d1 execute HOL_DB --local --file="$chunk" > /dev/null
done

if [ "${1:-}" = "--remote" ]; then
  echo "importing into REMOTE D1 (production)..."
  bunx wrangler d1 execute HOL_DB --remote --file="$SQL_FILE"
fi

echo "done."
