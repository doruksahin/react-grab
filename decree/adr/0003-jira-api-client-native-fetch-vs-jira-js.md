---
date: '2026-04-05'
references:
- PRD-002
- ADR-0002
status: accepted
---

# ADR-0003 JIRA API client — sidebar-to-sync-server vs sidebar-to-JIRA-direct

## Context and Problem Statement

Phase 3 (PRD-002) requires the sidebar to trigger JIRA ticket creation, list projects and issue types, and poll ticket status. Two architectures are possible: the sidebar calls JIRA directly from the browser, or the sidebar calls sync-server endpoints that proxy to JIRA. The original jira-integration-plan implied direct JIRA calls from the sidebar. However, `packages/sync-server` **already contains a `JiraService`** (`src/services/jira.service.ts`) that uses `jira.js` (`Version3Client`) to create tickets and attach screenshots. The sync-server already proxies JIRA operations on behalf of the dashboard. We must decide whether the sidebar calls JIRA directly (adding a second JIRA client path), or whether it routes through the existing sync-server proxy — and clarify the boundary so R-004 is correctly scoped. [R-004](../../docs/risks.md)

## Decision Drivers

- The sync-server already has `JiraService` using `jira.js` (`Version3Client`) and operates as the JIRA proxy for all existing dashboard calls
- `jira.js` works correctly in the sync-server's Node.js/Cloudflare Workers runtime where it is already deployed — R-004 is only a concern if `jira.js` is used in a context where Axios's Node `http` transport is unavailable
- The sidebar runs in the browser (a content script injected by react-grab) — browsers have native `fetch`; Axios/Node transport is irrelevant there
- JIRA credentials (base URL, email, API token) are held server-side in the sync-server configuration — the sidebar has no direct access to them and must not
- The sync-server OpenAPI spec (`packages/sync-server/openapi.json`) already defines the proxy endpoints the sidebar would call; Orval generates typed fetch functions from this spec into `src/generated/sync-api.ts` (ADR-0002)
- Adding a second JIRA client path in the sidebar would duplicate credential management, error handling, and attachment logic already in `JiraService`

## Considered Options

### Option A: Sidebar calls sync-server JIRA proxy endpoints (existing architecture)

The sidebar uses the Orval-generated fetch functions (or thin wrappers) to call sync-server endpoints such as `/jira/projects`, `/jira/issue-types`, `/jira/create-ticket`, `/jira/ticket-status/{key}`. The sync-server's `JiraService` handles all JIRA REST API calls. The sidebar never communicates with JIRA directly.

```
Browser (sidebar) → sync-server /jira/* → JIRA REST API v3
```

- Good: consistent with how the dashboard already works — same proxy pattern, same credential boundary
- Good: JIRA credentials stay server-side; the browser never handles `apiToken`
- Good: `JiraService` + `jira.js` in `packages/sync-server` continue working without any changes to the existing JIRA client
- Good: the sidebar's API calls are covered by Orval-generated types from the sync-server OpenAPI spec — same pattern as all other sidebar data fetching (ADR-0002)
- Good: R-004 (`jira.js` Workers incompatibility) is not a concern here — `jira.js` remains in the server where it already works
- Neutral: sync-server must expose any JIRA proxy endpoints not yet in the OpenAPI spec before the sidebar can call them
- Bad: an extra network hop (sidebar → sync-server → JIRA) vs. direct, but this is architecturally correct and the latency difference is negligible

### Option B: Sidebar calls JIRA REST API v3 directly from the browser

The sidebar constructs JIRA API requests using the browser's native `fetch`, including auth headers. JIRA credentials are injected into the page or retrieved from a config endpoint.

- Good: removes sync-server as an intermediary for JIRA calls
- Bad: JIRA credentials (API token) must be accessible to the browser — violates the existing credential boundary
- Bad: CORS: JIRA Cloud's REST API v3 does not permit cross-origin requests from arbitrary browser origins — this would fail in practice
- Bad: duplicates JIRA client logic (`buildDescription`, attachment upload, idempotency checks) that already exists and is tested in `JiraService`
- Bad: `jira.js` cannot be used in the browser bundle (Axios → Node transport), so all JIRA calls would need to be written with native `fetch` anyway — but this only relocates the problem rather than solving it
- Bad: diverges from the architecture that the dashboard and sync-server already establish

## Decision Outcome

**Option A: Sidebar calls sync-server JIRA proxy endpoints**, because:

1. **The proxy already exists.** `JiraService` in `packages/sync-server` handles JIRA ticket creation, attachment upload, and status polling. The sidebar routes through this proxy rather than duplicating it. [R-004](../../docs/risks.md)

2. **Credential boundary.** JIRA API tokens must not be exposed to the browser. The sync-server holds credentials; the sidebar authenticates to the sync-server (same session token used for all other sync calls), not to JIRA.

3. **CORS.** JIRA Cloud REST API v3 does not support cross-origin requests from arbitrary browser origins. Direct calls from the sidebar would fail. The sync-server proxy is the only viable path.

4. **R-004 scope correction.** R-004 flagged `jira.js` as Workers-incompatible. This risk was correctly identified for the case where `jira.js` is used in a Workers runtime without Axios transport. `jira.js` already runs in `packages/sync-server` and is not affected — the compatibility concern only applies if `jira.js` were introduced somewhere it isn't already deployed. The sidebar never needed `jira.js`; it calls the sync-server with native `fetch`.

5. **Type consistency.** The sync-server OpenAPI spec is the source of truth for all sidebar API calls (ADR-0002). JIRA proxy endpoints added to the spec produce typed Orval-generated functions — no parallel type system for JIRA calls.

## Consequences

- The sidebar calls sync-server JIRA proxy endpoints using Orval-generated fetch functions from `src/generated/sync-api.ts` — the same pattern used for all other sidebar data fetching
- `jira.js` (`Version3Client`) remains in `packages/sync-server` unchanged — no migration, no replacement
- Any JIRA proxy endpoints needed by the sidebar but not yet in the OpenAPI spec must be added to the spec and to the sync-server router before Phase 3 implementation; `pnpm codegen` regenerates the sidebar's typed client
- The sidebar has no direct JIRA dependency — it does not import `jira.js`, `axios`, or any JIRA-specific library
- R-004 is **mitigated** by this architecture: the question of `jira.js` Workers compatibility is moot because `jira.js` stays in the server layer where it already works
