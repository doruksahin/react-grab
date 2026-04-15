# JIRA Comment Write-Back Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to post JIRA comments (with threading, @mentions, and images) from react-grab without leaving the page.

**Architecture:** Layered bottom-up: sync-server backend (schemas, service, routes) -> Orval client regen -> TipTap WYSIWYG editor component -> selection-label integration. Comment body flows TipTap -> Markdown (tiptap-markdown) -> ADF (marklassian) -> JIRA REST API v3. Mentions are post-processed from `@Name` patterns into ADF mention nodes with accountId.

**Tech Stack:** TipTap v3, @tiptap/extension-mention, @tiptap/extension-image, @tiptap/extension-link, @tiptap/extension-color, tiptap-markdown, marklassian, jira.js, SolidJS, Hono (Cloudflare Workers)

**Spec:** [`decree/spec/013-jira-comment-write-back.md`](../../decree/spec/013-jira-comment-write-back.md) (77 acceptance criteria)

**PoCs:** [`poc-jira-comments.html`](../../poc-jira-comments.html), [`poc-jira-editor.html`](../../poc-jira-editor.html)

---

## Architecture Decisions (from code review)

### File tree

```
packages/react-grab/src/
  components/
    editor/                              # NEW — shared editor directory (reusable across surfaces)
      toolbar.tsx                        # ToolbarButton, ToolbarSeparator, ToolbarDropdown (shared with jira-editor.tsx)
      mention-picker.tsx                 # createMentionSuggestion(), floating popup renderer, keyboard nav, module-level cache
      emoji-picker.tsx                   # Emoji grid component
      color-picker.tsx                   # Color palette component with reset
      jira-comment-editor.tsx            # Main editor composition — wires extensions, toolbar, submit
      types.ts                           # Editor prop types (JiraCommentEditorProps, MentionMapping, etc.)
    selection-label/
      jira-comments-section.tsx          # NEW — extracted from index.tsx (comment list + reply buttons + composer)
      index.tsx                          # Stays ~870 lines — renders <JiraCommentsSection> with props
    sidebar/
      jira-editor.tsx                    # Refactored to import ToolbarButton from editor/toolbar.tsx
  features/
    sidebar/
      extract-mentions.ts               # TipTap JSON → mention array extraction
      use-jira-comments.ts              # NEW — hook for optimistic UI, submit, reply state (reusable across surfaces)

packages/sync-server/src/
  services/
    jira.service.ts                      # addComment always accepts ADF, new uploadBase64Images() method
    jira-adf-mentions.ts                 # Pure function — injectMentions (no dependencies)
```

### Key decisions

1. **Editor in `components/editor/`** — not `sidebar/` — so any surface can import it without cross-domain coupling.
2. **Decomposed sub-components** — toolbar, mention-picker, emoji-picker, color-picker are separate files (each <120 lines). The main editor file stays ~180 lines.
3. **`jira-comments-section.tsx` extracted from selection-label** — follows the existing pattern of `completion-view.tsx`, `jira-meta.tsx`, `error-view.tsx`. Prevents `index.tsx` from growing past 870 lines.
4. **`useJiraComments` hook** — owns optimistic state, submit logic, reply state, poll refresh. Reusable when the editor appears in other surfaces (dashboard, sidebar panel, etc.).
5. **Shared `ToolbarButton`** — extracted from `jira-editor.tsx` into `editor/toolbar.tsx`, imported by both editors. DRY.
6. **`addComment` always receives ADF** — route handler converts markdown → ADF → injects mentions. Service method has clean `body: object` type, not `string | object`.
7. **`uploadBase64Images` in JiraService** — image upload logic in service layer (not route handler), DRYs up the pattern from `createTicketFromGroup`.
8. **Module-level mention cache** — `mentionCache` Map in `mention-picker.tsx` with 60s TTL, survives editor lifecycle.

---

## Task 1: Verify PoC backend changes typecheck (already implemented)

The PoC session already added `addComment`, `searchUsers`, schemas, and routes to the sync-server. Verify they're solid before building on top.

**Files:**
- Verify: `packages/sync-server/src/services/jira.service.ts:429-460`
- Verify: `packages/sync-server/src/schemas/jira.ts:64-78`
- Verify: `packages/sync-server/src/routes/jira.ts:143-210`
- Verify: `packages/sync-server/src/schemas/index.ts`

**Step 1: Run typecheck**

Run: `cd packages/sync-server && npx tsc --noEmit`
Expected: Clean — 0 errors

**Step 2: Review the addComment service method**

Read `packages/sync-server/src/services/jira.service.ts:429-443`. Verify:
- It calls `this.client.issueComments.addComment()`
- It accepts optional `parentId` for threading
- It returns `{ id, created }`

**Step 3: Review the searchUsers service method**

Read `packages/sync-server/src/services/jira.service.ts:449-460`. Verify:
- It calls `this.client.userSearch.findUsersWithAllPermissions()`
- `maxResults: 10`
- Maps to `{ accountId, displayName, avatarUrl }`

**Step 4: Review schemas**

Read `packages/sync-server/src/schemas/jira.ts:64-78`. Verify:
- `AddJiraCommentRequest` has `body: string`, `parentId?: string`
- `AddJiraCommentResponse` has `id: string`, `created: string`
- `JiraUser` has `accountId: string`, `displayName: string`, `avatarUrl: string | null`
- All have `.openapi()` annotations

**Step 5: Review routes**

Read `packages/sync-server/src/routes/jira.ts:143-210`. Verify:
- `POST /workspaces/{id}/groups/{groupId}/jira-comment` resolves group -> ticketId, calls `jira.addComment()`
- `GET /jira/users?query=<string>` calls `jira.searchUsers()`
- Error handling returns 404/400/500 with message

**Step 6: Commit if any adjustments were needed**

```bash
git add packages/sync-server/
git commit -m "feat(sync-server): add addComment + searchUsers endpoints for JIRA comment write-back

SPEC-013 Layer 1: addComment service method, searchUsers service method,
AddJiraCommentRequest/Response/JiraUser schemas, and route handlers.
PoC-validated — typechecks clean."
```

**AC covered:** Layer 1 addComment (all 8), Layer 1 searchUsers (all 5), Layer 1 schemas (all 2)

---

## Task 2: Create the `injectMentions` ADF post-processor

A pure function module that enriches marklassian ADF output with mention nodes. Zero dependencies on JiraService — pure data transformation.

**Files:**
- Create: `packages/sync-server/src/services/jira-adf-mentions.ts`
- Test: `packages/sync-server/src/services/__tests__/jira-adf-mentions.test.ts`

**Step 1: Write the failing tests**

Create `packages/sync-server/src/services/__tests__/jira-adf-mentions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { injectMentions } from "../jira-adf-mentions.js";

describe("injectMentions", () => {
  it("returns ADF unchanged when no mentions provided", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hello world" }] }],
    };
    expect(injectMentions(adf, [])).toEqual(adf);
  });

  it("replaces @Name with a mention node in a paragraph", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello @Alice Cooper, looks good" }] },
      ],
    };
    const mentions = [{ text: "@Alice Cooper", accountId: "abc123" }];
    const result = injectMentions(adf, mentions);
    const para = result.content[0].content;
    expect(para).toHaveLength(3);
    expect(para[0]).toEqual({ type: "text", text: "Hello " });
    expect(para[1]).toEqual({
      type: "mention",
      attrs: { id: "abc123", text: "@Alice Cooper", accessLevel: "" },
    });
    expect(para[2]).toEqual({ type: "text", text: ", looks good" });
  });

  it("handles multiple mentions in one text node", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [
        { type: "paragraph", content: [{ type: "text", text: "@Alice Cooper and @Bob Martinez" }] },
      ],
    };
    const mentions = [
      { text: "@Alice Cooper", accountId: "a1" },
      { text: "@Bob Martinez", accountId: "b2" },
    ];
    const result = injectMentions(adf, mentions);
    const para = result.content[0].content;
    expect(para).toHaveLength(4);
    expect(para[0].type).toBe("mention");
    expect(para[1]).toEqual({ type: "text", text: " and " });
    expect(para[2].type).toBe("mention");
    expect(para[3]).toEqual({ type: "text", text: "" }); // trailing empty ok
  });

  it("handles mentions inside nested structures (list items)", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [{
        type: "bulletList",
        content: [{
          type: "listItem",
          content: [{
            type: "paragraph",
            content: [{ type: "text", text: "cc @Alice Cooper" }],
          }],
        }],
      }],
    };
    const mentions = [{ text: "@Alice Cooper", accountId: "a1" }];
    const result = injectMentions(adf, mentions);
    const innerPara = result.content[0].content[0].content[0].content;
    expect(innerPara[0]).toEqual({ type: "text", text: "cc " });
    expect(innerPara[1].type).toBe("mention");
  });

  it("leaves non-text nodes untouched", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [
        { type: "rule" },
        { type: "paragraph", content: [{ type: "text", text: "no mentions here" }] },
      ],
    };
    const result = injectMentions(adf, [{ text: "@Nobody", accountId: "x" }]);
    expect(result.content[0]).toEqual({ type: "rule" });
    expect(result.content[1].content[0].text).toBe("no mentions here");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/sync-server && npx vitest run src/services/__tests__/jira-adf-mentions.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `packages/sync-server/src/services/jira-adf-mentions.ts`:

```ts
interface AdfNode {
  type: string;
  text?: string;
  content?: AdfNode[];
  attrs?: Record<string, unknown>;
  marks?: unknown[];
  [key: string]: unknown;
}

interface MentionMapping {
  text: string;      // e.g. "@Alice Cooper"
  accountId: string; // JIRA accountId
}

/**
 * Walks an ADF tree and replaces @Name text patterns with mention nodes.
 * Pure function — no side effects, no dependencies on JiraService.
 */
export function injectMentions(
  adf: AdfNode,
  mentions: MentionMapping[],
): AdfNode {
  if (mentions.length === 0) return adf;
  return walkNode(structuredClone(adf), mentions);
}

function walkNode(node: AdfNode, mentions: MentionMapping[]): AdfNode {
  if (!node.content) return node;
  const expanded: AdfNode[] = [];
  for (const child of node.content) {
    if (child.type === "text" && child.text) {
      expanded.push(...splitTextNode(child, mentions));
    } else {
      expanded.push(walkNode(child, mentions));
    }
  }
  node.content = expanded;
  return node;
}

function splitTextNode(node: AdfNode, mentions: MentionMapping[]): AdfNode[] {
  let text = node.text!;
  const result: AdfNode[] = [];

  while (text.length > 0) {
    let earliest = -1;
    let match: MentionMapping | null = null;
    for (const m of mentions) {
      const idx = text.indexOf(m.text);
      if (idx !== -1 && (earliest === -1 || idx < earliest)) {
        earliest = idx;
        match = m;
      }
    }
    if (match === null || earliest === -1) {
      result.push({ ...node, text });
      break;
    }
    if (earliest > 0) {
      result.push({ ...node, text: text.slice(0, earliest) });
    }
    result.push({
      type: "mention",
      attrs: { id: match.accountId, text: match.text, accessLevel: "" },
    });
    text = text.slice(earliest + match.text.length);
    if (text.length === 0) {
      result.push({ ...node, text: "" });
    }
  }
  return result;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/sync-server && npx vitest run src/services/__tests__/jira-adf-mentions.test.ts`
Expected: All 5 tests PASS

**Step 5: Run full typecheck**

Run: `cd packages/sync-server && npx tsc --noEmit`
Expected: 0 errors

**Step 6: Commit**

```bash
git add packages/sync-server/src/services/jira-adf-mentions.ts packages/sync-server/src/services/__tests__/
git commit -m "feat(sync-server): add injectMentions ADF post-processor

SPEC-013 Layer 5: pure function that enriches marklassian ADF output
with mention nodes. No dependency on JiraService.
Tested: single mention, multiple mentions, nested structures, passthrough."
```

**AC covered:** Layer 5 ADF mention post-processing (all 7)

---

## Task 3: Wire `injectMentions` into the addComment route

Update the addComment route to accept a `mentions` array and use the post-processor. The service method always receives ADF (not string) — the route handler is responsible for conversion.

**Files:**
- Modify: `packages/sync-server/src/schemas/jira.ts` (AddJiraCommentRequest)
- Modify: `packages/sync-server/src/routes/jira.ts` (addComment handler)
- Modify: `packages/sync-server/src/services/jira.service.ts` (addComment method — always ADF)

**Step 1: Extend the request schema to include mentions**

In `packages/sync-server/src/schemas/jira.ts`, update `AddJiraCommentRequest`:

```ts
export const AddJiraCommentRequest = z.object({
  body: z.string().openapi({ description: "Comment text (Markdown)", example: "Looks good to me!" }),
  parentId: z.string().optional().openapi({ description: "Parent comment ID for threaded replies", example: "10001" }),
  mentions: z.array(z.object({
    text: z.string().openapi({ example: "@Alice Cooper" }),
    accountId: z.string().openapi({ example: "5b10ac8d82e05b22cc7d4ef5" }),
  })).optional().openapi({ description: "Mention mappings for ADF injection" }),
});
```

**Step 2: Update the addComment route handler**

In `packages/sync-server/src/routes/jira.ts`, update the addComment handler to:
1. Import `markdownToAdf` from `marklassian` and `injectMentions` from `../services/jira-adf-mentions.js`
2. Convert body to ADF: `const adf = markdownToAdf(body)`
3. If mentions present: `const enriched = injectMentions(adf, mentions)`
4. Pass ADF to `jira.addComment(ticketId, enriched, parentId)`

**Step 3: Update `addComment` service method — always accept ADF**

In `jira.service.ts`, change `body` parameter type from `string` to `object`:

```ts
async addComment(
  ticketId: string,
  body: object,  // Always ADF document — route handler converts markdown first
  parentId?: string,
): Promise<{ id: string; created: string }>
```

This is cleaner than `string | object` — the route handler is always responsible for markdown → ADF conversion. No dual codepath in the service.

**Step 4: Typecheck**

Run: `cd packages/sync-server && npx tsc --noEmit`
Expected: 0 errors

**Step 5: Commit**

```bash
git add packages/sync-server/
git commit -m "feat(sync-server): wire injectMentions into addComment route

SPEC-013: addComment now accepts optional mentions array, converts
markdown to ADF via marklassian, injects mention nodes, and posts
the enriched ADF to JIRA. Service method always receives ADF (not string)."
```

---

## Task 4: Regenerate the Orval API client

Export the OpenAPI spec and regenerate typed client functions.

**Files:**
- Regenerate: `packages/react-grab/src/generated/sync-api.ts`

**Step 1: Export the updated OpenAPI spec**

Run: `cd packages/sync-server && pnpm export-spec`

**Step 2: Regenerate the Orval client**

Run: `cd packages/react-grab && pnpm codegen`

**Step 3: Verify new functions exist**

Run: `grep -n "addJiraComment\|searchJiraUsers" packages/react-grab/src/generated/sync-api.ts`
Expected: Both functions appear with typed parameters

**Step 4: Typecheck the frontend**

Run: `cd packages/react-grab && npx tsc --noEmit`
Expected: 0 errors

**Step 5: Commit**

```bash
git add packages/react-grab/src/generated/ packages/sync-server/
git commit -m "chore: regenerate Orval client with addJiraComment + searchJiraUsers

SPEC-013 Layer 2: typed API client functions for comment write-back."
```

**AC covered:** Layer 2 Orval (all 2)

---

## Task 5: Install TipTap extension dependencies

The existing `package.json` has `@tiptap/core`, `@tiptap/starter-kit`, `@tiptap/pm`, `tiptap-extension-jira`, and `tiptap-markdown`. The comment editor needs additional extensions.

**Step 1: Install new TipTap extensions**

Run:
```bash
cd packages/react-grab && pnpm add @tiptap/extension-link @tiptap/extension-underline @tiptap/extension-color @tiptap/extension-text-style @tiptap/extension-image @tiptap/extension-mention @tiptap/extension-placeholder
```

**Step 2: Verify installation**

Run: `grep "@tiptap/extension-" packages/react-grab/package.json`
Expected: All 7 extensions listed

**Step 3: Commit**

```bash
git add packages/react-grab/package.json pnpm-lock.yaml
git commit -m "chore: add TipTap extensions for JIRA comment editor

@tiptap/extension-link, -underline, -color, -text-style,
-image, -mention, -placeholder — required by ADR-0010."
```

---

## Task 6: Create the `extractMentions` helper

A frontend utility that scans TipTap JSON for mention nodes and extracts `[{ text, accountId }]`.

**Files:**
- Create: `packages/react-grab/src/features/sidebar/extract-mentions.ts`
- Test: `packages/react-grab/src/features/sidebar/__tests__/extract-mentions.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { extractMentions } from "../extract-mentions.js";

describe("extractMentions", () => {
  it("returns empty array when no mentions", () => {
    const json = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }] };
    expect(extractMentions(json)).toEqual([]);
  });

  it("extracts mention with accountId and display name", () => {
    const json = {
      type: "doc",
      content: [{
        type: "paragraph",
        content: [
          { type: "mention", attrs: { id: "abc", label: "Alice Cooper" } },
          { type: "text", text: " hi" },
        ],
      }],
    };
    expect(extractMentions(json)).toEqual([{ text: "@Alice Cooper", accountId: "abc" }]);
  });

  it("deduplicates mentions", () => {
    const json = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "mention", attrs: { id: "a1", label: "Alice" } }] },
        { type: "paragraph", content: [{ type: "mention", attrs: { id: "a1", label: "Alice" } }] },
      ],
    };
    expect(extractMentions(json)).toHaveLength(1);
  });
});
```

**Step 2: Run to verify failure**

Run: `cd packages/react-grab && npx vitest run src/features/sidebar/__tests__/extract-mentions.test.ts`

**Step 3: Implement**

Create `packages/react-grab/src/features/sidebar/extract-mentions.ts`:

```ts
interface TipTapNode {
  type: string;
  attrs?: { id?: string; label?: string };
  content?: TipTapNode[];
}

export function extractMentions(
  json: TipTapNode,
): Array<{ text: string; accountId: string }> {
  const seen = new Set<string>();
  const result: Array<{ text: string; accountId: string }> = [];

  function walk(node: TipTapNode) {
    if (node.type === "mention" && node.attrs?.id && node.attrs?.label) {
      if (!seen.has(node.attrs.id)) {
        seen.add(node.attrs.id);
        result.push({ text: `@${node.attrs.label}`, accountId: node.attrs.id });
      }
    }
    for (const child of node.content ?? []) walk(child);
  }

  walk(json);
  return result;
}
```

**Step 4: Run tests to verify pass**

Run: `cd packages/react-grab && npx vitest run src/features/sidebar/__tests__/extract-mentions.test.ts`
Expected: All 3 PASS

**Step 5: Commit**

```bash
git add packages/react-grab/src/features/sidebar/extract-mentions.ts packages/react-grab/src/features/sidebar/__tests__/
git commit -m "feat: add extractMentions helper for TipTap mention nodes

SPEC-013: scans TipTap JSON for mention nodes, returns deduplicated
[{ text, accountId }] array for the addComment API payload."
```

**AC covered:** Layer 3 @mentions — extractMentions item

---

## Task 7: Build the `JiraCommentEditor` — decomposed into sub-components

The editor is decomposed into 5 files under `components/editor/` for reusability and SRP. Each sub-component is <120 lines. The main editor file stays ~180 lines.

**Files:**
- Create: `packages/react-grab/src/components/editor/types.ts`
- Create: `packages/react-grab/src/components/editor/toolbar.tsx` (shared with jira-editor.tsx)
- Create: `packages/react-grab/src/components/editor/mention-picker.tsx`
- Create: `packages/react-grab/src/components/editor/emoji-picker.tsx`
- Create: `packages/react-grab/src/components/editor/color-picker.tsx`
- Create: `packages/react-grab/src/components/editor/jira-comment-editor.tsx`
- Modify: `packages/react-grab/src/components/sidebar/jira-editor.tsx` (import ToolbarButton from shared)
- Reference: `poc-jira-editor.html` (PoC for toolbar layout and behavior)

**Step 1: Create shared types and extract ToolbarButton**

Create `packages/react-grab/src/components/editor/types.ts` with shared editor types:
```ts
export interface JiraCommentEditorProps {
  onSubmit: (markdown: string, mentions: Array<{ text: string; accountId: string }>) => void;
  onCancel?: () => void;
  onSearchUsers?: (query: string) => Promise<Array<{ accountId: string; displayName: string; avatarUrl: string | null }>>;
  replyTo?: { id: string; author: string } | null;
  onCancelReply?: () => void;
}
```

Extract `ToolbarButton` from `jira-editor.tsx:11-37` into `packages/react-grab/src/components/editor/toolbar.tsx`. Add `ToolbarSeparator` and `ToolbarDropdown`. Update `jira-editor.tsx` to import from `../editor/toolbar.js`.

**Step 1b: Create the mention-picker, emoji-picker, and color-picker sub-components**

- `mention-picker.tsx` (~120 lines): `createMentionSuggestion(searchFn)` factory, floating popup renderer, keyboard nav, module-level `mentionCache` Map with 60s TTL
- `emoji-picker.tsx` (~60 lines): Emoji grid with common emoji, `onSelect` callback
- `color-picker.tsx` (~40 lines): Color palette with 10 colors + reset, `onSelect` callback

**Step 1c: Create the main editor composition**

Create `packages/react-grab/src/components/editor/jira-comment-editor.tsx`. Follow the exact SolidJS + TipTap pattern from `jira-editor.tsx:38-57` but with the full extension list from ADR-0010:

```ts
import { type Component, createSignal, onCleanup, onMount, Show } from "solid-js";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import { extractMentions } from "../../features/sidebar/extract-mentions.js";
```

Editor creation in `onMount`:
```ts
editor = new Editor({
  element: editorEl,
  extensions: [
    StarterKit,
    Markdown.configure({ html: false, transformPastedText: true }),
    Link.configure({ openOnClick: false }),
    Underline,
    TextStyle,
    Color,
    Image,
    Mention.configure({
      HTMLAttributes: { class: "mention" },
      suggestion: createMentionSuggestion(props.onSearchUsers),
      renderText: ({ node }) => `@${node.attrs.label}`,
    }),
    Placeholder.configure({ placeholder: "Add a comment..." }),
  ],
  content: "",
  onTransaction: () => tick((n) => n + 1),
});
```

**Step 2: Add the toolbar**

Port the toolbar from `jira-editor.tsx:74-176` but extend with:
- Text style dropdown (Normal, H1, H2, H3) — use the existing `ToolbarButton` pattern
- Formatting dropdown (Bold, Italic, Underline, Strike, Code)
- List dropdown (Bullet, Ordered, Blockquote)
- Text color picker (palette of 10 colors + reset)
- Image button (triggers hidden file input)
- Code block toggle
- Emoji picker (grid of common emoji — `insertContent()`)
- Insert menu (+) (Divider, Code block, Quote)
- Link toggle
- Undo / Redo

Refer to `poc-jira-editor.html` for the exact toolbar layout and dropdown patterns.

**Step 3: Add mention suggestion plugin**

Create `createMentionSuggestion(searchFn)` that:
- Calls `searchFn(query)` to fetch user list (debounced)
- Renders a floating popup with avatar + name (same pattern as PoC)
- Arrow key navigation, Enter/Tab to select, Escape to dismiss
- Returns `{ id: accountId, label: displayName }` as the mention node attrs

**Step 4: Add image handling**

- Hidden `<input type="file" accept="image/*">` triggered by toolbar button
- Paste handler: listen to `paste` event on editor element, check for `image/*` items
- Drop handler: `dragover`/`drop` on editor element
- All three call `insertImageFile(file)` which does `FileReader.readAsDataURL` -> `editor.chain().setImage()`

**Step 5: Export the component interface and add `data-react-grab-*` attributes**

```ts
interface JiraCommentEditorProps {
  onSubmit: (markdown: string, mentions: Array<{ text: string; accountId: string }>) => void;
  onCancel?: () => void;
  onSearchUsers?: (query: string) => Promise<Array<{ accountId: string; displayName: string; avatarUrl: string | null }>>;
  replyTo?: { id: string; author: string } | null;
  onCancelReply?: () => void;
}
```

`onSubmit` is called with the Markdown body + extracted mentions.

**DOM attributes** — all interactive elements must use `data-react-grab-*` attributes:
- Root: `data-react-grab-comment-composer`
- Editor area: `data-react-grab-comment-editor`
- Submit: `data-react-grab-comment-submit`
- Cancel: `data-react-grab-comment-cancel`
- Mention picker: `data-react-grab-mention-picker`
- All toolbar buttons, dropdowns, pickers: `data-react-grab-ignore-events` (prevents parent selection-label from capturing events — same pattern as existing buttons at `selection-label/index.tsx:551,566,773,802`)

**Step 6: Typecheck**

Run: `cd packages/react-grab && npx tsc --noEmit`
Expected: 0 errors

**Step 7: Commit**

```bash
git add packages/react-grab/src/components/editor/ packages/react-grab/src/components/sidebar/jira-editor.tsx
git commit -m "feat: add JiraCommentEditor with decomposed sub-components

SPEC-013 Layer 3: components/editor/ directory with:
- toolbar.tsx (shared ToolbarButton — also used by jira-editor.tsx)
- mention-picker.tsx (suggestion plugin with module-level cache)
- emoji-picker.tsx, color-picker.tsx (isolated pickers)
- jira-comment-editor.tsx (main composition ~180 lines)
Full JIRA toolbar, @mentions, image paste/drop, Markdown output."
```

**AC covered:** Layer 3 core (all 6), Layer 3 toolbar (all 12), Layer 3 @mentions (5/6), Layer 3 images (all 6)

---

## Task 8: Extract `jira-comments-section.tsx` + `useJiraComments` hook

Instead of adding more logic to the 871-line `index.tsx`, extract a dedicated component and hook. Follows the existing pattern of `completion-view.tsx`, `jira-meta.tsx`, `error-view.tsx`.

**Files:**
- Create: `packages/react-grab/src/features/sidebar/use-jira-comments.ts` (optimistic UI hook)
- Create: `packages/react-grab/src/components/selection-label/jira-comments-section.tsx` (comment list + reply + composer)
- Modify: `packages/react-grab/src/components/selection-label/index.tsx:799-845` (replace inline comments with `<JiraCommentsSection>`)

**Step 0: Create the `useJiraComments` hook**

Create `packages/react-grab/src/features/sidebar/use-jira-comments.ts`:

```ts
export function useJiraComments(props: {
  workspaceId: () => string;
  groupId: () => string;
  serverComments: () => JiraComment[];
  onRefreshPoll: () => void;
}) {
  const [optimistic, setOptimistic] = createSignal<JiraComment[]>([]);
  const [replyTo, setReplyTo] = createSignal<{ id: string; author: string } | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  const mergedComments = () => [...props.serverComments(), ...optimistic()];

  async function submitComment(markdown: string, mentions: MentionMapping[]) {
    // 1. Optimistic insert with sending state
    // 2. Call addJiraComment API
    // 3. On success: remove optimistic, trigger onRefreshPoll
    // 4. On failure: remove optimistic, set error, return editor content for restore
  }

  return { mergedComments, replyTo, setReplyTo, submitComment, error };
}
```

This hook is reusable across any surface that needs comment write-back.

**Step 1: Create `jira-comments-section.tsx`**

This component owns the comment list, reply buttons, `JiraCommentEditor`, and `M` keyboard shortcut. Extract the block at `index.tsx:799-845` and extend with:

**DOM attributes** on new elements:
- Reply button: `data-react-grab-comment-reply` + `data-react-grab-ignore-events`
- Reply context bar: `data-react-grab-reply-context` + `data-react-grab-ignore-events`
- The entire comments section interactive area: `data-react-grab-ignore-events` (prevents selection-label pointer handlers from interfering with editor interactions)

```tsx
<button
  class="text-[10px] text-muted-foreground hover:text-foreground mt-0.5 opacity-0 group-hover:opacity-100"
  onMouseDown={(e) => { e.preventDefault(); setReplyTo({ id: root.id, author: root.author }); }}
>
  Reply
</button>
```

**Step 2: Add the JiraCommentEditor below the comment list**

After the `</CollapsibleContent>` (line 843), add:

```tsx
<JiraCommentEditor
  replyTo={replyTo()}
  onCancelReply={() => setReplyTo(null)}
  onSearchUsers={async (query) => {
    const result = await searchJiraUsers({ query });
    return result;
  }}
  onSubmit={async (markdown, mentions) => {
    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    // ... append to local comments signal
    // Call API
    const result = await addJiraComment(workspaceId, groupId, { body: markdown, parentId: replyTo()?.id, mentions });
    // Replace temp, trigger refresh poll
  }}
/>
```

**Step 3: Add `M` keyboard shortcut**

In the existing `handleGlobalKeyDown` (line 176), add a case for `M` that focuses the editor.

**Step 4: Add optimistic UI logic**

Create local signals for optimistic comments:
- `const [localComments, setLocalComments] = createSignal<JiraComment[]>([]);`
- Merge `props.jiraComments` with `localComments()` for rendering
- On submit: add optimistic entry with `sending: true`
- On success: remove optimistic, trigger immediate poll via `getJiraTicketStatus()`
- On failure: remove optimistic, show error, restore editor content

**Step 5: Typecheck and test manually**

Run: `cd packages/react-grab && npx tsc --noEmit`
Expected: 0 errors

**Step 6: Commit**

```bash
git add packages/react-grab/src/features/sidebar/use-jira-comments.ts packages/react-grab/src/components/selection-label/jira-comments-section.tsx packages/react-grab/src/components/selection-label/index.tsx
git commit -m "feat: extract JiraCommentsSection + useJiraComments hook

SPEC-013 Layer 4:
- useJiraComments hook: optimistic UI, submit, reply state (reusable)
- JiraCommentsSection: comment list, reply buttons, JiraCommentEditor, M shortcut
- index.tsx: renders <JiraCommentsSection> — no new logic added to 871-line file"
```

**AC covered:** Layer 4 composer (all 8), Layer 4 optimistic UI (all 5)

---

## Task 9: Add comment editor styles

Add TipTap editor styles to the global stylesheet for shadow DOM rendering.

**Files:**
- Modify: `packages/react-grab/src/styles.css`

**Step 1: Add editor styles**

Append ProseMirror styles for the comment editor:
- `.mention` chip style (blue background, rounded)
- Placeholder style (`.ProseMirror p.is-editor-empty:first-child::before`)
- Image max-width and border
- Toolbar button active/disabled states
- Mention picker popup positioning

Reference: `poc-jira-editor.html` CSS section for all styles.

**Step 2: Build CSS**

Run: `cd packages/react-grab && pnpm css:build`

**Step 3: Commit**

```bash
git add packages/react-grab/src/styles.css
git commit -m "style: add TipTap comment editor styles for shadow DOM

SPEC-013: mention chips, placeholder, image cards, toolbar states,
mention picker popup."
```

---

## Task 10: Image upload flow — `uploadBase64Images` service method

Handle base64 images in the comment body. Extract, upload to JIRA, replace URLs. Logic lives in `JiraService` (not the route handler) — DRYs up the attachment pattern from `createTicketFromGroup`.

**Files:**
- Modify: `packages/sync-server/src/services/jira.service.ts` (new `uploadBase64Images` method)
- Modify: `packages/sync-server/src/routes/jira.ts` (call `uploadBase64Images` before `markdownToAdf`)

**Step 1: Add `uploadBase64Images` to JiraService**

Add method to `JiraService` that extracts `![](data:...)` patterns, uploads each to JIRA attachments, and returns rewritten markdown:

```ts
// Extract and upload base64 images
const imgRegex = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g;
let processedBody = body;
for (const match of body.matchAll(imgRegex)) {
  const [full, alt, dataUrl] = match;
  const base64 = dataUrl.split(",")[1];
  const mimeType = dataUrl.match(/data:([^;]+)/)?.[1] ?? "image/png";
  const ext = mimeType.split("/")[1] ?? "png";
  const blob = new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], { type: mimeType });
  const form = new FormData();
  form.append("file", blob, `comment-${Date.now()}.${ext}`);
  const attachRes = await fetch(
    `${jira.config.baseUrl}/rest/api/3/issue/${ticketId}/attachments`,
    { method: "POST", headers: { Authorization: jira.authHeader, "X-Atlassian-Token": "no-check" }, body: form },
  );
  if (attachRes.ok) {
    const [att] = await attachRes.json();
    processedBody = processedBody.replace(full, `![${alt}](/jira-attachment/${att.id})`);
  }
}
```

**Step 2: Typecheck**

Run: `cd packages/sync-server && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add packages/sync-server/src/services/jira.service.ts packages/sync-server/src/routes/jira.ts
git commit -m "feat(sync-server): add uploadBase64Images to JiraService

SPEC-013 Layer 5: extracts data: URLs from markdown, uploads to JIRA
attachments API, replaces with proxy URLs. DRYs up pattern from
createTicketFromGroup. Route calls service before markdownToAdf."
```

**AC covered:** Layer 5 image upload (all 5)

---

## Task 11: Cross-cutting checks and final typecheck

**Step 1: Full typecheck both packages**

Run: `cd packages/sync-server && npx tsc --noEmit && cd ../react-grab && npx tsc --noEmit`
Expected: 0 errors in both

**Step 2: Run all unit tests**

Run: `cd packages/sync-server && npx vitest run`
Run: `cd packages/react-grab && npx vitest run`

**Step 3: Lint check**

Run: `cd packages/react-grab && pnpm lint`

**Step 4: Verify no new eslint-disable comments**

Run: `grep -rn "eslint-disable" packages/react-grab/src/components/sidebar/jira-comment-editor.tsx packages/sync-server/src/services/jira-adf-mentions.ts`
Expected: No output (no disables)

**Step 5: Verify JSDoc on new service methods**

Confirm `addComment`, `searchUsers`, and `injectMentions` all have JSDoc.

**Step 6: Final commit**

```bash
git add -A
git commit -m "chore: SPEC-013 cross-cutting — typecheck, lint, JSDoc verification"
```

**AC covered:** Cross-cutting (all 5)

---

## Task 12: Update decree progress

Check off the acceptance criteria that are complete and update decree.

**Step 1: Run decree progress**

Run: `decree progress`

**Step 2: Check off implemented items in SPEC-013**

Update checkboxes in `decree/spec/013-jira-comment-write-back.md` from `- [ ]` to `- [x]` for all completed items.

**Step 3: Commit**

```bash
git add decree/
git commit -m "docs: update SPEC-013 acceptance criteria progress"
```
