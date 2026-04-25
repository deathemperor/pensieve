#!/usr/bin/env bash
# Throttled background sync from origin/main into the active worktree.
#
# Hooked into UserPromptSubmit so it fires roughly whenever Loc types something.
# Internal throttle (default 300s / 5 min) means it only does real work once per
# interval — every other call short-circuits in <1ms.
#
# Behavior:
#   - Always `git fetch origin main` (safe — only updates remote-tracking refs).
#   - On main:                  `git merge --ff-only origin/main`.
#   - On feature branch behind: `git merge --ff-only origin/main` (no local commits to lose).
#   - On feature branch diverged or with uncommitted changes: log + skip (never auto-rebase).
#   - On detached HEAD or unknown state: log + skip.
#
# Output:
#   - Silent when nothing changes (avoids noise on the conversation channel).
#   - Stderr line when it pulled new commits — Claude Code surfaces hook stderr to the user.
#   - Full log: .session/sync.log
#
# Configuration (env vars):
#   SYNC_MAIN_INTERVAL_SEC    Min seconds between real syncs. Default 300.
#   SYNC_MAIN_ENABLED         Set to 0 to disable entirely. Default 1.
#   SYNC_MAIN_ALLOW_FF_FEATURE  Set to 0 to disable feature-branch ff. Default 1.

set -uo pipefail

[ "${SYNC_MAIN_ENABLED:-1}" = "0" ] && exit 0

# Resolve repo root from script location so hook works regardless of cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT" || exit 0

# Sanity: must be inside a git working tree.
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

INTERVAL="${SYNC_MAIN_INTERVAL_SEC:-300}"
STAMP_DIR="$REPO_ROOT/.session"
STAMP_FILE="$STAMP_DIR/sync-main.last"
LOG_FILE="$STAMP_DIR/sync.log"
mkdir -p "$STAMP_DIR" 2>/dev/null || exit 0

now=$(date +%s)
last=0
[ -f "$STAMP_FILE" ] && last=$(cat "$STAMP_FILE" 2>/dev/null || echo 0)
elapsed=$((now - last))
[ "$elapsed" -lt "$INTERVAL" ] && exit 0   # throttle

# Update the stamp BEFORE running git so a slow fetch doesn't queue up duplicates.
echo "$now" > "$STAMP_FILE"

iso() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log() { printf "[%s] %s\n" "$(iso)" "$*" >> "$LOG_FILE"; }

# Fetch in background-friendly mode. --quiet so no chatter on stderr.
if ! git fetch --quiet origin main 2>>"$LOG_FILE"; then
  log "fetch failed (network? auth?)"
  exit 0
fi

branch="$(git branch --show-current 2>/dev/null || echo "")"
if [ -z "$branch" ]; then
  log "detached HEAD; skip"
  exit 0
fi

# Has the working tree been modified? Don't disturb in-progress edits.
if ! git diff --quiet --ignore-submodules HEAD 2>/dev/null; then
  log "branch=$branch has uncommitted changes; skip"
  exit 0
fi

# Compute ahead/behind vs origin/main.
ahead_behind=$(git rev-list --left-right --count "origin/main...HEAD" 2>/dev/null || echo "0	0")
behind=$(echo "$ahead_behind" | awk '{print $1}')
ahead=$(echo "$ahead_behind" | awk '{print $2}')

if [ "$behind" = "0" ]; then
  log "branch=$branch already up to date"
  exit 0
fi

if [ "$branch" = "main" ]; then
  if git merge --ff-only --quiet origin/main 2>>"$LOG_FILE"; then
    log "branch=main fast-forwarded $behind commit(s)"
    echo "[sync-main] pulled $behind commit(s) into main" >&2
    exit 0
  else
    log "branch=main ff failed (someone committed locally?)"
    exit 0
  fi
fi

# Feature branch path. Only ff if there are no local commits to preserve.
if [ "$ahead" != "0" ]; then
  log "branch=$branch diverged ($ahead ahead, $behind behind); skip — manual rebase needed"
  echo "[sync-main] $branch diverged from main ($ahead ahead, $behind behind) — rebase manually when ready" >&2
  exit 0
fi

if [ "${SYNC_MAIN_ALLOW_FF_FEATURE:-1}" = "0" ]; then
  log "branch=$branch is $behind behind main; ff disabled by config"
  exit 0
fi

if git merge --ff-only --quiet origin/main 2>>"$LOG_FILE"; then
  log "branch=$branch fast-forwarded $behind commit(s) from main"
  echo "[sync-main] pulled $behind commit(s) from main into $branch" >&2
  exit 0
fi

log "branch=$branch ff failed despite ahead=0 (worktree owns this ref?)"
exit 0
