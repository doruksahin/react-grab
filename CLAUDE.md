# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

React Grab is a developer-tool overlay library that lets you select elements from a running website and copy their context (component name, source file, HTML) for coding agents. The core library is built with **Solid.js** (not React) and mounts into React apps via a portal. It integrates with a Cloudflare Worker backend (`sync-server`) for persistence, screenshots, and JIRA integration.

This is the **AdCreative fork** — consumed by `AdCreative-Frontend-V2` via a local pnpm symlink. AdCreative is an enterprise product — code quality must be production-grade. No shortcuts, no half-finished implementations, no "good enough" workarounds. Every change should be clean, typed, tested, and maintainable.

## CRITICAL: Code navigation

**MUST use Serena MCP tools (`find_symbol`, `get_symbols_overview`, `find_referencing_symbols`) for all code scanning and navigation.** Do not read entire files with `Read` or search with `Grep` when Serena can answer the question symbolically. Serena is token-efficient — it returns only what you need. Use `architecture.yml` to find entry points, then drill into symbols with Serena.

## Commands

```bash
# Install
pnpm install

# Build (required before test/lint — turbo dependsOn enforces this)
pnpm build

# Dev watch (core library + CLI)
pnpm dev

# Sync server (Cloudflare Worker on :8787)
pnpm sync:dev

# First-run DB setup
pnpm --filter @react-grab/sync-server db:migrate:local

# Test (Playwright E2E + Vitest CLI tests)
pnpm test

# E2E — overlay tests only (headless)
pnpm --filter react-grab test:e2e:overlay

# E2E — mocked JIRA tests only (headless)
pnpm --filter react-grab test:e2e:mocked

# E2E — headed (browser visible)
pnpm --filter react-grab test:e2e:overlay   # already --headed
pnpm --filter react-grab test:e2e:mocked    # already --headed

# E2E — UI mode (interactive test explorer)
pnpm --filter react-grab test:e2e:ui              # all projects
pnpm --filter react-grab test:e2e:overlay:ui      # overlay only
pnpm --filter react-grab test:e2e:mocked:ui       # mocked only

# E2E — run single file
pnpm --filter react-grab exec playwright test e2e/mocked/jira-comment-write.spec.ts --project=chromium-mocked

# E2E — filter by test name
pnpm --filter react-grab exec playwright test --project=chromium-mocked --headed --grep "comment"

# E2E — run tests for a decree spec (tags: @SPEC-004, @SPEC-010, @SPEC-013)
pnpm --filter react-grab exec playwright test --project=chromium-mocked --headed --grep @SPEC-013

# E2E — open HTML report (latest run)
pnpm --filter react-grab exec playwright show-report

# Single package test
pnpm --filter @react-grab/cli test

# Lint (oxlint)
pnpm lint
pnpm lint:fix

# Typecheck
pnpm typecheck

# Format (oxfmt)
pnpm format

# Regenerate typed API client from sync-server OpenAPI spec
pnpm --filter react-grab codegen

# Verify OpenAPI spec + codegen are in sync
pnpm check:codegen

# Architecture — dependency graph (madge + ts-morph)
pnpm arch:deps                # JSON import tree from core/index.tsx
pnpm arch:deps:circular       # Check for circular dependencies
pnpm arch:deps:svg            # Generate SVG → docs/architecture/dependency-graph.svg

# Playwright browser install (first-time)
pnpm --filter react-grab exec playwright install chromium --with-deps

# Dashboard dev
pnpm --filter dashboard dev

# Gym (agent testing playground)
pnpm --filter @react-grab/gym dev:mcp
```

## Architecture

### Navigation

See `architecture.yml` for the full architecture index — package entry points, cross-package feature map (17 features with file lists), and decree document (PRD/SPEC/ADR) registry. Use it with Serena MCP for quick navigation across package boundaries.

### Monorepo layout

pnpm workspaces + Turborepo. Key packages:

| Package | What it is |
|---|---|
| `react-grab` | Core overlay — **Solid.js**, Tailwind v4, Tiptap editor, tsup build |
| `sync-server` | **Cloudflare Worker** — Hono, D1 (Drizzle ORM), R2, JIRA integration |
| `dashboard` | React Vite app — frontend for sync-server (Orval + TanStack Query) |
| `cli` | CLI installer (`npx grab@latest init`) |
| `grab` | Published bundle (lib + CLI) |
| `mcp` | MCP server for Claude Code / Cursor |
| `gym` | Next.js 15 playground for testing agent integration |
| `e2e-app` | Vite React app — Playwright test target |
| `web-extension` | Chrome/Firefox extension |
| `design-system` | Shared Solid.js components (tsup) |
| `website` | Next.js marketing site |

### API contract flow

Zod schemas in `sync-server/src/schemas/` → `pnpm --filter @react-grab/sync-server export-spec` → `openapi.json` → `pnpm --filter react-grab codegen` (Orval) → typed fetch client in `react-grab/src/generated/`. Dashboard has its own Orval codegen from the same spec.

### How react-grab mounts in React apps

`react-grab/src/core/index.tsx` exports `initSync()` — called in the consuming app's entry point (dev-only via `import.meta.env.DEV` guard). The Solid.js overlay renders inside a shadow DOM portal, isolated from the host app's styles.

## Feature structure

When proposing a new feature, always propose the folder structure first. Features live in `packages/react-grab/src/features/<feature-name>/` with colocated business logic, types, and tests. UI components go in `packages/react-grab/src/components/<feature-name>/`. Backend additions go in `packages/sync-server/src/` split across routes, services, and schemas.

### Principles

- **SSOT (Single Source of Truth):** One canonical location for each piece of data. Types extend server-generated types, never duplicate them. Status/color/filter logic lives in one file, referenced everywhere else.
- **SRP (Single Responsibility):** One file = one job. `membership.ts` answers "is this item loose?", `synthetic-group.ts` handles synthetic group lifecycle, `ticket-lock.ts` gates removal. Don't mix concerns.
- **DRY:** Search the codebase before writing. Reuse existing utilities from `features/sidebar/` and `utils/`. If a function is used by 2+ features, extract to `utils/`.

### Feature template

```
features/<feature-name>/
  index.ts              — public API (barrel export, or factory like createSelectionGroups)
  types.ts              — feature-local interfaces (XxxAPI, XxxDeps, XxxProps)
  business/             — pure logic, no UI, no signals (testable in isolation)
    <operation>.ts      — one file per business rule
    <operation>.test.ts — colocated unit test
  hooks/                — Solid.js reactive hooks (use-xxx.ts)
  store/                — persistence (localStorage, adapter calls)
  __tests__/            — integration tests (if not colocated)

components/<feature-name>/
  <component>.tsx       — Solid.js UI components
  editor/               — sub-components if feature has rich UI (e.g., editor, picker)
```

See `packages/react-grab/CLAUDE.md` for concrete examples at different scales and Solid.js patterns.
See `packages/sync-server/CLAUDE.md` for backend feature additions and the layered pattern.
See `packages/dashboard/CLAUDE.md` for dashboard-specific patterns.

## Code style (from AGENTS.md)

- **Interfaces over types**, arrow functions over declarations
- **kebab-case** files, descriptive variable names (no 1-2 char abbreviations)
- **No comments** unless necessary — hacks prefixed with `// HACK: reason`
- **No type casting** (`as`) unless absolutely necessary
- Magic numbers → `constants.ts` with `SCREAMING_SNAKE_CASE` and unit suffixes (`_MS`, `_PX`)
- Utilities → one per file in `utils/`
- Use `Boolean(x)` over `!!x`
- See `AGENTS.md` for the full SolidJS reactivity ruleset

## Environment variables

JIRA credentials go in `packages/sync-server/.dev.vars` (gitignored):

```dotenv
JIRA_EMAIL=you@adcreative.ai
JIRA_API_TOKEN=<token>
```

AdCreative frontend needs in its `.env.local`:

```dotenv
VITE_REACT_GRAB_SYNC_URL=http://localhost:8787
VITE_REACT_GRAB_SYNC_WORKSPACE=<name>-workspace
```

## Local dev (full stack)

Three terminals: `pnpm dev` (library watch), `pnpm sync:dev` (sync server on :8787), and `pnpm dev` in AdCreative-Frontend-V2. The symlink in AdCreative's `node_modules/react-grab` points to `../../react-grab/packages/react-grab` — Vite HMR picks up changes automatically.

## E2E Testing

**Goal:** Run features against a mock sync-server with no real backend, capture screenshots as visual evidence, and link tests to decree SPEC acceptance criteria.

**Quick start:**

```bash
# Run all E2E tests (existing + mocked)
pnpm test

# Run only mocked tests (JIRA features, visual verification)
pnpm --filter react-grab exec playwright test --project=chromium-mocked

# View screenshots and videos in the report
pnpm --filter react-grab exec playwright show-report
```

### Architecture — two Playwright projects

| Project | Port | e2e-app mode | What it tests | initSync |
|---|---|---|---|---|
| `chromium` | 5175 | `dev` (default) | Overlay behavior — activation, selection, toolbar, copy | Off |
| `chromium-mocked` | 5176 | `dev:mock` (.env.mock) | JIRA features — sidebar groups, comments, ticket creation | On (mock server) |

The `chromium` project runs existing tests unaffected. The `chromium-mocked` project runs tests in `e2e/mocked/` against a mock sync-server with video recording enabled.

### How the mock server works

`e2e/mocks/fixtures.ts` — deterministic data for all 15 sync-server endpoints (groups, selections, JIRA tickets, comments, users, projects, priorities, labels, screenshots).

`e2e/mocks/routes.ts` — `mockSyncServer(page)` registers `page.route()` handlers that intercept network calls before they leave the browser. Supports per-test overrides and request capture.

`e2e/fixtures.ts` — `mockServer` fixture auto-resolves before `reactGrab` navigates, so routes are registered before `initSync()` fetches data. `reactGrab.screenshot(name, target)` attaches PNGs to the Playwright HTML report.

### Decree spec tags — linking tests to specs

Every mocked E2E test must be tagged with its decree spec using Playwright's `tag` option. This enables filtering tests by spec (`--grep @SPEC-013`) and shows in the HTML report + UI mode.

**Convention:** Tag the `test.describe` block so all tests inside inherit the tag. Add `annotation` on individual tests for AC-level traceability.

```ts
test.describe('JIRA comment write-back', { tag: ['@SPEC-013'] }, () => {
  test('AC-1: Cmd+Enter submits the comment', {
    annotation: { type: 'ac', description: 'SPEC-013 AC-1' },
  }, async ({ page, reactGrab, mockServer }) => {
    await reactGrab.screenshot('insert-menu-open', 'page');
    // assert...
  });
});
```

**Current tag mapping:**

| Tag | Decree spec | Test files |
|---|---|---|
| `@SPEC-004` | Selection status colors | `selection-label-visual.spec.ts` |
| `@SPEC-010` | JIRA comments display | `jira-comment-sidebar-visual.spec.ts`, `jira-selection-label-visual.spec.ts`, `reveal-test.spec.ts` |
| `@SPEC-013` | JIRA comment write-back | `verify-spec-013.spec.ts`, `jira-comment-write.spec.ts` |

When adding new mocked tests, always add a `@SPEC-xxx` tag. See `TESTING.md` for the full cheatsheet.

### Key files

| File | Purpose |
|---|---|
| `e2e/fixtures.ts` | `reactGrab` page object (70+ methods), `mockServer` fixture, `screenshot()` helper |
| `e2e/mocks/fixtures.ts` | Typed mock data for all 15 endpoints |
| `e2e/mocks/routes.ts` | `mockSyncServer(page)` — route interception + request capture |
| `e2e/mocked/*.spec.ts` | Tests that need the mock server (run in `chromium-mocked` project) |
| `packages/e2e-app/.env.mock` | Env vars for mock mode (`VITE_REACT_GRAB_SYNC_URL`, etc.) |
| `playwright.config.ts` | Two projects, two web servers, video config |

## Conventions

- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`
- Add changesets for published package changes: `pnpm changeset`
- Lint/format tools: **oxlint** + **oxfmt** (not ESLint/Prettier, except dashboard)
- Package manager: **pnpm** (pinned to 10.24.0 via `packageManager` field)
- Node: >= 18 (>= 22.18 for AdCreative integration)
