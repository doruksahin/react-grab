---
status: draft
date: 2026-04-16
references: [PRD-014, ADR-0014, ADR-0005]
---

# SPEC-017 Enlargeable Screenshot Viewer

## Overview

Implements PRD-014: clicking either screenshot thumbnail in the sidebar opens a full-viewport lightbox. The lightbox supports a fit ↔ 1:1 toggle, drag-to-pan when overflowing, and closes via `Esc` / backdrop / `×` button.

Follows ADR-0014's composition: a reusable `ImageLightbox` UI primitive in `components/ui/`, a singleton signal store in `features/image-lightbox/`, mounted once at the sidebar root, and triggered from `ScreenshotPair` thumbnails. The Portal-to-shadow-root mechanism reuses ADR-0005's pattern (`<Portal mount={useShadowMount()}>`).

No new infrastructure is introduced — the lightbox stands on existing primitives (Solid `Portal`, `useShadowMount`, the `--z-dialog` token). Existing code is touched in two places: `components/sidebar/index.tsx` mounts a single `<ImageLightbox>` at the root, and `components/sidebar/screenshot-pair.tsx` thumbnails call the hook from their click handlers.

## Technical Design

### Layer 1 — Types

**File:** `packages/react-grab/src/features/image-lightbox/types.ts`

Two interfaces, kept feature-local:

```ts
export interface LightboxState {
  open: boolean;
  src: string;
  caption: string;
}

export interface ImageLightboxProps {
  open: boolean;
  src: string;
  caption: string;
  onClose: () => void;
}
```

`caption` is required (not optional) on the props — every consumer should provide one for accessibility (`aria-label`) and visible labelling. Consumers that genuinely have nothing to say can pass an empty string.

### Layer 2 — Singleton signal store + hook

**Files:** `packages/react-grab/src/features/image-lightbox/{use-image-lightbox.ts, index.ts}`

Module-level singleton — no provider, no context. Mirrors the pattern in `utils/shadow-context.ts`.

```ts
import { createSignal } from "solid-js";
import type { LightboxState } from "./types.js";

const [state, setState] = createSignal<LightboxState>({
  open: false,
  src: "",
  caption: "",
});

export const useImageLightbox = () => ({
  state,
  open: (src: string, caption: string) => {
    setState({ open: true, src, caption });
  },
  close: () => {
    setState((prev) => ({ ...prev, open: false }));
  },
});
```

The signal lives at module scope, so every importer gets the same singleton. `close` preserves `src` and `caption` until the next `open` call — `<Show>` in the UI layer prevents the stale image from rendering. The hook's return shape is the entire imperative API.

### Layer 3 — UI primitive

**File:** `packages/react-grab/src/components/ui/image-lightbox.tsx`

Self-contained Solid component. Takes `ImageLightboxProps` and handles everything: Portal-to-shadow, backdrop, topbar, viewport, fit/actual modes, drag-to-pan, Esc handler, scroll lock, image unmounting on close.

Internal state:

```ts
type ZoomMode = "fit" | "actual";
const [mode, setMode] = createSignal<ZoomMode>("fit");
```

Structure (matches the validated POC in `docs/poc/screenshot-lightbox.html`):

```tsx
<Show when={props.open}>
  <Portal mount={useShadowMount()}>
    <div
      data-react-grab-image-lightbox
      class="fixed inset-0 flex flex-col"
      style={{ "z-index": "var(--z-dialog)", "pointer-events": "auto" }}
      role="dialog"
      aria-modal="true"
      aria-label={props.caption}
      onClick={props.onClose}
    >
      <div class="absolute inset-0 bg-black/86 backdrop-blur-sm" />

      {/* Topbar — caption + close. Stops propagation so its own clicks don't dismiss. */}
      <div
        class="relative flex items-center justify-between px-5 py-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-black/35 border border-white/10 backdrop-blur-sm">
          <span class="text-xs text-white/88">{props.caption}</span>
          <span class="text-[10px] text-muted-foreground font-mono uppercase">
            {mode()}
          </span>
        </div>
        <button
          data-react-grab-lightbox-close
          aria-label="Close"
          title="Close (Esc)"
          class="size-9 rounded-full border border-white/10 bg-black/40 text-white hover:bg-white/15 hover:scale-105 transition cursor-pointer"
          onClick={props.onClose}
        >
          ×
        </button>
      </div>

      {/* Viewport — holds the image. Scrolls in actual mode, hidden overflow in fit mode. */}
      <div
        ref={viewportRef}
        data-react-grab-lightbox-viewport
        data-mode={mode()}
        class={cn(
          "relative flex-1 flex items-center justify-center p-12",
          mode() === "fit" ? "overflow-hidden" : "overflow-auto items-start justify-start"
        )}
        onClick={(event) => {
          if (event.target === event.currentTarget) props.onClose();
        }}
      >
        <img
          ref={imageRef}
          src={props.src}
          alt={props.caption}
          class={cn(
            "block select-none transition-[max-width,max-height]",
            mode() === "fit"
              ? "max-w-[calc(100vw-96px)] max-h-[calc(100vh-96px)] object-contain cursor-zoom-in"
              : dragging() ? "cursor-grabbing" : "cursor-zoom-out"
          )}
          draggable={false}
          onClick={(event) => {
            event.stopPropagation();
            setMode((prev) => (prev === "fit" ? "actual" : "fit"));
          }}
          onPointerDown={handlePointerDown}
        />
      </div>

      {/* Bottom hint */}
      <div class="absolute bottom-4 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/35 border border-white/8 text-[11px] text-white/55 backdrop-blur-sm">
        Click to toggle zoom · <kbd class="...">Esc</kbd> to close
      </div>
    </div>
  </Portal>
</Show>
```

Effects (single-purpose, per the codebase's effect taxonomy):

- **Esc key handler** — `createEffect` registers `document.addEventListener("keydown", ...)`, `onCleanup` removes it. Only attaches when `props.open` is true.
- **Scroll lock** — `createEffect` writes `document.body.style.overflow = "hidden"` when `props.open` becomes true; `onCleanup` restores the previous value. Saves the prior value to handle nested locks correctly.
- **Mode reset** — `createEffect` resets `mode` to `"fit"` whenever `props.src` changes (so swapping to a different image starts fitted).

Drag-to-pan implementation:

```ts
const [dragging, setDragging] = createSignal(false);
let dragStart: { x: number; y: number; scrollLeft: number; scrollTop: number } | null = null;

const handlePointerDown = (event: PointerEvent) => {
  if (mode() !== "actual" || !viewportRef) return;
  setDragging(true);
  dragStart = {
    x: event.clientX,
    y: event.clientY,
    scrollLeft: viewportRef.scrollLeft,
    scrollTop: viewportRef.scrollTop,
  };
  imageRef?.setPointerCapture(event.pointerId);
  event.preventDefault();
};

const handlePointerMove = (event: PointerEvent) => {
  if (!dragging() || !dragStart || !viewportRef) return;
  viewportRef.scrollLeft = dragStart.scrollLeft - (event.clientX - dragStart.x);
  viewportRef.scrollTop = dragStart.scrollTop - (event.clientY - dragStart.y);
};

const handlePointerUp = (event: PointerEvent) => {
  if (!dragging()) return;
  setDragging(false);
  dragStart = null;
  imageRef?.releasePointerCapture(event.pointerId);
};
```

`pointermove` and `pointerup` listeners are attached to the image itself via `onPointerMove` / `onPointerUp` JSX handlers, since `setPointerCapture` ensures the events keep firing on the image even when the cursor leaves it.

### Layer 4 — Sidebar mount point

**File:** `packages/react-grab/src/components/sidebar/index.tsx`

A single `<ImageLightbox>` mounted near the sidebar root, bound to the singleton:

```tsx
import { ImageLightbox } from "../ui/image-lightbox.js";
import { useImageLightbox } from "../../features/image-lightbox/index.js";

// Inside the Sidebar component, near the root:
const lightbox = useImageLightbox();

return (
  <div data-react-grab-sidebar /* ... */>
    {/* ... existing sidebar content ... */}

    <ImageLightbox
      open={lightbox.state().open}
      src={lightbox.state().src}
      caption={lightbox.state().caption}
      onClose={lightbox.close}
    />
  </div>
);
```

The lightbox is the last child so it sits above the sidebar visually (its Portal escapes to the shadow root anyway, but tree order keeps the source readable). Mount happens once per sidebar lifetime.

### Layer 5 — Screenshot pair thumbnail wiring

**File:** `packages/react-grab/src/components/sidebar/screenshot-pair.tsx`

The `<img>` in `ScreenshotSlot` gains an `onClick` and a cursor cue:

```tsx
const lightbox = useImageLightbox();

<img
  src={props.src}
  alt={`${props.label} screenshot`}
  class="w-full rounded border border-border object-contain max-h-32 cursor-zoom-in hover:border-primary/60 transition-colors"
  loading="lazy"
  onClick={() => {
    if (props.src) lightbox.open(props.src, props.label);
  }}
/>
```

The caption passed is the slot's `label` ("Element" or "Full page"). If a richer caption with the component name is wanted later, `ScreenshotPair` can be extended to take a `captionPrefix` prop — out of scope for v1.

The fallback no-screenshot div remains unclickable (no `onClick`, no `cursor-zoom-in`) — it has no image to enlarge.

### Architecture diagram

```
                       ┌──────────────────────────┐
                       │ features/image-lightbox/ │
                       │  use-image-lightbox.ts   │
                       │  (module-level signal)   │
                       └────────────┬─────────────┘
                                    │
                ┌───────────────────┼───────────────────┐
                │                   │                   │
                ▼                   ▼                   ▼
       ┌─────────────────┐  ┌──────────────┐  ┌────────────────────┐
       │ ScreenshotPair  │  │   Sidebar    │  │ (future consumers) │
       │  thumbnail      │  │  mounts <IL/>│  │  avatar, attach…   │
       │   onClick →     │  │  reads state │  │                    │
       │  lightbox.open  │  │  passes props│  │                    │
       └─────────────────┘  └──────┬───────┘  └────────────────────┘
                                   │
                                   ▼
                       ┌──────────────────────────┐
                       │  components/ui/          │
                       │  image-lightbox.tsx      │
                       │  Portal → shadow root    │
                       │  fit/actual/drag/Esc/    │
                       │  scroll-lock             │
                       └──────────────────────────┘
```

### Z-index, pointer-events, event handling

- `z-index: var(--z-dialog)` (40) — above sidebar (30), toolbar (20), and overlay (10); below dropdown (50) and tooltip (60), as documented in `styles.css:72-82`
- `pointer-events: auto` inline on the lightbox root — required because the shadow host has `pointer-events: none` (see `mount-root.ts:54-63`)
- `role="dialog"` already auto-receives `pointer-events: auto` from the existing CSS rule at `styles.css:159-162`
- Backdrop click closes via `onClick={props.onClose}` on the root; topbar and image both `stopPropagation` to prevent dismiss; viewport closes only when the click target IS the viewport (not a descendant)
- `data-react-grab-image-lightbox` on root, `data-react-grab-lightbox-close` on the X button, `data-react-grab-lightbox-viewport` on the viewport — for E2E selectors and debugging per the convention in `react-grab/CLAUDE.md`

## Testing Strategy

**E2E tests** — `packages/react-grab/e2e/mocked/screenshot-lightbox.spec.ts`, tagged `@SPEC-017`:

- **Open and close test** (`AC1, AC2, AC6, AC7, AC8`) — seeds the sidebar with a group containing a selection that has both `screenshotElement` and `screenshotFullPage` keys via `reactGrab.populate()`, opens the sidebar, asserts both thumbnails are visible. Clicks the "Element" thumbnail, asserts `[data-react-grab-image-lightbox]` is visible with the right `src` and caption "Element". Tests close via three paths in sequence: backdrop click → reopens → `Esc` → reopens → `×` button. Each close asserts the lightbox is gone.

- **Zoom toggle and pan test** (`AC3, AC4, AC5`) — opens the lightbox on the full-page screenshot. Asserts initial mode is `fit` (zoom badge text). Clicks the image, asserts mode is `1:1` and viewport `data-mode="actual"`. With the image overflowing, simulates a pointer-down + pointer-move + pointer-up sequence on the image, asserts viewport `scrollTop` changed.

- **Image swap and scroll lock test** (`AC10, AC11, AC13`) — opens the lightbox on the Element thumbnail, asserts body scroll is locked (`document.body.style.overflow === "hidden"`). Without closing, clicks the Full-page thumbnail; asserts the lightbox is still open but the `src` swapped to the new image. Closes; asserts body scroll is restored.

- **No-selection click safety test** (`AC12`) — activates the overlay (full activation, not just sync), seeds data, clicks a thumbnail, and asserts no element selection occurred (`reactGrab.getSelections()` count unchanged).

All tests use `reactGrab.screenshot()` for visual regression attachment in the HTML report. Filter with `--grep @SPEC-017`.

**Manual verification** — open the AdCreative app with the local symlinked react-grab, click any screenshot thumbnail in the sidebar, verify the interaction matches the POC.

**No unit tests** — the singleton hook (`use-image-lightbox.ts`) is trivial reactive state (a single `createSignal` with two setters), not worth unit testing in isolation. The UI primitive is integration logic (Portal, refs, pointer events) that only matters as a whole — covered by E2E.

## Acceptance Criteria

### Reusable UI primitive

- [ ] AC1: `components/ui/image-lightbox.tsx` exists and exports a `ImageLightbox` Solid component
- [ ] AC2: `ImageLightbox` accepts exactly `{open, src, caption, onClose}` props — no screenshot-specific or sidebar-specific props
- [ ] AC3: `ImageLightbox` renders nothing when `open` is false (`<Show>` guards the entire tree)
- [ ] AC4: `ImageLightbox` renders into the shadow root via `<Portal mount={useShadowMount()}>`, not in-tree

### Singleton hook

- [ ] AC5: `features/image-lightbox/use-image-lightbox.ts` exposes `{state, open(src, caption), close}` from a single module-scoped signal
- [ ] AC6: Importing `useImageLightbox` from two different modules returns hooks that share the same signal instance (verified by opening from one module and observing state from another)
- [ ] AC7: `open` swaps `src` and `caption` and sets `open: true` atomically
- [ ] AC8: `close` flips `open: false` without resetting `src` / `caption` (so `<Show>` unmount is the only thing that hides the image)

### Sidebar wiring

- [ ] AC9: `components/sidebar/index.tsx` mounts exactly one `<ImageLightbox>` instance at the sidebar root
- [ ] AC10: `screenshot-pair.tsx` thumbnails call `useImageLightbox().open(src, label)` from their `onClick`
- [ ] AC11: Thumbnails get `cursor-zoom-in` and a hover border affordance (Tailwind class change on hover)
- [ ] AC12: Clicking a thumbnail does not trigger element selection in the underlying page (overlay click handlers are not invoked)

### Open / close interactions

- [ ] AC13: Clicking the "Element" thumbnail opens the lightbox with the element screenshot, caption text "Element"
- [ ] AC14: Clicking the "Full page" thumbnail opens the lightbox with the full-page screenshot, caption text "Full page"
- [ ] AC15: Pressing `Esc` while the lightbox is open closes it
- [ ] AC16: Clicking the backdrop (root container, outside topbar and viewport) closes the lightbox
- [ ] AC17: Clicking the close (`×`) button closes the lightbox
- [ ] AC18: Clicking the image itself does NOT close the lightbox
- [ ] AC19: Clicking the topbar caption pill does NOT close the lightbox
- [ ] AC20: Opening a second thumbnail while the lightbox is already open swaps the displayed `src` without unmounting

### Zoom and pan

- [ ] AC21: The lightbox opens in `fit` mode by default — the entire image fits within the viewport
- [ ] AC22: The zoom badge in the topbar shows `FIT` initially and `1:1` after toggling to actual size
- [ ] AC23: Clicking the image toggles between `fit` and `actual` modes
- [ ] AC24: In `actual` mode, when the image overflows, the user can pan by drag (verified: `viewport.scrollTop` changes after a pointermove sequence)
- [ ] AC25: In `actual` mode, scroll-wheel scrolling on the viewport scrolls the image (native browser scroll, no custom code)
- [ ] AC26: Mode resets to `fit` whenever `src` changes (verified by opening one image, toggling to actual, opening a different image, asserting mode is `fit`)

### Cursor states

- [ ] AC27: Image cursor is `zoom-in` in `fit` mode
- [ ] AC28: Image cursor is `zoom-out` in `actual` mode (when not dragging)
- [ ] AC29: Image cursor is `grabbing` while a drag-pan is in progress

### Body scroll lock

- [ ] AC30: When the lightbox opens, `document.body.style.overflow` becomes `"hidden"`
- [ ] AC31: When the lightbox closes, the previous `document.body.style.overflow` value is restored
- [ ] AC32: Scroll lock is not stuck after rapid open/close (no leaked listeners or stale state)

### Z-index and DOM placement

- [ ] AC33: The lightbox renders at `z-index: var(--z-dialog)` (40) — above sidebar / toolbar / overlay
- [ ] AC34: The lightbox root carries `data-react-grab-image-lightbox` for testing and debugging
- [ ] AC35: The close button carries `data-react-grab-lightbox-close`
- [ ] AC36: The viewport carries `data-react-grab-lightbox-viewport` and a `data-mode="fit" | "actual"` attribute reflecting current state

### E2E verification

- [ ] AC37: `e2e/mocked/screenshot-lightbox.spec.ts` exists and is tagged `@SPEC-017` on the describe block
- [ ] AC38: Open / close test covers backdrop click, `Esc`, and `×` button paths
- [ ] AC39: Zoom toggle / pan test verifies mode swap and scrollTop change after a drag sequence
- [ ] AC40: Image-swap test verifies opening a second thumbnail mid-view updates `src` without unmount
- [ ] AC41: Click-safety test verifies overlay element-selection is not triggered by thumbnail clicks
- [ ] AC42: Tests filterable via `pnpm --filter react-grab exec playwright test --project=chromium --grep @SPEC-017`

### Codebase hygiene

- [ ] AC43: `pnpm lint` passes with no new errors
- [ ] AC44: `pnpm typecheck` passes with no new errors
- [ ] AC45: `pnpm build` succeeds (tsup builds the new files)
- [ ] AC46: `pnpm arch:codegen` regenerates `architecture.yml` to include the new feature folder under the appropriate package

### Deferred (v2)

- [ ] Continuous scroll-wheel zoom toward cursor (POC includes it; v1 ships binary toggle only)
- [ ] Keyboard shortcuts beyond `Esc` (POC has `1` / `0` to toggle zoom; v1 ships `Esc` only)
- [ ] Prev / next navigation between images
- [ ] Download / copy-to-clipboard buttons
- [ ] Touch / pinch-to-zoom for mobile
- [ ] Rich caption (component name + label) — requires plumbing extra context into ScreenshotPair
