# Filter Menu Consolidation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 5 inline filter `<Select>` controls in the sidebar's stats bar with a single "Filter" menu button (icon + label + count badge) whose popover lists each filter as a row that opens a nested submenu — matching POC variant **B** from `poc-stats-bar.html`.

**Architecture:** Behavior is preserved end-to-end (`FilterState` shape, `applyFilters`, all five filter dimensions, the existing `FilterChips` row below, the existing `Clear` semantics). Only the *control surface* changes: `filter-bar.tsx` (5 inline Selects) becomes `filter-menu.tsx` (1 trigger + nested Kobalte Menu submenus). A new low-level `components/ui/menu.tsx` wraps Kobalte's `Menu` primitives, mirroring how `select.tsx` and `combobox.tsx` wrap their respective primitives.

**Tech Stack:** Solid.js, Kobalte 0.13.11 (`@kobalte/core/menu` — `Menu`, `Menu.Trigger`, `Menu.Portal`, `Menu.Content`, `Menu.Sub`, `Menu.SubTrigger`, `Menu.SubContent`, `Menu.RadioGroup`, `Menu.RadioItem`), Tailwind v4, Vitest, Playwright. Shadow-DOM aware portal mounting via existing `ShadowRootContext`.

**Non-goals (explicit):**
- No change to `FilterState`, `applyFilters`, `getDistinctAssignees/Reporters/Labels`, due-date matchers, or any business logic in `features/sidebar/`.
- No change to `FilterChips` (it stays below the stats bar; the new menu is the editor, chips remain the at-a-glance display).
- No search input inside submenus for v1 — current Selects don't have search either; this is a strict surface upgrade for the trigger, parity for the option lists. Search is a follow-up.
- No new decree spec needed — SPEC-006 (status filtering), SPEC-018 (due-date) and PRD-015 are unaffected; filter behavior is untouched.

---

## Pre-flight checklist (do once, before Task 1)

- Confirm working tree is clean: `git status` → "nothing to commit".
- Confirm on `main` and up to date: `git checkout main && git pull --ff-only`.
- Build everything once so dependent packages are warm: `pnpm build`.

---

### Task 0: Create feature branch

**Files:** none (git only).

**Step 1: Branch off `main`**

Run:
```bash
git checkout -b feat/sidebar-filter-menu
```

Expected: `Switched to a new branch 'feat/sidebar-filter-menu'`.

**Step 2: Confirm starting tests pass for the area we'll touch**

Run:
```bash
pnpm --filter react-grab exec vitest run src/features/sidebar
```

Expected: all green (105 tests per the recent due-date refactor commit). Establishes our baseline — anything red after Task 9 is regression we caused.

---

### Task 1: Add `components/ui/menu.tsx` Kobalte wrapper

This mirrors the existing `select.tsx` wrapper pattern. We expose only the surface our consumer (`filter-menu.tsx`) will use; we can grow it later if more callers appear.

**Files:**
- Create: `packages/react-grab/src/components/ui/menu.tsx`

**Step 1: Read the reference wrapper**

Open `packages/react-grab/src/components/ui/select.tsx` and skim — note: how they thread `ShadowRootContext` for portal mounting (Kobalte dialogs/popovers must portal into the shadow root, not document.body), how they apply Tailwind classes via `splitProps`, how they re-export typed primitives.

**Step 2: Implement the wrapper**

Create `packages/react-grab/src/components/ui/menu.tsx`:

```tsx
import { Menu as KMenu } from "@kobalte/core/menu";
import { useContext, splitProps, type Component, type ComponentProps, type JSX } from "solid-js";
import { ShadowRootContext } from "../../core/shadow-root-context.js";
import { cn } from "../../utils/cn.js";

export const Menu = KMenu;

export const MenuTrigger: Component<ComponentProps<typeof KMenu.Trigger>> = (props) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <KMenu.Trigger
      class={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 h-7 text-[11px] text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring data-[expanded]:border-primary data-[expanded]:bg-accent disabled:opacity-50",
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </KMenu.Trigger>
  );
};

export const MenuContent: Component<ComponentProps<typeof KMenu.Content>> = (props) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  const shadowRoot = useContext(ShadowRootContext);
  return (
    <KMenu.Portal mount={shadowRoot ?? undefined}>
      <KMenu.Content
        class={cn(
          "z-50 min-w-[14rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none",
          local.class,
        )}
        {...rest}
      >
        {local.children}
      </KMenu.Content>
    </KMenu.Portal>
  );
};

export const MenuSub: Component<ComponentProps<typeof KMenu.Sub>> = (props) => (
  <KMenu.Sub {...props} />
);

export const MenuSubTrigger: Component<ComponentProps<typeof KMenu.SubTrigger>> = (props) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <KMenu.SubTrigger
      class={cn(
        "flex cursor-default select-none items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-[12px] outline-none data-[highlighted]:bg-accent data-[expanded]:bg-accent",
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </KMenu.SubTrigger>
  );
};

export const MenuSubContent: Component<ComponentProps<typeof KMenu.SubContent>> = (props) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  const shadowRoot = useContext(ShadowRootContext);
  return (
    <KMenu.Portal mount={shadowRoot ?? undefined}>
      <KMenu.SubContent
        class={cn(
          "z-50 min-w-[12rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none",
          local.class,
        )}
        {...rest}
      />
    </KMenu.Portal>
  );
};

export const MenuItem: Component<ComponentProps<typeof KMenu.Item>> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <KMenu.Item
      class={cn(
        "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-[12px] outline-none data-[highlighted]:bg-accent",
        local.class,
      )}
      {...rest}
    />
  );
};

export const MenuRadioGroup: Component<ComponentProps<typeof KMenu.RadioGroup>> = (props) => (
  <KMenu.RadioGroup {...props} />
);

export const MenuRadioItem: Component<ComponentProps<typeof KMenu.RadioItem>> = (props) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <KMenu.RadioItem
      class={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-sm py-1.5 pl-7 pr-2 text-[12px] outline-none data-[highlighted]:bg-accent",
        local.class,
      )}
      {...rest}
    >
      <span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <KMenu.ItemIndicator>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </KMenu.ItemIndicator>
      </span>
      {local.children}
    </KMenu.RadioItem>
  );
};

export const MenuSeparator: Component<ComponentProps<typeof KMenu.Separator>> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return <KMenu.Separator class={cn("my-1 h-px bg-border", local.class)} {...rest} />;
};

export type MenuTriggerProps = ComponentProps<typeof MenuTrigger>;
```

**Step 3: Confirm imports resolve**

Run:
```bash
pnpm --filter react-grab typecheck
```

Expected: PASS. (No consumer of menu.tsx yet, but the file itself must typecheck.)

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/ui/menu.tsx
git commit -m "feat(ui): add Menu primitive wrapping Kobalte Menu"
```

---

### Task 2: Scaffold `filter-menu.tsx` with the trigger + active count

We build the trigger first (icon + "Filter" + badge), with no submenus yet, just an empty popover. This isolates the trigger styling and the activeCount derivation from the per-filter rows.

**Files:**
- Create: `packages/react-grab/src/components/sidebar/filter-menu.tsx`

**Step 1: Define the props interface and active-count helper**

Create `packages/react-grab/src/components/sidebar/filter-menu.tsx`:

```tsx
import { type Component, Show } from "solid-js";
import type { FilterState } from "../../features/sidebar/filter-state.js";
import { Menu, MenuTrigger, MenuContent } from "../ui/menu.js";
import { Button } from "../ui/button.js";

interface FilterMenuProps {
  filter: FilterState;
  assignees: string[];
  reporters: string[];
  labels: string[];
  onFilterChange: (filter: FilterState) => void;
}

const countActive = (filter: FilterState): number => {
  let n = 0;
  if (filter.statuses.size > 0) n += 1;
  if (filter.assignee !== null) n += 1;
  if (filter.reporter !== null) n += 1;
  if (filter.label !== null) n += 1;
  if (filter.dueDatePreset !== null) n += 1;
  return n;
};

const emptyFilter = (): FilterState => ({
  statuses: new Set(),
  assignee: null,
  reporter: null,
  label: null,
  dueDatePreset: null,
});

export const FilterMenu: Component<FilterMenuProps> = (props) => {
  const activeCount = () => countActive(props.filter);
  const handleClear = () => props.onFilterChange(emptyFilter());

  return (
    <div data-react-grab-filter-menu class="flex items-center gap-1.5 px-4 py-2 border-b border-border">
      <Menu>
        <MenuTrigger
          aria-label="Filter"
          class="relative"
          classList={{ "border-primary/50": activeCount() > 0 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18" /><path d="M7 12h10" /><path d="M11 18h2" />
          </svg>
          <span class="text-muted-foreground font-medium">Filter</span>
          <Show when={activeCount() > 0}>
            <span
              data-react-grab-filter-badge
              class="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold inline-flex items-center justify-center ring-2 ring-background"
            >
              {activeCount()}
            </span>
          </Show>
        </MenuTrigger>
        <MenuContent>
          {/* per-filter rows added in tasks 3-7 */}
        </MenuContent>
      </Menu>

      <Show when={activeCount() > 0}>
        <Button
          variant="ghost"
          size="sm"
          class="text-[10px] text-muted-foreground hover:text-foreground h-auto py-0.5 px-1.5 whitespace-nowrap"
          onClick={handleClear}
          data-react-grab-filter-clear
        >
          ✕ Clear
        </Button>
      </Show>
    </div>
  );
};
```

**Step 2: Typecheck**

Run:
```bash
pnpm --filter react-grab typecheck
```

Expected: PASS.

**Step 3: Commit (don't wire it in yet — sidebar still uses FilterBar)**

```bash
git add packages/react-grab/src/components/sidebar/filter-menu.tsx
git commit -m "feat(sidebar): scaffold FilterMenu with trigger + badge + clear"
```

---

### Task 3: Add Status filter row + submenu

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/filter-menu.tsx`

**Step 1: Add the imports**

At the top of `filter-menu.tsx`, add:

```tsx
import { For } from "solid-js";
import { ALL_ATT_STATUSES } from "../../features/sidebar/status-colors.js";
import { MenuSub, MenuSubTrigger, MenuSubContent, MenuRadioGroup, MenuRadioItem } from "../ui/menu.js";
```

**Step 2: Add the helper for current value display**

Inside the component (above the `return`):

```tsx
const STATUS_ALL = "";
const handleStatusChange = (value: string) => {
  const statuses = value === STATUS_ALL ? new Set<string>() : new Set([value]);
  props.onFilterChange({ ...props.filter, statuses });
};
const currentStatus = () => [...props.filter.statuses][0] ?? STATUS_ALL;
const currentStatusLabel = () => {
  const v = currentStatus();
  return v === STATUS_ALL ? "All" : v;
};
```

**Step 3: Add the Status row inside `<MenuContent>`**

Replace the placeholder comment:

```tsx
<MenuSub overlap gutter={8} shift={-4}>
  <MenuSubTrigger data-react-grab-filter-row="status" data-active={props.filter.statuses.size > 0 ? "true" : "false"}>
    <span class="flex items-center gap-2">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /></svg>
      <span class="text-foreground font-medium">Status</span>
    </span>
    <span class="flex items-center gap-1">
      <span
        class="text-[11px]"
        classList={{
          "text-primary": props.filter.statuses.size > 0,
          "text-muted-foreground": props.filter.statuses.size === 0,
        }}
      >{currentStatusLabel()}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg>
    </span>
  </MenuSubTrigger>
  <MenuSubContent>
    <MenuRadioGroup value={currentStatus()} onChange={handleStatusChange}>
      <MenuRadioItem value={STATUS_ALL}>All Statuses</MenuRadioItem>
      <MenuRadioItem value="No Task">No Task</MenuRadioItem>
      <For each={ALL_ATT_STATUSES}>
        {(status) => <MenuRadioItem value={status}>{status}</MenuRadioItem>}
      </For>
    </MenuRadioGroup>
  </MenuSubContent>
</MenuSub>
```

**Step 4: Typecheck**

Run:
```bash
pnpm --filter react-grab typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/react-grab/src/components/sidebar/filter-menu.tsx
git commit -m "feat(sidebar): add Status filter row to FilterMenu"
```

---

### Task 4: Add Assignee filter row + submenu

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/filter-menu.tsx`

**Step 1: Add handler + label helpers**

Inside the component, near the status helpers:

```tsx
const handleAssigneeChange = (value: string) => {
  props.onFilterChange({ ...props.filter, assignee: value === "" ? null : value });
};
const currentAssigneeValue = () => props.filter.assignee ?? "";
const currentAssigneeLabel = () => props.filter.assignee ?? "All";
```

**Step 2: Add the Assignee `MenuSub` directly below the Status one** (same shape as Status, swap labels/options):

```tsx
<MenuSub overlap gutter={8} shift={-4}>
  <MenuSubTrigger data-react-grab-filter-row="assignee" data-active={props.filter.assignee !== null ? "true" : "false"}>
    <span class="flex items-center gap-2">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
      <span class="text-foreground font-medium">Assignee</span>
    </span>
    <span class="flex items-center gap-1">
      <span
        class="text-[11px] max-w-[120px] truncate"
        classList={{
          "text-primary": props.filter.assignee !== null,
          "text-muted-foreground": props.filter.assignee === null,
        }}
      >{currentAssigneeLabel()}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg>
    </span>
  </MenuSubTrigger>
  <MenuSubContent>
    <MenuRadioGroup value={currentAssigneeValue()} onChange={handleAssigneeChange}>
      <MenuRadioItem value="">All Assignees</MenuRadioItem>
      <For each={props.assignees}>
        {(name) => <MenuRadioItem value={name}>{name}</MenuRadioItem>}
      </For>
    </MenuRadioGroup>
  </MenuSubContent>
</MenuSub>
```

**Step 3: Typecheck + commit**

```bash
pnpm --filter react-grab typecheck
git add packages/react-grab/src/components/sidebar/filter-menu.tsx
git commit -m "feat(sidebar): add Assignee filter row to FilterMenu"
```

---

### Task 5: Add Reporter filter row + submenu

Identical pattern to Task 4 (swap "assignee" → "reporter"; swap icon to the reporter SVG from `filter-bar.tsx:107`; swap data attribute value).

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/filter-menu.tsx`

**Step 1: Helpers, row, submenu** — copy Task 4's structure with:
- `handleReporterChange`, `currentReporterValue`, `currentReporterLabel`
- `data-react-grab-filter-row="reporter"`
- icon: `<svg ...><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-6"/></svg>`
- options driven by `props.reporters`
- "All Reporters" placeholder

**Step 2: Typecheck + commit**

```bash
pnpm --filter react-grab typecheck
git add packages/react-grab/src/components/sidebar/filter-menu.tsx
git commit -m "feat(sidebar): add Reporter filter row to FilterMenu"
```

---

### Task 6: Add Label filter row + submenu (conditional on `labels.length > 0`)

This mirrors the existing `<Show when={props.labels.length > 0}>` guard in `filter-bar.tsx:122-139`.

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/filter-menu.tsx`

**Step 1: Helpers** (next to other handlers):

```tsx
const handleLabelChange = (value: string) => {
  props.onFilterChange({ ...props.filter, label: value === "" ? null : value });
};
const currentLabelValue = () => props.filter.label ?? "";
const currentLabelLabel = () => props.filter.label ?? "All";
```

**Step 2: Wrap a `<Show>` around the row**:

```tsx
<Show when={props.labels.length > 0}>
  <MenuSub overlap gutter={8} shift={-4}>
    <MenuSubTrigger data-react-grab-filter-row="label" data-active={props.filter.label !== null ? "true" : "false"}>
      <span class="flex items-center gap-2">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
          <circle cx="7" cy="7" r="1.5"/>
        </svg>
        <span class="text-foreground font-medium">Label</span>
      </span>
      <span class="flex items-center gap-1">
        <span
          class="text-[11px] max-w-[120px] truncate"
          classList={{
            "text-primary": props.filter.label !== null,
            "text-muted-foreground": props.filter.label === null,
          }}
        >{currentLabelLabel()}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg>
      </span>
    </MenuSubTrigger>
    <MenuSubContent>
      <MenuRadioGroup value={currentLabelValue()} onChange={handleLabelChange}>
        <MenuRadioItem value="">All Labels</MenuRadioItem>
        <For each={props.labels}>
          {(name) => <MenuRadioItem value={name}>{name}</MenuRadioItem>}
        </For>
      </MenuRadioGroup>
    </MenuSubContent>
  </MenuSub>
</Show>
```

**Step 3: Typecheck + commit**

```bash
pnpm --filter react-grab typecheck
git add packages/react-grab/src/components/sidebar/filter-menu.tsx
git commit -m "feat(sidebar): add Label filter row to FilterMenu"
```

---

### Task 7: Add Due-date filter row + submenu (preserve `data-react-grab-due-date-filter`)

This is the most contract-sensitive row — the E2E test at `packages/react-grab/e2e/mocked/due-date-filter.spec.ts:61` queries `[data-react-grab-due-date-filter]` to find the trigger. We must put that attribute on the **`MenuSubTrigger`** so the test's `boundingCentreOfDueDateTrigger` continues to find it. The test will still need to be updated to first open the parent menu; that's Task 10.

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/filter-menu.tsx`

**Step 1: Imports**

Add at top:

```tsx
import {
  type DueDatePreset,
  DUE_DATE_PRESET_ORDER,
  DUE_DATE_PRESET_LABEL_ALL,
  dueDatePresetLabel,
} from "../../features/sidebar/due-date/index.js";
```

**Step 2: Helpers**

```tsx
const handleDueDateChange = (value: string) => {
  const preset = value === "" ? null : (value as DueDatePreset);
  props.onFilterChange({ ...props.filter, dueDatePreset: preset });
};
const currentDueValue = () => props.filter.dueDatePreset ?? "";
const currentDueLabel = () =>
  props.filter.dueDatePreset === null
    ? "All"
    : dueDatePresetLabel(props.filter.dueDatePreset);
```

**Step 3: Row**

Place after the Label `<Show>`:

```tsx
<MenuSub overlap gutter={8} shift={-4}>
  <MenuSubTrigger
    data-react-grab-filter-row="due-date"
    data-react-grab-due-date-filter
    data-active={props.filter.dueDatePreset !== null ? "true" : "false"}
  >
    <span class="flex items-center gap-2">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      <span class="text-foreground font-medium">Due date</span>
    </span>
    <span class="flex items-center gap-1">
      <span
        class="text-[11px]"
        classList={{
          "text-primary": props.filter.dueDatePreset !== null,
          "text-muted-foreground": props.filter.dueDatePreset === null,
        }}
      >{currentDueLabel()}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg>
    </span>
  </MenuSubTrigger>
  <MenuSubContent>
    <MenuRadioGroup value={currentDueValue()} onChange={handleDueDateChange}>
      <MenuRadioItem value="">{DUE_DATE_PRESET_LABEL_ALL}</MenuRadioItem>
      <For each={DUE_DATE_PRESET_ORDER}>
        {(preset) => <MenuRadioItem value={preset}>{dueDatePresetLabel(preset)}</MenuRadioItem>}
      </For>
    </MenuRadioGroup>
  </MenuSubContent>
</MenuSub>
```

**Step 4: Typecheck + commit**

```bash
pnpm --filter react-grab typecheck
git add packages/react-grab/src/components/sidebar/filter-menu.tsx
git commit -m "feat(sidebar): add Due-date filter row to FilterMenu"
```

---

### Task 8: Wire `FilterMenu` into the sidebar (replace `FilterBar`)

Now we swap the consumer. `FilterBar` and its file get deleted; `FilterChips` stays.

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/index.tsx:20, 248-254`
- Delete: `packages/react-grab/src/components/sidebar/filter-bar.tsx`

**Step 1: Swap the import at `index.tsx:20`**

```diff
-import { FilterBar } from "./filter-bar.js";
+import { FilterMenu } from "./filter-menu.js";
```

**Step 2: Swap the JSX at `index.tsx:248-254`**

```diff
-                <FilterBar
+                <FilterMenu
                   filter={filterState()}
                   assignees={getDistinctAssignees(userFacingGroups())}
                   reporters={getDistinctReporters(userFacingGroups())}
                   labels={getDistinctLabels(userFacingGroups())}
                   onFilterChange={setFilterState}
                 />
```

**Step 3: Delete `filter-bar.tsx`**

Run:
```bash
git rm packages/react-grab/src/components/sidebar/filter-bar.tsx
```

**Step 4: Confirm nothing else imports it**

Use Serena to verify no orphan references:

```
mcp__serena__find_symbol with name_path_pattern="FilterBar" — should return zero hits.
```

If a hit appears anywhere except the deleted file (e.g. an old test or doc), delete the reference too.

**Step 5: Typecheck + lint**

```bash
pnpm --filter react-grab typecheck
pnpm --filter react-grab exec oxlint src/components/sidebar
```

Expected: both PASS.

**Step 6: Commit**

```bash
git add packages/react-grab/src/components/sidebar/index.tsx
git commit -m "refactor(sidebar): swap FilterBar for FilterMenu, delete legacy file"
```

---

### Task 9: Run sidebar feature unit tests (smoke regression check)

The business logic in `features/sidebar/` is untouched, so all 105 tests must still pass. If any fail, the swap broke something we didn't expect.

**Files:** none (test run only).

**Step 1: Run**

```bash
pnpm --filter react-grab exec vitest run src/features/sidebar
```

Expected: 105/105 PASS (matches the baseline taken in Task 0 step 2).

**Step 2: If any fail, STOP and diagnose** — do not proceed to Task 10. The most likely culprits are: an accidental change to `filter-state.ts` re-exports during Task 7 imports, or an oxfmt auto-format of a test snapshot.

---

### Task 10: Update the due-date E2E helpers + run @SPEC-018 suite

The existing test in `packages/react-grab/e2e/mocked/due-date-filter.spec.ts` was written against the inline `<Select>`. Two things must change:

1. **Open the parent menu first.** `openDueDateFilter` currently clicks `[data-react-grab-due-date-filter]` directly. After our change it must (a) click the new `[data-react-grab-filter-menu] button` (the trigger), then (b) hover or click `[data-react-grab-due-date-filter]` (now the SubTrigger) to open the submenu.
2. **Option role.** Kobalte Menu uses `role="menuitemradio"`, not `role="option"`. `boundingCentreOfOptionByLabel` queries `role='option'` (line 79) and the close-poll on line 116 also uses `role='option'`. Both selectors need to accept either `option` or `menuitemradio`.
3. **Clear text preserved.** Our new component still emits "✕ Clear", so `clickClearFilters` keeps working as-is.

**Files:**
- Modify: `packages/react-grab/e2e/mocked/due-date-filter.spec.ts:55-138`

**Step 1: Update `boundingCentreOfDueDateTrigger`** to compose menu-open + sub-trigger find. Replace lines 57-67 with:

```ts
const openFilterMenu = (page: import("@playwright/test").Page) =>
  page.evaluate((attrName) => {
    const host = document.querySelector(`[${attrName}]`);
    const root = host?.shadowRoot;
    const trigger = root?.querySelector(
      "[data-react-grab-filter-menu] button",
    ) as HTMLElement | null;
    if (!trigger) return false;
    trigger.click();
    return true;
  }, ATTR);

const boundingCentreOfDueDateTrigger = (page: import("@playwright/test").Page) =>
  page.evaluate((attrName) => {
    const host = document.querySelector(`[${attrName}]`);
    // SubTrigger lives inside the portalled menu content — it may render in
    // either the host shadow root or, if Kobalte falls back, document.
    const root = host?.shadowRoot ?? document;
    const el = root.querySelector("[data-react-grab-due-date-filter]") as
      | HTMLElement
      | null;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }, ATTR);
```

**Step 2: Update `openDueDateFilter`** (lines 89-98) to open the parent menu first, then click the sub-trigger:

```ts
const openDueDateFilter = async (
  page: import("@playwright/test").Page,
) => {
  await expect.poll(() => openFilterMenu(page), { timeout: 5000 }).toBe(true);
  await expect
    .poll(() => boundingCentreOfDueDateTrigger(page), { timeout: 5000 })
    .not.toBeNull();
  const box = await boundingCentreOfDueDateTrigger(page);
  if (!box) throw new Error("due-date trigger not found");
  await page.mouse.click(box.x, box.y);
};
```

**Step 3: Update the option role queries** (lines 78-79 and 116) — replace `"[role='option']"` with `"[role='option'], [role='menuitemradio']"`.

**Step 4: Run the spec to confirm parity**

```bash
pnpm --filter react-grab exec playwright test e2e/mocked/due-date-filter.spec.ts --project=chromium
```

Expected: 6/6 PASS (matches the original SPEC-018 suite).

**Step 5: If a test fails because the radio item label includes the indicator's checkmark, update `boundingCentreOfOptionByLabel`** to compare on a normalized text (strip the SVG-rendered checkmark — usually `textContent` is fine because SVGs have empty `textContent`, but verify).

**Step 6: Commit**

```bash
git add packages/react-grab/e2e/mocked/due-date-filter.spec.ts
git commit -m "test(e2e): adapt due-date filter helpers to FilterMenu"
```

---

### Task 11: Run the broader filter-related E2E suites

These are the suites most likely to be sensitive to the surface change.

**Files:** none (test runs only).

**Step 1: Run @SPEC-006 (status filtering) tests**

```bash
pnpm --filter react-grab exec playwright test e2e/overlay-filtering.spec.ts --project=chromium
```

Expected: PASS.

**Step 2: Run all SPEC-tagged mocked tests touching filter UI**

```bash
pnpm --filter react-grab exec playwright test e2e/mocked/ --project=chromium --grep "@SPEC-006|@SPEC-018"
```

Expected: PASS.

**Step 3: If a test still references "All Statuses" / "All Assignees" / "All Reporters" / "All Labels" placeholder text** — those texts now live inside menu items, not as the trigger placeholder. Update the test to either: (a) open the menu and assert on the item text, or (b) assert on the new `data-active="false"` attribute on the row trigger. Pick whichever matches the test's original intent.

**Step 4: Commit any test changes**

```bash
git add packages/react-grab/e2e
git commit -m "test(e2e): adapt remaining filter selectors to FilterMenu"
```

---

### Task 12: Visual verification

Confirm the menu actually looks like POC variant B in a real browser, and that the Shadow-DOM portal mounting works (no z-index or click-outside bugs).

**Files:** none (manual verification).

**Step 1: Boot the e2e-app**

```bash
pnpm dev          # terminal 1 — library watch
pnpm --filter @react-grab/e2e-app dev   # terminal 2 — e2e-app on :5175
```

**Step 2: Open the e2e-app**

Visit `http://localhost:5175`, open the sidebar, then:
- Confirm the bar shows: `Filter` button (icon + label), no badge initially.
- Click `Filter` → popover opens listing 5 rows (or 4 if no labels exist in the seed).
- Hover each row → submenu cascades to the right with options.
- Pick `In Progress` under Status → menu closes, badge appears with `1`, the Clear button appears, and the selection list filters down.
- Pick an Assignee → badge ticks to `2`.
- Click `✕ Clear` → both badge and clear button disappear; filtered list returns to full.

**Step 3: Take a Playwright screenshot for the PR**

```bash
pnpm --filter react-grab exec playwright test e2e/mocked/due-date-filter.spec.ts --project=chromium --headed --grep "AC-1"
```

Watch the headed run to confirm no visual glitches.

**Step 4: If the menu portals into `document.body` instead of the shadow root** (visible as a `<div>` appended to body in DevTools, or as a menu rendered with the host page's CSS), inspect `MenuContent` / `MenuSubContent` `mount` prop wiring. Cross-check with `select.tsx` for the canonical pattern. Fix and re-test.

---

### Task 13: Lint + format + typecheck the whole package, then summary commit

**Files:** none (CI parity).

**Step 1: Format**

```bash
pnpm --filter react-grab exec oxfmt
```

**Step 2: Lint**

```bash
pnpm --filter react-grab exec oxlint
```

Expected: zero errors.

**Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: zero errors across all packages (consumers of react-grab unchanged).

**Step 4: If oxfmt produced changes, commit them**

```bash
git add -u
git commit -m "chore: oxfmt FilterMenu"
```

---

### Task 14: Merge to `main` (`--no-ff`)

Per the user's branch workflow preference (always merge feature branches with `--no-ff`).

**Step 1: Update `main`**

```bash
git checkout main
git pull --ff-only
```

**Step 2: Merge with explicit merge commit**

```bash
git merge --no-ff feat/sidebar-filter-menu -m "Merge branch 'feat/sidebar-filter-menu'"
```

Expected: a merge commit on `main` referencing all the per-task commits.

**Step 3: Confirm tree state**

```bash
git log --oneline -5
git status
```

Expected: top entry is the merge commit, working tree clean.

**Step 4: (Optional) Delete the local branch**

```bash
git branch -d feat/sidebar-filter-menu
```

---

## Done criteria (definition of "complete")

- [ ] `filter-bar.tsx` deleted; `filter-menu.tsx` is the only filter editor.
- [ ] Sidebar renders the trigger as: filter icon + "Filter" + count badge (when active) + inline "✕ Clear" (when active).
- [ ] All 5 filter dimensions reachable via nested submenus, single-select within each, "All ___" entry per submenu resets that dimension.
- [ ] `FilterChips` still renders below the bar with no behavior change.
- [ ] `pnpm --filter react-grab exec vitest run src/features/sidebar` → 105/105.
- [ ] `pnpm --filter react-grab exec playwright test e2e/overlay-filtering.spec.ts e2e/mocked/due-date-filter.spec.ts --project=chromium` → all PASS.
- [ ] `pnpm typecheck`, `pnpm --filter react-grab exec oxlint`, `pnpm --filter react-grab exec oxfmt --check` → all clean.
- [ ] Manual smoke in the e2e-app confirms the popover portals into the shadow root and dismisses on outside click / Escape.

---

## Risks and gotchas

- **Shadow-DOM portal mounting** — Kobalte's `Menu.Portal` defaults to `document.body`. We override with `mount={shadowRoot}`. If a submenu fails to render, this is the first place to look. The reference is `select.tsx` (working today).
- **Type-ahead inside submenus** — Kobalte's Menu has built-in keyboard type-ahead. With many assignees (50+) this may feel awkward but is a parity match for current Select behavior. Search input is intentionally deferred.
- **Click capture inside the overlay** — the bar lives inside the React Grab overlay shadow root; the existing `data-react-grab-ignore-events` boundary on the sidebar root already covers us, but verify by clicking the menu in the e2e-app and confirming no underlying page element fires.
- **Test flakiness from menu animation** — Kobalte uses `data-expanded` which appears synchronously, but visual transitions may not be done when Playwright clicks. The existing helpers use `expect.poll` which absorbs this. Keep that pattern in any new helpers.
- **`role="menuitemradio"` vs `role="option"`** — already addressed in Task 10 by accepting both selectors. If new E2E helpers are written elsewhere, follow the same dual-selector pattern.
