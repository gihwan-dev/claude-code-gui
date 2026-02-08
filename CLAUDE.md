# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read @AGENTS.md for architecture patterns, development rules, and agent-specific instructions.

## Quick Reference

### Commands

```bash
# Development (ask user to run dev server — don't run it yourself)
pnpm tauri:dev              # Run Tauri app with hot reload
pnpm dev                    # Vite dev server only (no Tauri)

# Build
pnpm build                  # TypeScript check + Vite build
pnpm tauri:build            # Build native application

# Quality (run after significant changes)
pnpm check:all              # ALL checks: typecheck, lint, ast-grep, format, rust checks, tests

# Individual checks
pnpm typecheck              # TypeScript type check
pnpm lint                   # ESLint (zero warnings)
pnpm ast:lint               # ast-grep architecture rules
pnpm format:check           # Prettier format check
pnpm rust:fmt:check         # Rust formatting
pnpm rust:clippy            # Rust linting

# Testing
pnpm test:run               # Run JS tests once
pnpm rust:test              # Run Rust tests
pnpm test:all               # Both JS + Rust
pnpm test:coverage          # Coverage report (60% threshold)

# Auto-fix
pnpm fix:all                # Fix lint + format + rust fmt + clippy

# Rust/Tauri
pnpm rust:bindings          # Regenerate TypeScript bindings from Rust (tauri-specta)

# Static analysis (periodic)
pnpm knip                   # Find unused exports/files
pnpm jscpd                  # Find code duplication
```

### Running a Single Test

```bash
pnpm vitest run src/path/to/file.test.ts       # Single test file
pnpm vitest run -t "test name"                  # By test name
cd src-tauri && cargo test test_name             # Single Rust test
```

## Package Manager

**Use pnpm** (locked at 10.29.1). Never use npm or yarn.

> Note: AGENTS.md says "Use npm only" — this is incorrect. The project has pnpm-lock.yaml and `"packageManager": "pnpm@10.29.1"` in package.json. Always use pnpm.

## Architecture Overview

**Desktop app**: Tauri v2 (Rust backend) + React 19 (frontend) + TypeScript

### State Management Onion

```
useState (component-local) → Zustand (global UI state) → TanStack Query (persistent/server data)
```

Decision: Is data needed across components? → Zustand. Does it persist between sessions? → TanStack Query.

### Rust ↔ React Bridge (tauri-specta)

All Rust commands are typed via tauri-specta. After adding/changing Rust commands, run `pnpm rust:bindings` to regenerate `src/lib/bindings.ts`.

- **React → Rust**: Import from `@/lib/tauri-bindings`, use `commands.*` with Result handling
- **Rust → React**: `app.emit("event-name", data)` → `listen("event-name", handler)`
- **Never** use string-based `invoke()` directly

### Critical Performance Rules

- **Zustand selectors required**: `useUIStore(state => state.value)` — never destructure the store
- **React Compiler active**: No manual `useMemo`/`useCallback` needed
- **getState() in callbacks**: Use `useStore.getState()` for event handlers, not hook subscriptions
- These rules are enforced by ast-grep (`pnpm ast:lint`)

### Code Style

- Prettier: 2 spaces, single quotes, no semicolons, trailing commas (es5), 80 char width
- TypeScript strict mode with `noUncheckedIndexedAccess`
- Path alias: `@/*` → `./src/*`
- i18n: All user-facing strings in `/locales/*.json` (en, ko)
- Rust: `format!("{variable}")` (modern formatting), Tauri v2 APIs only

### Key Directories

- `src/lib/commands/` — Centralized command system (actions for menus, shortcuts, command palette)
- `src/store/` — Zustand stores (selector pattern enforced)
- `src/hooks/` — Custom hooks (enforced by ast-grep to live here)
- `src/components/terminal/` — xterm.js 터미널 UI (TerminalPanel, theme)
- `src-tauri/src/commands/` — Rust Tauri commands
- `docs/developer/` — 24+ architecture and pattern guides
- `.ast-grep/rules/` — Custom lint rules (no store destructuring, hooks location, no stores in lib)

## Local Status

@CLAUDE.local.md
