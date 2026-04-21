#!/usr/bin/env bash
# Pensieve Publisher release script.
#
# Reads the version from manifest.json, builds the plugin, mirrors the source
# to the distribution repo (deathemperor/obsidian-pensieve-publisher), tags
# with that version, and creates a GitHub release with main.js + manifest.json
# + styles.css as assets. BRAT auto-picks up new releases within hours.
#
# Usage (from plugin dir):
#   npm run release
#
# Workflow:
#   1. Bump `version` in BOTH manifest.json and package.json.
#   2. Commit locally in the monorepo (or don't — the script only reads files).
#   3. Run `npm run release`.
#
# Preconditions: gh CLI authenticated, git + rsync + node available.

set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PLUGIN_DIR"

DIST_REPO="deathemperor/obsidian-pensieve-publisher"
DIST_URL="git@github.com:${DIST_REPO}.git"
WORK_DIR="$(mktemp -d -t obsidian-pensieve-publisher-release-XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT

# Verify manifest + package versions are in sync
MANIFEST_VERSION="$(node -p "require('./manifest.json').version")"
PACKAGE_VERSION="$(node -p "require('./package.json').version")"
if [ "$MANIFEST_VERSION" != "$PACKAGE_VERSION" ]; then
  echo "✗ Version mismatch — manifest.json is $MANIFEST_VERSION, package.json is $PACKAGE_VERSION"
  echo "  Update both to match before releasing."
  exit 1
fi
VERSION="$MANIFEST_VERSION"
echo "→ Releasing Pensieve Publisher v$VERSION"

# Abort early if the tag already exists on the remote
if gh release view "$VERSION" --repo "$DIST_REPO" >/dev/null 2>&1; then
  echo "✗ Release v$VERSION already exists on $DIST_REPO."
  echo "  Bump the version in manifest.json and package.json, then retry."
  exit 1
fi

# Fresh build
echo "→ Building…"
npm run build >/dev/null

# Sanity: the built files we'll ship must exist
for f in main.js manifest.json styles.css; do
  if [ ! -f "$f" ]; then
    echo "✗ Missing $f after build. Aborting."
    exit 1
  fi
done

# Mirror source into a clean clone of the distribution repo
echo "→ Cloning $DIST_REPO into $WORK_DIR…"
git clone --quiet --depth 1 "$DIST_URL" "$WORK_DIR/repo"

# Replace the clone's tree with the plugin dir, excluding build/state noise.
# The distribution repo is a source mirror — everything the user'd want to
# inspect, minus node_modules / data.json / build caches.
echo "→ Mirroring files…"
rsync -a --delete \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='data.json' \
  --exclude='*.tgz' \
  --exclude='.DS_Store' \
  "$PLUGIN_DIR/" "$WORK_DIR/repo/"

# Commit if anything changed in the tree
cd "$WORK_DIR/repo"
if [ -z "$(git status --porcelain)" ]; then
  echo "→ No source changes since last release, skipping commit."
else
  git add -A
  git commit -q -m "release: v$VERSION" \
    --author="Trương Hữu Lộc <loc.truongh@gmail.com>"
  git push -q origin main
fi

# Tag and push
echo "→ Tagging $VERSION…"
git tag -a "$VERSION" -m "Pensieve Publisher v$VERSION"
git push -q origin "$VERSION"

# Create the GitHub release with the three built assets.
# BRAT reads manifest.json from the assets, not the repo tree — so even if
# the tree got out of sync the release would still be installable.
echo "→ Creating GitHub release…"
gh release create "$VERSION" \
  --repo "$DIST_REPO" \
  --title "v$VERSION" \
  --generate-notes \
  "$PLUGIN_DIR/main.js" \
  "$PLUGIN_DIR/manifest.json" \
  "$PLUGIN_DIR/styles.css" >/dev/null

echo ""
echo "✓ Released v$VERSION"
echo "  https://github.com/${DIST_REPO}/releases/tag/${VERSION}"
echo ""
echo "  BRAT users on mobile will see the update automatically within a few hours,"
echo "  or they can force a check from BRAT → Re-install plugin."
