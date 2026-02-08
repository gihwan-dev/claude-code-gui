#!/usr/bin/env bash
# notify-macos.sh — Send macOS native notifications for Claude Code events
# Notification hook: triggers on permission_prompt, idle_prompt, etc.

set -euo pipefail

TITLE="${CLAUDE_NOTIFICATION_TITLE:-Claude Code}"
MESSAGE="${CLAUDE_NOTIFICATION_MESSAGE:-Needs your attention}"

osascript -e "display notification \"$MESSAGE\" with title \"$TITLE\"" 2>/dev/null || true

exit 0
