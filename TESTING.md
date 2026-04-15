# Testing Cheatsheet

## CRITICAL: Never run the full suite locally

580+ E2E tests take 4.5+ minutes. **Always run targeted tests.**

```bash
# By spec tag (PREFERRED)
pnpm --filter react-grab exec playwright test --project=chromium --grep @SPEC-013

# By file
pnpm --filter react-grab exec playwright test e2e/mocked/jira-comment-write.spec.ts --project=chromium

# By directory
pnpm --filter react-grab exec playwright test e2e/mocked/ --project=chromium

# Quick smoke test
pnpm --filter react-grab exec playwright test e2e/activation.spec.ts --project=chromium
```

## E2E — Playwright

Single project (`chromium`), single port (5175). Tests control sync state via `reactGrab.populate()` or `reactGrab.triggerInitSync()`.

### Useful flags

```bash
--headed                    # Show the browser window
--debug                     # Headed + inspector (step through)
--grep "selection label"    # Run tests matching name
--repeat-each 3             # Run each test N times (flake check)
--workers 1                 # Serial execution (easier to watch)
--trace on                  # Force trace capture (default: on-first-retry)
```

### UI mode (interactive)

```bash
pnpm --filter react-grab test:e2e:ui
```

### Reports & artifacts

```bash
# Open HTML report (latest run)
pnpm --filter react-grab exec playwright show-report

# Videos: packages/react-grab/test-results/  (enabled per-file with test.use({ video: "on" }))
# Traces: packages/react-grab/test-results/  (captured on first retry)
```

## Test types and how they get data

| Test type | Data method | Example |
|---|---|---|
| Overlay-only | No sync needed | `e2e/activation.spec.ts` |
| Sidebar/JIRA UI | `await reactGrab.populate()` | `e2e/mocked/jira-comment-sidebar-visual.spec.ts` |
| HTTP behavior | `mockServer` + `await reactGrab.triggerInitSync()` | `e2e/mocked/jira-comment-write.spec.ts` |

**`populate()` and `triggerInitSync()` are mutually exclusive.** Never use both in the same test.

### UI test pattern (syncData)

```ts
test.use({ video: "on" });

test.describe("Feature", { tag: ["@SPEC-010"] }, () => {
  test.beforeEach(async ({ reactGrab }) => {
    await reactGrab.populate();   // seeds store with default mock data
  });

  test("sidebar shows groups", async ({ reactGrab }) => {
    // sidebar has data, no HTTP involved
  });
});
```

### HTTP behavior test pattern (mockServer)

```ts
test.use({ video: "on" });

test.describe("Feature", { tag: ["@SPEC-013"] }, () => {
  test.beforeEach(async ({ reactGrab, mockServer }) => {
    // mockServer routes registered during fixture setup
    await reactGrab.triggerInitSync();  // fires HTTP, mockServer intercepts
  });

  test("posts comment to JIRA", async ({ reactGrab, mockServer }) => {
    // assert on mockServer.requests("addJiraComment")
  });
});
```

## Decree spec tags — run tests by SPEC

```bash
# Run all tests for a specific spec
pnpm --filter react-grab exec playwright test --project=chromium --headed --grep @SPEC-013

# Multiple specs
pnpm --filter react-grab exec playwright test --project=chromium --headed --grep "@SPEC-010|@SPEC-013"
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

## Unit tests — Vitest

```bash
pnpm --filter react-grab test:unit
pnpm --filter react-grab test:unit:watch    # watch mode
pnpm --filter @react-grab/cli test
```

## Playwright project

| Project | Port | What it tests | Video |
|---|---|---|---|
| `chromium` | 5175 | Everything — overlay, sidebar, JIRA, HTTP behavior | Per-file (`test.use`) |
| `chromium-touch` | 5175 | Touch interactions | Off |

## First-time setup

```bash
pnpm --filter react-grab exec playwright install chromium --with-deps
```
