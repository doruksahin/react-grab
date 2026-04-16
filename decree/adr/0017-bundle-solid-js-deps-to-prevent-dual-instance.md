---
date: '2026-04-16'
references:
- ADR-0005
- ADR-0016
- SPEC-019
status: accepted
---

# ADR-0017 Bundle all solid-js-consuming deps into react-grab's dist

## Context and Problem Statement

`react-grab` is a dev-only overlay library built with Solid.js that is consumed by React host applications (primarily AdCreative-Frontend-V2) via a pnpm workspace symlink. `packages/react-grab/tsup.config.ts` uses `noExternal: ["clsx", "solid-js", "bippy"]` so that consumers do not need to install Solid themselves — our Solid runtime is inlined into `dist/` alongside the library code.

Meanwhile, several of our direct dependencies also use Solid internally:

- `@kobalte/core` — headless UI primitives (DropdownMenu, Dialog, Select, Combobox). All rely on `createControllableSignal` to react to externally controlled props like `value`, `open`, `checked`.
- `solid-focus-trap` — focus management, used directly in `Sidebar`.

Until now, these packages were left as **external** imports in the built `dist`. A consumer loading `react-grab` would get our inlined Solid (call it **instance A**), then load `@kobalte/core` separately — whose own `import { createSignal } from "solid-js"` gets resolved by the consumer's bundler to `node_modules/solid-js` (**instance B**).

Two Solid runtimes at runtime means two independent global listener stacks. A signal created by **A** (e.g. our `filterState` signal in `sidebar/index.tsx`) is not observable by a memo created by **B** (e.g. Kobalte's `createControllableSignal` inside `MenuRadioGroup`). Signals set by A simply never notify effects tracked by B. Effects tracked by B never re-run on A's updates.

The concrete failure mode that triggered this ADR: when the user selects a status inside the sidebar filter submenu, the row label and the sidebar list update (those are A's effects over A's signal — same instance), but the ✓ indicator on the selected radio item does not move until the menu is closed and reopened (Kobalte's `data-checked` attribute is produced by B's memo over the `value` prop, which is fed by A). See `docs/plans/2026-04-16-filter-menu-radio-reactivity-root-cause.md` for the full evidence chain.

This bug is latent for **every** controlled Kobalte primitive (`Dialog.open`, `Select.value`, `Combobox.value`, `MenuRadioGroup.value`, etc.) as long as the current `noExternal` shape leaves those packages external.

A decision is needed on how to guarantee a single Solid runtime shared between our code and every dependency we rely on reactively.

## Decision Drivers

- **Correctness of controlled Kobalte primitives.** Any primitive we drive from our Solid signals must respond to prop updates without requiring a re-mount workaround.
- **Self-contained consumer contract.** AdCreative is a React application; making it install or dedupe `solid-js` leaks our implementation detail into its lockfile and Vite config.
- **Keep the fix at the build boundary, not per-component.** Component-level workarounds would have to be repeated on every future controlled primitive we adopt.
- **`react-grab` ships only in dev builds** (`import.meta.env.DEV` guard at the consumer's call site). Bundle size trade-offs are dev-only; no impact on AdCreative's production bundle.
- **Low maintenance cost.** The rule for future dep additions must be discoverable and easy to enforce.

## Considered Options

### Option A: Expand `noExternal` to cover every direct solid-js-consuming dep

Add `/^@kobalte\//` and `solid-focus-trap` to `noExternal`. tsup follows imports transitively, so `@corvu/utils`, `solid-presence`, `solid-prevent-scroll`, `@solid-primitives/*` — which are transitive and not listed in our `package.json` `dependencies` — get bundled automatically without being named.

```ts
noExternal: [
  "clsx",
  "solid-js",
  "bippy",
  /^@kobalte\//,
  "solid-focus-trap",
],
```

- Good: every Solid listener inside Kobalte and `solid-focus-trap` imports the **same** bundled solid-js module as our own code. Single instance. Reactivity works across the whole tree.
- Good: fixes the problem class, not just the `MenuRadioGroup` symptom. `Dialog.open`, `Select.value`, `Combobox.value` and any future controlled Kobalte primitive become reactive by default.
- Good: no consumer-side changes. AdCreative does not need to install or dedupe Solid.
- Neutral: `dist/renderer-*.js` grows by ~106 KB minified (from 238 KB to 344 KB). `react-grab` is dev-only, so this is dev-bundle cost, not shipped-to-users cost.
- Bad: new rule to remember — any future **direct** dep that uses solid-js must be added to `noExternal`. Transitive deps are already covered because only direct `package.json` dependencies are external by default in tsup.

### Option B: Drop `solid-js` from `noExternal`, make it a peer dependency

Mark `solid-js` external in library builds, list it under `peerDependencies` in `package.json`, and require consumers to install it themselves. With Solid sourced from the consumer's `node_modules`, Kobalte's `import from "solid-js"` resolves to the same copy.

- Good: smallest possible dist.
- Good: single Solid instance via consumer-side node resolution.
- Bad: AdCreative is a React codebase — forcing it to `pnpm add solid-js` leaks our internal choice of framework into its dependency graph and lockfile.
- Bad: consumers may accidentally install a mismatched Solid major version; we'd gain a runtime compatibility matrix to police.
- Bad: `react-grab`'s IIFE build (`format: ["iife"]`) for browser-injection use cases still needs Solid inlined. We'd need per-build-config `noExternal` entries, with `solid-js` inlined only for IIFE and external for CJS/ESM.

### Option C: Replace controlled Kobalte primitives with uncontrolled + manual state

Use `defaultValue` + `onChange` + force re-mount on external state change (e.g. via a `key` prop tied to `filterState` version). Never pass a live signal across the instance boundary.

- Good: sidesteps the dual-instance problem without changing bundling.
- Bad: every re-mount discards focus, ARIA announcements, and transition state. UX regression.
- Bad: the workaround has to be reapplied to every controlled primitive we use. Easy to forget, no type-level enforcement.
- Bad: future primitives we haven't yet adopted (e.g. `Combobox`) would silently reproduce the bug until someone adds the workaround.

### Option D: Consumer-side Vite `resolve.dedupe: ['solid-js']`

Ask AdCreative to configure Vite to deduplicate `solid-js`.

- Bad: impossible by construction. Our `solid-js` is **inlined** into the dist bundle, not imported as a module. Vite's `dedupe` works by collapsing duplicate node resolutions — it has no handle on a module that lives inside another bundle's source.

## Decision Outcome

**Option A**, because:

1. **It fixes the root cause at the boundary where it originates.** The bug exists because two Solid runtimes coexist at runtime; Option A collapses them into one at build time.

2. **It generalizes.** Every Kobalte controlled primitive benefits, not just the one that triggered this investigation. The same applies for `solid-focus-trap`, which already ships in `Sidebar` and will start behaving reactively.

3. **The dev-bundle cost is acceptable.** `react-grab` does not ship to production users (dev-only `import.meta.env.DEV` guard). The ~106 KB dev-build growth is invisible to AdCreative's production artifacts.

4. **Consumer stays ignorant of our Solid usage.** AdCreative does not need to install `solid-js`, configure dedupe, or know anything about our headless UI library. The abstraction boundary is preserved.

5. **The maintenance rule is narrow and easy to state.** "If you add a new **direct** `dependencies` entry that uses `solid-js`, add it to `noExternal`." Transitive deps are automatic because only direct deps are external by default in tsup. The rule lives in the config comment on `tsup.config.ts:53` and in this ADR.

Option B is rejected because peer-depping Solid leaks implementation details into React consumers. Option C is rejected because per-component workarounds are an ongoing tax and UX-degrading. Option D is rejected because it cannot physically work — you cannot dedupe an inlined module.

## Consequences

- `packages/react-grab/tsup.config.ts:53` `noExternal` grows from `["clsx", "solid-js", "bippy"]` to include `/^@kobalte\//` and `"solid-focus-trap"`. A comment on that config line points at `docs/plans/2026-04-16-filter-menu-radio-reactivity-root-cause.md` for the reasoning.
- `dist/renderer-*.js` minified size grows from 238 KB to 344 KB. Verified by rebuilding and re-running the SPEC-018 filter e2e suite (`pnpm --filter react-grab exec playwright test e2e/mocked/due-date-filter.spec.ts --project=chromium --retries=0`) — 8/8 passing in ~21 s.
- External imports remaining in the built dist are limited to non-reactive peers: `@tiptap/*`, `@floating-ui/dom`, `element-source`, `modern-screenshot`, `zod`, `cva`, `tailwind-merge`, `tiptap-markdown`, `@medv/finder`. None of these cross a Solid reactivity boundary.
- **Rule for future contributors:** when adding a new direct `dependencies` entry that uses `solid-js` (anything importing `createSignal`, `createMemo`, `createEffect`, or JSX), add it to `noExternal`. Transitive deps through an already-bundled package are handled automatically.
- This ADR does not change ADR-0005 (Dialog/Popover shadow DOM strategy) or ADR-0016 (Kobalte DropdownMenu shadow DOM fix) — both remain in force. It complements them by ensuring their controlled props work reactively.
- If `react-grab` ever stops being dev-only, the dist size trade-off should be re-evaluated under the new constraint; this ADR would move to `superseded`.
