---
status: proposed
date: 2026-04-05
references: [PRD-002]
---

# ADR-0002 Solid.js Sidebar with Orval-Generated Types

## Context and Problem Statement

PRD-002 requires embedding the dashboard's group management and JIRA integration into the react-grab floating UI as a sidebar. This creates two architectural decisions:

1. **UI framework:** The sidebar must render inside react-grab's existing Shadow DOM host. React-grab's floating UI is built entirely with Solid.js — the toolbar, selection labels, overlay canvas, and comments dropdown are all Solid components using Solid's reactive store. The dashboard, by contrast, is a standalone React 19 app with React Router, TanStack React Query, and shadcn/ui components. We must decide whether the sidebar uses Solid.js (matching the host) or introduces React (matching the dashboard source).

2. **Data layer and type generation:** The dashboard uses Orval to generate TanStack React Query hooks and TypeScript types from the sync-server's OpenAPI spec (`packages/sync-server/openapi.json`). The generated output includes both React-specific hooks (`useListGroups`, `useCreateJiraTicket`) and raw async functions (`listGroups()`, `createJiraTicket()`). React-grab's existing sync feature uses a hand-written `StorageAdapter` pattern with raw `fetch()` calls to the same endpoints. We must decide how the sidebar fetches data and whether to reuse the Orval pipeline.

The decisions are coupled: the UI framework constrains which data-fetching primitives are available.

## Decision Drivers

- The sidebar renders inside react-grab's Shadow DOM — mixing two reactive runtimes (React + Solid) in one Shadow DOM tree adds complexity and bundle size
- React-grab's sync feature already fetches group and comment data from the server — the sidebar should reuse this data, not maintain a parallel cache
- The OpenAPI spec is the single source of truth for API types — hand-writing types creates drift risk
- Orval already generates raw async functions alongside React Query hooks — these are framework-agnostic
- The sync feature's `StorageAdapter` already covers GET/PUT for groups, comments, and screenshots — but not JIRA endpoints
- Developer familiarity: the team has working knowledge of Orval configuration and the existing React Query setup
- Bundle size matters: react-grab is a third-party script injected into host pages

## Considered Options

### Option A: Solid.js sidebar + Orval with custom fetch client (no React)

Keep the entire react-grab codebase on Solid.js. Add a new Orval config in `packages/react-grab/` that outputs **framework-agnostic fetch functions only** (no React Query hooks). Optionally configure Orval's `zod` client to also generate Zod validators for runtime API response validation — this does not exist in the codebase today and would be new configuration [A-001](../../docs/assumptions.md). The sidebar uses Solid's `createResource` and `createSignal` for reactivity [A-006](../../docs/assumptions.md), calling the Orval-generated fetch functions directly.

Orval supports a custom `client` option — set it to generate plain `fetch` wrappers instead of React Query hooks. The generated TypeScript types are already framework-agnostic.

For groups and comments, the sidebar needs access to data already fetched by the sync feature's `StorageAdapter`. Currently, group data lives in a plain module-level variable (`let groups` in `group-storage.ts`), not a reactive Solid store — this will need to be refactored into Solid signals or a store for the sidebar to get live reactive updates. For JIRA endpoints (not covered by `StorageAdapter`), the sidebar calls the Orval-generated fetch functions directly.

- Good: single reactive runtime, no React in the bundle, types stay spec-driven, smallest bundle delta
- Good: Orval's raw async functions (`listGroups()`, `createJiraTicket()`) already exist in the dashboard's generated output — however, those files import `@tanstack/react-query` at the top level, so a separate Orval config for react-grab is required from the start (not optional) to avoid pulling React Query into the bundle [A-009](../../docs/assumptions.md)
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

2. **Store integration:** The sync feature already fetches group and comment data from the server. Currently this data lives in a plain module-level variable (`group-storage.ts`), not a reactive Solid store. Phase 1 will refactor this into Solid signals so the sidebar gets live reactive updates without a duplicate cache or bridge layer [A-011](../../docs/assumptions.md). This refactoring is straightforward (wrapping existing data in `createSignal`) [A-005](../../docs/assumptions.md) and yields a cleaner architecture regardless of the sidebar.

3. **Spec-driven types without React dependency:** A new Orval config in `packages/react-grab/` will generate fetch-only functions and TypeScript types from the same OpenAPI spec [A-002](../../docs/assumptions.md). The dashboard's existing generated files cannot be imported directly because they include `@tanstack/react-query` imports at the top level, making a separate config a prerequisite (not a nice-to-have). Optionally, Orval's `zod` client can be configured to also generate runtime validators — this would be new capability not currently in the codebase.

4. **JIRA endpoints:** The sync feature's `StorageAdapter` covers groups, comments, and screenshots but not JIRA endpoints [R-001](../../docs/risks.md). Rather than extending the adapter (which is designed for bidirectional sync, not one-off API calls), the sidebar calls the Orval-generated JIRA functions directly. This keeps the adapter focused on sync and the sidebar's JIRA layer thin.

5. **Bundle size:** React + ReactDOM would add ~40KB+ [A-003](../../docs/assumptions.md) to a script injected into every host page. Solid.js is already in the bundle; adding sidebar components adds only the component code, not a new framework.

The main tradeoff is that Solid.js lacks an equivalent to shadcn/ui — the JIRA create dialog's searchable selects, modals, and popovers must be built or adapted. This is real effort (estimated as the majority of Phase 3 work), but it's a one-time cost that keeps the architecture clean. Libraries like Kobalte (Solid.js headless UI) [A-004](../../docs/assumptions.md) [A-010](../../docs/assumptions.md) can accelerate this if the Shadow DOM constraint permits.

Option C (hand-written types) was rejected because the OpenAPI spec is the source of truth and Orval already solves the type-generation problem. Discarding it reintroduces manual drift risk that the team has already eliminated on the dashboard side.

## Consequences

- The sidebar is built entirely with Solid.js — no React dependency in `packages/react-grab`
- A new Orval config in `packages/react-grab/` generates framework-agnostic fetch functions and TypeScript types from `packages/sync-server/openapi.json` (Zod validators can be added as an optional enhancement)
- Group and comment data in `group-storage.ts` is refactored from plain module-level variables into Solid signals, enabling the sidebar to reactively subscribe to sync feature data without separate API calls
- JIRA endpoints (projects, issue-types, priorities, create-ticket, get-status) are called via Orval-generated fetch functions, wrapped in Solid's `createResource`
- Searchable select, dialog, and popover components must be implemented in Solid.js, rendering inside Shadow DOM (evaluate Kobalte as a base)
- The `packages/dashboard/` Orval config remains unchanged — it continues generating React Query hooks for as long as the dashboard exists

## Affected Files

- `packages/react-grab/orval.config.ts` — new Orval config for fetch-only client output
- `packages/react-grab/src/features/sidebar/` — new feature directory for sidebar components
- `packages/react-grab/src/features/sidebar/api/` — Orval-generated fetch functions + types
- `packages/react-grab/src/components/sidebar/` — Solid.js sidebar UI components
- `packages/react-grab/src/components/toolbar/toolbar-content.tsx` — add dashboard button
- `packages/react-grab/src/components/renderer.tsx` — mount sidebar component
- `packages/react-grab/src/features/selection-groups/store/group-storage.ts` — refactor from plain `let` variable to Solid signals for reactive sidebar reads

## Validation Needed

1. Verify that Orval can generate fetch-only output (no React Query) from the existing OpenAPI spec — run a test codegen with the custom client config and confirm zero `@tanstack/react-query` imports in the output
2. Confirm that Solid's `createResource` can wrap the Orval-generated async functions without type conflicts
3. Prototype a searchable select component in Solid.js inside Shadow DOM — validate that popovers render and position correctly without `document.body` access. If Kobalte proves incompatible with Shadow DOM constraints, fall back to minimal DOM-API dialogs without a component library
4. Measure bundle size delta: baseline react-grab bundle vs. bundle with sidebar components + Orval-generated fetch layer
5. Define testing strategy: verify that Solid sidebar components can be unit-tested in a JSDOM/happy-dom environment with Shadow DOM support [A-008](../../docs/assumptions.md), and integration-tested against the sync layer with mocked API responses
