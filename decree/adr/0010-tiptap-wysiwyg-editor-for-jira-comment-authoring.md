---
status: proposed
date: 2026-04-15
references: [PRD-009, ADR-0003, ADR-0004, ADR-0007, SPEC-010]
---

# ADR-0010 TipTap WYSIWYG editor for JIRA comment authoring

## Context and Problem Statement

PRD-009 requires a rich text editor for composing JIRA comments inside react-grab. The editor must produce output that JIRA's REST API v3 accepts — specifically Atlassian Document Format (ADF). It must support formatting (bold, italic, lists, code), @mentions with user `accountId` resolution, and inline image attachments.

Three sub-decisions are bundled here because they are tightly coupled:

1. **Editor framework** — which WYSIWYG library powers the comment composer?
2. **Serialization pipeline** — how does editor content become ADF for the JIRA API?
3. **@mention data flow** — how are mentions rendered in-editor and serialized to ADF with `accountId`?

### Constraints

- The editor runs inside a SolidJS component rendered in a shadow DOM (per ADR-0005)
- The JIRA API v3 requires ADF — plain text or HTML is not accepted for rich comments
- `jira.js` auto-converts plain strings to ADF, but only for simple text — rich formatting requires a proper ADF document
- The sync-server mediates all JIRA calls (per ADR-0003) — the editor never talks to JIRA directly

## Considered Options

### Option A: Extend existing TipTap + Markdown pipeline

Use the same stack already in `jira-editor.tsx`:
- **Editor:** TipTap with `StarterKit` + additional extensions (`Link`, `Image`, `Color`, `Mention`, `Underline`, `Placeholder`)
- **Serialization:** TipTap → Markdown (via `tiptap-markdown`) → ADF (via `marklassian`) with a post-processing step for mentions
- **Mentions:** `@tiptap/extension-mention` renders chips in-editor; a custom post-processor scans the `marklassian` ADF output and injects `mention` nodes where `@Name` patterns match known users

**Pros:**
- Zero new core dependencies — TipTap, `tiptap-markdown`, and `marklassian` are all already installed
- Proven pattern — `jira-editor.tsx` (ticket creation) already works this way
- Markdown intermediate format is debuggable and human-readable
- `marklassian` handles headings, lists, code blocks, links, images, tables — covers 90% of toolbar features

**Cons:**
- Markdown cannot represent @mentions with `accountId` — requires a post-processing step
- Markdown cannot represent text color, panels, status badges — these ADF nodes are lost in the markdown round-trip
- Two-step serialization adds complexity (TipTap → MD → ADF + post-process)

### Option B: TipTap + `tiptap-extension-jira` direct ADF export

Use `tiptap-extension-jira` (already installed, not yet loaded) which provides JIRA-specific nodes (Mention, Panel, Status, TextColor, MediaSingle) and may offer direct ProseMirror JSON → ADF conversion.

**Pros:**
- Native ADF node types — mentions, panels, text color survive the round-trip
- Single-step serialization (TipTap JSON → ADF) if the library supports it
- Closer fidelity to JIRA's native editor

**Cons:**
- `tiptap-extension-jira` (v1.0.10) is relatively new — the "server export" for ADF conversion is not well-documented
- Requires building or finding a TipTap-JSON-to-ADF converter — none is battle-tested in the ecosystem
- Bypasses the proven `marklassian` pipeline — more risk, less fallback
- Adds complexity to the read path (ADF → TipTap JSON for editing existing comments)

### Option C: Plain textarea with Markdown

Skip WYSIWYG entirely. Use a plain `<textarea>` where users type Markdown, convert to ADF via `marklassian` on submit.

**Pros:**
- Simplest implementation — no editor library concerns
- Markdown is already the intermediate format

**Cons:**
- Poor UX for non-technical users — Markdown syntax is not discoverable
- No WYSIWYG preview — users can't see formatting until after posting
- No inline mention chips — mentions are plain text
- No image paste/drop — clipboard screenshots require manual upload
- Does not match JIRA's editor experience (the user's explicit requirement)

## Decision Outcome

**Chosen: Option A — Extend existing TipTap + Markdown pipeline** with mention post-processing.

### Rationale

1. **Zero new core dependencies.** TipTap, `tiptap-markdown`, and `marklassian` are all already installed and proven. The `jira-editor.tsx` component is a working reference implementation.

2. **Mention post-processing is tractable.** The editor stores `accountId` in the mention node's `data-id` attribute. When serializing to Markdown, mentions become `@DisplayName`. On the server, before calling `markdownToAdf()`, we scan for `@Name` patterns and replace them with ADF `mention` nodes using the `accountId` mapping sent alongside the comment body. This is a contained, testable transformation.

3. **Option B is the future, not the present.** `tiptap-extension-jira` is the right long-term architecture, but its ADF export is not yet stable enough for production. We can migrate to Option B when the library matures — the editor extensions are already installed and the TipTap JSON format is the same regardless of serialization path.

4. **Text color and panels are acceptable losses for v1.** PRD-009 explicitly scopes out "Rich ADF nodes without Markdown equivalents." The toolbar still offers text color (rendered visually in-editor) — it just won't survive the ADF round-trip. This is a documented trade-off, not a bug.

### Mention serialization detail

The comment body is sent as a structured payload, not just a string:

```
POST /jira-comment
{
  "body": "Looks good @Alice Cooper, merging now",
  "parentId": "10002",
  "mentions": [
    { "text": "@Alice Cooper", "accountId": "5b10ac8d..." }
  ]
}
```

The sync-server:
1. Calls `markdownToAdf(body)` to produce the base ADF document
2. Walks the ADF tree, finds text nodes containing `@Name` patterns
3. Splits text nodes and inserts `{ type: "mention", attrs: { id: accountId, text: "@Name" } }` inline nodes
4. Sends the enriched ADF to `client.issueComments.addComment()`

### Image upload flow

1. User pastes/drops image → TipTap inserts `<img src="data:...">` (base64 preview)
2. On save, the frontend sends base64 images as part of the payload
3. Sync-server uploads each image to JIRA via `POST /rest/api/3/issue/{id}/attachments`
4. Sync-server replaces `![](data:...)` in the Markdown with `![](media://{attachmentId})` before ADF conversion
5. `marklassian` converts the image markdown to `mediaSingle > media` ADF nodes

### Extensions loaded for the comment editor

| Extension | Source | Purpose |
|-----------|--------|---------|
| `StarterKit` | `@tiptap/starter-kit` | Bold, italic, strike, code, headings, lists, blockquote, code block, history |
| `Link` | `@tiptap/extension-link` | Hyperlinks |
| `Underline` | `@tiptap/extension-underline` | Underline formatting |
| `Image` | `@tiptap/extension-image` | Inline images (paste, drop, toolbar) |
| `Placeholder` | `@tiptap/extension-placeholder` | "Type a comment..." placeholder |
| `TextStyle` + `Color` | `@tiptap/extension-text-style` + `@tiptap/extension-color` | Text color picker |
| `Mention` | `@tiptap/extension-mention` | @mention chips with suggestion popup |
| `Markdown` | `tiptap-markdown` | Markdown serialization/deserialization |

### DOM attribute convention

All interactive elements in the editor and comment section must use `data-react-grab-*` attributes. This is the project's standard for:
- **Event isolation:** `data-react-grab-ignore-events` prevents parent components (selection-label, canvas) from capturing pointer/click events intended for the editor
- **E2E test targeting:** Playwright tests use `[data-react-grab-comment-submit]` selectors
- **CSS scoping:** Shadow DOM styles target elements by attribute

Key attributes: `data-react-grab-comment-composer`, `data-react-grab-comment-editor`, `data-react-grab-comment-submit`, `data-react-grab-comment-reply`, `data-react-grab-mention-picker`. All toolbar and picker elements must have `data-react-grab-ignore-events`.

### Migration path to Option B

When `tiptap-extension-jira` matures:
1. Replace `StarterKit` extensions with `Jira.*` equivalents
2. Replace `Markdown` extension with direct ADF export
3. Remove the mention post-processing step (Jira.Mention produces ADF natively)
4. Remove `marklassian` from the comment write path (keep for ticket descriptions)

This is a non-breaking migration — the TipTap editor component and toolbar remain identical.

## PoC Evidence

| PoC | What it validates |
|-----|-------------------|
| [`poc-jira-editor.html`](../../poc-jira-editor.html) | TipTap editor with full toolbar, @mention popup with `data-id` on chips, image paste/drop, Markdown + HTML + JSON output panels |
| [`poc-jira-comments.html`](../../poc-jira-comments.html) | End-to-end comment posting with optimistic UI, threaded replies, @mention picker, API call logging |
| Existing: [`jira-editor.tsx`](../../packages/react-grab/src/components/sidebar/jira-editor.tsx) | Production TipTap + StarterKit + tiptap-markdown reference implementation |
