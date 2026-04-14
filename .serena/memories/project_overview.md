# Project Overview

**react-grab** — "Select context for coding agents directly from your website"

## What It Does
A visual element selection toolkit that lets users click on UI elements in a web page to grab context (HTML, screenshots, selectors) for coding agents. Includes a browser extension and an embeddable React/Solid library.

## Monorepo Structure (pnpm workspaces + Turborepo)

| Package | Purpose |
|---------|---------|
| `react-grab` | Core library — Solid.js sidebar/toolbar/overlay injected into pages, element selection engine, JIRA integration via TipTap editor |
| `grab` | Thin wrapper that re-exports react-grab with its own CLI entry |
| `@react-grab/cli` | CLI tooling |
| `@react-grab/web-extension` | Chrome extension (content script + background) wrapping react-grab |
| `@react-grab/sync-server` | Backend sync server (API spec export, codegen) |
| `dashboard` | Dashboard app with codegen'd API client |
| `design-system` | Shared design system |
| `@react-grab/shadcn-registry` | shadcn component registry |
| `website` | Marketing/docs site |
| `e2e-app` | E2E test fixture app |
| `gym` | Dev playground |
| `mcp` | MCP server package |

## Tech Stack
- **UI rendering**: Solid.js (sidebar, toolbar, overlay — NOT React for internals)
- **React integration**: Optional peer dep; uses `bippy` for React fiber inspection
- **Styling**: Tailwind CSS v4, `cva` (class-variance-authority), `tailwind-merge`
- **Build**: tsup (library), Vite (extension/apps), Turborepo (orchestration)
- **Package manager**: pnpm 10
- **Language**: TypeScript 5.9
- **Testing**: Playwright (E2E), Vitest (unit)
- **Linting**: oxlint (not ESLint for the core package)
- **Formatting**: oxfmt
- **API codegen**: Orval (from sync-server OpenAPI spec)
- **Rich text**: TipTap with JIRA markup extension
- **Versioning/Publishing**: Changesets
