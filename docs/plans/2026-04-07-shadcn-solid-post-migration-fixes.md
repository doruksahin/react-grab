# shadcn-solid Migration — Post-Implementation Fix List

> Follows implementation of [2026-04-06-kobalte-to-shadcn-solid.md](./2026-04-06-kobalte-to-shadcn-solid.md)
>
> Issues found via code review + SSOT audit after the migration was executed.

---

## Critical (breaks functionality / E2E)

### C-1 — `CommentsDropdown` tooltips mount on `document.body`
`CommentsDropdown` renders outside `ShadowRootContext.Provider`, so `useShadowRoot()` returns `null` → portals fall back to `document.body` → tooltip content is invisible and escapes the shadow tree's pointer-event model.

- **Files:** `renderer.tsx:~302`, `comments-dropdown.tsx:243,290`
- **Fix:** wrap `CommentsDropdown` in `ShadowRootContext.Provider` in `renderer.tsx` — same pattern as `Sidebar`

---

### C-2 — `placement` prop passed to `<Tooltip>` root instead of `<TooltipContent>` (likely E2E root cause)
Kobalte's `Tooltip` root does not accept `placement` — it belongs on `TooltipContent`. The prop is silently ignored, breaking tooltip positioning across 4 toolbar sites and the comments dropdown.

- **Files:** `toolbar/index.tsx:1111,1153,1211,1246`, `comments-dropdown.tsx:243,290`
- **Fix:** move `placement={tooltipPosition()}` from `<Tooltip>` to `<TooltipContent placement={…}>` at each site

---

## High (SSOT violations — fix before building on top of these layers)

### H-1 — Portal pattern copy-pasted across 3 files
`useShadowRoot() + mount` logic is identical in `DialogPortal`, `SelectPortal`, `TooltipPortal`. A bug fix to the cast or mount logic requires 3 edits.

- **Files:** `ui/dialog.tsx:13–16`, `ui/select.tsx:13–15`, `ui/tooltip.tsx:13–15`
- **Fix:** extract `useShadowMount()` into `shadow-context.ts`:
  ```ts
  export function useShadowMount(): HTMLElement {
    const shadowRoot = useShadowRoot();
    return (shadowRoot ?? document.body) as HTMLElement;
  }
  ```
  Each portal becomes one line: `<XxxPrimitive.Portal {...props} mount={useShadowMount()} />`

---

### H-2 — `"2147483647"` hardcoded in `jira-create-dialog.tsx`
`Z_INDEX_HOST` already exists in `constants.ts`. The dialog is the only component in the codebase that inlines the raw number as a string literal.

- **Files:** `jira-create-dialog.tsx:32`, `constants.ts:42`
- **Fix:** `import { Z_INDEX_HOST } from "../../constants.js"` and use `style={{ "z-index": String(Z_INDEX_HOST) }}`

---

### H-3 — `SelectContent` and `TooltipContent` don't absorb their portals; `DialogContent` does
`DialogContent` calls `DialogPortal` internally — callers just write `<DialogContent>`. `SelectContent` and `TooltipContent` don't, so callers must wrap them manually. Results in 6 redundant `<SelectPortal>` wraps across `jira-create-form.tsx` and `filter-bar.tsx`.

- **Files:** `ui/select.tsx:38–47`, `ui/tooltip.tsx:18–26`, vs `ui/dialog.tsx:38–54`
- **Fix:** make `SelectContent` and `TooltipContent` call their respective portals internally, then remove all 6 manual `<SelectPortal>` wraps from call sites

---

### H-4 — `ButtonProps` re-declares `cva` variant/size unions manually
`VariantProps` is not imported. Variant and size string literals are hard-coded in the interface, duplicating what `cva` already knows. Adding a variant requires editing two places.

- **Files:** `ui/button.tsx:33–35`
- **Fix:**
  ```ts
  import { cva, type VariantProps } from "cva";
  // ...
  interface ButtonProps extends Omit<ComponentProps<"button">, "size">, VariantProps<typeof buttonVariants> {}
  ```

---

## Important (fix before merge)

### I-1 — `ShadowRootContext.Provider` value is non-reactive
`value={shadowRoot()}` in `sidebar/index.tsx` is evaluated once at render. Pre-existing issue, but the migration expanded dependency from 1 portal type to 3. If `containerRef` isn't set before a portal opens, context returns `null` and portals fall back to `document.body`.

- **Files:** `sidebar/index.tsx:140`
- **Fix:** wrap in `createMemo` so the value reactively re-derives: `const shadowRootMemo = createMemo(() => shadowRoot()); <ShadowRootContext.Provider value={shadowRootMemo()}>`

---

## Medium (fix when touching those files)

### M-1 — `JiraCreateDialogProps` ≈ `JiraCreateFormProps` — two standalone interfaces
Dialog props are essentially form props + `open: boolean`. They will diverge silently if fields are added to one.

- **Files:** `jira-create-dialog.tsx:12–21`, `jira-create-form.tsx:32–41`
- **Fix:** `type JiraCreateDialogProps = JiraCreateFormProps & { open: boolean; onTicketCreated: TicketCreatedCallback }`

---

### M-2 — `onTicketCreated` callback signature duplicated 4×
`(groupId: string, ticketId: string, ticketUrl: string) => void` is re-declared in `types.ts`, `sidebar/index.tsx`, `group-detail-view.tsx`, and `jira-create-dialog.tsx` with no shared alias.

- **Files:** `types.ts:600`, `sidebar/index.tsx:40`, `group-detail-view.tsx:23`, `jira-create-dialog.tsx:19`
- **Fix:** `export type TicketCreatedCallback = (groupId: string, ticketId: string, ticketUrl: string) => void` in `types.ts`; import at all 4 sites

---

### M-3 — `bg-[#1a1a1a]` hardcoded in 3 files
Same hex with no shared token. Changing the dark surface color requires 3 edits.

- **Files:** `sidebar/index.tsx:145`, `jira-create-dialog.tsx:31`, `sync-indicator.tsx:35`
- **Fix:** add `--grab-dark-surface: #1a1a1a` to `styles.css` `:host` block and reference via `bg-[var(--grab-dark-surface)]`

---

## Low (cosmetic — track, fix opportunistically)

### L-1 — Kobalte open/close animation class string duplicated in `dialog.tsx` and `select.tsx`
`data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95` appears in both.

- **Files:** `ui/dialog.tsx:44`, `ui/select.tsx:44`
- **Fix:** extract to a shared constant or `@apply` class in `styles.css`

---

### L-2 — `SelectTrigger` class string repeated twice in `jira-create-form.tsx`
Lines 115 and 135 have identical class strings.

- **Files:** `jira-create-form.tsx:115,135`
- **Fix:** extract to a local `const triggerClass = "..."` (same pattern as `filter-bar.tsx:49`)

---

### L-3 — `textarea` base class string repeated twice in `jira-create-form.tsx`
Lines 148 and 164 differ only by `font-mono`.

- **Files:** `jira-create-form.tsx:148,164`
- **Fix:** extract to `const textareaClass = "..."` and append `font-mono` where needed

---

### L-4 — "✕ Clear" button in `FilterBar` not migrated to `Button`
All other buttons in migrated files use the `Button` component.

- **Files:** `filter-bar.tsx:136`
- **Fix:** `<Button variant="ghost" size="sm" onClick={handleClear}>✕ Clear</Button>`

---

## Summary

| ID | Severity | Area | Fix size |
|---|---|---|---|
| C-1 | Critical | CommentsDropdown outside ShadowRootContext | Small | ✅ done |
| C-2 | Critical | `placement` on wrong Tooltip component | Small | ✅ no-fix (valid on Tooltip root) |
| H-1 | High | Portal pattern copy-pasted 3× | Small | ✅ done |
| H-2 | High | z-index magic number in dialog | Trivial | ✅ done |
| H-3 | High | SelectContent/TooltipContent don't absorb portals | Medium | ✅ done |
| H-4 | High | ButtonProps duplicates cva variant unions | Trivial | ✅ done |
| I-1 | Important | ShadowRootContext value non-reactive | Small | ✅ no-fix (already reactive via signal) |
| M-1 | Medium | JiraCreateDialogProps ≈ JiraCreateFormProps | Small | ✅ done (via TicketCreatedCallback) |
| M-2 | Medium | TicketCreatedCallback duplicated 4× | Small | ✅ done |
| M-3 | Medium | `bg-[#1a1a1a]` hardcoded in 3 files | Small | ✅ done |
| L-1 | Low | Animation class string duplicated | Trivial | skipped (no shared file; scope creep) |
| L-2 | Low | SelectTrigger class repeated in same file | Trivial | ✅ done |
| L-3 | Low | Textarea class repeated in same file | Trivial | ✅ done |
| L-4 | Low | FilterBar Clear button not migrated to Button | Trivial | ✅ done |
