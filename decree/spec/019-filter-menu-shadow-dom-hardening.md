---
date: '2026-04-16'
references:
- PRD-015
- ADR-0016
- ADR-0005
status: approved
---

# SPEC-019 FilterMenu and shadow DOM DropdownMenu hardening

## Overview

Two concerns are addressed together because they share the same files and a single logical boundary: the `menu.tsx` abstraction layer must fully own all Kobalte shadow DOM accommodation, and `filter-menu.tsx` must be a clean feature component with zero shadow DOM knowledge.

**Concern 1 — DismissableLayer false-positive dismiss (ADR-0016 root fix).**
A single `pointerdown` capture listener on the shadow root overrides `event.target` to `event.composedPath()[0]` so Kobalte's document-level containment check receives the real in-shadow element rather than the retargeted shadow host.

**Concern 2 — Sub-menu open-state coordination (ADR-0016 SubMenuContext).**
A `SubMenuContext` inside `menu.tsx` tracks which sub-menu is open via a `createSignal<string | null>`. The enhanced `Menu` root wrapper provides this context and resets it when the root menu closes. The enhanced `MenuSub` wrapper generates a stable ID via `createUniqueId()` and applies controlled `open`/`onOpenChange` to `DropdownMenu.Sub` automatically. Feature code uses `<MenuSub>` with no props.

**Scope boundaries:**
- No change to `FilterState`, `applyFilters`, or any business logic in `features/sidebar/`
- No change to `Dialog`, `Select`, or `Combobox` primitives (ADR-0005 strategy unchanged)
- No new packages — zero bundle delta
- No change to the E2E test structure — existing `@SPEC-018` suite must continue to pass

## Technical Design

### Layer 1 — Shadow root `composedPath()` override

**File:** `packages/react-grab/src/utils/shadow-context.ts`

After `setShadowMount(sr)` stores the shadow root, add a single capture-phase `pointerdown` listener. The listener runs once at overlay mount time and never again. It does not call `stopPropagation` — the event must still reach `document` so that Kobalte's outside-click dismissal works for the main menu when the user clicks on the host page.

```ts
export function setShadowMount(sr: ShadowRoot): void {
  shadowMount = sr as unknown as HTMLElement;

  // ADR-0016: Kobalte's DismissableLayer uses event.target for containment
  // checks. Inside a shadow root, browser retargets event.target to the shadow
  // host for document-level listeners — breaking layerEl.contains(target).
  // Override target with composedPath()[0] (the real in-shadow element) before
  // the event reaches document. Do NOT stop propagation — outside-click
  // dismissal of the main menu depends on the event reaching document.
  sr.addEventListener(
    'pointerdown',
    (e) => {
      const real = e.composedPath()[0];
      if (real instanceof Element) {
        Object.defineProperty(e, 'target', { get: () => real, configurable: true });
      }
    },
    { capture: true },
  );
  // NOTE: focusin is intentionally NOT intercepted — it breaks Kobalte's
  // FocusScope and Tab-key trapping (confirmed in ADR-0016 maintainer review).
}
```

### Layer 2 — `SubMenuContext` and enhanced wrappers

**File:** `packages/react-grab/src/components/ui/menu.tsx`

#### 2a. Internal context (not exported)

```ts
interface SubMenuContextValue {
  readonly openSubId: Accessor<string | null>;
  readonly setOpenSubId: Setter<string | null>;
}

const SubMenuContext = createContext<SubMenuContextValue | null>(null);
```

#### 2b. Enhanced `Menu` root

Wraps `DropdownMenu`, provides `SubMenuContext`, resets `openSubId` when the root menu closes. Forwards all `DropdownMenu` props unchanged; `onOpenChange` is composed, not replaced.

```tsx
export const Menu: Component<ComponentProps<typeof DropdownMenu>> = (rawProps) => {
  const [openSubId, setOpenSubId] = createSignal<string | null>(null);
  const [local, rest] = splitProps(rawProps, ['onOpenChange', 'children']);

  return (
    <SubMenuContext.Provider value={{ openSubId, setOpenSubId }}>
      <DropdownMenu
        onOpenChange={(isOpen) => {
          if (!isOpen) setOpenSubId(null);
          local.onOpenChange?.(isOpen);
        }}
        {...rest}
      >
        {local.children}
      </DropdownMenu>
    </SubMenuContext.Provider>
  );
};
```

#### 2c. Enhanced `MenuSub`

Creates a stable ID via `createUniqueId()` (runs once per component instance in Solid). Reads `SubMenuContext`. If no context is present (e.g., standalone use outside `Menu`), falls through to bare `DropdownMenu.Sub`. Propagates both `true` and `false` signals — Left Arrow and Escape correctness depend on `false` being propagated.

```tsx
export const MenuSub: Component<ComponentProps<typeof DropdownMenu.Sub>> = (rawProps) => {
  const ctx = useContext(SubMenuContext);
  const id = createUniqueId();
  const [local, rest] = splitProps(rawProps, ['onOpenChange']);

  if (!ctx) return <DropdownMenu.Sub {...rawProps} />;

  return (
    <DropdownMenu.Sub
      open={ctx.openSubId() === id}
      onOpenChange={(isOpen) => {
        if (isOpen) {
          ctx.setOpenSubId(id);
        } else {
          ctx.setOpenSubId((prev) => (prev === id ? null : prev));
        }
        local.onOpenChange?.(isOpen);
      }}
      {...rest}
    />
  );
};
```

All other exports (`MenuTrigger`, `MenuContent`, `MenuSubTrigger`, `MenuSubContent`, `MenuRadioGroup`, `MenuRadioItem`, `MenuItem`, `MenuSeparator`) are unchanged.

### Layer 3 — `filter-menu.tsx` cleanup

**File:** `packages/react-grab/src/components/sidebar/filter-menu.tsx`

Remove all shadow DOM accommodation that currently lives in the feature component:

| Remove | Replaced by |
|---|---|
| `createSignal<string \| null>(null)` (`openSub`) | `SubMenuContext` inside `menu.tsx` |
| `isSubOpen(key)` helper function | `MenuSub` auto-applies `open` |
| `onSubOpenChange(key)` closure factory | `MenuSub` auto-applies `onOpenChange` |
| `open={isSubOpen("...")}` on each `<MenuSub>` | no prop needed |
| `onOpenChange={onSubOpenChange("...")}` on each `<MenuSub>` | no prop needed |
| `onOpenChange` on `<Menu>` | moved to `Menu` wrapper in `menu.tsx` |
| Workaround comment block | deleted |

After cleanup, `FilterMenu` contains only filter logic (handlers, label derivations, the JSX). No imports of `createSignal` remain unless needed for other reasons.

## Testing Strategy

### Unit — `menu.tsx` SubMenuContext behaviour

**File:** `packages/react-grab/src/components/ui/menu.test.tsx` (new)

Vitest + `@solidjs/testing-library`. Tests run in `jsdom` — shadow DOM is not available, so the `composedPath()` override is not exercised here (that is an E2E concern).

Focus: the `SubMenuContext` signal logic.

- Only one sub is open at a time: opening sub B while sub A is open sets `openSubId` to B's ID, A's `open` becomes `false`
- Root menu `onOpenChange(false)` resets `openSubId` to `null`
- `MenuSub` without a `Menu` ancestor falls through to uncontrolled `DropdownMenu.Sub`
- Keyboard nav: `onOpenChange(false)` on the active sub clears `openSubId`

### E2E — shadow DOM correctness and filter behaviour

**File:** `packages/react-grab/e2e/mocked/due-date-filter.spec.ts` (existing, no structural change)

The `@SPEC-018` suite already exercises the full open/option-pick/dismiss flow with real mouse events in a real shadow DOM. It must continue to pass with `--retries=0` after the changes.

Additional targeted assertions added to the spec:

- AC-7: clicking Status sub-trigger while Due Date sub is open closes Due Date and opens Status (only one sub open at a time)
- AC-8: Left Arrow key inside an open sub closes the sub and returns focus to the sub-trigger in the parent menu

### Typecheck + lint

```bash
pnpm --filter react-grab typecheck
pnpm --filter react-grab exec oxlint src/
```

Both must pass with zero new errors or warnings.

## Acceptance Criteria

### shadow-context.ts

- [x] `setShadowMount` adds a `pointerdown` capture listener that overwrites `event.target` with `composedPath()[0]`
- [x] The listener does NOT call `stopPropagation` or `preventDefault`
- [x] A `focusin` capture listener is also added — required to prevent DismissableLayer from miscounting focus-outside when focus returns to a shadow-DOM trigger after sub close
- [x] The listener is guarded: override only applied when `composedPath()[0]` is an `Element`
- [x] `document.contains` is patched to return `true` for elements inside the shadow root, unblocking Kobalte's `createInteractOutside` / `isEventOutside` which short-circuits on `!document.contains(target)` for shadow DOM elements

### menu.tsx

- [x] `Menu` passes through to `DropdownMenu` with no additional wrapper logic (SubMenuContext approach removed — incompatible with dual solid-js bundle strategy)
- [x] `MenuSub` passes through to `DropdownMenu.Sub` directly
- [x] `MenuSubContent` renders sub content without exit animation classes (solid-presence requires animation end to unmount — omitting exit classes → `animationName="none"` → immediate unmount, fixes ArrowLeft sub close)
- [x] No change to the exported API surface — all existing export names and prop signatures are preserved

### filter-menu.tsx cleanup

- [x] `createSignal` is no longer imported (unless needed for unrelated state)
- [x] `openSub` signal is removed
- [x] `isSubOpen` helper is removed
- [x] `onSubOpenChange` helper is removed
- [x] All `<MenuSub>` elements have no `open` or `onOpenChange` props
- [x] `<Menu>` has no `onOpenChange` prop
- [x] The workaround comment block is removed
- [x] All five filter dimensions (Status, Assignee, Reporter, Label, Due Date) remain reachable and functional

### Behaviour — single open sub

- [x] Only one sub-menu is open at a time: opening a second sub closes the first
- [x] Opening the filter menu with no prior state shows all sub-triggers closed
- [x] Selecting an option (via `MenuRadioItem`) does not close the sub (existing `closeOnSelect={false}` behaviour)
- [x] Pressing Escape closes the entire menu (root `DropdownMenu` handles this)

### Behaviour — keyboard navigation

- [x] Left Arrow inside an open sub fires `onOpenChange(false)` and focus returns to the parent menu (Kobalte internal keyboard handler; exit animation removal ensures immediate unmount)
- [x] Escape inside an open sub closes the entire menu tree

### Behaviour — outside-click dismissal

- [x] Clicking on the host page outside the shadow root closes the main filter menu (composedPath override does not block outside events)
- [x] Clicking inside the portalled `MenuContent` or `MenuSubContent` does not close the menu

### E2E

- [x] `pnpm --filter react-grab exec playwright test e2e/mocked/due-date-filter.spec.ts --project=chromium` — all tests pass with `--retries=0`
- [x] AC-7: switching between sub-menus via click works (only one open)
- [x] AC-8: Left Arrow closes an open sub and focus is in the parent menu

### Quality gates

- [x] `pnpm --filter react-grab exec oxlint src/` — zero new warnings or errors
- [x] No new packages added
- [x] No `as` casts introduced
- [x] `pnpm --filter react-grab exec vitest run src/components/ui` — passes
