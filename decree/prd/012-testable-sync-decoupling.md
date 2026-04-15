---
date: '2026-04-15'
status: approved
---

# PRD-012 Testable Sync Decoupling

## Problem Statement

The sync layer (`initSync`) is coupled to the Vite build via environment variables and fires at app boot time. This creates a binary split: either the entire sync layer is active (requiring HTTP responses) or it's completely absent (no sidebar, no groups, no JIRA UI). There is no middle ground.

This forced the E2E test infrastructure into two Playwright projects (`chromium` on port 5175, `chromium-mocked` on port 5176), two Vite modes, and two web server configurations — solely because sidebar/JIRA features cannot render without `initSync()` completing an HTTP round-trip. The JIRA sidebar, groups, and comments are overlay features that render inside the same shadow DOM, yet they cannot be tested in the overlay project.

The original repo had a single Playwright project. The split was introduced as a workaround for the boot-time coupling, not as an intentional design.

**Consequences:**
- Every sidebar/JIRA test requires `page.route()` HTTP mocking even when the test only verifies UI behavior (component rendering, interactions, visual state)
- Tests cannot seed sync data per-test — data comes from intercepted HTTP responses, adding indirection and timing sensitivity
- The sidebar renders empty then re-renders when data arrives — no deterministic readiness gate
- Two Vite instances, two ports, a `.env.mock` file, and a `dev:mock` script exist solely for test infrastructure
- New contributors must understand the project split to know where to place tests

## Requirements

### R1: Store population without HTTP
The sync store must be populatable with groups, comments, workspace config, and JIRA project key without triggering HTTP calls or requiring a running server.

### R2: Readiness gate
Sync-dependent UI (sidebar, JIRA features) must not render until sync data is explicitly available. The overlay itself must render immediately regardless of sync state. No empty-then-repopulate render cycle.

### R3: Single Playwright project
All E2E tests (overlay, sidebar, JIRA UI, HTTP behavior) must run in a single Playwright project against a single Vite instance on a single port.

### R4: Fixture-based test setup
Tests must declare their sync needs via Playwright fixtures, not via Vite modes or environment variables. A test that doesn't need sync data should pay zero sync overhead.

### R5: No public API for seeding
The populate mechanism must not be exported from the library's public API. It must only be accessible in the E2E test target app via a dev-only window property.

### R6: HTTP behavior tests preserved
Tests that verify actual HTTP request/response behavior (write-back payloads, polling, error handling) must continue to work via `page.route()` mocking.

## Success Criteria

- Single `chromium` project in `playwright.config.ts` (plus `chromium-touch` for touch tests)
- One `webServer` entry, one port
- `.env.mock` and `dev:mock` script removed
- Existing overlay tests pass without modification
- Existing mocked tests pass with fixture migration (same assertions, no `page.route()` for UI-only tests)
- Sidebar renders deterministically — never in an empty/loading state when sync data has been seeded
