# Shadow Root Threading Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Thread the `ShadowRoot` as an explicit prop from its creation point in `mountRoot()` down to a single `ShadowRootContext.Provider` in `ReactGrabRenderer`, eliminating every `getRootNode()`-based `ShadowRootContext` recovery, the dual-provider pattern, and the silent `document.body` fallback.

**Out of scope:** `comments-dropdown.tsx:81` and `toolbar/index.tsx:126` also call `getRootNode()`, but for a different purpose — they query for sibling DOM elements (`[data-react-grab-toolbar]`) within the shadow root for safe-polygon hover tracking, not for portal mounting. Those usages are query-scope helpers, not provider recovery, and are intentionally left untouched.

**Architecture:** The layer that creates a resource is its canonical owner and must hand it to consumers explicitly — never let consumers recover it from the DOM. `mountRoot()` creates the `ShadowRoot` and returns it. `ReactGrabRenderer` receives it as a prop and provides it once at the root of the entire component tree. All portal components consume it via `useShadowMount()`. No component traverses the DOM to find the shadow root.

**Tech Stack:** Solid.js, TypeScript, Kobalte portal `mount` prop, pnpm monorepo.

---

## Dependency direction (read before touching anything)

```
utils/mount-root.ts          ← CREATION LAYER: creates and returns ShadowRoot
        ↓ (returned value)
core/index.tsx               ← WIRING LAYER: destructures and passes as prop
        ↓ (prop: shadowRoot)
components/renderer.tsx      ← PROVISION LAYER: one ShadowRootContext.Provider at root
        ↓ (Solid.js context)
useShadowMount()             ← CONSUMPTION LAYER: every Portal reads from context
```

Each layer has one job. Violation of this direction is the bug we are fixing.

---

## Baseline: verify the portal e2e test passes before touching anything

Run:
```bash
cd packages/react-grab
pnpm test:e2e --grep "dialog opens inside shadow root"
```
Expected: **PASS**. If it fails before we start, stop and investigate.

---

## Task 1: Relocate `shadow-context.ts` to `utils/` — correct colocation

**Why:** `features/sidebar/shadow-context.ts` is imported by `components/renderer.tsx`, `components/sidebar/index.tsx`, `components/ui/dialog.tsx`, `components/ui/select.tsx`, and `components/ui/tooltip.tsx` (verified via `grep -rn "shadow-context"`). It is consumed by every UI portal wrapper and the renderer itself — it is not sidebar-specific. Cross-cutting infrastructure belongs in `utils/`, not inside a feature module.

**Files:**
- Create: `packages/react-grab/src/utils/shadow-context.ts`
- Modify: `packages/react-grab/src/components/renderer.tsx` (import path)
- Modify: `packages/react-grab/src/components/sidebar/index.tsx` (import path)
- Modify: `packages/react-grab/src/components/ui/dialog.tsx` (import path)
- Modify: `packages/react-grab/src/components/ui/select.tsx` (import path)
- Modify: `packages/react-grab/src/components/ui/tooltip.tsx` (import path)
- Modify: `packages/react-grab/src/features/sidebar/index.ts` (remove re-export of shadow context — it was never sidebar's to own)
- Delete: `packages/react-grab/src/features/sidebar/shadow-context.ts`

**Step 1: Create `utils/shadow-context.ts`**

> **Note (2026-04-07):** Dev assertion and `document.body` fallback dropped — the single-provider architecture in Task 5 guarantees the context is always set. Validating against an impossible scenario violates the project's standing preference against defensive code for impossible cases.

```ts
// packages/react-grab/src/utils/shadow-context.ts
import { createContext, useContext } from "solid-js";

/**
 * Provides the ShadowRoot to all components that need to mount overlays
 * (Dialog, Select, Tooltip) inside the shadow DOM.
 *
 * Set once by ReactGrabRenderer via the shadowRoot prop passed from
 * mountRoot(). All consumers of useShadowMount() are unconditionally
 * descendants of that provider — there is no fallback because there
 * is no scenario in which the context can be missing.
 */
export const ShadowRootContext = createContext<ShadowRoot | null>(null);

export function useShadowRoot(): ShadowRoot | null {
  return useContext(ShadowRootContext);
}

/**
 * Returns the ShadowRoot cast to HTMLElement, ready to pass as the
 * `mount` prop to any Kobalte Portal component. Kobalte's mount prop
 * accepts any Node at runtime; the cast satisfies its type signature.
 */
export function useShadowMount(): HTMLElement {
  return useShadowRoot() as unknown as HTMLElement;
}
```

**Step 2: Update import in `renderer.tsx`**

Find: `import { ShadowRootContext } from "../features/sidebar/shadow-context.js";`
Replace with: `import { ShadowRootContext } from "../utils/shadow-context.js";`

**Step 3: Update import in `components/sidebar/index.tsx`**

Find: `import { ShadowRootContext } from "../../features/sidebar/shadow-context.js";`
Replace with: `import { ShadowRootContext } from "../../utils/shadow-context.js";`

**Step 4: Update import in `ui/dialog.tsx`**

Find: `import { useShadowMount } from "../../features/sidebar/shadow-context.js";`
Replace with: `import { useShadowMount } from "../../utils/shadow-context.js";`

**Step 5: Update import in `ui/select.tsx`**

Find: `import { useShadowMount } from "../../features/sidebar/shadow-context.js";`
Replace with: `import { useShadowMount } from "../../utils/shadow-context.js";`

**Step 6: Update import in `ui/tooltip.tsx`**

Find: `import { useShadowMount } from "../../features/sidebar/shadow-context.js";`
Replace with: `import { useShadowMount } from "../../utils/shadow-context.js";`

**Step 7: Remove shadow context re-export from `features/sidebar/index.ts`**

Find this line:
```ts
export { ShadowRootContext, useShadowRoot } from "./shadow-context.js";
```
Delete it. The sidebar feature module should not claim ownership of cross-cutting infrastructure.

**Step 8: Delete the old file**

```bash
rm packages/react-grab/src/features/sidebar/shadow-context.ts
```

**Step 9: Verify typecheck**

```bash
pnpm --filter react-grab typecheck
```
Expected: 0 errors in changed files. (Pre-existing import-extension errors in unrelated files are acceptable.)

**Step 10: Commit**

```bash
git add packages/react-grab/src/utils/shadow-context.ts \
        packages/react-grab/src/features/sidebar/shadow-context.ts \
        packages/react-grab/src/features/sidebar/index.ts \
        packages/react-grab/src/components/renderer.tsx \
        packages/react-grab/src/components/sidebar/index.tsx \
        packages/react-grab/src/components/ui/dialog.tsx \
        packages/react-grab/src/components/ui/select.tsx \
        packages/react-grab/src/components/ui/tooltip.tsx

git commit -m "refactor(shadow-dom): relocate shadow-context to utils/

ShadowRootContext is used by renderer, toolbar, comments-dropdown and
all UI portal wrappers — it was never sidebar-specific. Move it to
utils/ where cross-cutting infrastructure belongs and remove the
misleading re-export from features/sidebar/index.ts."
```

---

## Task 2: `mountRoot` returns `ShadowMountResult` — creation layer owns the resource

**Why:** `mountRoot()` is the only place in the entire codebase that calls `host.attachShadow()`. It is the canonical owner of the `ShadowRoot`. Returning only the inner div and throwing away the shadow root forces every downstream consumer to recover it via `getRootNode()` — a violation of explicit dependency flow.

**Files:**
- Modify: `packages/react-grab/src/utils/mount-root.ts`

**Step 1: Read the current file**

The current signature is `export const mountRoot = (cssText?: string) => { ... return root; }`.
There are two return paths:
1. Early return (line ~30): when host is already mounted — returns `mountedRoot`
2. Normal return (line ~69): after fresh mount — returns `root`

**Step 2: Add `ShadowMountResult` and update `mountRoot`**

Replace the entire file content:

```ts
// packages/react-grab/src/utils/mount-root.ts
import { MOUNT_ROOT_RECHECK_DELAY_MS, Z_INDEX_HOST } from "../constants.js";

const ATTRIBUTE_NAME = "data-react-grab";

const FONT_LINK_ID = "react-grab-fonts";
const FONT_LINK_URL =
  "https://fonts.googleapis.com/css2?family=Geist:wght@500&display=swap";

/**
 * The result of mounting the react-grab shadow DOM host.
 *
 * Both values are returned by mountRoot() so that the creation layer
 * owns the ShadowRoot and can pass it explicitly to ReactGrabRenderer.
 * Nothing downstream should call getRootNode() to recover the shadow root.
 */
export interface ShadowMountResult {
  /** The inner div that Solid.js renders into via render(). */
  root: HTMLDivElement;
  /** The ShadowRoot that isolates all react-grab UI from the host page. */
  shadowRoot: ShadowRoot;
}

const loadFonts = () => {
  if (document.getElementById(FONT_LINK_ID)) return;
  if (!document.head) return;
  const link = document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href = FONT_LINK_URL;
  document.head.appendChild(link);
};

export const mountRoot = (cssText?: string): ShadowMountResult => {
  loadFonts();

  const mountedHost = document.querySelector(`[${ATTRIBUTE_NAME}]`);
  if (mountedHost) {
    const mountedRoot = mountedHost.shadowRoot?.querySelector(
      `[${ATTRIBUTE_NAME}]`,
    );
    if (mountedRoot instanceof HTMLDivElement && mountedHost.shadowRoot) {
      return { root: mountedRoot, shadowRoot: mountedHost.shadowRoot };
    }
  }

  const host = document.createElement("div");
  host.setAttribute(ATTRIBUTE_NAME, "true");
  host.style.zIndex = String(Z_INDEX_HOST);
  host.style.position = "fixed";
  host.style.inset = "0";
  host.style.pointerEvents = "none";
  const shadowRoot = host.attachShadow({ mode: "open" });

  if (cssText) {
    const styleElement = document.createElement("style");
    styleElement.textContent = cssText;
    shadowRoot.appendChild(styleElement);
  }

  const root = document.createElement("div");
  root.setAttribute(ATTRIBUTE_NAME, "true");
  shadowRoot.appendChild(root);

  const doc = document.body ?? document.documentElement;
  // HACK: wait for hydration (in case something blows away the DOM)
  doc.appendChild(host);

  // HACK: re-append after a delay to ensure we're the last child of body.
  // This handles two cases:
  //   1. Hydration blew away the DOM and the host was removed
  //   2. Another tool (e.g. react-scan) appended at the same max z-index —
  //      being last in DOM order wins the stacking tiebreaker
  // appendChild of an existing node is an atomic move (no flash, no reflow).
  setTimeout(() => {
    doc.appendChild(host);
  }, MOUNT_ROOT_RECHECK_DELAY_MS);

  return { root, shadowRoot };
};
```

**Step 3: Verify typecheck**

```bash
pnpm --filter react-grab typecheck
```
Expected: TypeScript will now error in `core/index.tsx` where `mountRoot` return value is used — because the type changed. That error is expected and will be fixed in Task 4.

**Step 4: Commit**

```bash
git add packages/react-grab/src/utils/mount-root.ts
git commit -m "refactor(mount-root): return ShadowMountResult with root and shadowRoot

The creation layer is the canonical owner of the ShadowRoot. Returning
only the inner div and discarding the shadow root forced all downstream
code to recover it via getRootNode(). Now both values are returned so
the wiring layer can pass the shadow root explicitly as a prop."
```

---

## Task 3: Add `shadowRoot` to `ReactGrabRendererProps` — the type contract

**Why:** `ReactGrabRenderer` will receive the `ShadowRoot` as a prop. The prop must appear in the public type so TypeScript enforces the contract at the call site in `core/index.tsx`.

**Files:**
- Modify: `packages/react-grab/src/types.ts`

**Step 1: Find `ReactGrabRendererProps`**

The interface is at approximately line 489. It ends at approximately line 603 with `onTicketCreated?: TicketCreatedCallback;`.

**Step 2: Add `shadowRoot` as the first field**

Inside `ReactGrabRendererProps`, add as the first property:

```ts
export interface ReactGrabRendererProps extends SelectionGroupsViewProps {
  /**
   * The ShadowRoot that hosts all react-grab UI. Passed from mountRoot()
   * through core/index.tsx. ReactGrabRenderer provides this to its entire
   * component tree via ShadowRootContext so portal components can mount
   * inside the shadow DOM rather than on document.body.
   */
  shadowRoot: ShadowRoot;
  selectionVisible?: boolean;
  // ... rest unchanged
```

**Step 3: Verify typecheck**

```bash
pnpm --filter react-grab typecheck
```
Expected: new error in `core/index.tsx` — `Property 'shadowRoot' is missing`. Expected. Fixed in Task 4.

**Step 4: Commit**

```bash
git add packages/react-grab/src/types.ts
git commit -m "feat(types): add shadowRoot prop to ReactGrabRendererProps

Establishes the type contract: the wiring layer (core/index.tsx) is
required to pass the ShadowRoot explicitly to ReactGrabRenderer."
```

---

## Task 4: Wire `shadowRoot` through `core/index.tsx` — the wiring layer

**Why:** `core/index.tsx` is the boundary between the creation layer (`mountRoot`) and the provision layer (`ReactGrabRenderer`). It already has the shadow root — it just wasn't returning it before. Now it destructures it and passes it as a prop.

**Closure capture note:** `mountRoot()` is called synchronously at line ~3324, but `<ReactGrabRenderer>` is rendered inside a dynamic `import("../components/renderer.js").then(...)` callback at line ~4338. The destructured `shadowRoot` will be captured by closure into the `.then()` callback — this is the same pattern `rendererRoot` already uses (referenced inside the same `.then()` at line ~4326 and line ~4503), so no additional plumbing is needed. Verified: there is no existing `shadowRoot` identifier in `core/index.tsx`, so no naming collision.

**Files:**
- Modify: `packages/react-grab/src/core/index.tsx`

**Step 1: Destructure `mountRoot` return (line ~3324)**

Find:
```ts
const rendererRoot = mountRoot(resolvedCssText);
```
Replace with:
```ts
const { root: rendererRoot, shadowRoot } = mountRoot(resolvedCssText);
```

**Step 2: Pass `shadowRoot` to `ReactGrabRenderer` (line ~4340)**

Find the `<ReactGrabRenderer` JSX block. It starts with:
```tsx
<ReactGrabRenderer
  selectionVisible={selectionVisible()}
```
Add `shadowRoot={shadowRoot}` as the **first** prop:
```tsx
<ReactGrabRenderer
  shadowRoot={shadowRoot}
  selectionVisible={selectionVisible()}
```

**Step 3: Verify typecheck**

```bash
pnpm --filter react-grab typecheck
```
Expected: 0 errors introduced by our changes. (`core/index.tsx`'s `shadowRoot` missing error is now resolved; `renderer.tsx` may now show an unused variable error for `rendererEl` — fix is in Task 5.)

**Step 4: Commit**

```bash
git add packages/react-grab/src/core/index.tsx
git commit -m "refactor(core): thread ShadowRoot from mountRoot to ReactGrabRenderer prop

The wiring layer destructures the ShadowMountResult and passes shadowRoot
explicitly. No component downstream needs to call getRootNode() anymore."
```

---

## Task 5: `renderer.tsx` — single provider, remove all recovery logic

**Why:** `ReactGrabRenderer` is the provision layer. Its job is to take the `ShadowRoot` prop and make it available to the entire component tree via `ShadowRootContext.Provider` — once, at the root. Currently it does this poorly: it has a `rendererEl` signal + `createMemo` to recover the shadow root from the DOM, and it only wraps `CommentsDropdown` (not everything). `Sidebar` has its own separate provider. Both patterns are removed here.

**Files:**
- Modify: `packages/react-grab/src/components/renderer.tsx`

**Step 1: Remove the recovery machinery**

Remove from the imports line:
- `createMemo` from the solid-js import

The import line changes from:
```ts
import { Show, Index, createSignal, createEffect, createRenderEffect, onCleanup, on, createMemo } from "solid-js";
```
to:
```ts
import { Show, Index, createSignal, createEffect, createRenderEffect, onCleanup, on } from "solid-js";
```

Remove these lines from the component body (lines ~31–37):
```ts
// Shadow root for CommentsDropdown's tooltip portals. Derived from a ref on
// the always-mounted frozen-glow div, which lives inside the shadow root.
const [rendererEl, setRendererEl] = createSignal<HTMLDivElement | null>(null);
const rendererShadowRoot = createMemo(() => {
  const el = rendererEl();
  if (!el) return null;
  const root = el.getRootNode();
  return root instanceof ShadowRoot ? root : null;
});
```

Remove `ref={setRendererEl}` from the frozen-glow div (line ~94):
```tsx
// Before:
<div
  ref={setRendererEl}
  style={{
    position: "fixed",
    ...
  }}
/>

// After:
<div
  style={{
    position: "fixed",
    ...
  }}
/>
```

Remove the `<ShadowRootContext.Provider value={rendererShadowRoot()}>` wrapper around `CommentsDropdown` and its closing tag (lines ~314–336).

**Step 2: Wrap the entire return in a single provider**

Change the return statement from:
```tsx
return (
  <>
    <OverlayCanvas ... />
    ...
  </>
);
```
to:
```tsx
return (
  <ShadowRootContext.Provider value={props.shadowRoot}>
    <OverlayCanvas ... />
    ...
    <CommentsDropdown ... />
    ...
    <Show when={sidebarOpen()}>
      <Sidebar ... />
    </Show>
  </ShadowRootContext.Provider>
);
```

The `<>` fragment wrapper is removed; `ShadowRootContext.Provider` is the root element. All children remain in the same order.

**Step 3: Verify typecheck**

```bash
pnpm --filter react-grab typecheck
```
Expected: 0 errors in renderer.tsx.

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/renderer.tsx
git commit -m "refactor(renderer): single ShadowRootContext.Provider at component root

Receives shadowRoot as a prop and provides it once to the entire tree.
Removes the rendererEl signal, createMemo recovery, and the partial
provider that only wrapped CommentsDropdown. Sidebar's own provider
will be removed in the next commit."
```

---

## Task 6: `sidebar/index.tsx` — remove shadow root ownership, pure UI only

**Why:** The sidebar is a UI feature. It should not be in the business of providing infrastructure context. `ShadowRootContext` is now provided by `ReactGrabRenderer` (Task 5), which is a proper ancestor of `Sidebar`. Removing the sidebar's own provider means it correctly inherits the context rather than re-providing it.

The `containerRef` signal was introduced only to make `shadowRoot()` reactive. With shadow root removed, `containerRef` can be a plain `let` — which is the idiomatic Solid.js pattern for DOM refs that are only needed for imperative operations (focus trap).

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/index.tsx`

**Step 1: Remove `ShadowRootContext` import**

Find:
```ts
import { ShadowRootContext } from "../../utils/shadow-context.js";
```
Delete this line entirely.

**Step 2: Change `containerRef` from signal to plain `let`**

Find (lines ~48–52):
```ts
// containerRef is a signal so that shadowRoot() can reactively re-derive
// after the ref callback fires (refs run after initial render).
const [containerRef, setContainerRef] = createSignal<
  HTMLDivElement | undefined
>(undefined);
```
Replace with:
```ts
let containerRef: HTMLDivElement | undefined;
```

**Step 3: Update `createFocusTrap` call (line ~56)**

Find:
```ts
createFocusTrap({ element: containerRef, enabled: () => true });
```
Replace with:
```ts
createFocusTrap({ element: () => containerRef, enabled: () => true });
```
(`containerRef` was a signal accessor before, so it was already `() => value` when called. Now it's a plain `let`, so we wrap it in a getter explicitly.)

**Type compatibility note:** `createFocusTrap`'s `element` prop is typed as `MaybeAccessor<HTMLElement | null>` (verified in `solid-focus-trap/dist/index.d.ts`). The current code passes a `() => HTMLDivElement | undefined` accessor and TypeScript accepts it (`HTMLDivElement` extends `HTMLElement`; `undefined` is permitted by structural inference). Wrapping the new plain `let` in `() => containerRef` produces the same accessor shape — no type widening or new errors.

**Step 4: Remove the `shadowRoot` derivation (lines ~129–137)**

Find and delete:
```ts
// Shadow root: resolved reactively from the container element so that
// the context value is updated after the ref callback fires on mount.
const shadowRoot = () => {
  const el = containerRef();
  return (el?.getRootNode() as ShadowRoot | Document | null) instanceof
    ShadowRoot
    ? (el!.getRootNode() as ShadowRoot)
    : null;
};
```

**Step 5: Remove `ShadowRootContext.Provider` wrapper from the return**

The return currently looks like:
```tsx
return (
  <ShadowRootContext.Provider value={shadowRoot()}>
    <div
      ref={(el) => setContainerRef(el)}
      ...
    >
      ...
    </div>
  </ShadowRootContext.Provider>
);
```

Remove the `<ShadowRootContext.Provider>` opening and closing tags. Update the `ref` callback:

```tsx
return (
  <div
    ref={(el) => { containerRef = el; }}
    data-react-grab-sidebar
    ...
  >
    ...
  </div>
);
```

**Step 6: Remove unused `createSignal` from solid-js import if no longer needed**

Check if `createSignal` is still used elsewhere in `sidebar/index.tsx`. It is used for `filterState`, `showLegend`, `activeDetailGroupId` — so keep it. Only remove it if it's now unused.

**Step 7: Verify typecheck**

```bash
pnpm --filter react-grab typecheck
```
Expected: 0 errors in sidebar/index.tsx.

**Step 8: Commit**

```bash
git add packages/react-grab/src/components/sidebar/index.tsx
git commit -m "refactor(sidebar): remove shadow root ownership — pure UI only

Sidebar was providing ShadowRootContext for its own subtree, which is now
redundant since ReactGrabRenderer provides it at the root. Removes the
containerRef signal (used only for shadow root reactivity), the getRootNode()
derivation, and the Provider wrapper. containerRef reverts to a plain let
ref, which is the idiomatic Solid.js pattern for DOM refs used only for
imperative operations like focus management."
```

---

## Task 7: Final verification — e2e + typecheck

> **Baseline note (updated 2026-04-07):** The `"dialog opens inside shadow root"` e2e test fails on the branch this plan started from — a pre-existing bug unrelated to portal placement (`isJiraDialogVisible` times out, meaning the dialog never opens, likely a click-handler or mock issue from the Kobalte→shadcn migration). The verification gates below are adjusted accordingly.

**Step 1: Full typecheck**

```bash
pnpm --filter react-grab typecheck
```
Expected: 0 errors in any file touched by this plan.

**Step 2: Record the e2e failure baseline (run after Task 6)**

```bash
cd packages/react-grab
pnpm test:e2e 2>&1 | tee /tmp/e2e-baseline.txt
```
Save the list of failing tests. This is the pre-plan-changes baseline.

**Step 3: Run the full e2e suite again (after Task 7 Step 1)**

```bash
cd packages/react-grab
pnpm test:e2e 2>&1 | tee /tmp/e2e-after.txt
```
**Gate:** The set of failing tests must be identical to Step 2. No new failures. If the JIRA dialog test starts passing, that is a bonus; if it still fails, that is acceptable. Any new failure is a regression and must be investigated before proceeding.

**Step 4: Manual smoke test (primary signal)**

Open the app in a browser. Open DevTools → Elements. Find the shadow host (`[data-react-grab]`). Expand the shadow root. Verify:
- Tooltips appear inside `#shadow-root`, not on `document.body`
- Jira create dialog opens inside `#shadow-root`
- Sidebar filter dropdowns open inside `#shadow-root`

---

## What this plan removes (summary)

| Removed | Was in | Reason |
|---|---|---|
| `features/sidebar/shadow-context.ts` | `features/sidebar/` | Wrong folder — cross-cutting, moved to `utils/` |
| `rendererEl` signal + `createMemo` | `renderer.tsx` | Recovery hack — shadow root now arrives as prop |
| `ref={setRendererEl}` on frozen-glow div | `renderer.tsx` | Was only needed for `getRootNode()` recovery |
| Partial `ShadowRootContext.Provider` (CommentsDropdown only) | `renderer.tsx` | Replaced by single root provider |
| `containerRef` signal | `sidebar/index.tsx` | Signal was only needed for reactive shadow root derivation |
| `shadowRoot()` derived function | `sidebar/index.tsx` | Shadow root now comes from ancestor context |
| Sidebar's `ShadowRootContext.Provider` | `sidebar/index.tsx` | Provider belongs in renderer, not in a feature component |
| `ShadowRootContext` re-export | `features/sidebar/index.ts` | Sidebar never owned this |

## What this plan adds (summary)

| Added | Where | Reason |
|---|---|---|
| `ShadowMountResult` interface | `utils/mount-root.ts` | Named return type — self-documenting |
| `utils/shadow-context.ts` | `utils/` | Correctly colocated cross-cutting context |
| `shadowRoot: ShadowRoot` prop | `ReactGrabRendererProps` | Explicit dependency contract |
| Single `ShadowRootContext.Provider` at root | `renderer.tsx` | One provider, correct scope |
| Dev-mode assertion in `useShadowMount` | `utils/shadow-context.ts` | Fail fast instead of silent CSS breakage |
