---
date: '2026-04-16'
references:
- PRD-014
- ADR-0005
status: accepted
---

# ADR-0014 Reusable Image Lightbox Composition — UI primitive + singleton hook + Portal-to-shadow

**Design POC:** [`docs/poc/screenshot-lightbox.html`](../../docs/poc/screenshot-lightbox.html) — the visual interaction model (fit ↔ 1:1 toggle, drag-to-pan, Esc/backdrop close) was validated here before implementation. This ADR describes the *code structure* chosen to ship that interaction inside the Solid.js + Shadow DOM overlay.

## Context and Problem Statement

PRD-014 requires every screenshot thumbnail in the sidebar to be clickable, opening a full-viewport lightbox. Two `ScreenshotPair` components render per selection card, and many cards can render simultaneously — there are potentially dozens of clickable thumbnails on screen at once.

The lightbox itself is a non-trivial UI: backdrop, captioned topbar, viewport with two zoom modes, drag-to-pan when overflowing, Esc handler, scroll lock, and a Portal that mounts into the Shadow DOM (per ADR-0005). It is also the kind of viewer that is likely to be reused — a JIRA attachment preview, a captured video frame, an enlarged user avatar. The pattern is general; only the trigger is screenshot-specific.

The question is: where does the lightbox state live, what owns the rendered DOM instance, and how do thumbnails open it without coupling unrelated components or duplicating the dialog code that `JiraCreateDialog` already implements?

## Decision Drivers

- Multiple thumbnail trigger sites — every `ScreenshotPair` instance has two clickable images, all in the same sidebar tree
- Only one lightbox can be visible at a time — opening a second image while the lightbox is open should swap the displayed image, not stack a second modal
- The repo already establishes a layered structure (`features/<name>/` for state and reactive logic, `components/<name>/` for pure UI, `components/ui/` for primitives reused by 2+ features) — the lightbox should match
- ADR-0005 already established that dialogs in this codebase use Solid's `<Portal mount={useShadowMount()}>` to escape the sidebar's `isolation: isolate` stacking context — the lightbox follows this rule, no new portal infrastructure needed
- The shadcn Dialog wrapper at `components/ui/dialog.tsx` is homegrown (not Kobalte) and its `DialogPortal` is a no-op `<>{children}</>` — it cannot be used as-is for shadow-root portaling
- The lightbox interaction (drag-to-pan, dual zoom modes, image-specific cursor states) is materially different from the form-card layout `Dialog` provides — they would not share useful internals even if Dialog were portal-capable
- The repo guideline ("three similar lines is better than a premature abstraction") applies to extracting a generic `PortalOverlay` from `JiraCreateDialog` — there is no third consumer, so the inline duplication stays

## Considered Options

### Option A: Local state inside `ScreenshotPair`, one `<Lightbox>` per pair

Each `ScreenshotPair` owns a local `createSignal<{open, src, caption}>` and renders its own `<Lightbox>` inline (or via a child component) that toggles via that signal.

- **Pro**: No global state, no singleton concerns, each instance is self-contained
- **Pro**: Trivial mental model — the trigger and the modal sit in the same component
- **Con**: Many `<Lightbox>` instances mount in the DOM (one per pair, even though only one is ever visible) — wasted nodes and Portal subscriptions
- **Con**: If two pairs are present and both happen to be open (race condition or rapid clicks), two backdrops stack
- **Con**: Other features that want to open a lightbox (JIRA attachment, avatar enlargement) cannot trigger one — the lightbox is owned by `ScreenshotPair`
- **Con**: Couples the lightbox lifecycle to the lifecycle of any individual pair — if the pair unmounts mid-view, the lightbox vanishes too

### Option B: Solid context provider wrapping the sidebar, with `useLightbox()` hook

Create a `<LightboxProvider>` component near the sidebar root that owns the state via `createContext`. Children call `const lightbox = useLightbox()` to get `{open, close}` and trigger it. The provider renders a single `<Lightbox>` instance.

- **Pro**: Single DOM instance, single state — all triggers share it
- **Pro**: Standard "provider + hook" Solid pattern, familiar to React refugees
- **Con**: Adds a Provider component to the tree just to share a single signal — overkill for state that isn't tree-scoped
- **Con**: Solid's context machinery has well-documented owner-chain pitfalls in this codebase (the same reason `useShadowMount` is a module-level singleton, not a context — see `utils/shadow-context.ts`)
- **Con**: Forces all consumers to be inside the provider — fragile if a future trigger sits outside the sidebar tree

### Option C: Singleton signal store + reusable `ImageLightbox` UI primitive + composition at sidebar root

Three pieces:

- `features/image-lightbox/use-image-lightbox.ts` — module-level `createSignal` exposing `{state, open(src, caption), close}`. Any module imports the hook and gets the same singleton.
- `components/ui/image-lightbox.tsx` — pure UI primitive. Props: `{open: boolean, src: string, caption?: string, onClose: () => void}`. Self-contained: Portal-to-shadow, backdrop, topbar, viewport with fit/actual modes, drag-to-pan, Esc handler, scroll lock. Knows nothing about screenshots.
- `components/sidebar/index.tsx` — composition shell. Mounts a single `<ImageLightbox>` once at sidebar root, wired to the singleton. `ScreenshotPair` thumbnails call `useImageLightbox().open(src, caption)` from their click handlers.

- **Pro**: Single DOM instance — exactly one `<ImageLightbox>` mounted, regardless of how many triggers exist
- **Pro**: Reusable — any feature anywhere in the sidebar (or any component that imports the hook) can open the lightbox without the trigger being lexically inside a provider
- **Pro**: Layered SRP — UI primitive only knows how to display an image big; hook only knows about state; sidebar composes them; ScreenshotPair only knows how to format the caption and call `open()`
- **Pro**: Matches the codebase's existing singleton pattern (`utils/shadow-context.ts` uses the same module-level approach for the same reason — Solid context fragility)
- **Pro**: The UI primitive lives in `components/ui/` where future image-display consumers expect to find it
- **Con**: Singleton state is global — two different features triggering simultaneously is a "last wins" race (acceptable for a viewer; the user can only look at one image at a time anyway)
- **Con**: Three files instead of one — slightly more indirection, but each has a single concern

### Option D: Reuse the existing `components/ui/dialog.tsx` shadcn wrapper

Compose the lightbox inside `<Dialog>` / `<DialogContent>` from the existing shadcn wrapper, overriding styles to make it full-viewport.

- **Pro**: Reuses an existing primitive — no new files for the modal shell
- **Con**: The shadcn `DialogPortal` in this repo is `<>{children}</>` — it does NOT portal anywhere, so the dialog would render inside the sidebar's stacking context and be clipped by `isolation: isolate`
- **Con**: `DialogContent` is hardcoded to a centered card layout (`max-w-lg`, padded, bordered, shadowed) — overriding it for full-viewport requires reverting most of its styling, at which point nothing useful is reused
- **Con**: The shadcn Dialog has no Esc handler, no focus trap, no scroll lock built in — every drawback of building from scratch, plus the constraint of working around the shadcn shape

## Decision Outcome

**Option C**: Singleton signal store + reusable `ImageLightbox` UI primitive + composition at sidebar root.

The composition matches the codebase's established layering (state in `features/`, primitives in `components/ui/`, composition in the consumer). The singleton hook mirrors the proven `useShadowMount` pattern in `utils/shadow-context.ts`, which exists precisely because Solid's context owner-chain is fragile in this overlay's mount sequence. The UI primitive lives in `components/ui/` where it is discoverable for the next feature that needs full-size image display.

Option A was rejected because mounting one lightbox per `ScreenshotPair` is wasteful and prevents reuse from outside the pair. Option B was rejected because a Provider+context adds tree coupling for state that has no tree-scoped meaning. Option D was rejected because the shadcn Dialog in this repo cannot portal into the shadow root, which is the load-bearing requirement from ADR-0005.

A generic `PortalOverlay` primitive (Portal + backdrop + Esc + scroll lock) extracted from `JiraCreateDialog` was considered and explicitly rejected for now: there is one new consumer (the lightbox), one existing consumer (`JiraCreateDialog`), and a third has not appeared. Per the codebase's anti-premature-abstraction guideline, the small inline duplication is preferable. If a third consumer arrives, extraction at that point is straightforward.

### Consequences

- New file `components/ui/image-lightbox.tsx` — a self-contained Solid component taking `{open, src, caption, onClose}`. No coupling to screenshots, JIRA, or the sidebar.
- New file `features/image-lightbox/use-image-lightbox.ts` — module-level `createSignal` exposing imperative `open` / `close` and a reactive `state` accessor. Importable from anywhere.
- New file `features/image-lightbox/types.ts` — `LightboxState` interface and `ImageLightboxProps` type, kept feature-local.
- `components/sidebar/index.tsx` — gains one new line mounting `<ImageLightbox {...lightboxState()} onClose={close} />` once near the root.
- `components/sidebar/screenshot-pair.tsx` — each thumbnail gains an `onClick` calling `useImageLightbox().open(src, caption)` and a `cursor-zoom-in` class. No other behavior change.
- `JiraCreateDialog` is left untouched — no preemptive refactor to share a `PortalOverlay` primitive.
- The sidebar's `isolation: isolate` stacking context is irrelevant to the lightbox because the Portal mounts the lightbox at the shadow root level, above the sidebar in the stacking order. `z-index: var(--z-dialog)` ensures correct layering relative to other overlay UI.
- Adding a future trigger (avatar enlargement, JIRA attachment preview) is a one-line `import { useImageLightbox } from "...image-lightbox"` and a call — no new mount, no new portal.
- Replacing the lightbox UI later (e.g., Kobalte-based focus-trapped variant, or a side-by-side comparison viewer) is a swap of the primitive — the singleton hook contract stays the same.
