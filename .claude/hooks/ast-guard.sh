#!/usr/bin/env bash
# ast-guard.sh — Check architecture rules after Write/Edit
# PostToolUse hook: runs ast-grep on edited src/ files, feeds violations back to Claude

set -euo pipefail

# Extract the file path from the tool input JSON
FILE_PATH=$(echo "$CLAUDE_TOOL_INPUT" | jq -r '.file_path // .filePath // empty')

if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

# Only check TypeScript files under src/
case "$FILE_PATH" in
  */src/*.ts|*/src/*.tsx) ;;
  *) exit 0 ;;
esac

# Run ast-grep scan on the specific file
VIOLATIONS=$(pnpm exec sg scan "$FILE_PATH" 2>/dev/null || true)

if [[ -n "$VIOLATIONS" ]]; then
  # Output as JSON with additionalContext to feed back to Claude
  jq -n --arg violations "$VIOLATIONS" --arg file "$FILE_PATH" '{
    additionalContext: ("ast-grep architecture violations found in " + $file + ":\n" + $violations + "\n\nPlease fix these violations immediately.")
  }'
fi

exit 0
