#!/usr/bin/env bash
# scripts/sync-new.sh
#
# Incremental Pensieve sync: drop a new Facebook DYI zip into data/, run this
# script, and only the new (not-yet-in-D1) posts get classified, translated,
# uploaded, and pushed.
#
# Facebook workflow that makes this practical:
#   1. Settings → Your Facebook Information → Download Your Information
#   2. Request a download, select "Posts" only, date range "All time"
#   3. Schedule regular exports (every 1/3/6 months) — FB emails you a link
#   4. Download the zip when the email arrives, drop it into data/
#   5. Run this script
#
# What it does:
#   a. Ingests new zip (ingest-facebook.ts keeps all narratives, new + old)
#   b. Diffs long-posts.json against remote D1 by source_id
#   c. Writes data/new-posts.json containing only posts not already imported
#   d. Prompts you to spawn Claude sub-agents for classification + translation
#      of just the new slice (via the main session's Agent tool)
#   e. Re-runs import-d1 / seed / fix-dates / apply-to-remote with the merged set
#
# The classification + translation step is NOT automatable without an API key
# — it needs an interactive Claude session. Everything else is automated.

set -euo pipefail
cd "$(dirname "$0")/.."

echo "🔄 Pensieve incremental sync"
echo

# Step 1: Ingest the zip in data/ — produces data/long-posts.json
echo "1/5 Ingesting new DYI zip..."
bun run scripts/ingest-facebook.ts
echo

# Step 2: Query the remote D1 for all existing source_ids
echo "2/5 Fetching existing source_ids from remote D1..."
./node_modules/.bin/wrangler d1 execute pensieve-db --remote --json \
    --command "SELECT DISTINCT source_id FROM ec_posts WHERE source_id IS NOT NULL" \
    > /tmp/pensieve-existing-sources.json
echo

# Step 3: Diff and write data/new-posts.json
echo "3/5 Computing diff..."
node -e "
const fs = require('fs');
const longPosts = JSON.parse(fs.readFileSync('data/long-posts.json', 'utf8'));
const remoteRaw = JSON.parse(fs.readFileSync('/tmp/pensieve-existing-sources.json', 'utf8'));
const existingIds = new Set(
  (remoteRaw[0]?.results || []).map(r => r.source_id).filter(Boolean)
);
const newPosts = longPosts.filter(p => !existingIds.has(p.id));
fs.writeFileSync('data/new-posts.json', JSON.stringify(newPosts, null, 2));
console.log(\`   existing on remote: \${existingIds.size}\`);
console.log(\`   in fresh DYI:       \${longPosts.length}\`);
console.log(\`   new to process:     \${newPosts.length}\`);
if (newPosts.length === 0) {
  console.log('\n✅ No new posts to import. Everything is up to date.');
  process.exit(0);
}
"
echo

# Step 4: Classification + translation must happen in a Claude session
echo "4/5 MANUAL STEP — classification + translation"
echo
echo "   Open a Claude Code session in this directory and tell it:"
echo
echo "     \"process data/new-posts.json: classify and translate like before,\""
echo "     \"merge into data/classified.json and data/translations-batch-*.json\""
echo
echo "   Claude will spawn sub-agents, run taste-profile-aware classification,"
echo "   and produce translations for the new slice only."
echo "   Re-run this script after that, and steps 1-3 will pick up where you left off."
echo

# Step 5: Re-run the full pipeline (idempotent)
read -p "Have you already done the classification+translation step above? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Stopping. Re-run after classification is done."
    exit 0
fi

echo "5/5 Re-running import + seed + media upload + push..."
bun run scripts/upload-media.ts
bun run scripts/import-d1.ts
rm -f data.db data.db-shm data.db-wal
./node_modules/.bin/emdash seed seed/seed.json
bun run scripts/fix-dates.ts
bash scripts/apply-to-remote.sh

echo
echo "✅ Sync complete. Run './node_modules/.bin/wrangler deploy' if any code changed."
