#!/usr/bin/env bash
# scripts/apply-to-remote.sh
#
# Push local data.db content changes to the remote D1 database.
#
# Problem this solves: each `emdash seed` run generates fresh ULIDs for
# taxonomy terms and bylines. So local ULIDs for "philosophy", "tag:essay",
# "byline-main" etc. differ from whatever remote D1 already has. content_*
# tables FK-reference those ULIDs, so we can't just INSERT content on top of
# the existing remote taxonomy/byline rows — FKs fail.
#
# Strategy: clear all content-adjacent rows on remote (in FK-safe order),
# then re-insert the fresh set from the local dump. Schema, migrations,
# collections, field defs, taxonomy defs, menus, widget areas, settings —
# all preserved on remote.

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f data.db ]]; then
  echo "❌ data.db not found. Run 'rm -f data.db data.db-shm data.db-wal && ./node_modules/.bin/emdash seed seed/seed.json' first." >&2
  exit 1
fi

DUMP=/tmp/pensieve-dump.sql
DELTA=/tmp/pensieve-delta.sql

echo "📦 Dumping local data.db..."
sqlite3 data.db .dump > "$DUMP"

echo "🧹 Building content-delta SQL..."

# ---- Phase 1: wipe content-adjacent rows on remote, in FK-safe order ----
#
# Note: we deliberately do NOT DELETE from _emdash_fts_posts or
# _emdash_fts_pages directly. FTS5 virtual tables are maintained via triggers
# on ec_posts and ec_pages (see seed/migrations). Manually touching the FTS
# virtual tables AND letting the triggers fire causes SQLITE_CORRUPT_VTAB
# because FTS5's shadow-table invariants get violated. Trust the triggers.
cat > "$DELTA" << 'SQL'
-- Clear join tables first (they FK-reference the tables we wipe next)
DELETE FROM content_taxonomies;
DELETE FROM _emdash_content_bylines;
DELETE FROM _emdash_seo;
-- Clear the content rows — triggers will sync the FTS5 virtual tables for us
DELETE FROM ec_posts;
DELETE FROM ec_pages;
-- Clear revisions (safe now that nothing references them)
DELETE FROM revisions;
-- Clear taxonomies and bylines (join tables already cleared)
DELETE FROM taxonomies;
DELETE FROM _emdash_bylines;
SQL

# ---- Phase 2: re-insert fresh rows from local dump ----
# Order matters: parent tables first, then child/join tables.

# Bylines first (referenced by primary_byline_id on ec_posts and by
# _emdash_content_bylines.byline_id)
grep '^INSERT INTO _emdash_bylines ' "$DUMP" >> "$DELTA" || true

# Taxonomies next (referenced by content_taxonomies.taxonomy_id)
grep '^INSERT INTO taxonomies ' "$DUMP" >> "$DELTA" || true

# Content rows (may reference revisions via draft_revision_id / live_revision_id;
# seed-generated posts have these as NULL so no revisions needed)
grep '^INSERT INTO ec_posts ' "$DUMP" >> "$DELTA" || true
grep '^INSERT INTO ec_pages ' "$DUMP" >> "$DELTA" || true

# Join tables last (all parent rows now exist)
grep '^INSERT INTO content_taxonomies ' "$DUMP" >> "$DELTA" || true
grep '^INSERT INTO _emdash_content_bylines ' "$DUMP" >> "$DELTA" || true
grep '^INSERT INTO _emdash_seo ' "$DUMP" >> "$DELTA" || true

# ---- Phase 3: FTS indexing happens automatically via the INSERT triggers on
#      ec_posts and ec_pages; no explicit FTS rebuild needed. ----

INSERT_COUNT=$(grep -c '^INSERT INTO ' "$DELTA" || true)
DELETE_COUNT=$(grep -c '^DELETE FROM ' "$DELTA" || true)
echo "   DELETE statements: $DELETE_COUNT"
echo "   INSERT statements: $INSERT_COUNT"
echo "   File size:        $(wc -c < "$DELTA") bytes"
echo

echo "🚀 Applying delta to remote D1 (pensieve-db)..."
./node_modules/.bin/wrangler d1 execute pensieve-db --remote --file="$DELTA"

echo
echo "✅ Done. Run './node_modules/.bin/wrangler deploy' if you changed Worker code."
