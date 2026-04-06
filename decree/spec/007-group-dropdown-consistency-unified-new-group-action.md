---
status: draft
date: 2026-04-06
references:
- PRD-002
- ADR-0005
---

# SPEC-007 Group Dropdown Consistency — Unified New Group Action

## Overview

Two bugs affect the group dropdown in the selection popup (`SelectionLabel` → `GroupPickerFlyout`):

**Bug 1 — Missing "New group..." action.** Two surfaces render a group dropdown but behave differently:
- **Selection popup** (`GroupPickerFlyout`): shows existing groups only, no way to create a new one.
- **Toolbar comments button** (`CommentsDropdown`): shows groups AND a "New group..." inline input that calls `onAddGroup`.

A user can assign a selection to a group but cannot create one without first opening the toolbar comments panel.

**Bug 2 — Groups not visible when using sync server.** When `initSync(config)` is configured, groups loaded from the server never reach the SolidJS signal powering both dropdowns. `createSelectionGroups` initializes `rawGroups` synchronously from `loadGroups()` (localStorage) during main init. `initSync` — a separate exported async function — later calls `initGroupStorage(adapter)` which overwrites the module-level `groups` variable with server data, but **never calls `selectionGroups.setGroups()`**. The signal stays at the stale localStorage snapshot for the entire session, so both the selection popup flyout and the CommentsDropdown show only the Default group.

## Technical Design

### Current state

`GroupPickerFlyout` (`src/features/selection-groups/components/group-picker-flyout.tsx`) accepts:

```ts
interface GroupPickerFlyoutProps {
  groups: SelectionGroup[];
  activeGroupId?: string;
  excludeGroupId?: string;
  onSelect: (groupId: string) => void;
  onClose: () => void;
}
```

It renders a flat list of group buttons. There is no `onAddGroup` prop and no creation UI.

`CommentsDropdown` (`src/components/comments-dropdown.tsx`, lines 459–475) independently renders a "New group..." section:

```tsx
<div class="border-t border-[#D9D9D9] px-2 py-1.5">
  <div class="flex items-center gap-1.5">
    <svg>/* + icon */</svg>
    <input
      type="text"
      placeholder="New group..."
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.currentTarget.value.trim()) {
          props.onAddGroup?.(e.currentTarget.value.trim());
          e.currentTarget.value = "";
        }
      }}
    />
  </div>
</div>
```

`SelectionLabel` passes no `onAddGroup` to `GroupPickerFlyout`, and `GroupPickerFlyout` has no such prop.

### Proposed change

**1. Extend `GroupPickerFlyoutProps`**

Add an optional `onAddGroup` callback:

```ts
interface GroupPickerFlyoutProps {
  groups: SelectionGroup[];
  activeGroupId?: string;
  excludeGroupId?: string;
  onSelect: (groupId: string) => void;
  onClose: () => void;
  onAddGroup?: (name: string) => void; // NEW
}
```

When `onAddGroup` is provided, render the "New group..." inline input at the bottom of the flyout — visually identical to `CommentsDropdown`'s implementation (border-top separator, `+` icon, plain text input, submit on Enter, clear after submit).

**2. Wire `onAddGroup` in `SelectionLabel`**

In `src/components/selection-label/index.tsx`, where `GroupPickerFlyout` is rendered, pass the group creation handler from the `SelectionGroupsAPI`:

```tsx
<GroupPickerFlyout
  groups={groups()}
  activeGroupId={activeGroupId()}
  onSelect={...}
  onClose={...}
  onAddGroup={(name) => props.onAddGroup?.(name)}  // NEW
/>
```

`props.onAddGroup` already exists on `SelectionGroupsViewProps` and is wired to `handleAddGroup` in the core API — no new API surface needed.

**3. No change to `CommentsDropdown`**

`CommentsDropdown` keeps its own inline implementation. Once `GroupPickerFlyout` has the same UI, the two surfaces are visually and functionally consistent. A future refactor could extract the "New group..." section into a shared sub-component, but that is out of scope here.

### Rendering constraints (ADR-0005)

The inline input approach (plain `<input type="text">`) is Shadow DOM safe — it does not use `<dialog>` or any portal that would break in Shadow DOM context. This is consistent with ADR-0005's decision to avoid native dialogs inside the shadow root.

### Data flow

```
SelectionLabel
  └── GroupPickerFlyout (onAddGroup prop)
        └── "New group..." input
              └── onAddGroup(name)
                    └── props.onAddGroup (SelectionGroupsViewProps)
                          └── handleAddGroup(name) in SelectionGroupsAPI
                                └── persistGroups(nextGroups)
```

No new state, no new API. The only change is threading an existing callback one level deeper.

---

### Bug 2 fix — Signal not updated after `initSync`

#### Root cause

```
main init (sync)
  createSelectionGroups()
    rawGroups = createSignal(loadGroups())   ← captures localStorage snapshot
    ...

later (async, user-called)
  initSync(config)
    initGroupStorage(adapter)
      groups = await adapter.loadGroups()   ← updates module var
      // ← selectionGroups.setGroups() never called
      // signal remains stale
```

`initSync` (`src/core/index.tsx`, exported at module scope) has no reference to the `selectionGroups` instance created inside the main init closure. After `initGroupStorage` resolves, nothing bridges the module-level `groups` variable back to the SolidJS signal.

#### Fix — register an `onGroupsLoaded` callback in `group-storage.ts`

**1. Add callback registration to `group-storage.ts`:**

```ts
let onGroupsLoadedCallback: ((groups: SelectionGroup[]) => void) | null = null;

export const registerGroupsLoadedCallback = (
  cb: (groups: SelectionGroup[]) => void,
): void => {
  onGroupsLoadedCallback = cb;
};

export const initGroupStorage = async (adapter: StorageAdapter): Promise<void> => {
  activeAdapter = adapter;
  groups = await adapter.loadGroups();
  onGroupsLoadedCallback?.(groups); // ← NEW
};
```

**2. Register the callback in main init after `createSelectionGroups`:**

```ts
const selectionGroups = createSelectionGroups({ ... });
registerGroupsLoadedCallback((loaded) => selectionGroups.setGroups(loaded));
```

`selectionGroups.setGroups` is already exposed by `createSelectionGroups` (`setGroups = setRawGroups`). The callback fires once, after `initGroupStorage` resolves, flushing server groups into the reactive signal. All downstream consumers — both `CommentsDropdown` and `SelectionLabel`/`GroupPickerFlyout` — update automatically via SolidJS reactivity.

#### Data flow after fix

```
initSync(config)
  initGroupStorage(adapter)
    groups = await adapter.loadGroups()
    onGroupsLoadedCallback(groups)
      selectionGroups.setGroups(groups)   ← signal updated
        selectionGroups.groups()          ← reactive, re-evaluates
          ReactGrabRenderer groups prop   ← SolidJS getter, propagates
            CommentsDropdown              ← shows server groups
            SelectionLabel → GroupPickerFlyout ← shows server groups
```

#### localStorage-only path (no adapter)

Unaffected. `loadGroups()` at `createSignal` time already returns the correct localStorage value. `initGroupStorage` is never called, so `onGroupsLoadedCallback` never fires.

## Testing Strategy

**Unit — `GroupPickerFlyout`:**
- When `onAddGroup` is not provided: the "New group..." section is not rendered.
- When `onAddGroup` is provided: the section renders with a `+` icon and a text input with placeholder "New group...".
- Typing a name and pressing Enter calls `onAddGroup` with the trimmed value.
- Pressing Enter with an empty/whitespace-only input does not call `onAddGroup`.
- After a successful submission the input is cleared.
- Pressing keys other than Enter does not call `onAddGroup`.

**Integration — `SelectionLabel`:**
- When a selection is active, the group dropdown button is visible.
- Opening the dropdown shows the "New group..." input.
- Typing a new group name and pressing Enter creates the group and it appears in subsequent dropdown opens.

**Visual regression:**
- Flyout with `onAddGroup`: screenshot matches the "New group..." section in `CommentsDropdown` (border-top, `+` icon, same input styling).
- Flyout without `onAddGroup`: no visual change from current state.

**Unit — group signal sync (Bug 2):**
- After `initGroupStorage(adapter)` resolves, `onGroupsLoadedCallback` is called with the loaded groups.
- `selectionGroups.groups()` reflects server-loaded groups after the callback fires.
- When no adapter is used, `onGroupsLoadedCallback` is never called and the signal retains its localStorage-initialized value.

**Integration — end-to-end sync (Bug 2):**
- Configure a StorageAdapter returning `[Default, "Feature A"]`.
- After `initSync` resolves, the `SelectionLabel` flyout shows both groups.
- After `initSync` resolves, the `CommentsDropdown` group list shows both groups.

## Acceptance Criteria

- [ ] `GroupPickerFlyoutProps` has an optional `onAddGroup?: (name: string) => void` prop
- [ ] When `onAddGroup` is not passed, the flyout renders identically to today (no regression)
- [ ] When `onAddGroup` is passed, a "New group..." inline input appears at the bottom of the flyout, separated by a border-top
- [ ] Submitting via Enter calls `onAddGroup` with the trimmed name and clears the input
- [ ] Empty/whitespace input does not trigger `onAddGroup`
- [ ] `SelectionLabel` passes `onAddGroup` from `SelectionGroupsViewProps` to `GroupPickerFlyout`
- [ ] Creating a group from the selection popup persists and appears in both surfaces
- [ ] Unit tests cover all `GroupPickerFlyout` input behaviors (6 cases above)
- [ ] No native `<dialog>` or portal used (Shadow DOM safe — consistent with ADR-0005)
- [ ] `group-storage.ts` exports `registerGroupsLoadedCallback`
- [ ] `initGroupStorage` calls the registered callback after `adapter.loadGroups()` resolves
- [ ] Main init registers the callback to call `selectionGroups.setGroups(loaded)`
- [ ] After `initSync` resolves with a server adapter, `selectionGroups.groups()` returns server-loaded groups
- [ ] `SelectionLabel` flyout shows server-loaded groups without a page reload
- [ ] `CommentsDropdown` group list shows server-loaded groups without a page reload
- [ ] localStorage-only path is unaffected (no regression)

### Deferred (v2)

- [ ] Extract the "New group..." section into a shared `<NewGroupInput>` sub-component reused by both `GroupPickerFlyout` and `CommentsDropdown`
- [ ] Add search/filter to `GroupPickerFlyout` for parity with `CommentsDropdown` (only relevant when group count is high)
