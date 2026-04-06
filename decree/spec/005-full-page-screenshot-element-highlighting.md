---
status: draft
date: 2026-04-06
references: [PRD-003]
---

# SPEC-005 Full-Page Screenshot Element Highlighting

## Overview

When react-grab captures a full-page screenshot, the selected element should be visually highlighted so reviewers can instantly locate it in context. This spec describes injecting a temporary absolute-positioned overlay `<div>` into the DOM before `domToBlob` runs, then removing it immediately after capture.

## Technical Design

### Approach: Temporary DOM Overlay

A helper function creates an absolutely-positioned `<div>` that covers the selected element with a colored border and semi-transparent fill. The overlay is appended to `document.body`, included in the `domToBlob` render, and removed after capture completes (or fails).

### Why not alternatives?

- **Mutating element styles** — risks layout shifts, affects the element's own cropped screenshot, requires style restoration logic.
- **Post-processing the image bitmap** — requires canvas manipulation, adds complexity, harder to position accurately with sub-pixel rendering.
- **`modern-screenshot` onClone hook** — does not exist in the library; no clone-time interception is available.

### New function: `createHighlightOverlay`

Location: `packages/react-grab/src/features/screenshot/capture.ts`

```ts
function createHighlightOverlay(element: Element): HTMLDivElement {
  const rect = element.getBoundingClientRect();
  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "absolute",
    top: `${rect.top + window.scrollY}px`,
    left: `${rect.left + window.scrollX}px`,
    width: `${(element as HTMLElement).offsetWidth}px`,
    height: `${(element as HTMLElement).offsetHeight}px`,
    border: "3px solid #f59e0b",
    background: "rgba(245, 158, 11, 0.15)",
    pointerEvents: "none",
    zIndex: "999999",
    boxSizing: "border-box",
  });
  return overlay;
}
```

Key details:
- Uses `getBoundingClientRect()` + `window.scrollX/Y` for document-relative positioning
- Uses `offsetWidth`/`offsetHeight` to match the element's layout box
- Does **not** carry `data-react-grab` attribute, so the existing `filter` function won't strip it from the render
- `boxSizing: border-box` ensures the border doesn't extend beyond the element bounds
- `zIndex: 999999` ensures visibility above page content

### Modified function: `captureFullPage`

Signature change: accepts an optional `element` parameter.

```ts
export async function captureFullPage(
  config: ScreenshotConfig,
  element?: Element,
): Promise<Blob | null>
```

Implementation:
1. If `element` is provided, call `createHighlightOverlay(element)` and append to `document.body`
2. Call `domToBlob(document.documentElement, ...)` as before
3. In a `finally` block, remove the overlay if it was created

```ts
let overlay: HTMLDivElement | undefined;
if (element) {
  overlay = createHighlightOverlay(element);
  document.body.appendChild(overlay);
}
try {
  const blob = await domToBlob(document.documentElement, { ... });
  return blob;
} catch {
  return null;
} finally {
  overlay?.remove();
}
```

### Modified call site: `orchestrate.ts`

Line 41 changes from:
```ts
const fullPageBlob = await captureFullPage(config);
```
to:
```ts
const fullPageBlob = await captureFullPage(config, element);
```

The `element` parameter is already available in `captureAndUploadScreenshots`.

### Filter behavior

The overlay `<div>` intentionally lacks `data-react-grab`, so `isReactGrabElement` returns `false` and the overlay is **included** in the `domToBlob` render. This is the desired behavior — the highlight should appear in the screenshot.

## Testing Strategy

### Unit tests

- `createHighlightOverlay` returns a div with correct styles matching a mock element's position/dimensions
- Overlay does not have `data-react-grab` attribute (verified by `isReactGrabElement` returning `false`)

### Integration tests

- `captureFullPage(config, element)` appends an overlay before capture and removes it after
- `captureFullPage(config)` (no element) still works without overlay — backward compatible
- After `captureFullPage` resolves, no overlay div remains in `document.body`
- After `captureFullPage` rejects/throws, no overlay div remains in `document.body` (finally block)

### Visual verification

- Manual test: select an element, trigger screenshot, verify the full-page image shows an amber highlight rectangle at the correct position

## Acceptance Criteria

- [ ] `createHighlightOverlay` function added to `capture.ts`
- [ ] `captureFullPage` accepts optional `element` parameter
- [ ] Overlay injected before `domToBlob` and removed in `finally` block
- [ ] `orchestrate.ts` passes `element` to `captureFullPage`
- [ ] Overlay uses absolute positioning with scroll offset
- [ ] Overlay styled: 3px solid #f59e0b border, rgba(245,158,11,0.15) background
- [ ] Overlay does NOT have `data-react-grab` attribute
- [ ] No DOM artifacts remain after capture (success or failure)
- [ ] Backward compatible — `captureFullPage(config)` without element still works
- [ ] Unit tests for overlay creation and cleanup
- [ ] Manual visual verification of highlight in full-page screenshot
