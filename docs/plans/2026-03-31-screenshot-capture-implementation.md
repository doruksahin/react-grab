# Screenshot Capture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add opt-in screenshot capture to react-grab — captures full-page and element screenshots on selection, uploads to sync-server, stores references on CommentItem.

**Architecture:** Screenshot capture is a plugin using `modern-screenshot` for DOM-to-image conversion. It hooks into the comment creation flow via `onGrabbedBox`, captures asynchronously (fire-and-forget), and uploads via an optional `uploadScreenshot` method on `StorageAdapter`. The capture module is the only file that imports `modern-screenshot` — single swap point.

**Tech Stack:** modern-screenshot, existing Plugin system, StorageAdapter extension, Hono (sync-server)

---

## Task 1: Add modern-screenshot dependency

**Files:**
- Modify: `packages/react-grab/package.json`

**Step 1: Install the dependency**

```bash
pnpm --filter react-grab add modern-screenshot
```

**Step 2: Verify build**

```bash
pnpm --filter react-grab build
```

Expected: Build succeeds, no code changes yet.

**Step 3: Commit**

```bash
git add packages/react-grab/package.json pnpm-lock.yaml
git commit -m "chore(react-grab): add modern-screenshot dependency"
```

---

## Task 2: Add ScreenshotConfig type and screenshot fields to CommentItem

**Files:**
- Modify: `packages/react-grab/src/types.ts:340-355` (Options interface)
- Modify: `packages/react-grab/src/types.ts:445-458` (CommentItem interface)
- Modify: `packages/react-grab/src/index.ts` (export ScreenshotConfig)

**Step 1: Add ScreenshotConfig interface to types.ts**

Add before the `Options` interface (around line 340):

```typescript
export interface ScreenshotConfig {
  /** Enable screenshot capture on selection. @default false */
  enabled: boolean;
  /** Device pixel ratio for capture. @default 2 */
  scale?: number;
  /** Image quality (0-1). Only applies when format is 'jpeg'. @default 0.8 */
  quality?: number;
  /** Capture full page in addition to element. @default true */
  captureFullPage?: boolean;
  /** Image format. @default 'png' */
  format?: "png" | "jpeg";
  /** Max width of screenshot in pixels. @default 1920 */
  maxWidth?: number;
  /** Max height of screenshot in pixels. @default 1080 */
  maxHeight?: number;
}
```

**Step 2: Add screenshot to Options interface**

In `packages/react-grab/src/types.ts`, modify the `Options` interface:

```typescript
export interface Options {
  enabled?: boolean;
  activationMode?: ActivationMode;
  keyHoldDuration?: number;
  allowActivationInsideInput?: boolean;
  maxContextLines?: number;
  activationKey?: ActivationKey;
  getContent?: (elements: Element[]) => Promise<string> | string;
  freezeReactUpdates?: boolean;
  sync?: SyncConfig;
  screenshot?: ScreenshotConfig; // NEW
}
```

**Step 3: Add screenshot fields to CommentItem**

In `packages/react-grab/src/types.ts`, add to `CommentItem`:

```typescript
export interface CommentItem {
  id: string;
  groupId: string;
  content: string;
  elementName: string;
  tagName: string;
  componentName?: string;
  elementsCount?: number;
  previewBounds?: OverlayBounds[];
  elementSelectors?: string[];
  commentText?: string;
  timestamp: number;
  revealed: boolean;
  screenshotFullPage?: string | null; // NEW — R2 key or blob URL
  screenshotElement?: string | null;  // NEW — R2 key or blob URL
}
```

**Step 4: Export ScreenshotConfig from index.ts**

In `packages/react-grab/src/index.ts`, add to the type exports:

```typescript
export type { SyncConfig } from "./features/sync/types.js";
export type { ScreenshotConfig } from "./types.js"; // NEW
```

**Step 5: Verify build**

```bash
pnpm --filter react-grab build
```

Expected: Build succeeds.

**Step 6: Commit**

```bash
git add packages/react-grab/src/types.ts packages/react-grab/src/index.ts
git commit -m "feat(react-grab): add ScreenshotConfig type and screenshot fields to CommentItem"
```

---

## Task 3: Create the capture module

**Files:**
- Create: `packages/react-grab/src/features/screenshot/capture.ts`

This is the **only file** that imports `modern-screenshot`. If we ever swap libraries, only this file changes.

**Step 1: Create the capture module**

`packages/react-grab/src/features/screenshot/capture.ts`:

```typescript
import { domToBlob } from "modern-screenshot";
import type { ScreenshotConfig } from "../../types.js";

const OVERLAY_SELECTOR = "[data-react-grab]";

const defaultConfig: Required<Omit<ScreenshotConfig, "enabled">> = {
  scale: 2,
  quality: 0.8,
  captureFullPage: true,
  format: "png",
  maxWidth: 1920,
  maxHeight: 1080,
};

function resolveConfig(
  config: ScreenshotConfig,
): Required<Omit<ScreenshotConfig, "enabled">> {
  return { ...defaultConfig, ...config };
}

function isReactGrabElement(node: Node): boolean {
  if (node instanceof HTMLElement) {
    return node.closest(OVERLAY_SELECTOR) !== null;
  }
  return false;
}

export async function captureElement(
  element: Element,
  config: ScreenshotConfig,
): Promise<Blob | null> {
  const resolved = resolveConfig(config);
  try {
    const blob = await domToBlob(element as HTMLElement, {
      scale: resolved.scale,
      quality: resolved.quality,
      type: resolved.format === "jpeg" ? "image/jpeg" : "image/png",
      filter: (node: Node) => !isReactGrabElement(node),
    });
    return blob;
  } catch {
    return null;
  }
}

export async function captureFullPage(
  config: ScreenshotConfig,
): Promise<Blob | null> {
  const resolved = resolveConfig(config);
  try {
    const blob = await domToBlob(document.documentElement, {
      scale: resolved.scale,
      quality: resolved.quality,
      type: resolved.format === "jpeg" ? "image/jpeg" : "image/png",
      width: Math.min(document.documentElement.scrollWidth, resolved.maxWidth),
      height: Math.min(
        document.documentElement.scrollHeight,
        resolved.maxHeight,
      ),
      filter: (node: Node) => !isReactGrabElement(node),
    });
    return blob;
  } catch {
    return null;
  }
}
```

**Step 2: Verify build**

```bash
pnpm --filter react-grab build
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add packages/react-grab/src/features/screenshot/capture.ts
git commit -m "feat(screenshot): create capture module wrapping modern-screenshot"
```

---

## Task 4: Extend StorageAdapter with uploadScreenshot

**Files:**
- Modify: `packages/react-grab/src/features/sync/types.ts:8-17` (StorageAdapter)
- Modify: `packages/react-grab/src/features/sync/adapter.ts` (createHttpAdapter)

**Step 1: Add uploadScreenshot to StorageAdapter**

In `packages/react-grab/src/features/sync/types.ts`:

```typescript
export interface StorageAdapter {
  /** Load all comments. Called once at init. */
  loadComments: () => Promise<CommentItem[]>;
  /** Persist the full comments array. Called on every mutation. */
  persistComments: (items: CommentItem[]) => Promise<CommentItem[]>;
  /** Load all groups. Called once at init. */
  loadGroups: () => Promise<SelectionGroup[]>;
  /** Persist the full groups array. Called on every mutation. */
  persistGroups: (groups: SelectionGroup[]) => Promise<SelectionGroup[]>;
  /** Upload a screenshot blob. Returns the storage key/URL. Optional. */
  uploadScreenshot?: (
    selectionId: string,
    type: "full" | "element",
    blob: Blob,
  ) => Promise<string>;
}
```

**Step 2: Implement uploadScreenshot in createHttpAdapter**

In `packages/react-grab/src/features/sync/adapter.ts`, add inside the returned object (after `persistGroups`):

```typescript
    uploadScreenshot: async (
      selectionId: string,
      type: "full" | "element",
      blob: Blob,
    ): Promise<string> => {
      try {
        const response = await fetch(
          `${baseUrl}/screenshots/${encodeURIComponent(selectionId)}/${type}`,
          {
            method: "PUT",
            body: blob,
            headers: { "Content-Type": blob.type },
          },
        );
        if (!response.ok) {
          throw new Error(`PUT /screenshots failed: ${response.status}`);
        }
        const result = (await response.json()) as { key: string };
        return result.key;
      } catch (error) {
        return handleError(error);
      }
    },
```

**Step 3: Verify build**

```bash
pnpm --filter react-grab build
```

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add packages/react-grab/src/features/sync/types.ts packages/react-grab/src/features/sync/adapter.ts
git commit -m "feat(sync): add uploadScreenshot to StorageAdapter and HTTP adapter"
```

---

## Task 5: Add screenshot routes to sync-server

**Files:**
- Create: `packages/sync-server/src/routes/screenshots.ts`
- Modify: `packages/sync-server/src/index.ts` (register route)

**Step 1: Create screenshots route**

`packages/sync-server/src/routes/screenshots.ts`:

```typescript
import { Hono } from "hono";
import { join } from "path";
import { mkdir, writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";

const DATA_DIR = join(process.cwd(), "data", "workspaces");

const screenshotsDir = (workspaceId: string, selectionId: string) =>
  join(DATA_DIR, workspaceId, "screenshots", selectionId);

export const screenshotsRoutes = new Hono()
  .put("/workspaces/:id/screenshots/:selectionId/:type", async (c) => {
    const workspaceId = c.req.param("id");
    const selectionId = c.req.param("selectionId");
    const type = c.req.param("type");

    if (type !== "full" && type !== "element") {
      return c.json({ error: "Type must be 'full' or 'element'" }, 400);
    }

    const dir = screenshotsDir(workspaceId, selectionId);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const contentType = c.req.header("Content-Type") ?? "image/png";
    const extension = contentType.includes("jpeg") ? "jpg" : "png";
    const filename = `${type}.${extension}`;
    const filePath = join(dir, filename);

    const arrayBuffer = await c.req.arrayBuffer();
    await writeFile(filePath, Buffer.from(arrayBuffer));

    const key = `screenshots/${selectionId}/${filename}`;
    return c.json({ key });
  })
  .get("/workspaces/:id/screenshots/:selectionId/:type", async (c) => {
    const workspaceId = c.req.param("id");
    const selectionId = c.req.param("selectionId");
    const type = c.req.param("type");

    const dir = screenshotsDir(workspaceId, selectionId);

    // Try both extensions
    for (const ext of ["png", "jpg"]) {
      const filePath = join(dir, `${type}.${ext}`);
      if (existsSync(filePath)) {
        const data = await readFile(filePath);
        const contentType = ext === "jpg" ? "image/jpeg" : "image/png";
        return new Response(data, {
          headers: { "Content-Type": contentType },
        });
      }
    }

    return c.json({ error: "Screenshot not found" }, 404);
  });
```

**Step 2: Register the route in index.ts**

In `packages/sync-server/src/index.ts`, add:

```typescript
import { screenshotsRoutes } from "./routes/screenshots.js";
```

And alongside the existing routes:

```typescript
app.route("/", screenshotsRoutes);
```

**Step 3: Verify sync-server builds**

```bash
pnpm --filter sync-server build
```

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add packages/sync-server/src/routes/screenshots.ts packages/sync-server/src/index.ts
git commit -m "feat(sync-server): add screenshot upload and serve routes"
```

---

## Task 6: Create the screenshot feature module

**Files:**
- Create: `packages/react-grab/src/features/screenshot/index.ts`

This module ties capture + upload together and exposes the function that the core will call.

**Step 1: Create the feature module**

`packages/react-grab/src/features/screenshot/index.ts`:

```typescript
import type { CommentItem, ScreenshotConfig } from "../../types.js";
import type { StorageAdapter } from "../sync/types.js";
import { captureElement, captureFullPage } from "./capture.js";

interface ScreenshotResult {
  screenshotElement?: string | null;
  screenshotFullPage?: string | null;
}

/**
 * Captures screenshots for a selection and uploads them.
 * Returns the storage keys to patch onto the CommentItem.
 * Fire-and-forget — failures return null keys silently.
 */
export async function captureAndUploadScreenshots(
  element: Element,
  selectionId: string,
  config: ScreenshotConfig,
  adapter: StorageAdapter | null,
): Promise<ScreenshotResult> {
  const result: ScreenshotResult = {
    screenshotElement: null,
    screenshotFullPage: null,
  };

  // Capture element screenshot
  const elementBlob = await captureElement(element, config);
  if (elementBlob) {
    if (adapter?.uploadScreenshot) {
      try {
        result.screenshotElement = await adapter.uploadScreenshot(
          selectionId,
          "element",
          elementBlob,
        );
      } catch {
        // Silent fail — screenshot is best-effort
      }
    } else {
      // Local-only mode: use blob URL
      result.screenshotElement = URL.createObjectURL(elementBlob);
    }
  }

  // Capture full page screenshot
  if (config.captureFullPage !== false) {
    const fullPageBlob = await captureFullPage(config);
    if (fullPageBlob) {
      if (adapter?.uploadScreenshot) {
        try {
          result.screenshotFullPage = await adapter.uploadScreenshot(
            selectionId,
            "full",
            fullPageBlob,
          );
        } catch {
          // Silent fail
        }
      } else {
        result.screenshotFullPage = URL.createObjectURL(fullPageBlob);
      }
    }
  }

  return result;
}
```

**Step 2: Verify build**

```bash
pnpm --filter react-grab build
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add packages/react-grab/src/features/screenshot/index.ts
git commit -m "feat(screenshot): create feature module — capture + upload orchestration"
```

---

## Task 7: Hook screenshot capture into the comment creation flow

**Files:**
- Modify: `packages/react-grab/src/core/index.tsx:927-946` (addCommentItem call site)
- Modify: `packages/react-grab/src/utils/comment-storage.ts` (add patchCommentItem)

This is the integration point. After a comment is created, we fire-and-forget the screenshot capture. When it completes, we patch the comment with the screenshot keys.

**Step 1: Add patchCommentItem to comment-storage.ts**

In `packages/react-grab/src/utils/comment-storage.ts`, add after the existing `addCommentItem`:

```typescript
export const patchCommentItem = (
  id: string,
  patch: Partial<CommentItem>,
): CommentItem[] =>
  persistCommentItems(
    commentItems.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    ),
  );
```

**Step 2: Integrate screenshot capture in core/index.tsx**

At the top of `packages/react-grab/src/core/index.tsx`, add the import:

```typescript
import { captureAndUploadScreenshots } from "../features/screenshot/index.js";
import { patchCommentItem } from "../utils/comment-storage.js";
```

Note: `patchCommentItem` may already be partially imported from comment-storage. Check existing imports and add only what's missing.

After the existing `addCommentItem` call (around line 927-946), add the screenshot fire-and-forget:

```typescript
      const updatedCommentItems = addCommentItem({
        groupId: selectionGroups.activeGroupId(),
        content,
        elementName: elementName ?? "element",
        tagName: tagName ?? "div",
        componentName: componentName ?? undefined,
        elementsCount: copiedElements.length,
        previewBounds: copiedElements.map((copiedElement) =>
          createElementBounds(copiedElement),
        ),
        elementSelectors,
        commentText: extraPrompt,
        timestamp: Date.now(),
        revealed: visibility.selectionsRevealed(),
      });
      setCommentItems(updatedCommentItems);
      setClockFlashTrigger((previous) => previous + 1);
      const newestCommentItem = updatedCommentItems[0];
      if (newestCommentItem && hasCopiedElements) {
        commentElementMap.set(newestCommentItem.id, [...copiedElements]);
      }

      // NEW: Fire-and-forget screenshot capture
      if (newestCommentItem && options.screenshot?.enabled && copiedElements[0]) {
        captureAndUploadScreenshots(
          copiedElements[0],
          newestCommentItem.id,
          options.screenshot,
          activeAdapter, // from comment-storage.ts — null if no sync
        ).then((screenshots) => {
          if (screenshots.screenshotElement || screenshots.screenshotFullPage) {
            const patched = patchCommentItem(newestCommentItem.id, screenshots);
            setCommentItems(patched);
          }
        });
      }
```

Note: `activeAdapter` is the StorageAdapter from comment-storage.ts. It's currently a module-level variable. You'll need to either:
- Export a getter `getActiveAdapter()` from comment-storage.ts, or
- Pass it through from the init flow where it's already available

Check how `activeAdapter` is accessed in `comment-storage.ts` and expose it minimally:

```typescript
// In comment-storage.ts, add:
export const getActiveAdapter = (): StorageAdapter | null => activeAdapter;
```

Then in core/index.tsx use `getActiveAdapter()` instead of referencing `activeAdapter` directly.

**Step 3: Verify build**

```bash
pnpm --filter react-grab build
```

Expected: Build succeeds.

**Step 4: Manual test**

Start the design-system dev server and sync-server:

```bash
# Terminal 1
pnpm --filter sync-server dev

# Terminal 2
pnpm --filter design-system dev
```

1. Open the design-system app in the browser
2. Configure react-grab with `screenshot: { enabled: true }` and sync enabled
3. Select an element
4. Check `data/workspaces/<workspace>/screenshots/` on the sync-server — should contain PNG files
5. Check the comment item in the comments JSON — should have `screenshotElement` and `screenshotFullPage` keys

**Step 5: Commit**

```bash
git add packages/react-grab/src/core/index.tsx packages/react-grab/src/utils/comment-storage.ts
git commit -m "feat(screenshot): hook capture into comment creation flow — fire-and-forget with patch"
```

---

## Task 8: Export and wire up configuration

**Files:**
- Modify: `packages/react-grab/src/features/screenshot/index.ts` (re-export capture)
- Modify: `packages/react-grab/src/features/sync/index.ts` (if needed)

**Step 1: Create feature barrel export**

Ensure `packages/react-grab/src/features/screenshot/index.ts` exports what's needed:

```typescript
export { captureAndUploadScreenshots } from "./index.js";
export { captureElement, captureFullPage } from "./capture.js";
```

Wait — this is circular. The orchestration IS index.ts. Instead, restructure:

- Rename current `index.ts` → `orchestrate.ts`
- Create new `index.ts` as barrel:

`packages/react-grab/src/features/screenshot/index.ts`:

```typescript
export { captureAndUploadScreenshots } from "./orchestrate.js";
export { captureElement, captureFullPage } from "./capture.js";
```

`packages/react-grab/src/features/screenshot/orchestrate.ts`:
(Move the content from the old index.ts here, update the import in core/index.tsx)

**Step 2: Update import in core/index.tsx**

```typescript
import { captureAndUploadScreenshots } from "../features/screenshot/index.js";
```

This stays the same since the barrel re-exports it.

**Step 3: Verify build**

```bash
pnpm --filter react-grab build
```

**Step 4: Commit**

```bash
git add packages/react-grab/src/features/screenshot/
git commit -m "refactor(screenshot): restructure feature module with barrel export"
```

---

## Task 9: Add screenshot config to sync transforms (strip/merge)

**Files:**
- Modify: `packages/react-grab/src/features/sync/transforms.ts`

When `syncRevealedState` is false, the transforms strip `revealed` before sending to the server. We need to make sure `screenshotFullPage` and `screenshotElement` fields pass through correctly (they should — they're not stripped). But verify the transform functions handle unknown keys gracefully.

**Step 1: Verify transforms don't strip screenshot fields**

Read `packages/react-grab/src/features/sync/transforms.ts` and confirm:
- `stripRevealedFromComments` only removes `revealed`, not other fields
- `mergeRevealedIntoComments` only adds `revealed`, doesn't clobber other fields

If the transforms use explicit field picking (destructuring only known fields), they'll drop screenshot fields. In that case, update them to spread remaining fields.

**Step 2: Fix transforms if needed**

If transforms destructure explicitly like `{ revealed, ...rest }`, they're fine — `rest` will contain screenshot fields.

If transforms reconstruct objects by picking specific fields, add the screenshot fields.

**Step 3: Verify build**

```bash
pnpm --filter react-grab build
```

**Step 4: Commit (if changes were needed)**

```bash
git add packages/react-grab/src/features/sync/transforms.ts
git commit -m "fix(sync): ensure screenshot fields survive strip/merge transforms"
```

---

## Summary

After all 9 tasks:

| What | Where | Status |
|---|---|---|
| `modern-screenshot` dep | `package.json` | Installed |
| `ScreenshotConfig` type | `types.ts` | Exported |
| `screenshotFullPage/Element` on CommentItem | `types.ts` | Added, nullable |
| Capture module | `features/screenshot/capture.ts` | Wraps modern-screenshot |
| Feature orchestrator | `features/screenshot/orchestrate.ts` | Capture + upload |
| `uploadScreenshot` on StorageAdapter | `features/sync/types.ts` | Optional method |
| HTTP upload impl | `features/sync/adapter.ts` | PUT blob to server |
| Server routes | `sync-server/src/routes/screenshots.ts` | PUT + GET |
| Core integration | `core/index.tsx` | Fire-and-forget after addCommentItem |
| `patchCommentItem` | `utils/comment-storage.ts` | Patches comment with screenshot keys |

**Configuration for users:**

```typescript
init({
  screenshot: {
    enabled: true,
    scale: 2,
    captureFullPage: true,
  },
  sync: {
    enabled: true,
    serverUrl: "http://localhost:3000",
    workspace: "my-workspace",
    syncRevealedState: false,
    onSyncError: console.error,
  },
});
```

Screenshots work with or without sync — without sync, they're stored as blob URLs (local-only, lost on refresh). With sync, they're uploaded to the server and persisted.
