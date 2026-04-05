---
date: '2026-04-05'
references:
- PRD-002
status: accepted
---

# ADR-0002 Solid.js Sidebar with Orval-Generated Types

## Context and Problem Statement

PRD-002 requires embedding the dashboard's group management and JIRA integration into the react-grab floating UI as a sidebar. This creates two architectural decisions:

1. **UI framework:** The sidebar must render inside react-grab's existing Shadow DOM host. React-grab's floating UI is built entirely with Solid.js — the toolbar, selection labels, overlay canvas, and comments dropdown are all Solid components using Solid's reactive store. The dashboard, by contrast, is a standalone React 19 app with React Router, TanStack React Query, and shadcn/ui components. We must decide whether the sidebar uses Solid.js (matching the host) or introduces React (matching the dashboard source).

2. **Data layer and type generation:** The dashboard uses Orval to generate TanStack React Query hooks and TypeScript types from the sync-server's OpenAPI spec (`packages/sync-server/openapi.json`). React-grab **already has its own Orval config** (`packages/react-grab/orval.config.ts`) with `client: "fetch"` that generates types to `src/generated/sync-api.ts`. However, the generated fetch functions are **not used** — the `StorageAdapter` in `adapter.ts` makes manual `fetch()` calls. Only the generated types (`ServerCommentItem`, `ServerSelectionGroup`) are consumed. We must decide how the sidebar fetches JIRA data (which is not covered by the existing adapter) and whether to leverage the unused generated fetch functions.

The decisions are partially coupled: the UI framework constrains which data-fetching primitives wrap the API calls, but the API layer itself is framework-agnostic.

## Decision Drivers

- The sidebar renders inside react-grab's Shadow DOM — mixing two reactive runtimes (React + Solid) in one Shadow DOM tree adds complexity and bundle size
- React-grab's sync feature already fetches group and comment data from the server — the sidebar should reuse this data, not maintain a parallel cache
- The OpenAPI spec is the single source of truth for API types — hand-writing types creates drift risk
- React-grab already has an Orval config generating `client: "fetch"` output — types are used, fetch functions are not
- The sync feature's `StorageAdapter` covers GET/PUT for groups, comments, and screenshots — but not JIRA endpoints
- Sync is **one-shot load + fire-and-forget persist** — not polling. JIRA status tracking requires a new polling pattern
- Developer familiarity: the team has working knowledge of Orval configuration and the existing React Query setup
- Bundle size matters: react-grab is a third-party script injected into host pages

## Considered Options

### Option A: Solid.js sidebar + Orval with custom fetch client (no React)

Keep the entire react-grab codebase on Solid.js. Use the **existing Orval config** (`packages/react-grab/orval.config.ts`, `client: "fetch"`) which already generates framework-agnostic fetch functions and types to `src/generated/sync-api.ts`. Optionally configure Orval's `zod` client to also generate Zod validators for runtime validation — this does not exist today and would be new configuration [A-001](../../docs/assumptions.md).

**For groups and comments (Phase 1-2):** Solid signals for `commentItems()` and `groups()` **already exist** — they are created via `createSignal` in `init()` (`core/index.tsx`) and passed as props to the comments dropdown. The sidebar subscribes to these same signals. No new API calls, no data layer refactoring. The module-level `let` variables in `comment-storage.ts` and `group-storage.ts` are the persistence layer; the Solid signals are the reactive layer on top. Both already exist and work.

**For JIRA endpoints (Phase 3):** The `StorageAdapter` does not cover JIRA. The sidebar calls the Orval-generated fetch functions (already in `src/generated/sync-api.ts` but currently unused) directly, wrapped in Solid's `createResource` [A-006](../../docs/assumptions.md). JIRA status polling is a **new pattern** — the existing sync is one-shot load + fire-and-forget persist, not polling. The sidebar introduces `setInterval` + `refetch()` for 30-second JIRA status updates.

- Good: single reactive runtime, no React in the bundle, types stay spec-driven, smallest bundle delta
- Good: groups/comments data is **already reactive** — Solid signals exist in `init()`, the sidebar just subscribes (same pattern as comments dropdown)
- Good: Orval config with `client: "fetch"` **already exists** in react-grab — generated fetch functions and types are in `src/generated/sync-api.ts`, currently unused but available for JIRA endpoints [A-009](../../docs/assumptions.md)
- Bad: Solid.js has a smaller ecosystem than React — no off-the-shelf component library equivalent to shadcn/ui, select/combobox/dialog components must be built or ported
- Bad: team must learn Solid's `createResource` API if unfamiliar (though it's simpler than React Query)
- Risk: the JIRA create dialog needs searchable selects, modals, and popovers — these are non-trivial to build from scratch in Solid.js inside Shadow DOM

### Option B: Embed React inside Shadow DOM for the sidebar only

Mount a separate React root inside the Shadow DOM for the sidebar. The sidebar reuses the dashboard's existing React components (group list, group detail, JIRA dialog) with minimal changes. Data fetching uses the same Orval-generated React Query hooks.

- Good: maximum code reuse from `packages/dashboard/` — components, hooks, and styles can be copied or shared
- Good: React's component ecosystem (shadcn/ui, Radix, Base UI) is immediately available
- Bad: two reactive runtimes in one Shadow DOM tree — React and Solid both managing DOM updates, event delegation conflicts [A-007](../../docs/assumptions.md), bundle size increases by ~40KB+ (React + ReactDOM minified) [A-003](../../docs/assumptions.md)
- Bad: React components cannot read from the Solid store — need a bridge layer or duplicate state, which the sync feature already populates
- Bad: React Query and the Solid store would both cache the same data — two caches for one API
- Bad: shadcn/ui and Radix popovers portal to `document.body` by default — breaks inside Shadow DOM, requires custom portal targets
- Risk: event propagation between React's synthetic events and Solid's native event handling inside the same Shadow DOM is poorly documented and may cause subtle bugs

### Option C: Solid.js sidebar + hand-written fetch functions (no Orval)

Keep Solid.js. Skip Orval entirely for the sidebar. Extend the existing `StorageAdapter` pattern to include JIRA endpoints, and hand-write TypeScript types based on the OpenAPI spec.

- Good: simplest setup — no Orval configuration to learn, no codegen pipeline to maintain
- Good: full control over the fetch layer, can optimize for Solid's reactivity model
- Bad: types drift from the OpenAPI spec over time — manual synchronization burden
- Bad: duplicates the type definitions that Orval already generates correctly
- Bad: loses the opportunity for Orval-generated runtime validation — API response shape errors silently propagate
- Risk: as the API evolves, the sidebar types lag behind the spec, leading to runtime errors that Orval codegen would catch at build time

## Decision Outcome

**Option A: Solid.js sidebar + Orval with custom fetch client**, because:

1. **Single runtime:** Keeping everything on Solid.js avoids the complexity, bundle bloat, and event-system conflicts of embedding React inside the same Shadow DOM tree. PRD-002's risk section already flags Shadow DOM portal conflicts — adding React makes this worse, not better.

2. **Store integration:** Solid signals for `commentItems()` and `groups()` already exist in `init()` — the comments dropdown already subscribes to them via props. The sidebar follows the same proven pattern. No refactoring of the storage layer is needed; the reactive layer is already in place. The module-level `let` variables (`comment-storage.ts`, `group-storage.ts`) remain the persistence layer, and the existing signals remain the reactive layer. The sidebar simply receives the same signal accessors [A-005](../../docs/assumptions.md).

3. **Spec-driven types already available:** An Orval config with `client: "fetch"` already exists in `packages/react-grab/orval.config.ts`, generating types and fetch functions to `src/generated/sync-api.ts` [A-002](../../docs/assumptions.md). The generated types (`ServerCommentItem`, `ServerSelectionGroup`) are already consumed by the app. The generated fetch functions exist but are unused — the sidebar's JIRA module will be the first consumer. Optionally, Orval's `zod` client can be configured to also generate runtime validators — this would be new capability not currently in the codebase.

4. **JIRA endpoints:** The sync feature's `StorageAdapter` covers groups, comments, and screenshots but not JIRA endpoints [R-001](../../docs/risks.md). Rather than extending the adapter (which is designed for bidirectional sync, not one-off API calls), the sidebar calls the Orval-generated JIRA functions directly. This keeps the adapter focused on sync and the sidebar's JIRA layer thin.

5. **Bundle size:** React + ReactDOM would add ~40KB+ [A-003](../../docs/assumptions.md) to a script injected into every host page. Solid.js is already in the bundle; adding sidebar components adds only the component code, not a new framework.

The main tradeoff is that Solid.js lacks an equivalent to shadcn/ui — the JIRA create dialog's searchable selects, modals, and popovers must be built or adapted. This is real effort (estimated as the majority of Phase 3 work), but it's a one-time cost that keeps the architecture clean. Libraries like Kobalte (Solid.js headless UI) [A-004](../../docs/assumptions.md) [A-010](../../docs/assumptions.md) can accelerate this if the Shadow DOM constraint permits [R-005](../../docs/risks.md).

Option C (hand-written types) was rejected because the OpenAPI spec is the source of truth and Orval already solves the type-generation problem. Discarding it reintroduces manual drift risk that the team has already eliminated on the dashboard side.

## Consequences

- The sidebar is built entirely with Solid.js — no React dependency in `packages/react-grab`
- The existing Orval config (`packages/react-grab/orval.config.ts`, `client: "fetch"`) already generates framework-agnostic fetch functions and types from `packages/sync-server/openapi.json` — the sidebar's JIRA module will be the first consumer of the generated fetch functions (Zod validators can be added as an optional enhancement)
- **No storage layer refactoring needed:** Solid signals for `commentItems()` and `groups()` already exist in `init()`. The sidebar receives these signal accessors as props, the same pattern used by the comments dropdown
- JIRA endpoints (projects, issue-types, priorities, create-ticket, get-status) are called via the already-generated fetch functions in `src/generated/sync-api.ts`, wrapped in Solid's `createResource`
- JIRA status polling introduces a **new pattern** to react-grab: `setInterval` + `createResource.refetch()` for 30-second updates, scoped to the sidebar detail view lifecycle
- Searchable select, dialog, and popover components must be implemented in Solid.js, rendering inside Shadow DOM (evaluate Kobalte as a base) [R-005](../../docs/risks.md) [A-020](../../docs/assumptions.md)
- The `packages/dashboard/` Orval config remains unchanged — it continues generating React Query hooks for as long as the dashboard exists

## Affected Files

- `packages/react-grab/src/features/sidebar/` — new feature directory for sidebar components
- `packages/react-grab/src/components/sidebar/` — Solid.js sidebar UI components
- `packages/react-grab/src/components/toolbar/toolbar-content.tsx` — add dashboard button
- `packages/react-grab/src/components/renderer.tsx` — mount sidebar component, pass existing signal accessors as props
- `packages/react-grab/src/core/index.tsx` — thread `commentItems()`, `groups()`, and `selectionGroups` API to sidebar (same pattern as comments dropdown)
- `packages/react-grab/orval.config.ts` — may need to add JIRA endpoint tags if not already included in generated output
- `packages/react-grab/src/generated/sync-api.ts` — verify JIRA fetch functions are generated (already exists, may need regeneration)

## Validation Needed

1. Verify that the existing generated output in `src/generated/sync-api.ts` includes JIRA endpoint functions (projects, issue-types, priorities, create-ticket, get-status) — if missing, regenerate via `pnpm codegen` and confirm zero `@tanstack/react-query` imports
2. Confirm that Solid's `createResource` can wrap the generated JIRA fetch functions without type conflicts, and that the polling pattern (`setInterval` + `refetch()`) cleanly handles component unmount via `onCleanup`
3. Prototype a searchable select component in Solid.js inside Shadow DOM — validate that popovers render and position correctly without `document.body` access. If Kobalte proves incompatible with Shadow DOM constraints, fall back to minimal DOM-API dialogs without a component library [R-005](../../docs/risks.md) [A-020](../../docs/assumptions.md) [A-021](../../docs/assumptions.md)
4. Measure bundle size delta: baseline react-grab bundle vs. bundle with sidebar components + Orval-generated fetch layer
5. Define testing strategy: verify that Solid sidebar components can be unit-tested in a JSDOM/happy-dom environment with Shadow DOM support [A-008](../../docs/assumptions.md), and integration-tested against the sync layer with mocked API responses
