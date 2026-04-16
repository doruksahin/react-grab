---
date: '2026-04-16'
references:
- ADR-0005
- PRD-015
status: accepted
---

# ADR-0016 Kobalte DropdownMenu sub-menu coordination inside Shadow DOM

## Context and Problem Statement

ADR-0005 established the overlay rendering strategy for the shadow DOM: Kobalte content components use `forceMount={true}` with a `<Portal mount={shadowRoot}>` wrapper, and Kobalte Issue #445 (dismiss loop on shadow boundary) is mitigated with `disableOutsidePointerEvents={true}` on modal `Dialog.Content`. That mitigation is acceptable for blocking modal dialogs, but it is not applicable to non-modal nested menus such as `DropdownMenu.Sub`.

During the implementation of `FilterMenu` (replacing the five inline `<Select>` controls in the sidebar stats bar with a single trigger + nested submenus), two distinct shadow DOM breakages were identified in Kobalte 0.13.11's `DropdownMenu`:

**Breakage 1 — DismissableLayer false-positive dismiss.**
Kobalte's `DismissableLayer` attaches a capture-phase `pointerdown` listener to `document`. When a pointer event originates inside the shadow root and crosses the shadow boundary, the browser retargets `event.target` to the shadow host for outer listeners. Kobalte's containment check (`layerEl.contains(event.target)`) then evaluates to `false` — the shadow host is not a descendant of the portalled layer element — so `DismissableLayer` fires `onDismiss` immediately, closing the menu as soon as it opens.

**Breakage 2 — Sub-menu open-state coordination.**
`DropdownMenu.Sub` uses Kobalte's `createControllableSignal` internally and opens submenus via pointer-enter detection. In shadow DOM the pointer-enter containment check has the same retargeting problem, making hover-based sub-menu open unreliable. When multiple `Sub` components are mounted, Kobalte's layer stack cannot determine which sub is active, so multiple submenus may remain open simultaneously.

The team consulted a Kobalte maintainer review (see `docs/plans/2026-04-16-filter-menu-consolidation.md`), which confirmed:

- The root cause is `event.target` (not `event.composedPath()[0]`) in the `DismissableLayer` containment check.
- Controlled `open`/`onOpenChange` on `DropdownMenu.Sub` is the documented escape hatch, but it does not eliminate the DismissableLayer retargeting — it only replaces hover-based coordination.
- Ignoring `onOpenChange(false)` signals breaks keyboard navigation: Left Arrow fires `onOpenChange(false)` and imperatively moves focus; if the signal is ignored, the submenu stays visually open while focus returns to the parent.

A decision is needed on how to fix these two breakages without switching headless libraries and without leaking shadow DOM knowledge into feature components.

## Decision Drivers

- Feature code (`filter-menu.tsx`) must have zero shadow DOM workarounds — the abstraction layer (`menu.tsx`) must own all accommodation logic
- Keyboard navigation (Left Arrow, Escape, Tab) must work correctly inside submenus
- The fix must not break the existing `Select`, `Dialog`, and `Combobox` primitives, which already work under ADR-0005's strategy
- No additional headless library should be introduced (recon found Ark UI adds ~60–80 KB gzipped with 64+ deps for menu-only use — not justified when a surgical fix exists)
- The fix must be auditable: a future Kobalte upgrade that ships a native `composedPath()` fix should be easy to detect and the workaround easy to remove

## Considered Options

### Option A: `composedPath()[0]` override on the shadow root + SubMenuContext

A single capture-phase `pointerdown` listener on the shadow root intercepts every pointer event before it crosses the boundary. It overrides `event.target` to `event.composedPath()[0]` — the actual in-shadow element — so that Kobalte's document-level `DismissableLayer` sees the real target rather than the retargeted shadow host. Kobalte's `layerEl.contains(realTarget)` then evaluates correctly.

For sub-menu coordination, a `SubMenuContext` is added inside `menu.tsx`. `Menu` (the root wrapper) provides the context with a `[openSubId, setOpenSubId]` signal. `MenuSub` (the per-sub wrapper) generates a stable ID via `createUniqueId()`, reads the context, and applies controlled `open` / `onOpenChange` to `DropdownMenu.Sub`. Both `true` and `false` signals from Kobalte are propagated: `true` sets the ID (closes all other subs); `false` clears the ID (allows keyboard nav to correctly dismiss).

```ts
// shadow-context.ts — after attachShadow():
sr.addEventListener('pointerdown', (e) => {
  const real = e.composedPath()[0] as Element;
  Object.defineProperty(e, 'target', { get: () => real, configurable: true });
}, { capture: true });

// menu.tsx — MenuSub (simplified):
onOpenChange={(isOpen) => {
  isOpen ? ctx.setOpenSubId(id) : ctx.setOpenSubId(null);
}}
```

The `focusin` event is explicitly **not** stopped or rewritten — the Kobalte maintainer review flagged this as breaking `FocusScope` and Tab-key trapping.

- Good: fixes DismissableLayer for all Kobalte components globally, not just menus
- Good: keyboard navigation (Left Arrow, Escape) works correctly — `onOpenChange(false)` is propagated
- Good: zero bundle cost — no new packages
- Good: the `composedPath()` override is entirely inside the shadow mount setup; removing it when Kobalte ships a native fix is a one-line deletion
- Good: feature code (`filter-menu.tsx`) uses `<MenuSub>` with no props — zero shadow DOM knowledge leaks
- Neutral: `Object.defineProperty` on a live event object is unconventional but supported; the override is idempotent and only affects events originating inside the shadow root
- Bad: if a future Kobalte version registers its document listener before the shadow root listener fires (ordering assumption), the override would not apply — this is a capture-phase ordering invariant that holds in all current browser implementations

### Option B: Replace Kobalte DropdownMenu with Ark UI Menu

Replace only the menu primitive (`menu.tsx`) with `@ark-ui/solid`'s `Menu`, which uses Zag.js and an `EnvironmentProvider` that scopes all DOM queries to a custom root.

- Good: eliminates the `composedPath()` override
- Bad: adds ~60–80 KB gzipped and 64+ new packages to the dep tree for menu-only usage
- Bad: two headless libraries (`@kobalte/core` for Select/Dialog/Combobox, `@ark-ui/solid` for Menu) with two different APIs and two separate upgrade cycles
- Bad: Ark UI's shadow DOM support is via environment scoping (query scoping), not `composedPath()` — similar assumptions, different mechanism; not verified to fully resolve the DismissableLayer issue without testing
- Bad: `@ark-ui/solid` Solid-specific support is secondary to their React adapter; shadow DOM bugs in Solid may lag upstream fixes

### Option C: stopPropagation on the shadow root

Block all `pointerdown` (and `focusin`) events from crossing the shadow boundary via `e.stopPropagation()`.

- Good: simpler than Option A — no `Object.defineProperty`
- Bad: prevents Kobalte's `DismissableLayer` from detecting clicks **outside** the shadow root — the main menu no longer closes when the user clicks on the host page
- Bad: `focusin` stopPropagation breaks `FocusScope` and Tab-key trapping (confirmed by maintainer review)

## Decision Outcome

**Option A**, because:

1. **It fixes the root cause.** The `composedPath()[0]` override corrects `event.target` before Kobalte's document listener fires. This is the minimal intervention — it does not change Kobalte's behavior for events originating outside the shadow root, so outside-click dismissal of the main menu continues to work.

2. **Keyboard navigation is preserved.** Propagating `onOpenChange(false)` (unlike the earlier prototype that ignored it) ensures Left Arrow and Escape correctly close submenus and return focus to the parent.

3. **The abstraction boundary is clean.** All shadow DOM accommodation lives in two files: `shadow-context.ts` (the `composedPath()` override) and `menu.tsx` (the `SubMenuContext`). Feature components (`filter-menu.tsx`) use `<Menu>`, `<MenuSub>`, `<MenuSubTrigger>`, `<MenuSubContent>` with no controlled props and no shadow DOM knowledge.

4. **Bundle cost is zero.** Option B adds significant weight for a problem that Option A solves surgically.

5. **Removability.** When Kobalte ships a native `composedPath()` fix, the override is a three-line deletion in `shadow-context.ts` and a note to re-verify that `SubMenuContext` is still needed (it provides "only one sub open at a time" UX coordination regardless of the shadow DOM issue, so it may be kept independently).

Option C is rejected because `stopPropagation` breaks outside-click dismissal and Tab trapping.

## Consequences

- `shadow-context.ts` gains a `pointerdown` capture listener that overrides `event.target` to `composedPath()[0]` — runs once at shadow root creation, affects all Kobalte components
- `menu.tsx` gains `SubMenuContext` (internal, not exported), an enhanced `Menu` root wrapper, and an enhanced `MenuSub` wrapper — callers use the same import surface, zero API change
- `filter-menu.tsx` drops the `openSub` signal, `isSubOpen` helper, `onSubOpenChange` helper, and all `open`/`onOpenChange` props on `<MenuSub>` — net reduction in feature code
- `focusin` propagation is intentionally **not** intercepted — do not add a `focusin` stopPropagation listener
- This fix applies only to `DropdownMenu`; `Dialog`, `Select`, and `Combobox` continue using the ADR-0005 strategy unchanged (`forceMount + Portal mount`, `disableOutsidePointerEvents` on Dialog)
- When Kobalte upstream resolves the `DismissableLayer` `composedPath()` issue, remove the override from `shadow-context.ts` and remove this consequence note
