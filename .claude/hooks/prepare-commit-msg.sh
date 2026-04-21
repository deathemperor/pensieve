#!/usr/bin/env bash
# prepare-commit-msg hook — enforce consistent co-authorship on Claude commits.
#
# Every commit authored as Claude (user.email == noreply@anthropic.com) gets a
# canonical `Co-Authored-By: deathemperor <loc.truongh@gmail.com>` trailer if
# one isn't already present (checked by email, not name, so any variant
# spelling is accepted). Skipped on merges/squashes so we don't mangle
# auto-generated messages.

set -euo pipefail

COMMIT_MSG_FILE="${1:-}"
COMMIT_SOURCE="${2:-}"

[ -z "$COMMIT_MSG_FILE" ] && exit 0

case "$COMMIT_SOURCE" in
  merge|squash) exit 0 ;;
esac

CANONICAL_NAME="deathemperor"
CANONICAL_EMAIL="deathemperor@gmail.com"

# Already has a co-author line with this email? Leave alone.
if grep -Fqi "<${CANONICAL_EMAIL}>" "$COMMIT_MSG_FILE"; then
  exit 0
fi

# Only auto-append when the commit is authored as Claude.
author_email="$(git config user.email 2>/dev/null || true)"
if [ "$author_email" != "noreply@anthropic.com" ]; then
  exit 0
fi

git interpret-trailers \
  --if-exists addIfDifferent \
  --trailer "Co-Authored-By: ${CANONICAL_NAME} <${CANONICAL_EMAIL}>" \
  --in-place \
  "$COMMIT_MSG_FILE"
