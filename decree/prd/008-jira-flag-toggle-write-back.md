---
status: draft
date: 2026-04-14
references: [PRD-007]
---

# PRD-008 JIRA Flag Toggle Write-Back

## Problem Statement

PRD-007 adds read-only visibility of JIRA flag/blocked status. Users can now *see* that a ticket is flagged — but to *change* it they must leave react-grab, navigate to the JIRA board, and toggle the flag there. This context-switch breaks flow and costs time, especially during triage or standup when the team is reviewing selections on the page.

The next step is to let users toggle the flag directly from react-grab — clicking a flagged indicator to unflag, or clicking an unflagged card to flag it. This closes the feedback loop: see a blocked issue, resolve the blocker, unflag it — all without leaving the page.

## Prerequisites

- PRD-007 must be implemented first — the `jiraFlagged` data model, polling, and visual indicators are the foundation this feature builds on
- The JIRA Agile API (or custom field) write path must be validated — can the authenticated user's token set/clear the flag?

## Requirements

### API Layer
- R1: Add a sync-server endpoint to toggle the JIRA flag: `PUT /workspaces/{id}/groups/{groupId}/jira-flag` with body `{ flagged: boolean }`
- R2: The endpoint must write to JIRA via the Agile API or by setting the custom field (`customfield_XXXXX = [{"value": "Impediment"}]` to flag, `[]` to unflag)
- R3: The endpoint must return the updated flag state from JIRA (read-after-write) to confirm the toggle succeeded
- R4: If the authenticated user lacks permission to flag/unflag, the endpoint must return a clear error (403 with descriptive message)

### Interaction Design
- R5: Clicking the red flag indicator (on selection label, selection card, or loose-selection card) must trigger an unflag action
- R6: A non-flagged card must provide an affordance to flag it — contextual action (right-click menu, long-press, or explicit "Flag" button in the card)
- R7: The interaction must require intentional action — no accidental flag/unflag from casual clicks (consider confirmation or a distinct gesture)

### Optimistic UI
- R8: The UI must update optimistically on toggle — show the new state immediately, roll back on failure
- R9: During the write round-trip, show a loading/pending state (e.g. pulsing border, disabled click)
- R10: On failure, roll back to the previous state and show an inline error (not a toast — keep context on the card)

### Error Handling
- R11: Permission errors must surface a message explaining the user cannot flag/unflag (e.g. "You don't have permission to flag issues in this project")
- R12: Network errors must allow retry without re-navigating
- R13: If the flag state changed server-side between optimistic update and confirmation (race condition), the confirmed state wins

## Success Criteria

- SC1: User can unflag a flagged ticket by clicking the red indicator — flag clears in JIRA within 2 seconds
- SC2: User can flag a non-flagged ticket via an explicit action — flag appears in JIRA within 2 seconds
- SC3: Optimistic UI shows state change instantly; rolls back cleanly on failure
- SC4: Permission errors show a clear, contextual message
- SC5: Flag state stays consistent between react-grab and JIRA after any toggle sequence

## Scope

### In Scope
- Sync-server write endpoint for JIRA flag toggle
- Click-to-toggle interaction on flagged indicators (label, cards)
- Optimistic UI with rollback
- Error handling (permission, network, race conditions)
- Loading/pending visual state during write

### Out of Scope
- Bulk flag/unflag (multiple tickets at once)
- Flag from sidebar list view (only from individual card/label indicators)
- Keyboard shortcut for flag toggle
- Flag history or audit trail
- Webhook/real-time updates (still polling-based from PRD-007)

## Open Questions

1. **Interaction pattern for flagging**: What's the right UX to flag a non-flagged card? Options: (a) small flag icon button always visible, (b) flag option in a right-click context menu, (c) hover-reveal action. Needs design input.
2. **Confirmation step**: Should unflagging require confirmation? Flagging is high-intent (you're declaring a blocker), but unflagging could be accidental.
3. **Permission discovery**: Should we probe the user's JIRA permissions on load and hide/disable the toggle if they can't flag? Or attempt and handle the 403?

## Related Documents

| Document | Relationship |
|----------|-------------|
| [PRD-007](007-jira-flag-blocked-visual-indicator.md) | Prerequisite — read-only flag visibility (data model, polling, visuals) |
| [ADR-0009](../adr/0009-flag-data-source-and-blocked-visual-strategy.md) | Data source decision — Agile API for flag field |
| [SPEC-012](../spec/012-jira-flag-blocked-visual-indicator.md) | Technical spec for read-only flag indicators |
| [Business Rule](../../packages/react-grab/src/features/sidebar/resolve-display-color.ts) | `resolveDisplayColor()` — reusable for toggle UI state |
