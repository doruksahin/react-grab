# FilterMenu radio reactivity — root cause analysis

**Date:** 2026-04-16
**Branch:** `fix/spec-019-filter-menu-shadow-dom`
**Related:** SPEC-019, ADR-0005, ADR-0016

---

## 1. The bug (symptom)

When the user opens the sidebar filter menu and picks an option inside a submenu (e.g. Status → "Code Review"), three things are expected to update:

1. The **row label** in the parent menu (e.g. "Status: Code Review")
2. The **list of group cards** in the sidebar below the filter
3. The **checkmark (✓)** next to the selected radio item inside the submenu

User report: **1 and 2 update, 3 does not.** To see the checkmark move, the user has to close the whole filter menu and reopen it.

Screenshots (from user):
- Before click: "No Task" is checked, row label says "Status: No Task".
- After clicking "Code Review": row label correctly flips to "Status: Code Review", sidebar filters to match — but in the submenu the checkmark is still on "No Task".

---

## 2. Why this narrows the search

If reactivity were *entirely* broken, none of the three would update — we'd see a stale label AND a stale list AND a stale checkmark. But only the checkmark is stuck. That tells us:

- The underlying filter state signal (`filterState` in `packages/react-grab/src/components/sidebar/index.tsx:88`) **is** being updated.
- The signal's consumers **inside our own code** re-run correctly.
- Something specific to Kobalte's internal `<MenuRadioItem>` is not responding to the outer `value` prop changing.

So the bug lives at the boundary between **our code** and **Kobalte's internals**.

---

## 3. Quick refresher — Solid reactivity for juniors

Before the trace, a minimal mental model.

**Signals** are reactive values. In Solid you create one with `createSignal`:

```ts
const [count, setCount] = createSignal(0);
count();       // read — subscribes the current "listener" if there is one
setCount(1);   // write — re-runs every listener that subscribed
```

**Listeners** are things like `createMemo(fn)`, `createEffect(fn)`, and every reactive JSX expression. When `fn` runs, Solid sets a *current listener* global, so any `signal()` read inside records a subscription. When the signal changes, Solid re-runs all subscribed listeners.

**Two solid-js instances = two separate sets of globals.** If signal `A` was created by instance 1 and memo `B` is being tracked by instance 2, reading `A()` from inside `B` does **not** record a subscription, because instance 2 has its own "current listener" stack that instance 1 knows nothing about. When `A` changes, only instance 1 re-runs things it knows about — instance 2 has no idea anything happened.

That is the entire bug. The rest is evidence.

---

## 4. High-level flow of one user click

Here's what should happen when the user clicks "Code Review". I'll mark each arrow with which solid-js instance does the work (see §5 for why there are two).

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. User clicks <MenuRadioItem value="Code Review">                  │
│                                                                     │
│    Kobalte's MenuItemBase onPointerUp →                  [Kobalte] │
│    MenuRadioItem.onSelect →                                [Kobalte]│
│    context.setSelectedValue("Code Review") →              [Kobalte] │
│    createControllableSignal.setValue(...)                 [Kobalte] │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. Because the group is CONTROLLED (we pass `value={...}`),         │
│    createControllableSignal skips updating its internal state       │
│    and calls props.onChange(nextValue).                   [Kobalte] │
│                                                                     │
│    That onChange is handleStatusChange in filter-menu.tsx.          │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. handleStatusChange builds a new FilterState and calls            │
│    props.onFilterChange(newState) →                                 │
│    setFilterState(newState) in sidebar/index.tsx.        [react-grab]│
│                                                                     │
│    filterState signal now holds the new value.                      │
└─────────────────────────────────────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
 ┌─────────────┐        ┌─────────────┐        ┌──────────────┐
 │ Row label   │        │ Group list  │        │ Radio        │
 │ re-renders  │        │ re-filters  │        │ checkmark    │
 │ [react-grab]│        │ [react-grab]│        │ should flip  │
 │ ✅ WORKS     │        │ ✅ WORKS     │        │ [Kobalte]    │
 │             │        │             │        │ ❌ STUCK     │
 └─────────────┘        └─────────────┘        └──────────────┘
```

The two boxes marked `[react-grab]` succeed because those reactive effects were created by the **same** solid-js instance that owns the `filterState` signal. The third box marked `[Kobalte]` fails because the effect that would update `data-checked` was created by **a different** solid-js instance — and it doesn't know our signal changed.

---

## 5. Why there are two solid-js instances

### 5.1 What tsup is configured to do

File: `packages/react-grab/tsup.config.ts:53`

```ts
noExternal: ["clsx", "solid-js", "bippy"],
```

`noExternal` tells tsup: **"bundle these packages into the output dist instead of leaving them as runtime imports."** So `solid-js` is inlined into `react-grab`'s `dist/*.js` chunks — every call to `createSignal`, `createMemo`, etc. in our code resolves to a copy of solid-js that lives *inside the dist bundle*.

### 5.2 What actually ships in the dist

Checked with a simple grep of the built output:

```bash
$ grep -Eo "from['\"]@?[a-z-]+/[a-z-]+['\"]" packages/react-grab/dist/renderer-YPISIF4K.js | sort -u
from'@kobalte/core'
from'@tiptap/core'
from'@tiptap/extension-color'
...
```

`@kobalte/core` appears as an external import — it is **not** bundled. At runtime, the consumer's bundler (AdCreative's Vite) is the one that resolves `@kobalte/core` by walking `node_modules`.

### 5.3 What solid-js Kobalte uses

Kobalte is installed exactly once under pnpm:

```bash
$ ls node_modules/.pnpm | grep kobalte
@kobalte+core@0.13.11_solid-js@1.9.10
@kobalte+utils@0.9.1_solid-js@1.9.10
```

Good — there's only one copy. But when AdCreative's Vite loads this copy, every `import { createSignal } from "solid-js"` inside Kobalte's code resolves to `node_modules/solid-js/...`. That's a **different** solid-js module instance from the one bundled inside `react-grab/dist/`.

### 5.4 Summary of what's running

| Code | Which solid-js does it use? |
|---|---|
| `packages/react-grab/src/**/*.tsx` (including `filter-menu.tsx`, `sidebar/index.tsx`) | Instance **A** — bundled into `react-grab/dist/` |
| `@kobalte/core/*` components (`MenuRadioGroup`, `MenuItemBase`, etc.) | Instance **B** — resolved from consumer's `node_modules/solid-js` |

Signals created in A do not notify effects tracked in B. Effects created in B do not know when A's signals change.

---

## 6. Mapping the bug to this split

### 6.1 The row label — works (same instance)

File: `packages/react-grab/src/components/sidebar/filter-menu.tsx:177`

```tsx
<MenuSubTrigger data-react-grab-filter-row="status">
  ...
  <span class={valueClass(props.filter.statuses.size > 0)}>
    {currentStatusLabel()}   {/* text update effect */}
  </span>
</MenuSubTrigger>
```

The JSX lives inside `FilterMenu`, which is compiled as part of `react-grab`. The effect that swaps the text when `currentStatusLabel()` changes was created by **instance A**. `props.filter` is A's signal. A's listener subscribes to A's signal. A re-runs the effect. ✅

### 6.2 The sidebar list — works (same instance)

File: `packages/react-grab/src/components/sidebar/index.tsx:153-160`

```tsx
const filteredGroups = createMemo(() => {
  const filter = filterState();
  ...
});
```

Created inside `Sidebar` — instance A. Reads `filterState()` — A's signal. When it changes, A re-runs the memo, the `<GroupList>` consumer re-renders. ✅

### 6.3 The radio checkmark — stuck (cross-instance)

File: `node_modules/@kobalte/core/dist/chunk/LEK3K6R3.jsx:926-953`

```js
function MenuRadioGroup(props) {
  ...
  const [local, others] = splitProps10(mergedProps, ["value", ...]);
  const [selected, setSelected] = createControllableSignal({
    value: () => local.value,   // <-- reads our controlled prop
    ...
  });
  const context = {
    isSelectedValue: (value) => value === selected(),
    ...
  };
  return <MenuRadioGroupContext.Provider value={context}>
    <MenuGroup {...others} />
  </MenuRadioGroupContext.Provider>;
}
```

And the controllable signal itself, `node_modules/@kobalte/core/dist/chunk/BLN63FDC.js:5-22`:

```js
function createControllableSignal(props) {
  const [_value, _setValue] = createSignal(props.defaultValue?.());
  const isControlled = createMemo(() => props.value?.() !== void 0);
  const value = createMemo(() =>
    isControlled() ? props.value?.() : _value()
  );
  ...
}
```

Here's the broken link:

- `createMemo` comes from **instance B** (Kobalte resolved `import { createMemo } from "solid-js"` to node_modules).
- The memo's body calls `props.value?.()`, which ultimately reads our `currentStatus()`, which reads our `filterState` signal — from **instance A**.
- When the memo runs, B's listener is active. A's signal write never notifies anyone in B.
- Result: `value()` returns the **first** value it was initialized with, and never refreshes while the submenu is mounted.

Down the line: `<MenuItemBase checked={context.isSelectedValue(local.value)}>` reads `selected()`, which reads `value()` — same stale answer. `data-checked` on the DOM stays where it was. `<MenuItemIndicator>` shows a checkmark wrapped in `<Show when={context.isChecked()}>` which, again, resolves against a frozen memo.

### 6.4 Why closing and reopening fixes it

Closing the root menu unmounts `MenuSubContent` (portalled node). Reopening remounts it — which re-runs `MenuRadioGroup` fresh. `createControllableSignal` runs for the first time with the *current* value of our controlled prop, so the initial read is correct. The tracking is still broken; the snapshot just happens to be right at mount time.

### 6.5 Why submenu open/close itself still works

`DropdownMenu.Sub`'s open/close state is managed internally by Kobalte (no controlled `open` prop from us in this branch — SPEC-019 AC explicitly backed that out, noted as "incompatible with dual solid-js bundle strategy"). Since no signal crosses the A↔B boundary for open-state, it works.

This is also why the bug didn't show up in the SPEC-018 e2e tests: those check that the sidebar list filters after a click (instance-A reactivity), not that the Kobalte radio's `data-checked` attribute flips (instance-B reactivity).

---

## 7. The fix

Make the two instances one. The simplest way: tell tsup to bundle `@kobalte/core` and the other solid-js-using deps into `react-grab`'s dist alongside the already-inlined `solid-js`. Then every `import "solid-js"` inside those packages resolves at **build time** to the same bundled solid-js our own code uses.

**Change to `packages/react-grab/tsup.config.ts:53`:**

```ts
noExternal: [
  "clsx",
  "solid-js",
  "bippy",
  /^@kobalte\//,        // MenuRadioGroup, Dialog, Select, Combobox — all controlled primitives
  "solid-focus-trap",   // used directly by Sidebar
],
```

### 7.1 Which packages need to be listed, which don't

tsup's default is: **direct dependencies listed in `package.json` are external**; anything else gets bundled. So the rule is "for every *direct* dep that uses solid-js reactively, add it to `noExternal`; transitive deps take care of themselves."

Direct deps of `react-grab` that use solid-js:
- `@kobalte/core` — was external, now bundled via `/^@kobalte\//`. The regex covers both `@kobalte/core` and `@kobalte/utils` (both listed as direct deps of Kobalte itself, but pulled in transitively for us).
- `solid-focus-trap` — was external, now bundled.

Transitive deps (`@corvu/utils`, `solid-presence`, `solid-prevent-scroll`, `@solid-primitives/*`) are **already inlined** by tsup even without being named in `noExternal`, because they aren't in `package.json`'s `dependencies`. Adding them would be dead weight — verified by grepping the built dist for external imports, none of them appear.

### 7.2 Trade-off

- **Dev bundle size grows by ~60–100 KB minified.**
  `react-grab` is a **dev-only** overlay (see the `import.meta.env.DEV` guard at the call site in AdCreative). It never ships to production users, so this is dev-only cost.
- **All other Kobalte controlled primitives become reactive as a side benefit.** `Dialog.open`, `Select.value`, `Combobox.value`, etc. have the same latent bug today.
- **No change required on the consumer side.** AdCreative's config stays the same.

### 7.3 Alternatives considered and rejected

| Option | Why not |
|---|---|
| Drop `solid-js` from `noExternal` and add as peer dep | Forces AdCreative (a React app) to install solid-js — leaks an implementation detail into the consumer's lockfile. |
| Replace `MenuRadioGroup` with plain `MenuItem`s + our own checkmark | Sidesteps the bug but doesn't fix controlled `Dialog`/`Select`/`Combobox`. Same bug returns next time someone writes a controlled primitive. |
| Consumer-side Vite `resolve.dedupe: ['solid-js']` | Impossible — our solid-js is *inlined*, not imported. `dedupe` only helps when both sides go through node resolution. |

---

## 8. Verification plan

1. Apply the `noExternal` change.
2. `pnpm --filter react-grab build` to produce a new dist.
3. Confirm `@kobalte/core` is no longer listed as an external import:
   ```bash
   grep -Eo "from['\"]@?[a-z-]+/[a-z-]+['\"]" packages/react-grab/dist/renderer-*.js | sort -u
   ```
   `@kobalte/core` should no longer appear in the output; `@tiptap/*` and the rest can remain.
4. Run the existing filter e2e suite to make sure nothing regressed:
   ```bash
   pnpm --filter react-grab exec playwright test e2e/mocked/due-date-filter.spec.ts --project=chromium
   ```
5. Manually in AdCreative: open the filter menu, pick a new Status, confirm the checkmark moves **without** closing the menu.

---

## 9. References

**Source files touched / read during investigation:**

- `packages/react-grab/src/components/sidebar/filter-menu.tsx:63-117` — `FilterMenu`, controlled `value` props
- `packages/react-grab/src/components/sidebar/index.tsx:88` — `filterState` signal creation
- `packages/react-grab/src/components/sidebar/index.tsx:153-160` — `filteredGroups` memo
- `packages/react-grab/src/components/sidebar/index.tsx:251-257` — `<FilterMenu filter={...} onFilterChange={...}>`
- `packages/react-grab/src/components/ui/menu.tsx:124-161` — `MenuRadioGroup` re-export, `MenuRadioItem` wrapper
- `packages/react-grab/tsup.config.ts:53` — the `noExternal` line being changed
- `packages/react-grab/package.json` — `@kobalte/core` as a dependency (not in noExternal currently)

**Kobalte internals that explain the stale memo:**

- `node_modules/@kobalte/core/dist/chunk/LEK3K6R3.jsx:926-953` — `MenuRadioGroup`
- `node_modules/@kobalte/core/dist/chunk/LEK3K6R3.jsx:959-976` — `MenuRadioItem`, passes `checked={context.isSelectedValue(local.value)}`
- `node_modules/@kobalte/core/dist/chunk/BLN63FDC.js:5-22` — `createControllableSignal` — the memo that never re-runs
- `node_modules/@kobalte/core/dist/chunk/LEK3K6R3.jsx:264-304` — `MenuItemBase`, `data-checked` dataset memo + spread
- `node_modules/@kobalte/core/dist/chunk/LEK3K6R3.jsx:855-869` — `MenuItemIndicator`, the `<Show when={context.isChecked()}>` that renders the ✓

**Prior art / context:**

- `decree/spec/019-filter-menu-shadow-dom-hardening.md:197` — AC explicitly mentions "incompatible with dual solid-js bundle strategy" — the team was already aware that two solid-js instances exist at runtime, but hadn't traced a concrete consumer-visible bug to it until this one.
- `decree/adr/0016-kobalte-dropdown-menu-shadow-dom-fix.md` — separate shadow-DOM fixes already applied; not the same issue but shares the Kobalte + shadow DOM surface area.
- `decree/adr/0005-dialog-and-popover-rendering-inside-shadow-dom.md` — original strategy for mounting Kobalte components inside the shadow root; does not address the bundle-boundary problem.

---

## 10. For the next engineer

If you're touching a controlled Kobalte primitive (`value`, `open`, `checked` passed from our side) and its internal state seems to "lag by one re-mount," that's this bug. The fix is at the build-boundary, not inside the component. Don't work around it by remounting or by stripping controlled mode — fix the `noExternal` list so the bundle boundary doesn't exist.
