# react-grab — Package Guide

Core overlay library built with **Solid.js** (not React). Mounts into React apps via a shadow DOM portal.

## Feature structure examples

### Complex — `selection-groups/` (business logic + store + hooks + components)

```
features/selection-groups/
  index.ts              — createSelectionGroups() factory, exports API + types
  types.ts              — SelectionGroup, SelectionGroupsAPI, SelectionGroupsDeps, SelectionGroupsViewProps
  business/
    group-operations.ts — CRUD operations
    membership.ts       — isPresentedAsLoose predicate (+ test)
    selection-assignment.ts — assign/unassign selections (+ test)
    synthetic-group.ts  — synthetic group create/GC (+ test)
    ticket-lock.ts      — canRemoveSelection gate (+ test)
  hooks/
    use-active-group-picker-state.ts
  store/
    index.ts            — barrel
    group-storage.ts    — localStorage persistence
    migrate.test.ts

components/selection-groups/
  active-group-picker.tsx
  group-picker-flyout.tsx
  group-collapsible.tsx
  ungrouped-section.tsx
```

Key patterns:
- Factory function (`createSelectionGroups`) takes deps, returns API interface — decouples from core
- `business/` is pure logic with no signals, no UI — unit-testable in isolation
- Types define `XxxAPI` (what the factory returns), `XxxDeps` (what it needs), `XxxViewProps` (what components receive)
- Store handles persistence separately from business rules

### Medium — `jira-comments/` (hook + utilities, no store)

```
features/jira-comments/
  use-jira-comments.ts  — main hook (optimistic updates, reply threading)
  types.ts              — JiraComment, MentionMapping, JiraCommentEditorProps, JiraCommentsSectionProps
  parse-comment-body.ts — ADF/markdown body parsing
  avatar-utils.ts       — avatar URL helpers
  mention-cache.ts      — mention resolution cache
  extract-mentions.ts   — extract @mentions from text
  __tests__/
    extract-mentions.test.ts

components/jira-comments/
  comments-section.tsx
  comment-item.tsx
  avatar.tsx
  editor/
    jira-comment-editor.tsx
    mention-picker.tsx
```

Key patterns:
- `editor/` subdirectory for complex sub-component with its own dependencies (Tiptap)
- Pure utility files (`parse-comment-body.ts`, `extract-mentions.ts`) alongside the hook
- Props interfaces defined in feature `types.ts`, not in the component files

### Small — `screenshot/` (pure functions, no state)

```
features/screenshot/
  index.ts              — barrel export
  capture.ts            — captureElement, captureFullPage, createHighlightOverlay
  orchestrate.ts        — captureAndUploadScreenshots (coordinates capture + upload)
```

No types file needed — small enough that types live inline.

## Component design

### Separation of concerns

Components follow a strict layered split:

| Layer | Location | Contains | Does NOT contain |
|---|---|---|---|
| **Business logic** | `features/<name>/business/` | Pure functions, predicates, transforms | Signals, JSX, DOM access |
| **State/hooks** | `features/<name>/hooks/` or `use-*.ts` | Signals, effects, stores | JSX, DOM elements |
| **UI components** | `components/<name>/` | JSX, styling, event wiring | Business rules, fetch calls |

Components receive behavior via props (callbacks like `onSubmit`, `onCancel`), never import services or make API calls directly. This keeps them reusable and testable.

When a component exceeds ~150 lines or mixes concerns, split it:
- Extract **toolbar/control bars** into their own component (takes `editor`/`state` as prop)
- Extract **event handling logic** (paste, drop, keyboard) into a hook in `features/`
- The parent becomes a **composition shell** that wires children together

Example: `jira-comment-editor.tsx` (composition shell) composes `EditorToolbar` (declarative buttons), `MentionPicker` (suggestion popup), and `use-editor-images` (paste/drop logic from features).

### Reusability

- Components take **props for everything they vary on** — no hardcoded feature-specific assumptions
- Extract primitives to `components/ui/` when used by 2+ features (e.g., `collapsible.tsx`, `button.tsx`)
- Feature-specific components stay in `components/<feature-name>/` — only promote to `ui/` when reused
- Use `splitProps` to separate local props from pass-through, enabling composition

### Data attributes

Every component gets a `data-react-grab-*` attribute on its root element for DOM identification. This convention is used for:
- **Event handling** — `data-react-grab-ignore-events` prevents overlay event interception
- **Testing** — Playwright selectors target `[data-react-grab-comment-submit]` etc.
- **Debugging** — inspect the DOM tree to find which component rendered an element

Naming convention: `data-react-grab-<component-name>` on the root, `data-react-grab-<action>` on interactive elements.

```tsx
// Root element — identifies the component
<div data-react-grab-comment-composer>

  // Interactive elements — identifies the action
  <button data-react-grab-comment-submit>Save</button>
  <button data-react-grab-comment-cancel>Cancel</button>
  <button data-react-grab-comment-reply>Reply</button>

  // Event boundary — prevents overlay from intercepting clicks
  <div data-react-grab-ignore-events>
```

When creating a new component, always add:
1. `data-react-grab-<component-name>` on the root element
2. `data-react-grab-ignore-events` on any interactive container inside the overlay
3. `data-react-grab-<action>` on buttons/inputs that tests or event handlers need to find

## Solid.js rules

### Mental model

- Components are **setup functions that run once** — not render functions
- Place reactive work in primitives (`createMemo`, `createEffect`, `<Show>`, `<For>`), not component body
- Access signals only inside reactive contexts (JSX expressions, effects, memos)

### Reactivity

- Call signals as functions: `count()` not `count`
- Use functional updates when new state depends on old: `setCount((prev) => prev + 1)`
- Keep signals atomic (one per value) — one big state object loses granularity
- Use derived functions `() => count() * 2` for cheap/infrequent derivations
- Use `createMemo(() => ...)` for expensive/frequent derivations — caches result
- Use `createEffect` for side effects only (DOM, localStorage, subscriptions)
- Call `onCleanup(() => ...)` inside effects for subscriptions/intervals/listeners
- Use path syntax for store updates: `setStore("users", 0, "name", "Jane")`
- Use `batch(() => { ... })` when updating multiple signals outside event handlers
- **Never** derive state via `createEffect(() => setX(y()))` — use memo or derived function

### Effect taxonomy

Before writing `createEffect`, classify the work:

- **Derived state** → `createMemo` (no external system touched)
- **User action** → event handler (don't watch a flag in an effect)
- **One-time setup** → `onMount` / `onCleanup`
- **External bridge** → `createEffect` (single-purpose, one effect = one bridge)

### Props

- Access props via `props.title`, not destructuring — destructuring breaks reactivity
- Use `splitProps(props, ["keys"])` to separate local from pass-through props
- Use `mergeProps(defaults, props)` for default values

### JSX

- Use `class` not `className`
- Combine static `class="btn"` with reactive `classList={{ active: isActive() }}`
- Use `<For each={items()}>` for object arrays, `<Index each={items()}>` for primitives
- Use `<Show when={cond()} fallback={...}>` for conditionals
- **Never** use `.map()` in JSX — use `<For>` or `<Index>`

### Shadow DOM patterns

- All container divs need `style={{ "pointer-events": "auto" }}` (Shadow DOM inherits `none`)
- Use `ShadowRootContext` to pass shadow root reference for portal mounting (Kobalte dialogs, Floating UI)
- Resolve shadow root via `containerRef?.getRootNode()`

## Codegen

After sync-server schema changes, regenerate the typed client:

```bash
pnpm --filter react-grab codegen
```

This runs Orval against `sync-server/openapi.json` and outputs to `src/generated/sync-api.ts`. The generated types in `src/generated/types.ts` are the SSOT for server shapes — extend them in feature `types.ts` files, never duplicate.
