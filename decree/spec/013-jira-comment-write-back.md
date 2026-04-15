---
date: '2026-04-15'
references:
- PRD-009
- ADR-0010
- ADR-0003
- ADR-0004
- ADR-0007
- SPEC-010
- SPEC-003
status: review
---

# SPEC-013 JIRA Comment Write-Back

## Overview

Extends the read-only JIRA comment display (SPEC-010) with full write-back capability: posting new comments, threaded replies, @mentions with accountId resolution, and inline image attachments — all without leaving react-grab.

The write path uses the existing `jira.js` `Version3Client` (ADR-0003) via the sync-server proxy. Comment bodies are authored in a TipTap WYSIWYG editor (ADR-0010), serialized to Markdown via `tiptap-markdown`, converted to ADF via `marklassian` (ADR-0004), with a post-processing step that injects `mention` ADF nodes using accountId mappings.

The architecture follows the same layered pattern as SPEC-003 (ticket creation) and SPEC-010 (comment display):
- **Layer 1** — sync-server schemas, service methods, and routes
- **Layer 2** — react-grab API client (Orval-generated)
- **Layer 3** — TipTap editor component with toolbar
- **Layer 4** — Comment composer integration in selection-label

## Technical Design

### Layer 1 — sync-server: addComment service method

**File:** `packages/sync-server/src/services/jira.service.ts`

Add `addComment()` to `JiraService`:

```ts
async addComment(
  ticketId: string,
  body: string,
  parentId?: string,
): Promise<{ id: string; created: string }>
```

- Uses `this.client.issueComments.addComment({ issueIdOrKey: ticketId, body, parentId })`
- `jira.js` auto-converts plain strings to ADF for the v3 API
- For rich ADF (with mentions), the caller passes a pre-built ADF document instead of a string
- Returns `{ id, created }` from the JIRA response

**PoC evidence:** Backend already implemented and typechecks — see `jira.service.ts:429-443`

### Layer 1 — sync-server: searchUsers service method

**File:** `packages/sync-server/src/services/jira.service.ts`

Add `searchUsers()` to `JiraService`:

```ts
async searchUsers(query: string): Promise<Array<{
  accountId: string;
  displayName: string;
  avatarUrl: string | null;
}>>
```

- Uses `this.client.userSearch.findUsersWithAllPermissions({ query, permissions: "BROWSE", maxResults: 10 })`
- Maps response to `{ accountId, displayName, avatarUrl }` — the minimum for mention picker + ADF nodes

**PoC evidence:** Backend already implemented and typechecks — see `jira.service.ts:445-459`

### Layer 1 — sync-server: schemas and routes

**File:** `packages/sync-server/src/schemas/jira.ts`

New Zod schemas:
- `AddJiraCommentRequest` — `{ body: string, parentId?: string }`
- `AddJiraCommentResponse` — `{ id: string, created: string }`
- `JiraUser` — `{ accountId: string, displayName: string, avatarUrl: string | null }`

**File:** `packages/sync-server/src/routes/jira.ts`

New routes:
- `POST /workspaces/{id}/groups/{groupId}/jira-comment` → `addComment` handler
- `GET /jira/users?query=<string>` → `searchUsers` handler

Both follow the existing pattern: validate params/body via Zod, resolve group → ticketId, delegate to `JiraService`, return typed response.

**PoC evidence:** Routes already implemented and typecheck — see `jira.ts:143-170` (addComment) and `jira.ts:172-192` (searchUsers)

### Layer 2 — react-grab: Orval-generated API client

**File:** `packages/react-grab/src/generated/sync-api.ts` (auto-generated)

After adding the OpenAPI routes, run `pnpm codegen` to regenerate the Orval client. This produces:
- `addJiraComment(workspaceId, groupId, body)` — typed POST call
- `searchJiraUsers(query)` — typed GET call

### Layer 3 — TipTap comment editor component

**Directory:** `packages/react-grab/src/components/editor/` (new shared directory)

Decomposed into sub-components for reusability (the editor will be used in multiple UI surfaces):
- `toolbar.tsx` — shared `ToolbarButton`, `ToolbarSeparator`, `ToolbarDropdown` (also used by existing `jira-editor.tsx`)
- `mention-picker.tsx` — `createMentionSuggestion()`, floating popup, module-level cache with 60s TTL
- `emoji-picker.tsx` — emoji grid component
- `color-picker.tsx` — color palette with reset
- `jira-comment-editor.tsx` — main editor composition (~180 lines)
- `types.ts` — shared editor types

A SolidJS component wrapping TipTap with JIRA-style toolbar. Extends the existing `jira-editor.tsx` pattern with:

**Extensions** (per ADR-0010):
- `StarterKit` (bold, italic, strike, code, headings, lists, blockquote, code block, history)
- `Link.configure({ openOnClick: false })`
- `Underline`
- `TextStyle` + `Color`
- `Image`
- `Mention.configure({ HTMLAttributes: { class: 'mention' }, suggestion: mentionSuggestion() })`
- `Markdown.configure({ html: false, transformPastedText: true })`
- `Placeholder.configure({ placeholder: 'Add a comment...' })`

**Toolbar layout** (matching JIRA):
`Tt▾ | B▾ | :=▾ | A | Image | </> | Emoji | + | Link | Undo | Redo`

Each group is a dropdown or direct action button using `onMouseDown` + `e.preventDefault()` to preserve editor focus (the existing `ToolbarButton` pattern).

**Mention suggestion plugin:**
- `items({ query })` — calls `searchJiraUsers(query)` (debounced 200ms), falls back to cached results
- `render()` — floating popup with avatar + name list, arrow key navigation, Enter/Tab to select
- Selected mention inserts a `mention` node with `attrs: { id: accountId, label: displayName }`

**Image handling:**
- Toolbar button → hidden `<input type="file" accept="image/*">` → `FileReader` → `editor.chain().setImage({ src: dataUrl })`
- Clipboard paste → `paste` event listener → check `clipboardData.items` for `image/*` → same flow
- Drag-drop → `dragover`/`drop` event listeners → same flow

**Output:**
- `editor.storage.markdown.getMarkdown()` — Markdown string
- Mention nodes serialize as `@DisplayName` in Markdown
- Image nodes serialize as `![alt](data:...)` in Markdown
- An `extractMentions()` helper scans TipTap JSON for mention nodes and returns `[{ text, accountId }]` for the API payload

**PoC evidence:** Full editor demonstrated in [`poc-jira-editor.html`](../../poc-jira-editor.html) — toolbar, mention popup, image paste/drop, output panels

### Layer 4 — Comment composer integration

**Files:**
- `packages/react-grab/src/features/sidebar/use-jira-comments.ts` (new hook — optimistic UI, submit, reply state)
- `packages/react-grab/src/components/selection-label/jira-comments-section.tsx` (new — extracted from index.tsx)
- `packages/react-grab/src/components/selection-label/index.tsx` (renders `<JiraCommentsSection>` — no new logic)

The optimistic UI and submit logic lives in `useJiraComments()` — a reusable hook that can be used from any surface that needs comment write-back. The `JiraCommentsSection` component replaces the inline comment block (lines 799-845) following the existing extraction pattern (`completion-view.tsx`, `jira-meta.tsx`).

Replace the existing comment display section with an enhanced version:

1. **Comment list** — same as SPEC-010 (collapsible, threaded, with `CommentBody`)
2. **Action buttons** — add a Reply button to each comment (hover-reveal)
3. **Composer** — `JiraCommentEditor` component below the comment list:
   - Shows "Pro tip: press M to comment" hint
   - Reply context bar when replying (shows parent author, cancel button)
   - TipTap editor with toolbar
   - Save / Cancel buttons
4. **Submit flow:**
   - Extract Markdown + mentions from editor
   - Call `addJiraComment(workspaceId, groupId, { body, parentId, mentions })`
   - Optimistic update: immediately append comment to local list with `sending` state
   - On success: replace temp ID with real ID, clear `sending` state
   - On failure: remove optimistic comment, show error toast, restore editor content
   - Trigger immediate `getJiraTicketStatus()` poll to refresh full comment list

**PoC evidence:** Full comment flow demonstrated in [`poc-jira-comments.html`](../../poc-jira-comments.html) — post, reply, mention, optimistic UI

### Layer 5 — ADF mention post-processing (sync-server)

**File:** `packages/sync-server/src/services/jira-adf-mentions.ts` (new)

A pure function that enriches `marklassian` ADF output with `mention` nodes:

```ts
function injectMentions(
  adf: object,
  mentions: Array<{ text: string; accountId: string }>,
): object
```

- Walks the ADF tree (depth-first)
- For each `text` node, checks if it contains any `mention.text` substring
- Splits the text node into: `[text-before, mention-node, text-after]`
- The mention node is `{ type: "mention", attrs: { id: accountId, text: displayText, accessLevel: "" } }`
- Returns the modified ADF tree

This is the only place that transforms Markdown-derived ADF into mention-aware ADF — **single responsibility, single source of truth**.

### Layer 5 — Image upload flow (sync-server)

When the comment body contains base64 image data:

1. Sync-server extracts `![alt](data:image/...)` patterns from the Markdown body
2. For each image, uploads to JIRA via `POST /rest/api/3/issue/{ticketId}/attachments` (existing pattern from `createTicketFromGroup`)
3. Replaces the base64 data URL with `![alt](/jira-attachment/{attachmentId})` in the Markdown
4. Proceeds with `markdownToAdf()` conversion — `marklassian` converts image markdown to `mediaSingle > media` ADF nodes

## Testing Strategy

### Unit tests

- `injectMentions()` — pure function, test with various ADF trees:
  - Single mention in a paragraph
  - Multiple mentions in one text node
  - Mention at start/end of text
  - No mentions (pass-through)
  - Nested structures (list items, blockquotes containing mentions)

- `extractMentions()` — test TipTap JSON → mention array extraction

### Integration tests

- `addComment` route — mock `JiraService`, verify:
  - 200 response with `{ id, created }`
  - 404 when group has no JIRA ticket
  - 400 when JIRA API returns error
  - `parentId` passed correctly for threaded replies

- `searchUsers` route — mock `JiraService`, verify:
  - Returns filtered user list
  - Handles empty query
  - Handles JIRA API failure gracefully

### E2E tests (Playwright)

- Open selection label with linked JIRA ticket
- Click comment composer, type text, click Save → comment appears in list
- Click Reply on existing comment → reply context shown → submit → threaded reply appears
- Type `@` → mention picker appears → select user → chip rendered in editor
- Paste image → image appears in editor → Save → image appears in posted comment

## Acceptance Criteria

### Layer 1 — sync-server: addComment

- [x] `JiraService.addComment(ticketId, body)` calls `client.issueComments.addComment()` and returns `{ id, created }`
- [x] `JiraService.addComment(ticketId, body, parentId)` passes `parentId` for threaded replies
- [x] `AddJiraCommentRequest` schema validates `{ body: string, parentId?: string }`
- [x] `AddJiraCommentResponse` schema returns `{ id: string, created: string }`
- [x] `POST /workspaces/{id}/groups/{groupId}/jira-comment` route exists and delegates to `JiraService`
- [x] Route returns 404 when group has no `jiraTicketId`
- [x] Route returns 400 with JIRA error message on API failure
- [x] Route resolves `groupId` → `jiraTicketId` via `repo.listGroups()` (same pattern as `getTicketStatus`)

### Layer 1 — sync-server: searchUsers

- [x] `JiraService.searchUsers(query)` calls `client.userSearch.findUsersWithAllPermissions()`
- [x] Returns `{ accountId, displayName, avatarUrl }[]` with max 10 results
- [x] `JiraUser` schema validates the response shape
- [x] `GET /jira/users?query=<string>` route exists and delegates to `JiraService`
- [x] Route returns 500 with error message on JIRA API failure

### Layer 1 — sync-server: schemas

- [x] `AddJiraCommentRequest`, `AddJiraCommentResponse`, `JiraUser` exported from `schemas/index.ts`
- [x] All new schemas have `.openapi()` annotations for Swagger UI

### Layer 2 — Orval client regeneration

- [x] `pnpm codegen` produces `addJiraComment()` and `searchJiraUsers()` typed functions
- [x] Generated types match the Zod schemas exactly

### Layer 3 — TipTap editor: core

- [x] `JiraCommentEditor` component creates a TipTap `Editor` with extensions listed in ADR-0010
- [x] Editor renders inside the selection label's comment section
- [x] Editor outputs Markdown via `editor.storage.markdown.getMarkdown()`
- [x] Placeholder text "Add a comment..." shows when editor is empty
- [ ] `Cmd+Enter` / `Ctrl+Enter` submits the comment
- [ ] `Escape` cancels reply mode (if active)

### Layer 3 — TipTap editor: toolbar

- [x] Text style dropdown: Normal, H1, H2, H3
- [x] Formatting dropdown: Bold, Italic, Underline, Strikethrough, Code
- [x] List dropdown: Bullet list, Ordered list, Blockquote
- [x] Text color picker with palette (at minimum: red, orange, yellow, green, cyan, blue, purple, pink, reset)
- [x] Image button opens file picker → selected image inserted inline
- [x] Code block toggle button
- [x] Emoji picker with common emoji grid
- [ ] Insert menu (+): Divider, Code block, Quote
- [x] Link button: prompts for URL, toggles link on/off
- [x] Undo / Redo buttons with disabled state when unavailable
- [x] All toolbar buttons use `onMouseDown` + `e.preventDefault()` to preserve editor focus
- [x] Active state highlighting on toolbar buttons when formatting is active at cursor

### Layer 3 — TipTap editor: @mentions

- [x] Typing `@` in the editor triggers the mention suggestion popup
- [x] Popup shows a filtered list of users based on text after `@`
- [x] Arrow keys navigate the popup; Enter/Tab selects the highlighted user
- [x] Escape closes the popup without inserting
- [x] Selected mention renders as a styled chip (blue background) with `data-id` = accountId
- [x] `extractMentions()` returns `[{ text: "@Name", accountId: "..." }]` from editor JSON

### Layer 3 — TipTap editor: images

- [x] Toolbar image button opens a file picker (`<input type="file" accept="image/*">`)
- [x] Selected file is read via `FileReader.readAsDataURL()` and inserted as `<img>` in editor
- [x] Pasting an image from clipboard (Cmd+V) inserts the image inline
- [x] Dragging and dropping an image file onto the editor inserts it inline
- [x] Images display with `max-width: 300px`, border, and rounded corners
- [x] Multiple images can be inserted in a single comment

### Layer 4 — Comment composer integration

- [x] Comment section shows a composer below the comment list
- [ ] "Pro tip: press M to comment" hint shown above the composer
- [ ] Pressing `M` (when no input is focused) focuses the comment editor
- [x] Each comment has a Reply button (visible on hover)
- [x] Clicking Reply shows "Replying to [author]" context bar above the editor
- [x] Cancel button in reply context bar clears reply state
- [x] Save button submits the comment (disabled when editor is empty)
- [ ] Cancel button below the editor clears the editor content (with confirmation if non-empty)

### Layer 4 — Optimistic UI and error handling

- [x] After submit, comment appears immediately in the list with "sending" visual state (dimmed)
- [x] On API success: comment ID and timestamp updated, "sending" state removed
- [x] On API failure: optimistic comment removed, error toast shown, editor content restored
- [x] After successful post, an immediate `getJiraTicketStatus()` poll is triggered (bypass 30s interval)
- [x] Threaded reply appears nested under the parent comment in the optimistic update

### Layer 5 — ADF mention post-processing

- [x] `injectMentions(adf, mentions)` is a pure function in its own module
- [x] It walks the ADF tree and replaces `@Name` text patterns with `mention` ADF nodes
- [x] Each injected mention node has `{ type: "mention", attrs: { id: accountId, text: "@Name" } }`
- [x] Text before and after the mention is preserved as separate text nodes
- [x] Multiple mentions in a single text node are all replaced
- [x] Mentions inside list items, blockquotes, and other nested structures are handled
- [x] If no mentions array is provided, ADF passes through unchanged

### Layer 5 — Image upload

- [x] Sync-server detects `![](data:image/...)` patterns in the Markdown body
- [x] Each base64 image is uploaded to JIRA via `POST /rest/api/3/issue/{id}/attachments`
- [x] Data URL is replaced with `![](/jira-attachment/{attachmentId})` in the Markdown before ADF conversion
- [x] `marklassian` converts the image markdown to `mediaSingle > media` ADF nodes
- [ ] If image upload fails, the comment is still posted (without the image) and an error is logged

### DOM attributes (`data-react-grab-*` convention)

All interactive elements in the comment section must follow the project's `data-react-grab-*` attribute convention for event isolation, E2E test targeting, and CSS scoping:

- [x] Comment composer root: `data-react-grab-comment-composer`
- [x] Comment editor content area: `data-react-grab-comment-editor`
- [x] Comment submit button: `data-react-grab-comment-submit`
- [x] Comment cancel button: `data-react-grab-comment-cancel`
- [x] Reply button on each comment: `data-react-grab-comment-reply`
- [x] Reply context bar: `data-react-grab-reply-context`
- [x] Mention picker popup: `data-react-grab-mention-picker`
- [x] All interactive elements inside the editor/composer: `data-react-grab-ignore-events` (prevents parent selection-label from capturing pointer/click events — same pattern as existing toolbar buttons at lines 551, 566, 773, 802)
- [x] Comment section collapsible trigger: `data-react-grab-ignore-events` (already present)

### Cross-cutting

- [x] TypeScript compiles with no errors (`pnpm typecheck`)
- [x] No new `eslint-disable` comments added
- [x] New service methods have JSDoc comments describing parameters and return types
- [x] The `injectMentions` module has no dependency on `JiraService` — pure data transformation
- [x] The comment editor component is a standalone module in `components/editor/` — not inlined in selection-label
- [x] All new UI elements follow `data-react-grab-*` attribute convention
