# Risks Registry

| ID | Risk | Status | Mitigation |
|----|------|--------|------------|
| R-001 | JIRA status polling semantically belongs to sync layer — boundary decision (keep outside StorageAdapter) is implicit, not recorded as explicit design choice | open | Record as explicit decision in ADR-0002 or create separate ADR if scope grows |
| R-002 | JIRA Cloud API v3 requires Atlassian Document Format (ADF), not Markdown — description field with markdown will be rejected or mangled by modern JIRA instances | **mitigated** | Use `marklassian` (12.9 kB gz, Workers-safe, MIT) for markdown → ADF conversion. Researched 2026-04-05, see `docs/research/2026-04-05-leverageable-libraries.md §2` |
| R-004 | `jira.js` (planned in jira-integration-plan) uses Axios → Node.js `http` transport — incompatible with Cloudflare Workers runtime | **mitigated** | Drop `jira.js`; call JIRA REST API v3 directly with native `fetch`. See `docs/research/2026-04-05-leverageable-libraries.md §1` |
| R-005 | Kobalte `*.Portal` hard-codes `document.body` as mount target — overlays will escape the Shadow DOM and may break styling/event handling. Open bug #445: dismiss loop in Shadow DOM | open | Wrap Kobalte content with `forceMount={true}` inside Solid's native `<Portal mount={shadowRoot}>`. Dismiss bug: `disableOutsidePointerEvents={true}` as interim. No upstream fix ETA. |
| R-003 | In-sidebar navigation mechanism unspecified — back/forward transitions described but no commitment to router, signal-based view stack, or show/hide toggle; affects URL sharability and animation | open | Decide navigation approach during Phase 1 implementation |
