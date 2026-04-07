---
date: '2026-04-08'
references:
- PRD-004
- ADR-0003
- ADR-0004
- ADR-0007
- SPEC-003
status: implemented
---

# SPEC-010 Jira comments display in selection labels

## Overview

Surfaces Jira ticket comments inside every persistent `data-react-grab-selection-label` panel attached to a revealed group item, with full thread fidelity, inline images, and markdown body rendering. The data flows through the existing 30-second `createJiraStatusPoller` pipeline established in SPEC-003 — no new poller, no new client-side fetch — but the underlying source is a parallel call to the Atlassian internal GraphQL gateway (per ADR-0007), which returns real `threadParentId` / `childComments` relationships that the public REST API does not expose.

The comment body is converted from ADF to markdown via the [`adf-to-markdown`](https://github.com/evolo-at/afd-to-markdown) library — chosen as the read-side mirror of [`marklassian`](https://github.com/jamsinclair/marklassian) which already handles the write-side per ADR-0004. Inline images embedded in comments are resolved via a sync-server attachment proxy so the Jira API token never reaches the browser.

The UI lives at the bottom of the selection label's prompt-mode `BottomSection` (the same panel that hosts `JiraMeta` and the per-item textarea), inside a shadcn-solid `Collapsible` that starts collapsed.

## Technical Design

### Layer 1 — sync-server: extend the comment schema with threading

**File:** `packages/sync-server/src/schemas/jira.ts`

Add `JiraComment` (new) and append a `comments` array to the existing `JiraTicketStatus`:

```ts
export const JiraComment = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  author: z.string(),
  authorAvatar: z.string().nullable(),
  body: z.string(),  // markdown rendering of the ADF body
  createdAt: z.string(),
});

export const JiraTicketStatus = z.object({
  // ...existing status / assignee / labels fields...
  comments: z.array(JiraComment),
});
```

`parentId` is `null` for root comments and the parent's `commentId` for replies. The wire format is intentionally **flat with parent pointer** rather than nested-tree, so the orval-generated TypeScript shape stays simple and the frontend reconstructs the tree via filter at render time.

### Layer 2 — sync-server: fetch threaded comments via GraphQL gateway

**File:** `packages/sync-server/src/services/jira.service.ts`

Per ADR-0007, comments come from the internal gateway, not the REST API. A new private method `fetchThreadedComments(ticketId, filenameToAttachmentId)`:

1. Lazily resolves `cloudId` once per service instance via `GET /_edge/tenant_info` (unauthenticated, cached in `cloudIdPromise`).
2. POSTs the following query to `https://{tenant}/gateway/api/graphql` with HTTP Basic auth using `JIRA_EMAIL` + `JIRA_API_TOKEN`:
   ```graphql
   query JiraComments($cloudId: ID!, $key: String!) {
     jira {
       issueByKey(cloudId: $cloudId, key: $key) {
         comments(first: 100, rootCommentsOnly: true) {
           edges {
             node {
               ...CommentFields
               childComments(first: 100) {
                 edges { node { ...CommentFields } }
               }
             }
           }
         }
       }
     }
   }
   fragment CommentFields on JiraPlatformComment {
     commentId
     threadParentId
     created
     author { name picture }
     richText { adfValue { json } }
   }
   ```
3. Walks the root → child tree depth-first, flattening into `ThreadedComment[]`. Each child's `parentId` is set to its parent's `commentId` (preferring the structural parent over `threadParentId` for consistency).
4. Converts each ADF body to markdown via `convertADFToMarkdown(body).trim()`, then runs the result through `rewriteMediaUrls` (Layer 4).
5. Returns `[]` on any non-200 response so a broken gateway never crashes the rest of the status fetch.

`getIssueStatus` is restructured: it now fetches the REST issue (status/assignee/labels/**attachment**) first so the attachment list is available, then calls `fetchThreadedComments` with the `filenameToAttachmentId` map derived from `issue.fields.attachment[]`. The REST `comment` field is no longer requested.

### Layer 3 — sync-server: ADF → markdown conversion

**Library:** [`adf-to-markdown`](https://www.npmjs.com/package/adf-to-markdown) v1.0.1 (zero deps, MIT, Cloudflare Workers-safe — verified via `npm view`).

Mirrors the marklassian decision in ADR-0004 in the opposite direction. The library handles paragraphs, hard breaks, headings, lists, code blocks, blockquotes, marks (bold/italic/strike/code), mentions, and — critically — `mediaSingle` / `media` nodes, which it emits as standard markdown image syntax `![alt](media://{fileId})`. The `media://{fileId}` URI is then rewritten in Layer 4.

Note: the library exposes only `convertADFToMarkdown` and a class `ADFToMarkdownConverter` whose methods are all `private`. There is no public extension hook for custom node converters, so node-level customization (e.g. emitting our own URL scheme directly) is not possible. We post-process the markdown string instead.

### Layer 4 — sync-server: rewrite media URLs to attachment proxy paths

**File:** `packages/sync-server/src/services/jira.service.ts`

The `id` attribute on an ADF `media` node is an Atlassian Media API file id, **not** the Jira REST attachment id. They are in different namespaces and one cannot be derived from the other directly. The bridge is the `alt` attribute: when an inline image is uploaded into a comment, Jira **also** attaches the same file to the parent issue, and `attachment.filename` matches the ADF `media.alt`.

`rewriteMediaUrls(markdown, filenameToAttachmentId)` runs a regex `!\[([^\]]*)\]\(media:\/\/([^)]+)\)` over each comment body and substitutes `media://{fileId}` with `/jira-attachment/{attachmentId}` whenever the filename matches an attachment in the map. Unmatched media nodes (rare — would require an attachment to be deleted after comment creation) are left as-is so the user sees the raw alt text rather than a broken image.

The result is a markdown body containing **sync-server-relative** image URLs, ready for the frontend to prepend its API base URL.

### Layer 5 — sync-server: attachment proxy route

**File:** `packages/sync-server/src/routes/jira.ts`

A new flat route `GET /jira-attachment/:attachmentId` (deliberately not workspace-scoped — the auth is server-side via stored Jira credentials, not per-workspace):

```ts
jiraRoutes.get("/jira-attachment/:attachmentId", async (c) => {
  const attachmentId = c.req.param("attachmentId");
  const upstream = await c.var.jira.fetchAttachmentContent(attachmentId);
  if (!upstream.ok || !upstream.body) {
    return c.json({ error: "attachment fetch failed" }, 502);
  }
  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("cache-control", "public, max-age=3600");
  return new Response(upstream.body, { status: 200, headers });
});
```

The corresponding `JiraService.fetchAttachmentContent(attachmentId)` calls `${baseUrl}/rest/api/3/attachment/content/{id}` with the basic-auth header and `redirect: "follow"` (Atlassian returns a 302 to a signed S3-style URL). Hono streams the body straight back to the browser with the original content-type, capped at one hour of public caching. The Jira API token never crosses the boundary.

### Layer 6 — orval regen + custom-fetch suffix patch

**Files:**
- `packages/react-grab/src/generated/sync-api.ts` — regenerated from the Zod schema; now includes `GetJiraTicketStatus200CommentsItem` with the `parentId` field
- `packages/react-grab/orval.config.ts` — adds an `afterAllFilesWrite` hook
- `packages/react-grab/scripts/patch-orval-imports.mjs` — appends `.js` to the `./custom-fetch` import (orval v8.6.2 emits extensionless relative imports which tsc nodenext rejects during the tsup DTS pass)

The patch script is idempotent and runs unconditionally after every `pnpm codegen`, so future regenerations stay nodenext-compatible without manual intervention.

### Layer 7 — react-grab: thread `jiraComments` through the existing pipeline

**Files:**
- `packages/react-grab/src/features/sidebar/jira-types.ts` — `SelectionGroupWithJira` gains `jiraComments?: Array<{id, parentId, author, authorAvatar, body, createdAt}>`
- `packages/react-grab/src/types.ts` — `SelectionLabelInstance` and `SelectionLabelProps` both gain `jiraComments?: ReadonlyArray<...>` (both are required because the renderer's `labelInstances` mapper spreads instance fields onto the JSX)
- `packages/react-grab/src/core/index.tsx` — the existing `createJiraStatusPoller` `onStatusUpdate` callback merges `jiraComments: status.comments` into the group object alongside `jiraStatus`, `jiraLabels`, etc. The existing `computedLabelInstancesWithStatus` memo automatically picks it up and copies it onto each instance
- `packages/react-grab/src/components/renderer.tsx` — the `<Index each={props.labelInstances ?? []}>` `<SelectionLabel>` invocation now passes `jiraComments={instance().jiraComments}` alongside the other `jira*` props

No new poller, no new fetch, no new signal — `jiraComments` rides on the same 30-second loop established in SPEC-003.

### Layer 8 — react-grab: render the threaded collapsible in the prompt-mode panel

**File:** `packages/react-grab/src/components/selection-label/index.tsx`

The persistent labels attached to revealed group items render through the **prompt-mode** branch (`<Show when={canInteract() && props.isPromptMode && !props.isPendingDismiss}>`), the same branch that hosts `JiraMeta` and the per-item textarea. (An earlier iteration mistakenly placed the comments block in the `!isPromptMode` sibling branch; that branch never mounts for revealed items because the per-item prompt is what makes them "prompt-mode". The bug was caught only after a debug `console.log` failed to fire in that branch.)

The collapsible lives at the bottom of the prompt-mode `BottomSection`, just below the textarea row. Structure:

```tsx
<Show when={(props.jiraComments?.length ?? 0) > 0}>
  <Collapsible>  {/* starts collapsed */}
    <CollapsibleTrigger>
      Comments ({props.jiraComments!.length}) ▾
    </CollapsibleTrigger>
    <CollapsibleContent>
      {/* roots first */}
      <For each={props.jiraComments.filter((c) => !c.parentId)}>
        {(root) => (
          <>
            <CommentBody body={root.body} />
            {/* replies indented under each root */}
            <For each={props.jiraComments.filter((c) => c.parentId === root.id)}>
              {(reply) => (
                <div class="pl-2 border-l border-muted-foreground/20">
                  <CommentBody body={reply.body} />
                </div>
              )}
            </For>
          </>
        )}
      </For>
    </CollapsibleContent>
  </Collapsible>
</Show>
```

`Collapsible` / `CollapsibleTrigger` / `CollapsibleContent` come from `packages/react-grab/src/components/ui/collapsible.tsx`, which is a verbatim port of the canonical [shadcn-solid registry source](https://github.com/hngngn/shadcn-solid/blob/main/apps/docs/src/registry/ui/collapsible.tsx) (adapted only for the project's `cn` import path).

The trigger forwards `data-react-grab-ignore-events` and stops both `pointerdown` and `click` propagation so it doesn't interact with the host page's pointer pipeline.

The collapsible body has `max-h-[200px] overflow-y-auto` so long threads scroll inside the label rather than blowing it up to fullscreen.

### Layer 9 — react-grab: inline image rendering via `CommentBody`

**File:** `packages/react-grab/src/components/selection-label/index.tsx`

A small in-file helper component splits a comment body on markdown image syntax and renders alternating text/`<img>` segments:

```ts
type CommentSegment =
  | { kind: "text"; text: string }
  | { kind: "image"; alt: string; url: string };

const IMG_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

const parseCommentBody = (body: string): CommentSegment[] => { /* … */ };

const CommentBody: Component<{ body: string }> = (props) => (
  <div class="text-muted-foreground whitespace-pre-wrap wrap-break-word">
    <For each={parseCommentBody(props.body)}>
      {(seg) => seg.kind === "text"
        ? <span>{seg.text}</span>
        : <img src={seg.url} alt={seg.alt}
               class="max-w-full h-auto my-1 rounded" loading="lazy" />}
    </For>
  </div>
);
```

URLs that begin with `/` (sync-server-relative paths emitted by Layer 4) are prepended with the runtime API base URL via `getApiBaseUrl()` from `src/generated/custom-fetch.ts`. Absolute URLs are left untouched. The `whitespace-pre-wrap` on the wrapping `<div>` preserves newlines from the markdown so multi-line plain comments render the way they look in Jira.

This is intentionally **not** a full markdown renderer — it only handles `![alt](url)`. Bold/italic/lists/links from the markdown body still come through as raw markdown syntax in v1. A real renderer is a follow-up if/when richer formatting is requested.

## Acceptance Criteria

### Backend — schema and threading

- [x] `JiraComment` zod schema added to `packages/sync-server/src/schemas/jira.ts` with `id`, `parentId` (nullable), `author`, `authorAvatar`, `body`, `createdAt`
- [x] `JiraComment` exported from the schemas barrel `packages/sync-server/src/schemas/index.ts`
- [x] `JiraTicketStatus` extended with `comments: z.array(JiraComment)` as the last field, no other field changes
- [x] `JiraService.getCloudId()` lazily fetches `/_edge/tenant_info` once per service instance and caches the promise
- [x] `JiraService.fetchThreadedComments(ticketId, filenameToAttachmentId)` calls the gateway with the documented query and walks the root → child tree
- [x] Each child's `parentId` is set to its parent's `commentId` during the walk
- [x] `fetchThreadedComments` returns `[]` on any non-OK gateway response (graceful degradation)
- [x] `getIssueStatus` requests `attachment` in the REST `fields` list and builds a `filename → attachment.id` map before calling `fetchThreadedComments`
- [x] The REST `comment` field is no longer requested in `getIssueStatus`

### Backend — markdown conversion

- [x] `adf-to-markdown` v1.0.1 added as a dependency to `packages/sync-server`
- [x] Comment ADF bodies are converted to markdown via `convertADFToMarkdown(body).trim()`
- [x] The legacy hand-rolled `adfToPlainText` walker is removed
- [x] Hand-tested against `ATT-2746`: returns markdown with hardBreaks preserved as two-space + newline

### Backend — image proxy

- [x] `JiraService.fetchAttachmentContent(attachmentId)` issues `GET /rest/api/3/attachment/content/{id}` with the basic-auth header and `redirect: "follow"`
- [x] `JiraService.rewriteMediaUrls(markdown, map)` regex-replaces `![alt](media://{fileId})` with `![alt](/jira-attachment/{attachmentId})` whenever `alt` matches a filename in the map; unmatched media nodes are left untouched
- [x] New route `GET /jira-attachment/:attachmentId` in `packages/sync-server/src/routes/jira.ts` streams the upstream body, forwards the `content-type` header, and sets `cache-control: public, max-age=3600`
- [x] Route returns 502 on upstream failure rather than throwing
- [x] Jira API token never appears in any response sent to the browser

### Codegen

- [x] `pnpm codegen` regenerates `packages/react-grab/src/generated/sync-api.ts` with `GetJiraTicketStatus200CommentsItem` containing `id`, `parentId`, `author`, `authorAvatar`, `body`, `createdAt`
- [x] `packages/react-grab/orval.config.ts` adds an `afterAllFilesWrite` hook
- [x] `packages/react-grab/scripts/patch-orval-imports.mjs` appends `.js` to the `./custom-fetch` import so future regenerations stay nodenext-compatible without manual fixes
- [x] `pnpm build` for `@react-grab/react-grab` succeeds (DTS pass clean) after regen

### Frontend — type plumbing

- [x] `SelectionGroupWithJira` in `packages/react-grab/src/features/sidebar/jira-types.ts` gains `jiraComments?: Array<{id, parentId, author, authorAvatar, body, createdAt}>`
- [x] `SelectionLabelInstance` in `packages/react-grab/src/types.ts` gains `jiraComments?: ReadonlyArray<...>` (required because the spread mapper at `core/index.tsx:3821` widens it onto the instance)
- [x] `SelectionLabelProps` in `packages/react-grab/src/types.ts` gains the same field
- [x] `core/index.tsx` `createJiraStatusPoller` `onStatusUpdate` callback merges `jiraComments: status.comments` next to the existing `jiraLabels` line
- [x] `computedLabelInstancesWithStatus` memo spreads `jiraComments: group?.jiraComments` onto each `SelectionLabelInstance`
- [x] `renderer.tsx` `<Index each={props.labelInstances ?? []}>` invocation passes `jiraComments={instance().jiraComments}` to `<SelectionLabel>`

### Frontend — UI rendering

- [x] `packages/react-grab/src/components/ui/collapsible.tsx` exists as a verbatim port of `shadcn-solid/apps/docs/src/registry/ui/collapsible.tsx` adapted for the project's `cn` import path
- [x] `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` imported into `selection-label/index.tsx`
- [x] Comments collapsible rendered inside the **prompt-mode** `BottomSection` (`<Show when={canInteract() && props.isPromptMode && !props.isPendingDismiss}>`), positioned below the textarea row
- [x] Wrapped in `<Show when={(props.jiraComments?.length ?? 0) > 0}>` so empty arrays don't render the toggle
- [x] Trigger displays `Comments (N)` with the total count
- [x] Collapsible starts collapsed (no `defaultOpen`)
- [x] Trigger has `data-react-grab-ignore-events` and stops `pointerdown` + `click` propagation
- [x] Body has `max-h-[200px] overflow-y-auto` to scroll long threads
- [x] Roots are rendered first via `filter((c) => !c.parentId)`
- [x] Replies are rendered nested under their root via `filter((c) => c.parentId === root.id)` with `pl-2 border-l border-muted-foreground/20` for visual indent
- [x] `CommentBody` helper component splits each body on `!\[alt\]\(url\)` regex and renders alternating `<span>` + `<img>` segments
- [x] `CommentBody` prepends `getApiBaseUrl()` to URLs starting with `/` so attachment proxy paths resolve to the live sync-server origin
- [x] `<img>` tags carry `loading="lazy"`, `class="max-w-full h-auto my-1 rounded"` so they fit the label width and don't block paint
- [x] Multi-line plain bodies render with `whitespace-pre-wrap` so newlines from the markdown survive

## Testing Strategy

`packages/sync-server` has no Vitest infrastructure, and adding it solely for two schema/service changes was deemed scope creep (per user feedback during execution). Verification was therefore done at three layers:

### Static

- `npx tsc --noEmit` in both `packages/sync-server` and `packages/react-grab` after every commit. The pre-existing sidebar `TS2834/TS2835` errors (uncommitted WIP from feat/shadow-root-threading) are tolerated as they predate this work; no **new** type errors were introduced.
- `pnpm build` in `packages/react-grab` (which runs the full tsup DTS pass) confirms the regen + rewiring is sound.

### Live integration against `appier.atlassian.net`

- Manual probe of the GraphQL gateway with the project's API token confirmed `JiraPlatformComment.threadParentId` and `childComments` resolve as expected.
- `curl http://localhost:8788/workspaces/my-workspace/groups/default/jira-status | jq '.comments'` against ticket `ATT-2746` returned the threaded shape: comment `2114598` with two children (`2114599` and `2114600`) plus standalone roots `2114594` and `2114597`, all with `parentId` populated correctly.
- The attachment proxy was hand-tested by reloading the AdCreative dashboard and verifying the inline image on comment `2114600` (`AAAA` plus `image-20260407-222507.png`) loads via `GET /jira-attachment/{id}` with `Cache-Control: public, max-age=3600`.

### Visual

- The `data-react-grab-selection-label` panels on revealed `ATT-2746` group items show a `Comments (5)` collapsible at the bottom. Expanding shows three roots, with the appropriate replies indented under their parents and the inline image rendered inside comment `2114600`.

### Out of scope (deferred)

- E2E Playwright spec for the comments collapsible — the existing `e2e/` setup works against a fixture-based playground, not against a live Jira instance. Wiring a recorded fixture is a follow-up.
- Vitest scaffolding for `packages/sync-server`. Backend behavior is currently exercised only by manual smoke tests + tsc.
- Stripping leading `@mention` from reply bodies (cosmetic; Jira's own UI does this).
- Lightbox / click-to-enlarge for inline images.
- Bold / italic / list rendering inside comment bodies (currently come through as raw markdown syntax — a real renderer is a follow-up).
