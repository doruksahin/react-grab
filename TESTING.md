# Testing Cheatsheet

## Run everything

```bash
pnpm test                   # E2E (Playwright) + CLI unit tests (Vitest)
```

## E2E — Playwright

All commands run from repo root. Add `--filter react-grab` or `cd packages/react-grab`.

```bash
# All E2E projects (overlay + mocked + touch)
pnpm --filter react-grab test:e2e

# Overlay tests only (no backend, port 5175)
pnpm --filter react-grab test:e2e:overlay

# Mocked JIRA tests only (mock sync-server, port 5176)
pnpm --filter react-grab test:e2e:mocked

# Interactive UI mode (pick & run tests visually)
pnpm --filter react-grab test:e2e:ui
```

### Useful flags (append to any command above)

```bash
--headed                    # Show the browser window
--debug                     # Headed + inspector (step through)
--ui                        # Interactive UI mode
--grep "selection label"    # Run tests matching name
--repeat-each 3             # Run each test N times (flake check)
--workers 1                 # Serial execution (easier to watch)
--trace on                  # Force trace capture (default: on-first-retry)
--update-snapshots          # Update visual snapshot baselines
```

### Run a single test file

```bash
pnpm --filter react-grab exec playwright test e2e/mocked/jira-selection-label-visual.spec.ts --project=chromium-mocked
pnpm --filter react-grab exec playwright test e2e/activation.spec.ts --project=chromium
```

### Reports & artifacts

```bash
# Open HTML report (always the latest run)
pnpm --filter react-grab exec playwright show-report

# Videos: packages/react-grab/test-results/   (chromium-mocked records all runs)
# Traces: packages/react-grab/test-results/   (captured on first retry)
```

## Decree spec tags — run tests by SPEC

Mocked E2E tests are tagged with `@SPEC-xxx` matching `decree/spec/` documents. Use `--grep` to run tests for a specific spec.

All commands run from repo root via `pnpm --filter react-grab exec`:

```bash
# Run all tests for a specific spec
pnpm --filter react-grab exec playwright test --project=chromium-mocked --headed --grep @SPEC-013

# Multiple specs
pnpm --filter react-grab exec playwright test --project=chromium-mocked --headed --grep "@SPEC-010|@SPEC-013"

# Exclude a spec
pnpm --filter react-grab exec playwright test --project=chromium-mocked --headed --grep-invert @SPEC-013
```

### Tag → spec mapping

| Tag | Spec | What it covers |
|---|---|---|
| `@SPEC-004` | `decree/spec/004-selection-status-colors.md` | Selection label rendering |
| `@SPEC-010` | `decree/spec/010-jira-comments-display-in-selection-labels.md` | JIRA comments in sidebar, selection labels, reveal |
| `@SPEC-013` | `decree/spec/013-jira-comment-write-back.md` | Comment write-back, mock infra, AC verification |

### Adding tags to new tests

Tag the `test.describe` block (applies to all tests inside):

```ts
test.describe("Feature name", { tag: ["@SPEC-013"] }, () => {
  test("AC-1: description", {
    annotation: { type: "ac", description: "SPEC-013 AC-1" },
  }, async ({ reactGrab }) => {
    // ...
  });
});
```

For standalone tests (no describe block):

```ts
test("test name", { tag: ["@SPEC-010"] }, async ({ reactGrab }) => {
  // ...
});
```

Tags show up in `--ui` mode sidebar and in the HTML report for filtering.

## Unit tests — Vitest

```bash
# react-grab unit tests
pnpm --filter react-grab test:unit
pnpm --filter react-grab test:unit:watch    # watch mode

# CLI unit tests
pnpm --filter @react-grab/cli test
pnpm --filter @react-grab/cli test:watch
```

## Playwright projects

| Project | Port | What it tests | initSync | Video |
|---|---|---|---|---|
| `chromium` | 5175 | Overlay — activation, selection, toolbar, copy | Off | Off |
| `chromium-mocked` | 5176 | JIRA — sidebar, comments, tickets, labels | On (mock) | On |
| `chromium-touch` | 5175 | Touch interactions | Off | Off |

## First-time setup

```bash
pnpm --filter react-grab exec playwright install chromium --with-deps
```
