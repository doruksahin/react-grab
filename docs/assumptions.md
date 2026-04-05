# Assumptions Registry

| ID | Assumption | Status | Source |
|----|-----------|--------|--------|
| A-001 | Orval `zod` client generates standalone framework-agnostic validators — actual output may be tied to HTTP client | active | ADR-0002 |
| A-002 | Orval react-grab config treated as future work in ADR — but `orval.config.ts` already exists in repo with `client: "fetch"` | active | ADR-0002 |
| A-003 | React+ReactDOM adds ~40KB+ to bundle — figure depends on compression baseline and may be inaccurate | active | ADR-0002 |
| A-004 | Kobalte Shadow DOM compatibility unverified — uses floating-ui portals that default to `document.body` | active | ADR-0002 |
| A-005 | group-storage.ts refactor to Solid signals is "straightforward" — callers hold direct array references, full call-site audit needed | active | ADR-0002 |
| A-006 | `createResource` suspense semantics require a `<Suspense>` boundary — sidebar mount point must account for this | active | ADR-0002 |
| A-007 | Solid.js event delegation targets `document` by default — inside Shadow DOM this must be the shadow root, known compatibility issue | active | ADR-0002 |
| A-008 | happy-dom Shadow DOM support is incomplete (no `adoptedStyleSheets`, limited slot distribution) — test environment may need replacement | active | ADR-0002 |
| A-009 | Orval raw async functions are importable without React Query — depends on bundler tree-shaking, not guaranteed without separate config | active | ADR-0002 |
| A-010 | Kobalte is the only named Solid UI library candidate — no evaluation of alternatives (corvu, solid-aria, solid-primitives) was performed | active | ADR-0002 |
| A-011 | Signal refactor sequenced in Phase 1 with no fallback — blocks Phase 2+ if call-site complexity is higher than expected | active | ADR-0002 |
| A-012 | JIRA "done" status is reliably identifiable — JIRA workflows are project-configurable, terminal status names vary ("Closed", "Resolved", "Done") | active | PRD-002 |
| A-013 | Sync-server exposes JIRA base URL via configuration — no dedicated config endpoint confirmed in OpenAPI spec | active | PRD-002 |
| A-014 | Source file path and line number are parseable from `content` field — relies on regex extraction from free-text, may be brittle or missing | active | PRD-002 |
| A-015 | Shadow DOM host element can accommodate a 380px sidebar panel — host was designed for a small floating toolbar, may need structural changes | active | PRD-002 |
| A-016 | Sync-server JIRA proxy supports multipart file attachment upload — endpoint not listed in OpenAPI spec, may require new backend work | active | PRD-002 |
| A-017 | OpenAPI spec is complete, accurate, and kept in sync with server — gaps would cause generated types to diverge from runtime | active | PRD-002 |
| A-018 | Both screenshot types (element + full-page) are always present — no fallback for selections with partial or missing screenshots | active | PRD-002 |
| A-019 | Shadow DOM focus APIs (`activeElement`, Tab order) work correctly across the shadow boundary — known edge cases beyond Kobalte portals | active | PRD-002 |
