#!/bin/bash
# Double-click this to start the TMNT Survivor look-pass agent.
# It opens in its own private workspace and begins with the first message, so
# there is nothing to type or paste. Safe to run twice: each run is a new session.
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="/Users/eladayzen/UnityProjects/WebViewGames/.claude/worktrees/survivor-look/TmntSurvivor"
CLAUDE_BIN="${CLAUDE_BIN:-/Users/eladayzen/.local/bin/claude}"
if [ ! -d "$WORK" ]; then
  echo "The Survivor workspace is missing: $WORK"
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi
cd "$WORK" || exit 1
exec "$CLAUDE_BIN" "$(cat "$HERE/survivor-first-message.txt")"
