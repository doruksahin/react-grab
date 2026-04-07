# Kobalte → shadcn-solid Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all hand-rolled UI primitives and the unused `@kobalte/core` dependency with shadcn-solid components, retaining full shadow DOM portal isolation.

**Architecture:** shadcn-solid is copy-paste (not an npm package) — component source goes into `src/components/ui/`. Each component that uses a Portal (Dialog, Select, Tooltip) is patched at copy-time to consume `ShadowRootContext` so callers never have to thread `mount` manually. Kobalte stays as a direct dependency because shadcn-solid source imports from it.

**Tech Stack:** Solid.js, shadcn-solid (copy-paste), @kobalte/core, cva@beta, tailwind-merge, tw-animate-css, Tailwind CSS v4

---

## Current state baseline

| Location | Current pattern | Target |
|---|---|---|
| `src/utils/cn.ts` | `clsx` only | `clsx` + `tailwind-merge` |
| `src/styles.css` | custom `@theme` vars | + shadcn CSS vars under `:host` |
| `src/components/sidebar/jira-create-dialog.tsx` | raw Portal + divs | `Dialog` from shadcn-solid |
| `src/components/sidebar/jira-create-form.tsx` | native `<select>` × 3, raw `<button>` × 2 | `Select` + `Button` |
| `src/components/sidebar/filter-bar.tsx` | native `<select>` × 4 | `Select` |
| `src/components/tooltip.tsx` | custom delay/timer logic | `Tooltip` from shadcn-solid |

---

### Task 1: Install new deps

**Files:**
- Modify: `packages/react-grab/package.json`

**Step 1: Add deps**

```bash
cd packages/react-grab
pnpm add cva@beta tailwind-merge tw-animate-css
```

**Step 2: Verify installed**

```bash
cat package.json | grep -E "cva|tailwind-merge|tw-animate"
```

Expected: three new entries under `dependencies`.

**Step 3: Commit**

```bash
git add packages/react-grab/package.json pnpm-lock.yaml
git commit -m "chore(deps): add cva, tailwind-merge, tw-animate-css for shadcn-solid"
```

---

### Task 2: Update `cn` utility to merge Tailwind conflicts

**Files:**
- Modify: `packages/react-grab/src/utils/cn.ts`

**Why:** shadcn-solid component variants use `cva` + `cn` to merge class overrides. Without `tailwind-merge`, conflicting classes like `bg-primary hover:bg-primary/90` won't resolve correctly.

**Step 1: Replace the file content**

```ts
// packages/react-grab/src/utils/cn.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
```

**Step 2: Verify no type errors**

```bash
cd packages/react-grab
pnpm tsc --noEmit
```

Expected: 0 errors (the signature is identical — callers unaffected).

**Step 3: Commit**

```bash
git add packages/react-grab/src/utils/cn.ts
git commit -m "chore(utils): add tailwind-merge to cn for shadcn-solid variant resolution"
```

---

### Task 3: Add shadcn-solid CSS variables to the shadow DOM stylesheet

**Files:**
- Modify: `packages/react-grab/src/styles.css`

**Why:** shadcn-solid components use CSS custom properties (`--background`, `--primary`, etc.). Because all CSS is injected into the shadow root, these vars must live inside `:host` (not `:root`) so they're available inside the shadow tree. The dialog is dark-themed, so we declare a dark variant triggered by `[data-kb-theme="dark"]` on any ancestor inside the shadow.

**Step 1: Add `tw-animate-css` import and CSS vars**

After the `@import "tailwindcss" source(".");` line at the top, insert:

```css
@import "tw-animate-css";

/*
 * SHADOW DOM NOTE: This dark variant only matches [data-kb-theme="dark"] attributes
 * on elements INSIDE the shadow tree. It cannot see host-page dark mode attributes
 * (e.g. <html class="dark"> or <body data-theme="dark">) because shadow DOM CSS
 * selectors do not pierce outward. Dark mode is opt-in per-element inside the shadow.
 */
@custom-variant dark (&:is([data-kb-theme="dark"] *));
```

After the closing brace of the `@theme { … }` block and before the `:host { … }` block, insert the `@theme inline` block:

```css
@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}
```

Inside the `:host { … }` block, after `direction: ltr;`, add the light-mode vars:

```css
  /* shadcn-solid design tokens — light mode (sidebar) */
  --radius: 0.375rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
```

After the `:host` block, add the dark-mode override:

```css
/* shadcn-solid design tokens — dark mode (dialog) */
[data-kb-theme="dark"] {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
}
```

**Step 2: Build CSS and verify no errors**

```bash
cd packages/react-grab
pnpm css:build
```

Expected: `dist/styles.css` regenerated without errors.

**Step 3: Verify `tw-animate-css` keyframes landed in the shadow stylesheet**

`@keyframes` defined outside the shadow root are not visible inside it — CSS animations will silently do nothing if keyframes are emitted to a document-level stylesheet instead of the injected shadow `<style>` block.

```bash
grep -c "@keyframes fade-in" dist/styles.css
```

Expected: count ≥ 1. If count is 0, the bundler resolved `tw-animate-css` as a separate side-effect stylesheet (injected into `<head>`). Fix: remove the `@import "tw-animate-css"` line and instead manually copy the required `@keyframes` blocks from `node_modules/tw-animate-css/dist/tw-animate.css` directly into `styles.css` alongside the existing hand-rolled keyframes.

**Step 4: Verify `@theme inline` tokens are in the shadow stylesheet, not `:root`**

`@theme inline` maps Tailwind token names to CSS vars. If Tailwind v4 emits these on `:root` in a separate rule, they won't be available inside the shadow root (which has `all: initial` cutting off cross-boundary inheritance).

```bash
grep -n "color-background" dist/styles.css
```

Expected: the `--color-background: var(--background)` declaration appears in the same compiled bundle. If it's emitted in a separate file or only under `:root` outside the shadow `<style>` injection point, move those declarations manually into the `:host` block.

**Step 5: Check for keyframe name collisions with existing animations**

```bash
grep "@keyframes" dist/styles.css | sort | uniq -d
```

Expected: no output (no duplicate `@keyframes` names). If duplicates appear (e.g. `@keyframes spin` from both Tailwind core and `tw-animate-css`), verify the final timing matches expectations and remove the redundant definition.

**Step 6: Commit**

```bash
git add packages/react-grab/src/styles.css
git commit -m "style: add shadcn-solid CSS vars and tw-animate-css to shadow DOM stylesheet"
```

---

### Task 4: Create `src/components/ui/` scaffold

**Files:**
- Create: `packages/react-grab/src/components/ui/.gitkeep`

**Step 1: Create the directory**

```bash
mkdir -p packages/react-grab/src/components/ui
```

This is where all shadcn-solid component files will live (Button, Dialog, Select, Tooltip).

**Step 2: Commit**

```bash
git add packages/react-grab/src/components/ui/
git commit -m "chore: scaffold src/components/ui/ for shadcn-solid components"
```

---

### Task 5: Add `Button` component

**Files:**
- Create: `packages/react-grab/src/components/ui/button.tsx`

**Step 1: Copy shadcn-solid Button source**

Fetch from: https://shadcn-solid.com/docs/components/button (copy the "Manual" tab source)

The file should match this structure (adapt imports to use `../../utils/cn.js`):

```tsx
// packages/react-grab/src/components/ui/button.tsx
import { type VariantProps, cva } from "cva";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "../../utils/cn.js";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

const Button: Component<ButtonProps> = (props) => {
  const [local, rest] = splitProps(props, ["class", "variant", "size"]);
  return (
    <button
      class={cn(buttonVariants({ variant: local.variant, size: local.size }), local.class)}
      {...rest}
    />
  );
};

export { Button, buttonVariants };
export type { ButtonProps };
```

**Step 2: Type-check**

```bash
cd packages/react-grab
pnpm tsc --noEmit
```

Expected: 0 errors.

**Step 3: Commit**

```bash
git add packages/react-grab/src/components/ui/button.tsx
git commit -m "feat(ui): add shadcn-solid Button component"
```

---

### Task 6: Migrate `jira-create-form` buttons to `Button`

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/jira-create-form.tsx`

**Step 1: Replace imports and button JSX**

At the top, add import:
```tsx
import { Button } from "../ui/button.js";
```

Replace the Cancel button (line ~219):
```tsx
// Before:
<button
  type="button"
  class="px-3 py-1.5 text-[12px] text-white/60 hover:text-white rounded hover:bg-white/10 transition-colors"
  style={{ "pointer-events": "auto" }}
  onClick={props.onClose}
>
  Cancel
</button>

// After:
<Button
  type="button"
  variant="ghost"
  size="sm"
  style={{ "pointer-events": "auto" }}
  onClick={props.onClose}
>
  Cancel
</Button>
```

Replace the Create Ticket submit button (line ~223):
```tsx
// Before:
<button
  type="submit"
  disabled={submitting() || !projectKey() || !issueType()}
  class="px-3 py-1.5 text-[12px] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
  style={{ "pointer-events": "auto" }}
>
  {submitting() ? "Creating…" : "Create Ticket"}
</button>

// After:
<Button
  type="submit"
  size="sm"
  disabled={submitting() || !projectKey() || !issueType()}
  style={{ "pointer-events": "auto" }}
>
  {submitting() ? "Creating…" : "Create Ticket"}
</Button>
```

**Step 2: Type-check**

```bash
pnpm tsc --noEmit
```

**Step 3: Commit**

```bash
git add packages/react-grab/src/components/sidebar/jira-create-form.tsx
git commit -m "feat(jira-form): migrate buttons to shadcn-solid Button"
```

---

### Task 7: Add `Dialog` component (shadow-DOM-aware)

**Files:**
- Create: `packages/react-grab/src/components/ui/dialog.tsx`

**Step 1: Copy shadcn-solid Dialog source**

Fetch from: https://shadcn-solid.com/docs/components/dialog (copy the "Manual" tab source)

**Critical patch:** The `DialogPortal` sub-component must consume `ShadowRootContext` so it mounts inside the shadow DOM. Modify the `DialogPortal` function like this:

```tsx
// packages/react-grab/src/components/ui/dialog.tsx
import { Dialog as DialogPrimitive } from "@kobalte/core/dialog";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { Portal } from "solid-js/web";
import { cn } from "../../utils/cn.js";
import { useShadowRoot } from "../../features/sidebar/shadow-context.js";

// Re-export root and trigger unchanged
const Dialog = DialogPrimitive;
const DialogTrigger = DialogPrimitive.Trigger;

// Portal — auto-mounts inside shadow DOM via context.
// useShadowRoot() returns ShadowRoot | null — NOT a signal. Do not call it as a function.
// Spread props BEFORE mount so context always wins over any caller-supplied mount prop.
const DialogPortal: Component<ComponentProps<typeof DialogPrimitive.Portal>> = (props) => {
  const shadowRoot = useShadowRoot(); // ShadowRoot | null
  // TypeScript may type `mount` as HTMLElement — cast if tsc rejects ShadowRoot directly.
  return <DialogPrimitive.Portal {...props} mount={(shadowRoot ?? document.body) as HTMLElement} />;
};

const DialogOverlay: Component<ComponentProps<typeof DialogPrimitive.Overlay>> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <DialogPrimitive.Overlay
      class={cn(
        "fixed inset-0 z-50 bg-black/80 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0",
        local.class,
      )}
      {...rest}
    />
  );
};

const DialogContent: Component<ComponentProps<typeof DialogPrimitive.Content> & { "data-kb-theme"?: string }> = (props) => {
  const [local, rest] = splitProps(props, ["class", "children", "data-kb-theme"]);
  return (
    // Wrap both overlay and content in the theme div so [data-kb-theme="dark"] covers
    // DialogOverlay too. Overlay is a sibling of Content — placing the attribute only
    // on Content would leave the overlay outside the dark-token cascade.
    <DialogPortal>
      <div data-kb-theme={local["data-kb-theme"]}>
        <DialogOverlay />
        <DialogPrimitive.Content
          class={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 data-[closed]:slide-out-to-left-1/2 data-[closed]:slide-out-to-top-[48%] data-[expanded]:slide-in-from-left-1/2 data-[expanded]:slide-in-from-top-[48%] sm:rounded-lg",
            local.class,
          )}
          {...rest}
        >
          {local.children}
          <DialogPrimitive.CloseButton class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </DialogPrimitive.CloseButton>
        </DialogPrimitive.Content>
      </div>
    </DialogPortal>
  );
};

const DialogHeader: Component<ComponentProps<"div">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div class={cn("flex flex-col space-y-1.5 text-center sm:text-left", local.class)} {...rest} />
  );
};

const DialogFooter: Component<ComponentProps<"div">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div class={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", local.class)} {...rest} />
  );
};

const DialogTitle: Component<ComponentProps<typeof DialogPrimitive.Title>> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <DialogPrimitive.Title
      class={cn("text-lg font-semibold leading-none tracking-tight", local.class)}
      {...rest}
    />
  );
};

const DialogDescription: Component<ComponentProps<typeof DialogPrimitive.Description>> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <DialogPrimitive.Description
      class={cn("text-sm text-muted-foreground", local.class)}
      {...rest}
    />
  );
};

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
```

**Step 2: Check what `useShadowRoot` exports from shadow-context**

```bash
cat packages/react-grab/src/features/sidebar/shadow-context.ts
```

If the export is named differently (e.g. `useShadowRootContext`), adjust the import in dialog.tsx accordingly.

**Step 3: Type-check**

```bash
pnpm tsc --noEmit
```

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/ui/dialog.tsx
git commit -m "feat(ui): add shadcn-solid Dialog with shadow DOM portal auto-mount"
```

---

### Task 8: Migrate `JiraCreateDialog` to use Dialog component

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/jira-create-dialog.tsx`

**Step 1: Rewrite the component**

```tsx
// packages/react-grab/src/components/sidebar/jira-create-dialog.tsx
import { type Component } from "solid-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog.js";
import { JiraCreateForm } from "./jira-create-form.js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";
import type { CommentItem } from "../../types.js";

interface JiraCreateDialogProps {
  open: boolean;
  workspaceId: string;
  groupId: string;
  group: SelectionGroupWithJira;
  commentItems: CommentItem[];
  shadowRoot?: ShadowRoot | null;
  onTicketCreated: (groupId: string, ticketId: string, ticketUrl: string) => void;
  onClose: () => void;
}

export const JiraCreateDialog: Component<JiraCreateDialogProps> = (props) => {
  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()} modal>
      {/* data-kb-theme="dark" is forwarded to the portal wrapper div inside DialogContent,
          which wraps BOTH the overlay and the content panel — so dark tokens apply to both. */}
      <DialogContent
        data-react-grab-jira-dialog
        data-kb-theme="dark"
        class="w-[480px] max-h-[80vh] overflow-y-auto bg-[#1a1a1a] border-white/10"
        style={{ "z-index": "2147483647" }}
      >
        <DialogHeader>
          <DialogTitle class="text-white">Create JIRA Ticket</DialogTitle>
        </DialogHeader>
        <JiraCreateForm
          workspaceId={props.workspaceId}
          groupId={props.groupId}
          group={props.group}
          commentItems={props.commentItems}
          onSuccess={props.onTicketCreated}
          onClose={props.onClose}
        />
      </DialogContent>
    </Dialog>
  );
};
```

Note: `data-kb-theme="dark"` on `DialogContent` triggers the dark CSS vars defined in Task 3. The `shadowRoot` prop is no longer needed (Dialog auto-mounts via context) but kept in the interface for backward compatibility for now.

**Step 2: Type-check**

```bash
pnpm tsc --noEmit
```

**Step 3: Build and visually verify**

```bash
pnpm build --filter react-grab
```

Open the dev harness and trigger the Jira dialog — confirm the backdrop + content render inside the shadow root (inspect with DevTools → shadow-root node).

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/sidebar/jira-create-dialog.tsx
git commit -m "feat(jira-dialog): migrate to shadcn-solid Dialog"
```

---

### Task 9: Add `Select` component (shadow-DOM-aware)

**Files:**
- Create: `packages/react-grab/src/components/ui/select.tsx`

**Step 1: Copy shadcn-solid Select source**

Fetch from: https://shadcn-solid.com/docs/components/select (copy the "Manual" tab source)

**Critical patch:** Patch `SelectPortal` to auto-mount in shadow DOM:

```tsx
// In the SelectPortal definition, replace whatever `mount` logic exists with:
import { useShadowRoot } from "../../features/sidebar/shadow-context.js";

// useShadowRoot() returns ShadowRoot | null — NOT a signal, do not invoke it.
// Spread props BEFORE mount so context always wins over any caller-supplied mount.
// Cast to HTMLElement if TypeScript rejects ShadowRoot for the mount prop type.
const SelectPortal: Component<ComponentProps<typeof SelectPrimitive.Portal>> = (props) => {
  const shadowRoot = useShadowRoot(); // ShadowRoot | null
  return <SelectPrimitive.Portal {...props} mount={(shadowRoot ?? document.body) as HTMLElement} />;
};
```

All other sub-components (SelectTrigger, SelectContent, SelectItem, SelectValue, etc.) copy as-is from the official source, updating import paths:
- `~/lib/utils` → `../../utils/cn.js`

**Step 2: Type-check**

```bash
pnpm tsc --noEmit
```

**Step 3: Commit**

```bash
git add packages/react-grab/src/components/ui/select.tsx
git commit -m "feat(ui): add shadcn-solid Select with shadow DOM portal auto-mount"
```

---

### Task 10: Migrate `FilterBar` selects to `Select`

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/filter-bar.tsx`

**Step 1: Replace native selects**

The FilterBar has 4 native `<select>` elements (status, assignee, reporter, label). Each becomes a `Select` component.

Import at top:
```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectPortal,
  SelectTrigger,
  SelectValue,
} from "../ui/select.js";
```

Pattern for each (example — status select):
```tsx
// Before:
<select class={selectClass} onChange={handleStatusChange} value={[...props.filter.statuses][0] ?? ""}>
  <option value="">All Statuses</option>
  <option value="No Task">No Task</option>
  {ALL_ATT_STATUSES.map((s) => (
    <option value={s}>{s}</option>
  ))}
</select>

// After:
<Select
  value={[...props.filter.statuses][0] ?? ""}
  onChange={(value: string) => handleStatusChange(value)}
  options={["", "No Task", ...ALL_ATT_STATUSES]}
  itemComponent={(itemProps) => (
    <SelectItem item={itemProps.item}>
      {itemProps.item.rawValue === "" ? "All Statuses" : itemProps.item.rawValue}
    </SelectItem>
  )}
>
  <SelectTrigger class="flex-1 min-w-0 text-[11px]">
    <SelectValue<string>>{(state) => state.selectedOption() || "All Statuses"}</SelectValue>
  </SelectTrigger>
  <SelectPortal>
    <SelectContent />
  </SelectPortal>
</Select>
```

Apply the same pattern to the assignee, reporter, and label selects. Remove the old `handleStatusChange` etc. event handler functions — replace their signatures to accept `(value: string)` directly.

**Step 2: Type-check**

```bash
pnpm tsc --noEmit
```

**Step 3: Commit**

```bash
git add packages/react-grab/src/components/sidebar/filter-bar.tsx
git commit -m "feat(filter-bar): migrate native selects to shadcn-solid Select"
```

---

### Task 11: Migrate `jira-create-form` selects to `Select`

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/jira-create-form.tsx`

**Step 1: Replace the 3 native selects (project, issue type, priority)**

Import at top (add to existing import from `../ui/button.js`):
```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectPortal,
  SelectTrigger,
  SelectValue,
} from "../ui/select.js";
```

Pattern for project select:
```tsx
// Before:
<select
  class="w-full bg-white/10 text-white text-[12px] rounded px-2 py-1.5 border border-white/10"
  style={{ "pointer-events": "auto" }}
  value={projectKey()}
  onChange={(e) => {
    setProjectKey(e.currentTarget.value);
    setIssueType("");
  }}
  required
>
  <option value="">Select project…</option>
  <For each={projects()}>
    {(p) => <option value={p.key}>{p.name} ({p.key})</option>}
  </For>
</select>

// After:
<Select
  value={projectKey()}
  onChange={(value: string) => {
    setProjectKey(value);
    setIssueType("");
  }}
  options={projects()?.map((p) => p.key) ?? []}
  itemComponent={(itemProps) => {
    const p = projects()?.find((proj) => proj.key === itemProps.item.rawValue);
    return (
      <SelectItem item={itemProps.item}>
        {p ? `${p.name} (${p.key})` : itemProps.item.rawValue}
      </SelectItem>
    );
  }}
>
  <SelectTrigger class="w-full text-[12px]" style={{ "pointer-events": "auto" }}>
    <SelectValue<string>>{(state) => state.selectedOption() || "Select project…"}</SelectValue>
  </SelectTrigger>
  <SelectPortal>
    <SelectContent />
  </SelectPortal>
</Select>
```

Apply same pattern to issue type and priority selects.

**Step 2: Type-check**

```bash
pnpm tsc --noEmit
```

**Step 3: Commit**

```bash
git add packages/react-grab/src/components/sidebar/jira-create-form.tsx
git commit -m "feat(jira-form): migrate native selects to shadcn-solid Select"
```

---

### Task 12: Add `Tooltip` component (shadow-DOM-aware)

**Files:**
- Create: `packages/react-grab/src/components/ui/tooltip.tsx`

**Step 1: Copy shadcn-solid Tooltip source**

Fetch from: https://shadcn-solid.com/docs/components/tooltip (copy the "Manual" tab source)

**Critical patch:** Patch `TooltipPortal` to auto-mount in shadow DOM:

```tsx
import { useShadowRoot } from "../../features/sidebar/shadow-context.js";

// useShadowRoot() returns ShadowRoot | null — NOT a signal, do not invoke it.
// Spread props BEFORE mount so context always wins over any caller-supplied mount.
const TooltipPortal: Component<ComponentProps<typeof TooltipPrimitive.Portal>> = (props) => {
  const shadowRoot = useShadowRoot(); // ShadowRoot | null
  return <TooltipPrimitive.Portal {...props} mount={(shadowRoot ?? document.body) as HTMLElement} />;
};
```

Update all `~/lib/utils` imports → `../../utils/cn.js`.

**Step 2: Type-check**

```bash
pnpm tsc --noEmit
```

**Step 3: Commit**

```bash
git add packages/react-grab/src/components/ui/tooltip.tsx
git commit -m "feat(ui): add shadcn-solid Tooltip with shadow DOM portal auto-mount"
```

---

### Task 13: Migrate custom `Tooltip` to shadcn-solid Tooltip

**Files:**
- Modify: `packages/react-grab/src/components/tooltip.tsx`

**Context:** The current `Tooltip` is a fully custom component with manual hover delay timers, grace period logic, and a `visible: boolean` prop controlled by the parent. The shadcn-solid Tooltip is trigger-based (hover/focus managed internally by Kobalte).

**Step 1: Assess call sites**

```bash
grep -r "Tooltip" packages/react-grab/src --include="*.tsx" -l
```

Read each file to understand how `Tooltip` is used — specifically whether `visible` is controlled externally or purely hover-driven.

**Step 2: Rewrite tooltip.tsx**

If all usages are purely hover-driven (no external `visible` signal), replace the entire file:

```tsx
// packages/react-grab/src/components/tooltip.tsx
// Re-export shadcn-solid Tooltip primitives for use throughout the app.
// The portal auto-mounts inside the shadow DOM via ShadowRootContext.
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipPortal,
} from "./ui/tooltip.js";
```

If any usage requires external `visible` control, keep the old `tooltip.tsx` alongside and migrate each call site to use `Tooltip` trigger-based API before deleting the old file. In that case, create `tooltip-legacy.tsx` as a temporary alias.

**Step 3: Update imports at each call site**

For each file that imports from `../components/tooltip` or `./tooltip`, update the import and switch from `<Tooltip visible={…} position={…}>` to:

```tsx
<Tooltip>
  <TooltipTrigger as="div">
    {/* the element that triggers the tooltip */}
  </TooltipTrigger>
  <TooltipPortal>
    <TooltipContent side="top">
      {/* tooltip content */}
    </TooltipContent>
  </TooltipPortal>
</Tooltip>
```

**Step 4: Type-check**

```bash
pnpm tsc --noEmit
```

**Step 5: Remove grace-period/delay constants if now unused**

Check `src/constants.ts` for `TOOLTIP_DELAY_MS` and `TOOLTIP_GRACE_PERIOD_MS` — remove if no remaining references.

**Step 6: Commit**

```bash
git add packages/react-grab/src/components/tooltip.tsx \
         packages/react-grab/src/constants.ts
git commit -m "feat(tooltip): replace custom implementation with shadcn-solid Tooltip"
```

---

### Task 14: Clean up `shadowRoot` prop from JiraCreateDialog callers

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/jira-create-dialog.tsx`
- Modify: Call site(s) that pass `shadowRoot` prop

**Step 1: Find call sites**

```bash
grep -r "JiraCreateDialog" packages/react-grab/src --include="*.tsx" -n
```

**Step 2: Remove `shadowRoot` from the interface and all call sites**

In `jira-create-dialog.tsx`, remove `shadowRoot?: ShadowRoot | null` from `JiraCreateDialogProps`.

At each call site, remove the `shadowRoot={…}` prop.

**Step 3: Type-check**

```bash
pnpm tsc --noEmit
```

**Step 4: Commit**

```bash
git add -p
git commit -m "chore(jira-dialog): remove now-redundant shadowRoot prop"
```

---

### Task 15: Final verification

**Step 1: Full build**

```bash
cd packages/react-grab
pnpm build
```

Expected: clean build, no TS errors.

**Step 2: Run E2E tests**

```bash
pnpm test:e2e
```

Expected: all existing tests pass — especially any that assert avatar, dialog, or filter behaviour.

**Step 3: Smoke-check shadow DOM isolation**

Open the host page in Chrome DevTools. Inspect the shadow root. Confirm:
- Dialog backdrop and content are inside `#shadow-root`
- Select dropdowns open inside `#shadow-root` (not attached to `<body>`)
- Tooltips appear inside `#shadow-root`

**Step 4: Final commit**

```bash
git commit --allow-empty -m "chore: complete shadcn-solid migration"
```

---

## Migration summary

| Component | Before | After | Task |
|---|---|---|---|
| `Button` | raw `<button>` | `Button` (shadcn-solid) | 5–6 |
| `Dialog` | manual Portal + divs | `Dialog` (shadcn-solid) | 7–8 |
| FilterBar `<select>` × 4 | native | `Select` (shadcn-solid) | 9–10 |
| Jira form `<select>` × 3 | native | `Select` (shadcn-solid) | 9, 11 |
| `Tooltip` | custom delay logic | `Tooltip` (shadcn-solid) | 12–13 |
| `shadowRoot` prop | manual threading | auto via `ShadowRootContext` | 14 |

## Shadow DOM portal pattern

Every shadcn-solid `*Portal` component in `src/components/ui/` is patched once at copy-time:

```tsx
const FooPortal = (props) => {
  // useShadowRoot() returns ShadowRoot | null — NOT a signal. Never call it as shadowRoot().
  // Props spread BEFORE mount so the context value always wins over any caller-supplied mount.
  // Cast to HTMLElement if TypeScript rejects ShadowRoot for the mount prop type.
  const shadowRoot = useShadowRoot();
  return <FooPrimitive.Portal {...props} mount={(shadowRoot ?? document.body) as HTMLElement} />;
};
```

Callers never need to pass `mount` — the context does it automatically.

### Shadow DOM constraints to keep in mind

- `[data-kb-theme="dark"]` in the shadow stylesheet only matches elements **inside the shadow tree**. It cannot respond to `<html data-theme="dark">` or any host-page dark mode attribute.
- `@keyframes` from `tw-animate-css` must be verified to land in the shadow `<style>` block (see Task 3 verification steps) — keyframes defined in document stylesheets are invisible inside a shadow root.
- `@theme inline` tokens (`--color-primary` etc.) must also be in the shadow stylesheet, not emitted to a separate document-level `:root` rule.
