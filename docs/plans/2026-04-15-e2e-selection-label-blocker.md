# Blocker: Make revealed selections render as selection labels in E2E tests

> **For Claude:** This is a continuation prompt. Read this document fully before doing anything.

## Problem

The JIRA comment editor renders inside the **selection label** (floating popup anchored to DOM elements), NOT the sidebar. E2E tests need to screenshot this UI, but revealed selections from the mock server never appear as labels on the canvas.

## What works

- `initSync()` fires on port 5176 (mock mode) — confirmed by mock server receiving `listComments` + `listGroups` requests
- Mock fixtures return 2 selections: `sel-1` (revealed: true, groupId: grp-1, elementSelectors: ["nav.main-nav"]) and `sel-2`
- The e2e-app has matching `<nav class="main-nav">` element on the page
- `document.querySelector("nav.main-nav")` returns the element (confirmed)
- The overlay initializes (toolbar visible, `__REACT_GRAB__` API available)

## What doesn't work

After page load + overlay init, `store.labelInstances` is empty. No selection labels render. No grabbed boxes render. The reveal system doesn't create labels.

## The natural mechanism (found via Serena)

The codebase HAS a reveal system that should do exactly what we need:

1. **`createSelectionVisibility`** (`src/features/selection-visibility/index.ts`) — has a `createEffect` that watches `commentItems()` changes
2. **`showRevealedPreviews()`** — iterates items where `item.revealed === true`, calls `getConnectedCommentElements(item)`
3. **`reacquireCommentElements()`** (`src/core/index.tsx:428-446`) — uses `document.querySelector(selector)` with `item.elementSelectors`
4. **`addCommentItemPreview()`** (`src/core/index.tsx:3785-3827`) — creates label instance WITH `itemId` and `groupId`
5. **`computedLabelInstancesWithStatus`** (`src/core/index.tsx:3885-3929`) — enriches label with JIRA data from the group

When this chain works, the selection label appears with full JIRA comments, editor, toolbar — the UI shown in the user's reference screenshots.

## What to investigate

### Hypothesis 1: Timing — `init()` vs `initSync()` race

`initSync()` is called in `main.tsx` before React renders. `init()` is called by the Playwright fixture AFTER `page.goto()`. The reactive system (createEffect, createMemo) only exists after `init()` runs. If `initSync`'s async fetch completes before `init()`, the `commentItems` signal might not be set up yet to receive the data.

**Check:** Read `initSync()` (core/index.tsx:227-264) and `init()` (the createRoot callback). Trace how `commentItems` signal is created and when `initCommentStorage(adapter)` populates it. Does the data arrive before or after the reactive effects are set up?

### Hypothesis 2: `syncRevealedState` stripping

With `syncRevealedState: false` (the original config), `mergeRevealedIntoComments()` reads revealed states from localStorage (empty in tests) and overrides the server's `revealed: true` with `false`.

**Status:** Already changed to `syncRevealedState: true` in `.env.mock` config. Still didn't work. BUT — the dev server may have been serving cached/stale build. Need to verify with a clean restart.

### Hypothesis 3: The reveal effect needs `selectionsRevealed` toolbar state

The `createEffect` in `createSelectionVisibility` watches `commentItems()` + `disconnectedItemIds()`. It calls `showRevealedPreviews()` which checks `item.revealed` per-item (NOT the parent `selectionsRevealed` toggle). So the parent toggle shouldn't matter. But verify.

### Hypothesis 4: `commentItems` signal isn't populated

Maybe `initCommentStorage(adapter)` loads data into a different signal than what `createSelectionVisibility` watches. The `commentItems` in core/index.tsx line 382 is a destructured constant — is it the same reactive signal that the visibility effect depends on?

## Key files to read

| File | What to look at |
|---|---|
| `src/core/index.tsx:227-264` | `initSync()` — how it calls `initCommentStorage(adapter)` |
| `src/core/index.tsx:370-390` | Where `commentItems` signal is created inside `init()` |
| `src/core/index.tsx:3785-3827` | `addCommentItemPreview()` — creates label instances |
| `src/core/index.tsx:3885-3929` | `computedLabelInstancesWithStatus` — enriches with JIRA |
| `src/core/index.tsx:428-446` | `reacquireCommentElements()` — querySelector matching |
| `src/features/selection-visibility/index.ts` | The reveal effect + `showRevealedPreviews()` |
| `src/features/sync/adapter.ts:25-45` | How `loadComments` handles `syncRevealedState` |
| `packages/e2e-app/src/main.tsx` | Current init config |

## What success looks like

Running this test:
```ts
test("revealed selections show as labels", async ({ page, reactGrab, mockServer }) => {
  await expect.poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 }).toBe(true);
  await page.waitForTimeout(2000);
  await reactGrab.screenshot("revealed-labels", "page");
  // This screenshot should show the selection label anchored to nav.main-nav
  // with JIRA ticket ATT-101, comments from Alice and Bob, and the TipTap editor
});
```

And seeing a screenshot like the user's reference image — the dark card floating over the nav element with JIRA data, comment thread, and editor.

## Current branch

`feat/e2e-mock-infrastructure` — all mock infrastructure is committed and working. The blocker is only about rendering revealed selections as canvas labels.

## Test file for debugging

`packages/react-grab/e2e/mocked/reveal-test.spec.ts` — diagnostic test that checks label counts, state keys, mock server requests. Use it to verify fixes.
