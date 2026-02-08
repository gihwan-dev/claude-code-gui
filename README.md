# Claude Code GUI

A desktop GUI client for **Claude Code**, built with **Tauri v2**, **React 19**, and **TypeScript**. Based on [dannysmith/tauri-template](https://github.com/dannysmith/tauri-template).

## Stack

| Layer    | Technologies                                    |
| -------- | ----------------------------------------------- |
| Frontend | React 19, TypeScript, Vite 7                    |
| UI       | shadcn/ui v4, Tailwind CSS v4, Lucide React     |
| State    | Zustand v5, TanStack Query v5                   |
| Backend  | Tauri v2, Rust                                  |
| Testing  | Vitest v4, Testing Library                      |
| Quality  | ESLint, Prettier, ast-grep, knip, jscpd, clippy |

## Getting Started

```bash
# Prerequisites: Node.js 20+, Rust (latest stable)
# See https://tauri.app/start/prerequisites/ for platform-specific deps

git clone https://github.com/gihwan-dev/claude-code-gui.git
cd claude-code-gui
pnpm install
pnpm tauri:dev
```

## Scripts

```bash
pnpm dev          # Start Vite dev server
pnpm tauri:dev    # Run Tauri app with hot reload
pnpm tauri:build  # Build for distribution
pnpm check:all    # Run all quality checks
pnpm test:all     # Run all tests (JS & Rust)
```

## Documentation

- **[Developer Docs](docs/developer/)** - Architecture, patterns, and detailed guides
- **[User Guide](docs/userguide/)** - End-user documentation

## License

[MIT](LICENSE.md)
