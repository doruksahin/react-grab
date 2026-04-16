---
status: draft
date: 2026-04-16
references: [PRD-002, PRD-003, ADR-0005]
---

# PRD-014 Enlargeable Screenshot Viewer

**Design POC:** [`docs/poc/screenshot-lightbox.html`](../../docs/poc/screenshot-lightbox.html) — standalone HTML exploring the lightbox interaction (fit-to-viewport default, click-to-toggle 1:1, drag-to-pan when overflowing, Esc/backdrop/× to close, caption with zoom badge). Mirrors the patterns used by Google Photos, GitHub, Slack, and Linear image viewers.

## Problem Statement

The sidebar renders two screenshots per selection — an "Element" capture (the selected element in isolation) and a "Full page" capture (the whole page with the element highlighted). Both render at `max-h-32` (128px) inside the sidebar's narrow column, where they fit the available space but are too small to read.

For the Element screenshot this is mildly inconvenient — small UI elements like buttons or badges are still recognisable. For the Full page screenshot it is a real problem: a 2400px-tall page scaled into a 128px tile is unreadable. The user can see *that* something was captured but not *what* was captured, which defeats the purpose of having the screenshot in the sidebar at all.

Today the only workaround is right-click → "Open image in new tab", which jumps the user out of the sidebar context and into a raw browser viewer with no caption or affordance to return. Users have stopped relying on the screenshots for context as a result, even though the data is right there.

The resolution is a click-to-enlarge lightbox: clicking either thumbnail opens a full-viewport viewer with the image rendered at a usable size, with a one-click toggle between fit-to-viewport and 1:1 actual size, and a drag-to-pan affordance for inspecting tall full-page captures. The interaction follows the conventional pattern users already know from photo viewers across the web.

## Requirements

### Interaction

- R1: Clicking either screenshot thumbnail in the sidebar opens a lightbox displaying that single image at a large size
- R2: The lightbox opens with the image fitted to the viewport (whole image visible, aspect preserved, letterboxed if needed) — `FIT` mode
- R3: Clicking the image toggles between `FIT` mode and `1:1` actual-pixel-size mode
- R4: When in `1:1` mode and the image overflows the viewport, the user can pan by dragging with the mouse, or scroll with the trackpad/scroll wheel, to inspect different regions
- R5: The lightbox closes when the user presses `Esc`, clicks the backdrop, or clicks the close (`×`) button
- R6: Only one lightbox instance is visible at a time — opening a second thumbnail while the lightbox is open swaps the displayed image without closing and reopening

### Visual

- R7: The lightbox renders a dark backdrop covering the full viewport with a subtle blur to push focus onto the image
- R8: A caption pill in the top-left of the lightbox shows the image label (e.g. "Element" or "Full page") plus a zoom badge (`FIT` or `1:1`)
- R9: A close button (`×`) sits in the top-right with a hover affordance
- R10: The cursor reflects the current interaction state — `zoom-in` over the image when in `FIT` mode, `zoom-out` when in `1:1` mode, `grab`/`grabbing` while panning
- R11: Thumbnails in the sidebar gain a `zoom-in` cursor and a subtle hover affordance (border highlight) to indicate they are clickable
- R12: A small bottom hint shows the available actions ("Click to toggle zoom · `Esc` to close")

### Scope

- R13: The lightbox is a reusable UI primitive (`components/ui/image-lightbox.tsx`) that takes an image source and caption — it is not coupled to screenshots specifically and can be reused by future features that need to display any image at full size
- R14: Triggering the lightbox is mediated by a singleton signal store — any component in the sidebar can open the lightbox by calling a hook, and a single lightbox instance serves all triggers (no per-thumbnail dialog mounting)
- R15: The lightbox renders via Solid's `<Portal mount={useShadowMount()}>` to escape the sidebar's stacking context, following the same pattern as `JiraCreateDialog` (per ADR-0005)
- R16: The lightbox does not introduce navigation between images (no prev/next arrows), download buttons, rotation, annotation, or zoom controls beyond the binary fit ↔ actual toggle

### Behaviour

- R17: While the lightbox is open, the page body scroll is locked so the background does not move when the user scrolls inside the lightbox
- R18: Clicking the image itself does not propagate to the backdrop — the backdrop close handler only fires for clicks that originate on the backdrop, not on the image or topbar
- R19: The lightbox does not interfere with the overlay's element-selection clicks — clicking a thumbnail does not select the underlying page element, and dismissing the lightbox does not trigger a selection
- R20: When the lightbox closes, the underlying image source is unmounted from the DOM (no retained `<img>` for closed state)

### Acceptance Criteria (Testable)

- AC1: Clicking the "Element" thumbnail opens the lightbox with the element screenshot, captioned "Element"
- AC2: Clicking the "Full page" thumbnail opens the lightbox with the full-page screenshot, captioned "Full page"
- AC3: The lightbox opens in `FIT` mode by default — the entire image is visible within the viewport
- AC4: Clicking the image toggles to `1:1` mode and the zoom badge updates to read `1:1`
- AC5: In `1:1` mode, when the image overflows the viewport, the user can pan by dragging
- AC6: Pressing `Esc` closes the lightbox
- AC7: Clicking the backdrop (outside the image) closes the lightbox
- AC8: Clicking the close (`×`) button closes the lightbox
- AC9: Clicking the image itself does NOT close the lightbox
- AC10: While the lightbox is open, the document body cannot be scrolled
- AC11: After closing the lightbox, body scroll is restored
- AC12: Clicking a thumbnail does not trigger element selection in the underlying page
- AC13: Opening a second thumbnail while the lightbox is already open swaps the image without flicker
- AC14: The lightbox is rendered above all sidebar content and the floating toolbar (z-index above `--z-sidebar`, at `--z-dialog`)

## Success Criteria

- A user can read the contents of a small captured element without leaving the sidebar context
- A user can scan the full-page screenshot of a tall page at readable size by toggling to 1:1 and panning
- The interaction matches conventional image-viewer behaviour from products users already use daily (Google Photos, GitHub, Linear) — no learning curve
- The lightbox is reusable for any future image-display need without further abstraction (a JIRA attachment viewer, an avatar enlargement, etc. can use the same primitive)
- Existing sidebar behaviour is unchanged for users who never click a thumbnail — no layout shifts, no new visual noise

## Out of Scope

- Navigation between images via prev/next arrows or keyboard (left/right)
- Download, copy-to-clipboard, or share controls
- Image rotation, cropping, annotation, or any editing affordance
- Continuous zoom (scroll-wheel-to-zoom toward cursor) — only the binary fit ↔ actual toggle
- A magnifier/lens hover mode on the thumbnails themselves (no zoom without opening the lightbox)
- A "compare both screenshots" side-by-side view in the lightbox
- Animated transitions for the open/close lifecycle beyond a simple fade
- Persisting the user's preferred zoom mode across opens
- Keyboard shortcuts beyond `Esc` (no `1`/`0` to toggle zoom in v1; the POC includes them but they're a nice-to-have, not a requirement)
- Touch / pinch-to-zoom support (desktop-first; mobile is not a target for the dev overlay)
