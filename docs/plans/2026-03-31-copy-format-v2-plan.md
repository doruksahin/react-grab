# Copy Format v2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the copy system group-aware and respect reveal/visibility state. "Copy" only copies items that are `revealed === true` AND connected to the DOM. All three clipboard formats (text/plain, text/html, application/x-react-grab) and the MCP context endpoint gain group structure.

**Architecture:** New `joinGroupedSnippets` formatter replaces `joinSnippets` for the copy-all path. `copyContent` gains a new `ReactGrabMetadata` format with `groups[]` instead of flat `entries[]`. The MCP server schema changes from `{ content, prompt }` to `{ groups }`. `handleCommentsCopyAll` filters items by `revealed + connected` before copying. `GroupCollapsible` gets a per-group copy button.

**Tech Stack:** SolidJS, TypeScript, Zod (MCP server schema)

**Proposal doc:** `docs/plans/copy-format-v2-proposal.md`

---

## Codebase Orientation

| Concept | File | What to look for |
|---------|------|-----------------|
| Copy All handler | `src/core/index.tsx:3953-4005` | `handleCommentsCopyAll` — rewrite to filter + group |
| copyContent util | `src/utils/copy-content.ts` | `ReactGrabMetadata`, `ReactGrabEntry`, clipboard write |
| joinSnippets util | `src/utils/join-snippets.ts` | Flat `[1]\n...\n\n[2]\n...` formatter |
| Group operations | `src/features/selection-groups/business/group-operations.ts` | `groupComments` — already groups items by group |
| GroupCollapsible | `src/features/selection-groups/components/group-collapsible.tsx:7-15` | Props — add `onCopyGroup` |
| CommentsDropdown | `src/components/comments-dropdown.tsx:34-51` | Props — add `onCopyGroup` |
| Renderer | `src/components/renderer.tsx:251-263` | CommentsDropdown prop passthrough |
| ReactGrabRendererProps | `src/types.ts` | Add `onCopyGroup` prop |
| Visibility module | `src/features/selection-visibility/index.ts` | `isItemRevealed` for filtering |
| Disconnected IDs | `src/core/index.tsx` | `commentsDisconnectedItemIds` memo |
| MCP client | `packages/mcp/src/client.ts:7-17` | `sendContextToServer` — change payload format |
| MCP server | `packages/mcp/src/server.ts:17-44` | `agentContextSchema`, `formatContext` — change schema |
| E2E test | `e2e/selection.spec.ts:47-66` | Clipboard metadata test — update assertions |

All paths relative to `packages/react-grab/` unless noted.

---

### Task 1: Create `joinGroupedSnippets` formatter

**Files:**
- Modify: `packages/react-grab/src/utils/join-snippets.ts`

**Step 1: Add the new formatter**

Keep the existing `joinSnippets` (still used by single-element copy). Add a new exported function:

```typescript
export interface GroupedSnippet {
  groupName: string;
  entries: Array<{
    content: string;
    commentText?: string;
  }>;
}

export const joinGroupedSnippets = (groups: GroupedSnippet[]): string => {
  // Filter out empty groups
  const nonEmpty = groups.filter((g) => g.entries.length > 0);
  if (nonEmpty.length === 0) return "";

  // Single item across all groups — no header, no numbering
  const totalEntries = nonEmpty.reduce((n, g) => n + g.entries.length, 0);
  if (totalEntries === 1) {
    const entry = nonEmpty[0]!.entries[0]!;
    if (entry.commentText) {
      return `${entry.commentText}\n\n${entry.content}`;
    }
    return entry.content;
  }

  const multiGroup = nonEmpty.length > 1;
  let index = 1;
  const parts: string[] = [];

  for (const group of nonEmpty) {
    if (multiGroup) {
      parts.push(`## ${group.groupName}`);
    }
    for (const entry of group.entries) {
      const prefix = entry.commentText ? `[${index}] ${entry.commentText}` : `[${index}]`;
      parts.push(`${prefix}\n${entry.content}`);
      index++;
    }
  }

  return parts.join("\n\n");
};
```

**Step 2: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/react-grab/src/utils/join-snippets.ts
git commit -m "feat(copy): add joinGroupedSnippets formatter with group headers"
```

---

### Task 2: Update clipboard metadata format

**Files:**
- Modify: `packages/react-grab/src/utils/copy-content.ts`

**Step 1: Add new grouped types alongside existing ones**

Keep old types for now (single-element copy still uses them). Add:

```typescript
export interface ReactGrabGroupEntry {
  tagName?: string;
  componentName?: string;
  content: string;
  commentText?: string;
}

export interface ReactGrabGroup {
  name: string;
  entries: ReactGrabGroupEntry[];
}

interface ReactGrabMetadataV2 {
  version: string;
  groups: ReactGrabGroup[];
  timestamp: number;
}
```

**Step 2: Add `copyGroupedContent` function**

Add a new function that writes the grouped format. Keep existing `copyContent` for single-element copies.

```typescript
export const copyGroupedContent = (
  content: string,
  groups: ReactGrabGroup[],
  options?: { onSuccess?: () => void },
): boolean => {
  const metadata: ReactGrabMetadataV2 = {
    version: VERSION,
    groups,
    timestamp: Date.now(),
  };

  const copyHandler = (event: ClipboardEvent) => {
    event.preventDefault();
    event.clipboardData?.setData("text/plain", content);
    event.clipboardData?.setData(
      "text/html",
      `<meta charset='utf-8'><pre><code>${escapeHtml(content)}</code></pre>`,
    );
    event.clipboardData?.setData(
      REACT_GRAB_MIME_TYPE,
      JSON.stringify(metadata),
    );
  };

  document.addEventListener("copy", copyHandler);

  const textarea = document.createElement("textarea");
  textarea.value = content;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.ariaHidden = "true";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    if (typeof document.execCommand !== "function") {
      return false;
    }
    const didCopySucceed = document.execCommand("copy");
    if (didCopySucceed) {
      options?.onSuccess?.();
    }
    return didCopySucceed;
  } finally {
    document.removeEventListener("copy", copyHandler);
    textarea.remove();
  }
};
```

**Step 3: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/react-grab/src/utils/copy-content.ts
git commit -m "feat(copy): add copyGroupedContent with ReactGrabMetadataV2 format"
```

---

### Task 3: Rewrite `handleCommentsCopyAll` to filter + group

**Files:**
- Modify: `packages/react-grab/src/core/index.tsx:3953-4005`

**Step 1: Read the current function**

Read `handleCommentsCopyAll` at line 3953. It currently copies ALL items unconditionally.

**Step 2: Replace with filtered + grouped version**

```typescript
const handleCommentsCopyAll = () => {
  clearCommentsHoverPreviews();

  const disconnected = commentsDisconnectedItemIds();
  const currentItems = commentItems();
  const currentGroups = selectionGroups.groups();

  // Filter: only revealed + connected items
  const copyableItems = currentItems.filter(
    (item) => item.revealed && !disconnected.has(item.id),
  );
  if (copyableItems.length === 0) return;

  // Group the copyable items
  const grouped = groupComments(currentGroups, copyableItems);
  const nonEmptyGroups = grouped.filter((g) => g.items.length > 0);

  // Build grouped snippets for text/plain
  const groupedSnippets: GroupedSnippet[] = nonEmptyGroups.map((g) => ({
    groupName: g.group.name,
    entries: g.items.map((item) => ({
      content: item.content,
      commentText: item.commentText,
    })),
  }));
  const combinedContent = joinGroupedSnippets(groupedSnippets);

  // Build grouped metadata for clipboard
  const metadataGroups: ReactGrabGroup[] = nonEmptyGroups.map((g) => ({
    name: g.group.name,
    entries: g.items.map((item) => ({
      tagName: item.tagName,
      componentName: item.componentName ?? item.elementName,
      content: item.content,
      commentText: item.commentText,
    })),
  }));
  copyGroupedContent(combinedContent, metadataGroups);

  if (isClearConfirmed()) {
    handleCommentsClear();
  } else {
    showClearPrompt();
  }

  clearAllLabels();

  // Show "copied" labels only for the items we actually copied
  nativeRequestAnimationFrame(() => {
    batch(() => {
      for (const item of copyableItems) {
        const connectedElements = getConnectedCommentElements(item);
        for (const element of connectedElements) {
          const bounds = createElementBounds(element);
          const labelId = generateId("label");

          actions.addLabelInstance({
            id: labelId,
            bounds,
            tagName: item.tagName,
            componentName: item.componentName,
            status: "copied",
            createdAt: Date.now(),
            element,
            mouseX: bounds.x + bounds.width / 2,
          });
          scheduleLabelFade(labelId);
        }
      }
    });
  });
};
```

**Step 3: Add imports**

At the top of `core/index.tsx`, add:

```typescript
import { joinGroupedSnippets, type GroupedSnippet } from "../utils/join-snippets.js";
import { copyGroupedContent, type ReactGrabGroup } from "../utils/copy-content.js";
import { groupComments } from "../features/selection-groups/business/group-operations.js";
```

Check if `groupComments` is already imported. If so, skip.

**Step 4: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/react-grab/src/core/index.tsx
git commit -m "feat(copy): handleCommentsCopyAll filters by revealed+connected and groups"
```

---

### Task 4: Add per-group copy handler

**Files:**
- Modify: `packages/react-grab/src/core/index.tsx`

**Step 1: Create `handleCopyGroup` handler**

Place near `handleCommentsCopyAll`:

```typescript
const handleCopyGroup = (groupId: string) => {
  const disconnected = commentsDisconnectedItemIds();
  const currentItems = commentItems();
  const currentGroups = selectionGroups.groups();
  const group = currentGroups.find((g) => g.id === groupId);
  if (!group) return;

  // Filter: items in this group that are revealed + connected
  const copyableItems = currentItems.filter(
    (item) =>
      item.groupId === groupId &&
      item.revealed &&
      !disconnected.has(item.id),
  );
  if (copyableItems.length === 0) return;

  // Single group — no header needed
  const groupedSnippets: GroupedSnippet[] = [
    {
      groupName: group.name,
      entries: copyableItems.map((item) => ({
        content: item.content,
        commentText: item.commentText,
      })),
    },
  ];
  const combinedContent = joinGroupedSnippets(groupedSnippets);

  const metadataGroups: ReactGrabGroup[] = [
    {
      name: group.name,
      entries: copyableItems.map((item) => ({
        tagName: item.tagName,
        componentName: item.componentName ?? item.elementName,
        content: item.content,
        commentText: item.commentText,
      })),
    },
  ];
  copyGroupedContent(combinedContent, metadataGroups);

  // Show "copied" labels for copied items
  nativeRequestAnimationFrame(() => {
    batch(() => {
      for (const item of copyableItems) {
        const connectedElements = getConnectedCommentElements(item);
        for (const element of connectedElements) {
          const bounds = createElementBounds(element);
          const labelId = generateId("label");

          actions.addLabelInstance({
            id: labelId,
            bounds,
            tagName: item.tagName,
            componentName: item.componentName,
            status: "copied",
            createdAt: Date.now(),
            element,
            mouseX: bounds.x + bounds.width / 2,
          });
          scheduleLabelFade(labelId);
        }
      }
    });
  });
};
```

**Step 2: Add `onCopyGroup` to `ReactGrabRendererProps`**

In `src/types.ts`, add:

```typescript
onCopyGroup?: (groupId: string) => void;
```

**Step 3: Pass to renderer**

Where `<ReactGrabRenderer>` is called, add:

```tsx
onCopyGroup={handleCopyGroup}
```

**Step 4: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: Errors in renderer/dropdown (don't accept prop yet). Fixed in Task 5.

**Step 5: Commit**

```bash
git add packages/react-grab/src/core/index.tsx packages/react-grab/src/types.ts
git commit -m "feat(copy): add handleCopyGroup for per-group copy"
```

---

### Task 5: Wire per-group copy through UI

**Files:**
- Modify: `packages/react-grab/src/features/selection-groups/components/group-collapsible.tsx`
- Modify: `packages/react-grab/src/components/comments-dropdown.tsx`
- Modify: `packages/react-grab/src/components/renderer.tsx`

**Step 1: Add `onCopyGroup` to `GroupCollapsibleProps`**

```typescript
onCopyGroup: (groupId: string) => void;
```

**Step 2: Add copy button to group header**

In the group header `<div>`, in the actions area (alongside eye toggle), add a copy button:

```tsx
<button
  data-react-grab-ignore-events
  class="flex items-center justify-center w-[18px] h-[18px] rounded hover:bg-black/5 transition-colors"
  on:click={(e) => {
    e.stopPropagation();
    props.onCopyGroup(props.group.id);
  }}
  on:pointerdown={(e) => e.stopPropagation()}
  aria-label="Copy group selections"
>
  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-black/20 hover:text-black/50 transition-colors">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
  </svg>
</button>
```

Place it before the eye toggle in the header actions area. Use `on:click` (native) per the SolidJS event delegation pattern.

**Step 3: Add `onCopyGroup` to `CommentsDropdownProps`**

```typescript
onCopyGroup?: (groupId: string) => void;
```

Pass through to `<GroupCollapsible>`:

```tsx
onCopyGroup={(groupId) => props.onCopyGroup?.(groupId)}
```

**Step 4: Wire in renderer**

In `renderer.tsx`, add to `<CommentsDropdown>`:

```tsx
onCopyGroup={props.onCopyGroup}
```

**Step 5: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/components/group-collapsible.tsx packages/react-grab/src/components/comments-dropdown.tsx packages/react-grab/src/components/renderer.tsx
git commit -m "feat(copy): add per-group copy button in GroupCollapsible header"
```

---

### Task 6: Update "Copy" button label to show count

**Files:**
- Modify: `packages/react-grab/src/components/comments-dropdown.tsx`

**Step 1: Add `copyableCount` prop or compute it**

Add to `CommentsDropdownProps`:

```typescript
copyableCount?: number;
```

**Step 2: Update the "Copy" button label**

Find the Copy button in the header (the one with `data-react-grab-comments-copy-all`). Change the label:

```tsx
<span class="text-black text-[13px] leading-3.5 font-sans font-medium">
  {props.copyableCount != null && props.copyableCount < (props.items?.length ?? 0)
    ? `Copy (${props.copyableCount})`
    : "Copy"}
</span>
```

**Step 3: Compute and pass `copyableCount` from core**

In `core/index.tsx`, create a memo for the count:

```typescript
const copyableItemCount = createMemo(() => {
  const disconnected = commentsDisconnectedItemIds();
  return commentItems().filter(
    (item) => item.revealed && !disconnected.has(item.id),
  ).length;
});
```

Pass to renderer:

```tsx
copyableCount={copyableItemCount()}
```

Add `copyableCount?: number` to `ReactGrabRendererProps`.

Wire through `renderer.tsx`:

```tsx
copyableCount={props.copyableCount}
```

**Step 4: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/react-grab/src/components/comments-dropdown.tsx packages/react-grab/src/core/index.tsx packages/react-grab/src/types.ts packages/react-grab/src/components/renderer.tsx
git commit -m "feat(copy): show Copy (N) count for revealed+connected items"
```

---

### Task 7: Update MCP server schema and formatting

**Files:**
- Modify: `packages/mcp/src/server.ts`

**Step 1: Replace `agentContextSchema`**

```typescript
const agentContextEntrySchema = z.object({
  componentName: z.string().optional(),
  content: z.string(),
  commentText: z.string().optional(),
});

const agentContextGroupSchema = z.object({
  name: z.string(),
  entries: z.array(agentContextEntrySchema),
});

const agentContextSchema = z.object({
  groups: z
    .array(agentContextGroupSchema)
    .describe("Array of selection groups, each containing entries with HTML content"),
});
```

**Step 2: Update `formatContext`**

```typescript
const formatContext = (context: AgentContext): string => {
  const parts: string[] = [];
  const nonEmpty = context.groups.filter((g) => g.entries.length > 0);
  const multiGroup = nonEmpty.length > 1;
  let index = 1;

  for (const group of nonEmpty) {
    if (multiGroup) {
      parts.push(`## ${group.name}`);
    }
    for (const entry of group.entries) {
      const header = entry.commentText
        ? `[${index}] ${entry.commentText}`
        : `[${index}]`;
      const componentLine = entry.componentName
        ? `${entry.componentName}:`
        : "";
      parts.push(
        [header, componentLine, entry.content].filter(Boolean).join("\n"),
      );
      index++;
    }
  }

  return parts.join("\n\n");
};
```

**Step 3: Verify MCP server builds**

Run: `cd packages/mcp && pnpm build` (or `pnpm typecheck` if available)
Expected: PASS

**Step 4: Commit**

```bash
git add packages/mcp/src/server.ts
git commit -m "feat(mcp): update server schema to group-aware format"
```

---

### Task 8: Update MCP client plugin

**Files:**
- Modify: `packages/mcp/src/client.ts`

**Step 1: Update `sendContextToServer` signature**

```typescript
interface McpContextGroup {
  name: string;
  entries: Array<{
    componentName?: string;
    content: string;
    commentText?: string;
  }>;
}

const sendContextToServer = async (
  contextUrl: string,
  groups: McpContextGroup[],
): Promise<void> => {
  await fetch(contextUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groups }),
  }).catch(() => {});
};
```

**Step 2: Update `onCopySuccess` hook**

The `onCopySuccess` hook receives `(elements, content)`. It currently sends `[content]`. Now it needs to send a group structure. However, `onCopySuccess` only has the raw content string — not the group structure.

Two options:
- (a) Pass the group structure through the plugin hook
- (b) Send a single-group wrapper

Use (b) for now — single-element copy doesn't have group info:

```typescript
hooks: {
  onCopySuccess: (_elements: Element[], content: string) => {
    void sendContextToServer(contextUrl, [
      { name: "Selection", entries: [{ content }] },
    ]);
  },
```

**Step 3: Update `transformAgentContext` hook**

This hook has the full `AgentContext` with `content[]` and `prompt`. The agent context doesn't have groups yet — this is the agent session path, not the copy-all path. Wrap in a single group for now:

```typescript
transformAgentContext: async (
  context: AgentContext,
): Promise<AgentContext> => {
  await sendContextToServer(contextUrl, [
    {
      name: "Agent Session",
      entries: context.content.map((c) => ({ content: c })),
    },
  ]);
  return context;
},
```

**Step 4: Verify typecheck**

Run: `cd packages/mcp && pnpm build`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/mcp/src/client.ts
git commit -m "feat(mcp): update client plugin to send group-aware context"
```

---

### Task 9: Update e2e test

**Files:**
- Modify: `packages/react-grab/e2e/selection.spec.ts:47-66`

**Step 1: Update clipboard metadata assertion**

The test asserts `clipboardMetadata.entries`. Update to check `groups`:

```typescript
test("should write React Grab clipboard metadata on copy", async ({
  reactGrab,
}) => {
  await reactGrab.activate();
  await reactGrab.hoverElement("[data-testid='todo-list'] h1");
  await reactGrab.waitForSelectionBox();

  const copyPayloadPromise = reactGrab.captureNextClipboardWrites();
  await reactGrab.clickElement("[data-testid='todo-list'] h1");
  const copyPayload = await copyPayloadPromise;
  const clipboardMetadataText = copyPayload["application/x-react-grab"];
  if (!clipboardMetadataText) {
    throw new Error("Missing React Grab clipboard metadata");
  }

  const clipboardMetadata = JSON.parse(clipboardMetadataText);
  expect(clipboardMetadata.groups).toBeDefined();
  expect(clipboardMetadata.groups.length).toBeGreaterThan(0);
  expect(clipboardMetadata.groups[0].entries).toHaveLength(1);
  expect(clipboardMetadata.groups[0].entries[0].content).toContain("Todo List");
});
```

**Note:** Single-element copy still uses the old `copyContent` (not `copyGroupedContent`). Check if this test tests single-element copy or copy-all. If single-element copy, the old format still applies and the test stays as-is. Read the test carefully before changing.

Actually — single-element copy at line 55 clicks an element (not "Copy All"). The `tryCopyWithFallback` path uses `copyContent`, which still writes the old `ReactGrabMetadata` format with `entries[]`. This test should NOT be changed unless we also update `copyContent` for single-element copy.

**Decision:** Leave the e2e test as-is for now. The single-element copy path still uses the old format. Only `handleCommentsCopyAll` and `handleCopyGroup` use the new grouped format. Add a NEW test for copy-all if e2e test infrastructure supports it.

**Step 2: Commit**

```bash
# Only if test was changed
git add packages/react-grab/e2e/selection.spec.ts
git commit -m "test(e2e): update clipboard metadata test for v2 format"
```

---

### Task 10: Build and verify

**Step 1: Build react-grab**

```bash
cd /Users/doruk/Desktop/ADCREATIVE/react-grab/packages/react-grab && pnpm build
```

**Step 2: Build MCP**

```bash
cd /Users/doruk/Desktop/ADCREATIVE/react-grab/packages/mcp && pnpm build
```

**Step 3: Test all scenarios**

| # | Scenario | Expected |
|---|----------|----------|
| 1 | All items revealed → click "Copy" | All items copied, grouped format in clipboard |
| 2 | Some items revealed → click "Copy" | Only revealed+connected items copied |
| 3 | No items revealed → click "Copy" | Nothing copied (no-op) |
| 4 | Button label | Shows `Copy (N)` when N < total, `Copy` when all |
| 5 | Per-group copy button | Copies only that group's revealed+connected items |
| 6 | Single group result | No `## GroupName` header in text/plain |
| 7 | Multi-group result | `## GroupName` headers in text/plain |
| 8 | Single item result | No numbering, just comment + content |
| 9 | Paste into text editor | Clean text/plain format |
| 10 | Check `application/x-react-grab` in devtools | JSON has `groups[]` structure |
| 11 | E2e tests still pass | `npx playwright test e2e/selection.spec.ts` |

**Step 4: Commit if fixes needed**

---

## File Change Summary

| File | Action | What |
|------|--------|------|
| `src/utils/join-snippets.ts` | Modify | Add `joinGroupedSnippets` with `## GroupName` headers |
| `src/utils/copy-content.ts` | Modify | Add `copyGroupedContent`, `ReactGrabMetadataV2`, `ReactGrabGroup` |
| `src/core/index.tsx` | Modify | Rewrite `handleCommentsCopyAll` (filter + group), add `handleCopyGroup`, add `copyableItemCount` memo |
| `src/types.ts` | Modify | Add `onCopyGroup`, `copyableCount` to `ReactGrabRendererProps` |
| `src/features/selection-groups/components/group-collapsible.tsx` | Modify | Add copy button + `onCopyGroup` prop |
| `src/components/comments-dropdown.tsx` | Modify | Add `onCopyGroup` + `copyableCount` props, update "Copy" label |
| `src/components/renderer.tsx` | Modify | Pass `onCopyGroup` + `copyableCount` |
| `packages/mcp/src/server.ts` | Modify | New `agentContextSchema` with `groups`, updated `formatContext` |
| `packages/mcp/src/client.ts` | Modify | `sendContextToServer` sends `{ groups }` |
