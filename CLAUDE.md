# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

React Grab is a developer-tool overlay library that lets you select elements from a running website and copy their context (component name, source file, HTML) for coding agents. The core library is built with **Solid.js** (not React) and mounts into React apps via a portal. It integrates with a Cloudflare Worker backend (`sync-server`) for persistence, screenshots, and JIRA integration.

This is the **AdCreative fork** — consumed by `AdCreative-Frontend-V2` via a local pnpm symlink. AdCreative is an enterprise product — code quality must be production-grade. No shortcuts, no half-finished implementations, no "good enough" workarounds. Every change should be clean, typed, tested, and maintainable.

## CRITICAL: Read `architecture.yml` first

**Every session must load `architecture.yml` at the start — before scanning code, debugging, or proposing changes.** It is the canonical index of this codebase and the cheapest way to understand the cross-package picture that no single file exposes.

| Section | What's in it | Use it when |
|---|---|---|
| `packages.*` | Entry points for every package (core, sync-server, dashboard, cli, mcp, web-extension, gym, etc.) | Starting exploration of any package |
| `features.*` | 17 cross-package features with file lists, statuses, linked PRDs/SPECs/ADRs | Finding every file related to a feature in one lookup (no grepping) |
| `data_flows.*` | Reactive data flow — composition roots, stores, sources, consumers, triggers (e.g., 30s JIRA polling) | Tracing how data moves end-to-end; debugging reactive chains |
| `data_attrs.*` | Catalog of 121+ `data-react-grab-*` DOM identifiers with scope ownership + generated inventory | Picking the right attr for a test selector or overlay event boundary |
| `api_contract` | Zod → OpenAPI → Orval codegen chain | Before touching schemas or regenerating the fetch client |
| `decree.*` | PRD / SPEC / ADR registry with file paths + statuses | Finding the spec or ADR behind any decision |

Keep it in sync: `pnpm arch:codegen` regenerates derived sections; `pnpm arch:lint` validates it (enforced via pre-commit hook + CI).

## CRITICAL: Code navigation

Once `architecture.yml` has given you the file path, **MUST use Serena MCP tools (`find_symbol`, `get_symbols_overview`, `find_referencing_symbols`) for all code scanning and navigation.** Do not read entire files with `Read` or search with `Grep` when Serena can answer the question symbolically. Serena is token-efficient — it returns only what you need.

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

# E2E — run single file (PREFERRED — always run targeted tests)
pnpm --filter react-grab exec playwright test e2e/mocked/jira-comment-write.spec.ts --project=chromium

# E2E — run mocked tests only
pnpm --filter react-grab exec playwright test e2e/mocked/ --project=chromium

# E2E — filter by test name
pnpm --filter react-grab exec playwright test --project=chromium --headed --grep "comment"

# E2E — run tests for a decree spec (tags: @SPEC-004, @SPEC-010, @SPEC-013)
pnpm --filter react-grab exec playwright test --project=chromium --headed --grep @SPEC-013

# E2E — UI mode (interactive test explorer)
pnpm --filter react-grab test:e2e:ui

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

# Architecture — codegen + lint + dependency graph
pnpm arch:codegen              # Generate/merge machine-derivable sections of architecture.yml
pnpm arch:lint                 # Validate paths + data_flows consumers + data-react-grab-* attr scoping
pnpm arch:deps                 # JSON import tree from core/index.tsx
pnpm arch:deps:circular        # Check for circular dependencies
pnpm arch:deps:svg             # Generate SVG → docs/architecture/dependency-graph.svg

# Playwright browser install (first-time)
pnpm --filter react-grab exec playwright install chromium --with-deps

# Dashboard dev
pnpm --filter dashboard dev

# Gym (agent testing playground)
pnpm --filter @react-grab/gym dev:mcp
```

## Architecture

### Navigation

See the [Read `architecture.yml` first](#critical-read-architectureyml-first) section above — that's the map. Below is how codegen keeps it in sync.

`pnpm arch:codegen` uses madge (import tree tracing) and ts-morph (AST analysis) to generate machine-derivable fields while preserving human-authored content:

| Field | Codegen behavior |
|---|---|
| `features.*.files` | **Replaced** — madge traces import tree from entry point, scoped to owned dirs |
| `features.*.description`, `status`, `prds`, `specs`, `adrs` | **Preserved** — human-authored |
| `data_flows.*.sources.*.consumers` | **Replaced** — madge reverse-dependency tracing |
| `data_flows.*.sources.*.trigger` | **Replaced** — ts-morph detects `setInterval` patterns |
| `data_flows.*.description`, `init_sequence` | **Preserved** — human-authored |
| `data_attrs.inventory` | **Replaced** — scans `src/` + `e2e/` for `data-react-grab-*` occurrences |
| `data_attrs.scopes`, `reserved`, `bare_verbs` | **Preserved** — human-authored |
| `packages.*`, `decree.*` | **Preserved** — stable/managed elsewhere |

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

### Data attributes (`data-react-grab-*`)

Every overlay element carries a `data-react-grab-*` attribute used for:
event boundaries (overlay ignore), Playwright selectors, and devtool inspection. There is a central catalog in `architecture.yml` under `data_attrs` with scope declarations (authored) and a generated inventory (all 120+ attrs).

**SSOT split:** JSX is the source of truth for what exists. `data_attrs.scopes` is the source of truth for what's allowed. `data_attrs.inventory` is a materialized report — `pnpm arch:codegen` regenerates it from a code scan; never edit it by hand.

**Check `packages/react-grab/docs/data-attrs.md` when:**
- Adding a new `data-react-grab-*` attr (rules R1–R4, scope choice)
- Renaming / removing an attr (atomic JSX + test + scope update)
- `pnpm arch:lint` fails with `[orphan]`, `[stale-test]`, or warns `[bare-verb]`
- Creating a new feature region (whether to extend a scope or create one)

Flow for a new attr: write JSX → add suffix to the right `scopes.*.owns` → run `pnpm arch:codegen` → run `pnpm arch:lint` → commit JSX and `architecture.yml` together. Full scenarios (new region, rename, delete) + enforcement status in the doc.

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

Sync-server secrets go in `packages/sync-server/.dev.vars` (gitignored). Copy `.dev.vars.example`, which lists every value, and see ADR-0018 and ADR-0020:

```dotenv
JIRA_EMAIL=you@yourcompany.com
JIRA_API_TOKEN=<atlassian token>
SYNC_API_TOKEN=<32+ random characters, e.g. openssl rand -base64 32>
```

The sync server refuses every data request without `SYNC_API_TOKEN` (ADR-0020). Each caller needs the same value:

| Caller | Where the token goes |
|---|---|
| Overlay in AdCreative-Frontend-V2 | `VITE_REACT_GRAB_SYNC_TOKEN` in its `.env.local`, passed as `initSync({ apiToken })` |
| Dashboard | `SYNC_API_TOKEN` in `packages/dashboard/.env.local` (the dev proxy adds it) |
| Deployed Worker | `wrangler secret put SYNC_API_TOKEN` |

AdCreative frontend needs in its `.env.local`:

```dotenv
VITE_REACT_GRAB_SYNC_URL=http://localhost:8787
VITE_REACT_GRAB_SYNC_WORKSPACE=<name>-workspace
VITE_REACT_GRAB_SYNC_TOKEN=<same value as SYNC_API_TOKEN>
```

`initSync()` throws if sync is enabled without `apiToken`. It runs only in development builds, so the token never ships in a production bundle.

## Local dev (full stack)

Three terminals: `pnpm dev` (library watch), `pnpm sync:dev` (sync server on :8787), and `pnpm dev` in AdCreative-Frontend-V2. The symlink in AdCreative's `node_modules/react-grab` points to `../../react-grab/packages/react-grab` — Vite HMR picks up changes automatically.

### Watch modes

| Script | Emits | Rebuild time | Use when |
|---|---|---|---|
| `pnpm dev` | JS only (ESM+CJS+IIFE) | ~15–20s | Default. Fast iteration on implementation. |
| `pnpm dev:full` | JS + DTS | ~30–40s | Iterating on public types/exports and you need the IDE to reflect them live. |

`pnpm dev` passes `--no-dts --no-clean` to tsup. DTS comes from a prior `pnpm build` and is preserved across watch restarts via the tsup `clean` pattern (`"!**/*.d.ts", "!**/*.d.cts"`).

### First-run sequence

```bash
pnpm build   # one-shot — writes fresh DTS + full dist
pnpm dev     # watch — JS-only rebuilds
```

Without the initial `pnpm build`, ADC's TypeScript will fail to resolve `react-grab` types (runtime still works — Vite strips types).

### Gotchas

- **Never run stray `tsup` / `pnpm build` while `pnpm dev` is running in another terminal.** Two tsup processes racing on the same `dist/` will corrupt outputs and wedge the watcher.
- **If ADC's Vite errors with `Failed to resolve entry for package "react-grab"`:** ADC started while tsup was mid-rebuild and cached the failure. Fix: `rm -rf AdCreative-Frontend-V2/node_modules/.vite` then restart ADC's Vite.
- **If ADC's Vite errors with `Failed to resolve import "@solid-devtools/overlay"`:** you're on a version before the `fix(dev): avoid static resolution of optional solid-devtools import` commit. Pull latest `main`.

## E2E Testing

**CRITICAL: Never run the full test suite locally.** 580+ tests take 4.5+ minutes. Always run targeted tests:

```bash
# Run tests for the spec you're working on
pnpm --filter react-grab exec playwright test --project=chromium --grep @SPEC-013

# Run a specific file
pnpm --filter react-grab exec playwright test e2e/mocked/jira-comment-write.spec.ts --project=chromium

# Run mocked tests only
pnpm --filter react-grab exec playwright test e2e/mocked/ --project=chromium

# Quick smoke test (one file)
pnpm --filter react-grab exec playwright test e2e/activation.spec.ts --project=chromium

# UI mode for interactive debugging
pnpm --filter react-grab test:e2e:ui
```

### Architecture — single Playwright project

One project (`chromium`), one port (5175), one Vite dev server. Tests control sync state via the `reactGrab` page object — no Vite modes, no env vars, no separate ports.

| Test type | How it gets data | Example |
|---|---|---|
| Overlay-only (activation, toolbar, selection) | No sync needed — sidebar renders empty | `e2e/activation.spec.ts` |
| Sidebar/JIRA UI (visual, groups, comments) | `reactGrab.populate()` seeds store directly | `e2e/mocked/jira-comment-sidebar-visual.spec.ts` |
| HTTP behavior (write-back, polling, error) | `mockServer` fixture + `reactGrab.triggerInitSync()` | `e2e/mocked/jira-comment-write.spec.ts` |

### How sync data gets into tests

The `reactGrab` page object exposes two methods:

- **`reactGrab.populate(overrides?)`** — Seeds the sync store with mock data (groups, comments, workspace). No HTTP. For UI tests that need sidebar data.
- **`reactGrab.triggerInitSync(config?)`** — Calls `initSync()` which makes real HTTP calls. For tests that need `mockServer` to intercept requests.

**These are mutually exclusive.** Never use both in the same test.

```ts
// UI test — seed data directly, no HTTP
test('sidebar shows groups', async ({ reactGrab }) => {
  await reactGrab.populate();
  await openSidebar(page);
  // assert on sidebar content...
});

// HTTP test — mockServer intercepts initSync HTTP calls
test('comment write-back posts to JIRA', async ({ reactGrab, mockServer }) => {
  await reactGrab.triggerInitSync();
  // assert on mockServer.requests()...
});
```

### How the mock server works

`e2e/mocks/fixtures.ts` — deterministic data for all 15 sync-server endpoints (groups, selections, JIRA tickets, comments, users, projects, priorities, labels, screenshots).

`e2e/mocks/routes.ts` — `mockSyncServer(page)` registers `page.route()` handlers that intercept network calls before they leave the browser. Supports per-test overrides and request capture.

`e2e/fixtures.ts` — `mockServer` is opt-in (`{ auto: false }`). Only created when a test declares it in its function signature. For HTTP tests, declare `mockServer` in `beforeEach` so routes are registered before `triggerInitSync()`.

### Decree spec tags — linking tests to specs

Every mocked E2E test must be tagged with its decree spec using Playwright's `tag` option. This enables filtering tests by spec (`--grep @SPEC-013`) and shows in the HTML report + UI mode.

**Convention:** Tag the `test.describe` block so all tests inside inherit the tag. Add `annotation` on individual tests for AC-level traceability.

```ts
test.describe('JIRA comment write-back', { tag: ['@SPEC-013'] }, () => {
  test('AC-1: Cmd+Enter submits the comment', {
    annotation: { type: 'ac', description: 'SPEC-013 AC-1' },
  }, async ({ reactGrab, mockServer }) => {
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
| `e2e/fixtures.ts` | `reactGrab` page object (70+ methods, `populate()`, `triggerInitSync()`), `mockServer` fixture |
| `e2e/mocks/fixtures.ts` | Typed mock data for all 15 endpoints |
| `e2e/mocks/routes.ts` | `mockSyncServer(page)` — route interception + request capture |
| `e2e/mocked/*.spec.ts` | Tests that need sync data or mock server |
| `playwright.config.ts` | Single project, single web server |

## Conventions

- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`
- Add changesets for published package changes: `pnpm changeset`
- Lint/format tools: **oxlint** + **oxfmt** (not ESLint/Prettier, except dashboard)
- Package manager: **pnpm** (pinned to 10.24.0 via `packageManager` field)
- Node: >= 18 (>= 22.18 for AdCreative integration)
