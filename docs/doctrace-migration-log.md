# Doctrace Migration Log

Audit trail for implicit assumption/risk/decision extraction from decree documents.

## decree/adr/0002-solid-js-sidebar-with-orval-generated-types.md (2026-04-05)

### Candidates found
- [x] "Orval's `zod` client to also generate Zod validators" → A-001 (approved)
- [x] "A new Orval config in `packages/react-grab/`" → A-002 (approved)
- [x] "~40KB+ (React + ReactDOM minified)" → A-003 (approved)
- [x] "Libraries like Kobalte (Solid.js headless UI)" → A-004 (approved)
- [x] "This refactoring is straightforward (wrapping existing data in `createSignal`)" → A-005 (approved)
- [x] "Solid's `createResource` and `createSignal` for reactivity" → A-006 (approved)
- [x] "event delegation conflicts" raised for React but not Solid → A-007 (approved)
- [x] "unit-tested in a JSDOM/happy-dom environment with Shadow DOM support" → A-008 (approved)
- [x] "raw async functions already exist in the dashboard's generated output" → A-009 (approved)
- [x] "Kobalte (Solid.js headless UI)" as sole named candidate → A-010 (approved)
- [x] "Phase 1 will refactor this into Solid signals" → A-011 (approved)
- [x] "StorageAdapter covers groups, comments, and screenshots — but not JIRA endpoints" → R-001 (approved)

### References injected
- Line 33: added [A-001], [A-006]
- Line 40: added [A-009]
- Line 51: added [A-007], [A-003]
- Line 74: added [A-011], [A-005]
- Line 76: added [A-002]
- Line 78: added [R-001]
- Line 80: added [A-003]
- Line 82: added [A-004], [A-010]
- Line 111: added [A-008]

### Verification
`doctrace index` exit 0 — 14 IDs, 31 refs, 0 dangling

---

## decree/prd/002-embedded-dashboard-sidebar.md (2026-04-05)

### Candidates found
- [x] "Description field (auto-generated markdown...)" → R-002 (approved) — JIRA ADF vs markdown risk
- [x] "ticketed → resolved (when JIRA status reaches 'done')" → A-012 (approved)
- [x] "JIRA base URL resolved from sync-server configuration" → A-013 (approved)
- [x] "Source file path and line number (extracted from content)" → A-014 (approved)
- [x] "The sidebar renders inside react-grab's existing Shadow DOM host" → A-015 (approved)
- [x] "screenshots that will be attached" → A-016 (approved)
- [x] "TypeScript types and runtime validators generated from the OpenAPI spec" → A-017 (approved)
- [x] "Full-page screenshot thumbnail (both types displayed, labeled)" → A-018 (approved)
- [x] "Clicking a group navigates to its detail view within the sidebar" → R-003 (approved)
- [x] "focus moves into it; pressing Escape returns focus to the dashboard button" → A-019 (approved)

### References injected
- Phase 1: added [A-015], [A-019], [R-003]
- Phase 2: added [A-014], [A-018]
- Phase 3: added [R-002], [A-016], [A-013], [A-012]
- Phase 4: added [A-017]

### Verification
`doctrace index` exit 0 — 24 IDs, 41 refs, 0 dangling
