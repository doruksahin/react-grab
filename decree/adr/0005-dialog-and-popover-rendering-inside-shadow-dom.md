---
date: '2026-04-05'
references:
- PRD-002
- ADR-0002
status: accepted
---

# ADR-0005 Dialog and popover rendering inside Shadow DOM

## Context and Problem Statement

Phase 3 (PRD-002) requires a JIRA create dialog inside the sidebar, containing searchable project and issue-type selects, a priority selector, and a modal dialog — all rendered within react-grab's Shadow DOM host. PRD-002 explicitly requires that dialog popovers render correctly within Shadow DOM with no portaling to `document.body`. ADR-0002 established Solid.js as the UI framework and identified Kobalte as a candidate headless UI library. However, Kobalte's Portal sub-components (`Dialog.Content`, `Select.Content`, `Popover.Content`, etc.) hard-code `document.body` as their mount target with no `mount`, `container`, or `root` prop override. Additionally, Kobalte Issue #445 documents a dismiss loop bug specific to Shadow DOM: when a trigger lives inside a shadow root, the overlay closes and reopens immediately because `DismissableLayer` uses trigger ref exclusion that breaks when `event.target` reports the shadow host instead of the trigger element. This bug was unresolved as of October 2025. We must decide the rendering strategy for overlays (dialogs, selects, popovers) inside the Shadow DOM. [R-005](../../docs/risks.md) [A-004](../../docs/assumptions.md)

## Decision Drivers

- PRD-002 requires overlays to render inside the Shadow DOM — portaling to `document.body` breaks Shadow DOM scoped styles and event handling
- ADR-0002 chose Solid.js — the solution must remain in-ecosystem
- Kobalte `*.Portal` sub-components hard-code `document.body` with no override (confirmed 2026-04-05, Kobalte issue #445 unresolved upstream)
- Overlay positioning inside Shadow DOM has a known `offsetParent` bug — `@floating-ui/dom` with `strategy: 'fixed'` avoids it [A-020](../../docs/assumptions.md)
- Solid's native `<Portal>` component accepts a `mount` prop of any `Node`, including a shadow root
- corvu has the same `document.body` portal limitation as Kobalte, with no documented Shadow DOM support
- Kobalte provides accessibility primitives (ARIA roles, keyboard navigation, focus management) that are non-trivial to re-implement
- The JIRA dialog requires: modal dialog with focus trap, two searchable selects (project, issue type), one non-searchable select (priority) — these are standard headless UI patterns

## Considered Options

### Option A: Kobalte content components with `forceMount={true}` wrapped in Solid's native `<Portal mount={shadowRoot}>`

Use Kobalte's headless primitives for accessibility structure (Dialog, Select, Combobox) but bypass Kobalte's own portal by using `forceMount={true}` on content components. Wrap each content component in Solid's `<Portal mount={shadowRoot}>` which accepts any `Node` as its mount target.

```tsx
import { Portal } from "solid-js/web";

<Select.Content forceMount={true}>
  {/* Kobalte handles ARIA, keyboard nav, focus */}
</Select.Content>
// wrapped in:
<Portal mount={shadowRoot}>
  <Select.Content forceMount={true}>...</Select.Content>
</Portal>
```

For positioning: use `@floating-ui/dom` with `strategy: 'fixed'` to avoid the Shadow DOM `offsetParent` bug. [A-020](../../docs/assumptions.md)

For the Kobalte Issue #445 dismiss loop: apply `disableOutsidePointerEvents={true}` on content components as an interim workaround until an upstream fix is available.

- Good: retains Kobalte's accessibility primitives — ARIA roles, keyboard navigation, Tab/Escape handling, `aria-expanded`, `aria-controls`, `role="dialog"` etc. are all correct out of the box
- Good: `<Portal mount={shadowRoot}>` is a first-party Solid API — it is documented and stable
- Good: `@floating-ui/dom` `strategy: 'fixed'` is the documented fix for Shadow DOM positioning [A-020](../../docs/assumptions.md)
- Good: Kobalte is already identified as the component library candidate in ADR-0002 — this stays within that decision
- Neutral: `disableOutsidePointerEvents={true}` mitigates the dismiss loop (Issue #445) but prevents click-outside-to-dismiss — acceptable for modal dialog UX, less ideal for non-modal popovers
- Neutral: Issue #445 has no upstream fix ETA; workaround must be maintained until Kobalte fixes it
- Bad: the composition pattern (`forceMount` + `<Portal mount>`) is non-obvious and will need to be documented for future contributors

### Option B: Hand-roll all overlay components using native DOM APIs (`<dialog>` element, Popover API)

Implement modal dialogs using the native HTML `<dialog>` element and popovers using the Popover API (`popover` attribute), both of which are scoped to the shadow root natively.

- Good: zero library dependency for overlay rendering — native browser APIs that are Shadow DOM-aware
- Good: the native `<dialog>` element handles focus trapping and scroll locking natively in modern browsers
- Good: no portal concern — native dialogs render in the flat tree relative to their DOM position
- Bad: searchable select/combobox (needed for project and issue type search) has no native equivalent — must be built from scratch
- Bad: `<dialog>` keyboard accessibility (`Escape`, Tab order, ARIA) must be wired manually for anything beyond the most basic use
- Bad: the Popover API browser support in older Chromium-based browsers used by the target host pages is not guaranteed
- Bad: eliminates all Kobalte accessibility work — the ARIA authoring patterns for combobox are complex (ARIA 1.2 combobox pattern)
- Bad: `solid-focus-trap` or similar still needed for focus management inside the dialog [A-021](../../docs/assumptions.md)

### Option C: corvu (Solid.js headless UI alternative to Kobalte)

Use corvu's Dialog, Select, and Popover primitives instead of Kobalte.

- Good: corvu is actively maintained by the `solid-focus-trap` team; focus trap is tightly integrated
- Good: API is similar to Kobalte — easier migration if Kobalte is fully abandoned
- Bad: corvu has the same `document.body` portal limitation as Kobalte — the same `forceMount` + `<Portal mount>` workaround would be required [R-005](../../docs/risks.md)
- Bad: no documented Shadow DOM support — the same dismiss-on-shadow-host bug likely exists (unconfirmed, but the same event target assumption is shared)
- Bad: switching from Kobalte to corvu is a full library swap — the gains over Option A are marginal while the migration cost is real
- Neutral: corvu's focus trap integration is an advantage for the dialog, but `solid-focus-trap` can be used standalone alongside Kobalte (it is `solid-focus-trap` itself, maintained by corvu)

## Decision Outcome

**Option A: Kobalte with `forceMount={true}` + `<Portal mount={shadowRoot}>`**, because:

1. **Accessibility primitives are retained.** The JIRA create dialog and searchable selects require correct ARIA roles, keyboard navigation, and focus management. Kobalte provides these out of the box. Building them from scratch (Option B) or switching to corvu (Option C) both carry higher implementation risk for the same accessibility surface. [R-005](../../docs/risks.md)

2. **The workaround is first-party and documented.** Solid's `<Portal mount={...}>` is a stable, documented API. `forceMount={true}` is a supported Kobalte prop. The composition is non-obvious but unambiguous, and the research doc (`docs/research/2026-04-05-leverageable-libraries.md §3`) provides the exact pattern.

3. **Option B eliminates searchable select.** The combobox pattern (ARIA 1.2) is one of the most complex interactive widget patterns. Kobalte's `Combobox` implements it; hand-rolling it is out of scope for Phase 3.

4. **corvu (Option C) has the same portal limitation** and likely the same Shadow DOM dismiss bug. Switching libraries to gain no meaningful advantage is not justified.

The Issue #445 dismiss loop mitigation (`disableOutsidePointerEvents={true}`) is acceptable for the modal dialog use case (click-outside-to-dismiss is not expected for a blocking JIRA create form). For non-modal selects within the dialog, the dismiss behaviour must be validated during prototyping and an alternative workaround applied if needed. [A-004](../../docs/assumptions.md)

Floating element positioning uses `@floating-ui/dom` with `strategy: 'fixed'`, which is the documented workaround for the Shadow DOM `offsetParent` bug. [A-020](../../docs/assumptions.md)

## Consequences

- All Kobalte overlay content components (`Dialog.Content`, `Select.Content`, `Combobox.Content`, `Popover.Content`) are used with `forceMount={true}` and wrapped in `<Portal mount={shadowRoot}>` — this is the **required pattern** for all overlay rendering in the sidebar
- The `shadowRoot` reference is provided via Solid context to all sidebar components that need it
- `@floating-ui/dom` is used with `strategy: 'fixed'` for all floating element positioning inside the shadow root [A-020](../../docs/assumptions.md)
- `disableOutsidePointerEvents={true}` is applied on `Dialog.Content` as the Kobalte Issue #445 interim workaround
- Non-modal select/combobox dismiss behaviour must be prototyped and validated before Phase 3 implementation proceeds
- `solid-focus-trap` (corvu) is available for any focus trapping needs beyond what Kobalte manages internally [A-021](../../docs/assumptions.md)
- When Kobalte Issue #445 is resolved upstream, the `disableOutsidePointerEvents` workaround should be removed — this is tracked in [R-005](../../docs/risks.md)
- corvu, bare `<dialog>`, and the Popover API are **not** used as primary overlay mechanisms
