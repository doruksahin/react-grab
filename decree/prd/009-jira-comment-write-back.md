---
status: draft
date: 2026-04-15
references: [PRD-004, SPEC-010]
---

# PRD-009 JIRA Comment Write-Back

## Problem Statement

SPEC-010 delivers read-only JIRA comment display inside selection labels. Users can now *see* the full threaded conversation attached to a JIRA ticket. But to *reply*, *mention a colleague*, or *attach a screenshot*, they must leave react-grab, navigate to the JIRA issue, and use JIRA's native editor. This context-switch breaks flow and undermines the value proposition of react-grab as a single-pane-of-glass review tool.

For enterprise teams running triage or standup directly on the page, the inability to respond to comments without leaving the overlay is a critical gap. A design reviewer who notices a flagged ticket's comment thread cannot add "fixed in latest deploy" without a browser tab switch. A PM who sees a question from QA cannot answer it in-context.

Closing the write loop for comments — the same pattern PRD-008 applies to flags — turns react-grab from a passive viewer into an active collaboration surface.

## Prerequisites

- SPEC-010 must be implemented (comment display) — **100% complete**
- The sync-server JIRA credentials must have `Add Comments` project permission for the target project
- ADR-0007 (GraphQL gateway for threaded comments) provides the read path; the write path uses the standard REST API v3

## Requirements

### API Layer
- R1: Add a sync-server endpoint to post a comment to a JIRA ticket: `POST /workspaces/{id}/groups/{groupId}/jira-comment` with body `{ body: string, parentId?: string }`
- R2: The endpoint must use `jira.js` `issueComments.addComment()` — the same client already used for ticket creation
- R3: For threaded replies, the endpoint must pass `parentId` to create the comment as a child of the specified parent
- R4: The endpoint must return `{ id, created }` on success
- R5: If no JIRA ticket is linked to the group, return 404 with descriptive error
- R6: If the API call fails (permission denied, network error), return 400 with the JIRA error message

### User Search (for @mentions)
- R7: Add a sync-server endpoint to search JIRA users: `GET /jira/users?query=<string>`
- R8: The endpoint must return `{ accountId, displayName, avatarUrl }[]` — the minimum needed for the mention picker and ADF mention nodes
- R9: Results must be limited to 10 users per query to avoid over-fetching

### Rich Text Editor
- R10: Replace the plain textarea comment composer with a WYSIWYG editor based on TipTap (already a dependency)
- R11: The editor must support the following formatting features (matching JIRA's comment editor): bold, italic, underline, strikethrough, inline code, headings (H1-H3), bullet list, ordered list, blockquote, code block, horizontal rule, links, inline images, and @mentions
- R12: Features that can be omitted: "Improve writing" (AI), Atlassian Intelligence dropdown, history timeline, table insertion, panel/status/date nodes, expand/collapse sections
- R13: The editor must render @mentions as styled chips (blue background, like JIRA) with the user's `accountId` stored in the node data
- R14: The editor must support pasting screenshots from clipboard (Cmd+V) and drag-and-drop image insertion
- R15: The editor toolbar must match JIRA's layout: text style dropdown, formatting dropdown (B/I/U/S/code), list dropdown, text color, image, code block, emoji, insert menu (+), link, undo/redo

### Output and ADF Conversion
- R16: The editor must output content as Markdown via `tiptap-markdown` (the existing `JiraEditor` pattern)
- R17: The sync-server must convert Markdown to ADF via `marklassian` before posting to JIRA (the existing `markdownToAdf` pattern from ticket creation)
- R18: @mentions must be converted to ADF `mention` nodes with `accountId` — since Markdown cannot represent mentions, a post-processing step must inject mention nodes into the ADF output
- R19: Inline images must be uploaded as JIRA attachments before posting, then referenced as `mediaSingle > media` ADF nodes

### Comment Interaction
- R20: Each existing comment must have a "Reply" action button that opens the composer with `parentId` pre-set
- R21: The composer must show a "Replying to [author]" context bar when in reply mode, with a cancel button
- R22: After posting, the new comment must appear optimistically in the comment list (with a "sending" state), then be confirmed or rolled back after the API response
- R23: After successful post, trigger an immediate JIRA status poll (bypass the 30s interval) to refresh the full comment list
- R24: The keyboard shortcut `M` (when not focused on an input) must focus the comment composer
- R25: `Cmd+Enter` / `Ctrl+Enter` must submit the comment

## Success Criteria

- SC1: A user can post a plain text comment to a linked JIRA ticket without leaving react-grab
- SC2: A user can reply to an existing comment (threaded) and the reply appears nested under the parent
- SC3: A user can @mention a colleague using the inline `@` trigger or the toolbar button, and the mention is rendered as a JIRA mention in the posted comment
- SC4: A user can paste a screenshot into the editor and it appears as an inline image in the posted JIRA comment
- SC5: The rich text toolbar provides formatting options that produce correct JIRA ADF output (bold, italic, lists, code blocks, links)
- SC6: Optimistic UI provides immediate feedback — the comment appears instantly and is confirmed/rolled back after API response
- SC7: Error states (permission denied, network failure) are surfaced clearly without losing the user's drafted content

## Scope

### In Scope
- sync-server `addComment` endpoint (plain text and threaded replies)
- sync-server `searchUsers` endpoint for @mention resolution
- TipTap WYSIWYG editor component with JIRA-style toolbar
- @mention picker (triggered by `@` keystroke and toolbar button)
- Screenshot/image paste and drag-drop insertion
- Markdown output with ADF conversion via `marklassian`
- Optimistic UI with rollback on failure
- Reply-to-comment threading

### Out of Scope
- Editing existing comments (edit-in-place with PUT)
- Deleting comments
- Reactions/likes on comments (JIRA has no public API for reactions)
- @mention autocomplete fetching from JIRA in real-time (mock data acceptable for v1; wired to API in v2)
- Rich ADF nodes without Markdown equivalents (panels, status badges, expand, date, inline cards)
- Image layout controls (wrap left/right/center) — JIRA's `MediaSingle` layout options

## Related Documents

| Document | Relationship |
|----------|-------------|
| [SPEC-010](../spec/010-jira-comments-display-in-selection-labels.md) | Read-side predecessor — comment display (100% complete) |
| [ADR-0007](../adr/0007-atlassian-internal-graphql-gateway-for-threaded-jira.md) | GraphQL gateway for threaded comment reads |
| [ADR-0003](../adr/0003-jira-api-client-native-fetch-vs-jira-js.md) | `jira.js` as the JIRA API client |
| [ADR-0004](../adr/0004-markdown-to-adf-conversion-for-jira-ticket-description.md) | `marklassian` for Markdown-to-ADF conversion |
| [PRD-008](008-jira-flag-toggle-write-back.md) | Parallel write-back pattern (flags) |
| ADR-0010 | Architecture decision for the editor stack (TBD) |
| SPEC-013 | Technical specification (TBD) |

### PoC Evidence

| PoC | What it demonstrates |
|-----|---------------------|
| [`poc-jira-comments.html`](../../poc-jira-comments.html) | Read + write comment panel with threaded replies, @mention picker, optimistic UI, API call logging |
| [`poc-jira-editor.html`](../../poc-jira-editor.html) | TipTap WYSIWYG editor with JIRA-style toolbar, inline @mentions as chips, image paste/drop, Markdown/HTML/JSON output |
