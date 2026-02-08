#!/usr/bin/env bash
# format-on-save.sh — Auto-format files after Write/Edit
# PostToolUse hook: formats the edited file with Prettier or rustfmt

set -euo pipefail

# Extract the file path from the tool input JSON
FILE_PATH=$(echo "${CLAUDE_TOOL_INPUT:-{}}" | jq -r '.file_path // .filePath // empty')

if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

# Skip auto-generated files
case "$FILE_PATH" in
  */bindings.ts) exit 0 ;;
esac

# Determine formatter based on file extension
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.md|*.html)
    pnpm exec prettier --write "$FILE_PATH" 2>/dev/null || true
    ;;
  *.rs)
    rustfmt "$FILE_PATH" 2>/dev/null || true
    ;;
esac

exit 0
