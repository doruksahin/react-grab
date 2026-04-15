---
date: '2026-04-15'
references:
- PRD-012
status: accepted
---

# ADR-0011 Sync store populate pattern for test decoupling

## Context and Problem Statement

PRD-012 requires that the sync store be populatable without HTTP calls so E2E tests can seed sidebar/JIRA UI data directly. The reactive sync layer refactor (already implemented) split the store from transport — `createSyncStore` has public `reconcileGroups()`, `reconcileComments()`, and `setConfig()` methods. The question is how to expose a seeding mechanism to tests without compromising the library's public API or test fidelity.

## Decision Drivers

- The sync store already has all necessary setters — no new store API is needed
- `initSync()` is the only public entry point; it must remain unchanged for consumers
- The readiness gate (`status !== "idle"`) must be set correctly by any population path
- The e2e-app is a test target, not a published artifact — dev-only window properties are acceptable
- `page.route()` mocking must remain available for HTTP behavior tests
- Solid.js `batch()` should wrap multi-setter calls to avoid intermediate render states

## Considered Options

### Option A: Public `seedSync()` export from `react-grab`

Add `seedSync(config)` to the library's public API that calls `setConfig` + `reconcileGroups` + `reconcileComments` + `setStatus("local")` in one batch, without creating an HTTP adapter.

- **Pro**: Simple, single function call
- **Con**: Adds a test-only backdoor to the public API — consumers could call it instead of `initSync` and get a broken store (no adapter, no polling, no persistence)
- **Con**: Bypasses `init()` entirely — any normalization or migration logic in the init path is skipped, creating test/prod divergence
- **Con**: Status stays "local" but no localStorage was loaded — semantically wrong

### Option B: `populate()` method on sync layer + dev-only window exposure

Add a `populate(data)` method to the sync layer's internal API that calls `setConfig` + `reconcileGroups` + `reconcileComments` + `setStatus("local")` in a single `batch()`. The e2e-app exposes it on `window.__reactGrabSync` behind an `import.meta.env.DEV` guard. Tests call it via `page.evaluate()` or `page.addInitScript()`.

- **Pro**: No public API change — `populate` is internal to the sync layer
- **Pro**: Dev-only window exposure lives in the test target app, not the library
- **Pro**: Uses plain `setStore` for initial seeding (not `reconcile` against empty arrays — cheaper)
- **Pro**: Single `batch()` avoids intermediate renders
- **Con**: Tests seed data through a different path than production `initSync()` — HTTP behavior tests still need `page.route()` to test the real path

### Option C: Solid.js Context/Provider pattern

Replace the module-level `createSyncLayer()` singleton with a `<SyncProvider>` context. Tests wrap the overlay in `<SyncProvider seed={data}>`, production wraps in `<SyncProvider config={syncConfig}>`.

- **Pro**: Most idiomatic Solid.js approach
- **Pro**: No window globals, no dev-only guards
- **Con**: Massive refactor — every `syncLayer.foo()` call in core/index.tsx must change to `useSyncContext().foo()`
- **Con**: The overlay mounts via `render()` into a shadow DOM portal — injecting a provider requires restructuring the mount point
- **Con**: Overkill for the problem size — the store is already decoupled from transport

## Decision Outcome

**Option B**: `populate()` method on sync layer + dev-only window exposure.

The store already has the setters. `populate()` is a thin composition that calls them in a batch. The dev-only window property is an established pattern in this codebase (`window.initReactGrab` already exists in e2e-app). This keeps the library's public API clean while giving tests full control over sync state.

Option A was rejected because a public `seedSync` invites misuse and creates test/prod divergence. Option C was rejected because the refactor cost is disproportionate — the module-level singleton works fine now that the reactive sync layer separated store from transport.

### Consequences

- Tests that verify UI behavior (sidebar rendering, group display, comment visibility) seed data via `populate()` — no HTTP mocking needed
- Tests that verify HTTP behavior (write-back payloads, polling, error recovery) continue using `page.route()` + real `initSync()` path
- The readiness gate (`status !== "idle"`) applies uniformly — both `populate()` and `init()` set status, so the sidebar never renders empty
- The `chromium-mocked` Playwright project, `.env.mock`, `dev:mock` script, and second web server config can be removed
