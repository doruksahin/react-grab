# Screenshot Capture — High-Level Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Capture full-page and element screenshots when a selection is made in react-grab, upload them to the sync-server (later R2), and store references on the CommentItem.

**Architecture:** Screenshot capture is a **plugin** — opt-in, zero impact when disabled. Uses `modern-screenshot` for DOM-to-image conversion. Upload is handled by extending the existing `StorageAdapter` pattern. The capture hooks into the existing `addCommentItem` flow.

**Tech Stack:** modern-screenshot, existing plugin system, StorageAdapter extension

---

## How it fits into react-grab

```
User selects element
  │
  ├─ Core creates CommentItem (exists today)
  │
  ├─ Screenshot plugin hooks in (new)
  │   ├─ Capture element → Blob
  │   ├─ Capture full page (filter out react-grab overlay) → Blob
  │   └─ Upload both via StorageAdapter.uploadScreenshot()
  │       └─ Returns keys/URLs
  │
  └─ CommentItem saved with screenshot references
      screenshotFullPage: "screenshots/{id}/full.png"
      screenshotElement: "screenshots/{id}/element.png"
```

---

## The 5 pieces

### 1. Configuration (Options)

Add screenshot config to the existing `Options` interface:

```ts
interface Options {
  // ... existing fields
  sync?: SyncConfig;
  screenshot?: ScreenshotConfig;  // new
}

interface ScreenshotConfig {
  enabled: boolean;
  scale?: number;           // default 2 (retina)
  quality?: number;         // default 0.8
  captureFullPage?: boolean; // default true — capture both page + element
  maxWidth?: number;        // max screenshot width in px
  maxHeight?: number;       // max screenshot height in px
}
```

Screenshot config is separate from sync config. You could capture screenshots and store them locally (blob URLs) even without a sync server.

### 2. Capture module (`features/screenshot/capture.ts`)

Wraps `modern-screenshot` with react-grab specifics:

- **`captureElement(element, config)`** → `Blob` — captures a single DOM element
- **`captureFullPage(config)`** → `Blob` — captures `document.body` with a `filter` that excludes the react-grab overlay root (`[data-react-grab]` or similar)
- Both return PNG Blobs

This module is the only place that imports `modern-screenshot`. If we ever swap libraries, only this file changes.

### 3. Upload via StorageAdapter

Extend `StorageAdapter` with an optional screenshot method:

```ts
interface StorageAdapter {
  // ... existing
  uploadScreenshot?: (selectionId: string, type: "full" | "element", blob: Blob) => Promise<string>;
}
```

Optional — if not provided, screenshots are created but not uploaded (kept as blob URLs for local-only use).

The HTTP adapter (`createHttpAdapter`) implements this as:
```
PUT /workspaces/{id}/screenshots/{selectionId}/{type}
Content-Type: image/png
Body: <blob>
→ Returns: { key: "screenshots/{selectionId}/full.png" }
```

### 4. CommentItem extension

Add two nullable fields to `CommentItem`:

```ts
interface CommentItem {
  // ... existing fields
  screenshotFullPage?: string | null;  // R2 key or blob URL
  screenshotElement?: string | null;   // R2 key or blob URL
}
```

These are set after capture + upload completes. If capture fails, the comment is still saved — screenshots are best-effort.

### 5. Screenshot plugin (`features/screenshot/plugin.ts`)

A react-grab plugin that ties everything together:

- Hooks into `onGrabbedBox` (fires when a selection is confirmed)
- Receives the element and its bounds
- Calls capture module → gets Blobs
- Calls StorageAdapter.uploadScreenshot → gets keys
- Patches the CommentItem with screenshot keys

```ts
export const screenshotPlugin: Plugin = {
  name: "screenshot",
  setup: (api, hooks) => ({
    hooks: {
      onGrabbedBox: async (bounds, element) => {
        // 1. capture element
        // 2. capture full page (excluding overlay)
        // 3. upload both
        // 4. update comment item with screenshot keys
      },
    },
  }),
};
```

---

## Sync-server changes

One new route:

```
PUT /workspaces/:id/screenshots/:selectionId/:type
  Content-Type: image/png
  Body: raw PNG bytes
  → Stores file to disk (now), R2 (later)
  → Returns { key: "screenshots/{selectionId}/{type}.png" }

GET /workspaces/:id/screenshots/:selectionId/:type
  → Returns the PNG file
```

When we migrate to Cloudflare Workers + R2 (Phase 0 of the roadmap), the PUT writes to R2 instead of disk. The GET serves from R2. Same API contract.

---

## What stays the same

- `addCommentItem` flow unchanged — screenshots are patched on after
- Plugin system unchanged — screenshot is just another plugin
- StorageAdapter interface — only adds one optional method
- Sync config — screenshot config is independent
- Existing comment data — old comments without screenshots continue to work (fields are nullable)

## What's new

| Piece | Location | Depends on |
|---|---|---|
| `modern-screenshot` dependency | `package.json` | — |
| `ScreenshotConfig` type | `types.ts` | — |
| Capture module | `features/screenshot/capture.ts` | modern-screenshot |
| Screenshot plugin | `features/screenshot/plugin.ts` | capture module, StorageAdapter |
| `uploadScreenshot` on StorageAdapter | `features/sync/types.ts` | — |
| HTTP upload in adapter | `features/sync/adapter.ts` | sync-server route |
| `screenshotFullPage/Element` on CommentItem | `types.ts` | — |
| Screenshot upload route | `sync-server/src/routes/screenshots.ts` | — |
| Screenshot serve route | `sync-server/src/routes/screenshots.ts` | — |

## Open decisions

| Decision | Options | Recommendation |
|---|---|---|
| Capture timing | Synchronous (block until captured) vs fire-and-forget | Fire-and-forget — don't block the UX. Patch the comment when ready. |
| Failure handling | Retry? Silent fail? Error callback? | Silent fail + `onSyncError` callback. Comment saves regardless. |
| Overlay exclusion | CSS class filter vs data attribute | Data attribute (`[data-react-grab-root]`) — more reliable than class names |
| Local-only mode | Blob URLs without upload | Yes — if no `uploadScreenshot` on adapter, store as blob URLs. Useful for dev/preview. |
| Image format | PNG vs JPEG | PNG — lossless, better for UI screenshots with text. JPEG option via `quality` config for smaller files. |

---

## Implementation order

```
1. Add modern-screenshot dependency
2. Create capture module (captureElement, captureFullPage)
3. Add ScreenshotConfig to Options
4. Add screenshot fields to CommentItem
5. Add uploadScreenshot to StorageAdapter + HTTP adapter
6. Add screenshot routes to sync-server
7. Create screenshot plugin (ties it all together)
8. Register plugin when screenshot config is enabled
9. Test end-to-end: select element → screenshots appear on comment
```
