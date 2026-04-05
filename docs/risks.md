# Risks Registry

| ID | Risk | Status | Mitigation |
|----|------|--------|------------|
| R-001 | JIRA status polling semantically belongs to sync layer — boundary decision (keep outside StorageAdapter) is implicit, not recorded as explicit design choice | open | Record as explicit decision in ADR-0002 or create separate ADR if scope grows |
| R-002 | JIRA Cloud API v3 requires Atlassian Document Format (ADF), not Markdown — description field with markdown will be rejected or mangled by modern JIRA instances | open | Implement ADF conversion layer or use JIRA v2 API; verify against target JIRA version |
| R-003 | In-sidebar navigation mechanism unspecified — back/forward transitions described but no commitment to router, signal-based view stack, or show/hide toggle; affects URL sharability and animation | open | Decide navigation approach during Phase 1 implementation |
