import { createEffect, createMemo, on, onCleanup } from "solid-js";
import type {
  PreviewEntry,
  SelectionVisibilityAPI,
  SelectionVisibilityDeps,
} from "./types.js";

const REVEAL_PREFIX = "reveal-pinned";

export function createSelectionVisibility(
  deps: SelectionVisibilityDeps,
): SelectionVisibilityAPI {
  // Private state — hover code CANNOT touch this
  let revealedPreviews: PreviewEntry[] = [];
  let mutationObserver: MutationObserver | null = null;

  const selectionsRevealed = createMemo(
    () => deps.currentToolbarState()?.selectionsRevealed ?? false,
  );

  const clearRevealedPreviews = () => {
    for (const { boxId, labelId } of revealedPreviews) {
      deps.actions.removeGrabbedBox(boxId);
      if (labelId) {
        deps.actions.removeLabelInstance(labelId);
      }
    }
    revealedPreviews = [];
  };

  const getRevealedItemsWithElements = () => {
    const results: {
      item: (typeof deps.commentItems extends () => (infer T)[] ? T : never);
      connectedElements: Element[];
    }[] = [];
    for (const item of deps.commentItems()) {
      if (!item.revealed) continue;
      const connectedElements = deps.getConnectedCommentElements(item);
      results.push({ item, connectedElements });
    }
    return results;
  };

  const showRevealedPreviews = () => {
    for (const { item, connectedElements } of getRevealedItemsWithElements()) {
      const previewBounds = connectedElements.map((element) =>
        deps.createElementBounds(element),
      );
      deps.addCommentItemPreview(
        item,
        previewBounds,
        connectedElements,
        REVEAL_PREFIX,
        revealedPreviews,
      );
    }
  };

  /**
   * Checks if any revealed items have unresolved elements (not yet in DOM).
   * Returns true if all revealed items have their elements available.
   */
  const allRevealedElementsResolved = (): boolean => {
    for (const item of deps.commentItems()) {
      if (!item.revealed) continue;
      if (deps.getConnectedCommentElements(item).length === 0) return false;
    }
    return true;
  };

  /**
   * Starts observing DOM mutations on document.body. On each mutation,
   * re-syncs revealed previews. This handles both directions:
   * - Elements appearing (host app mounts) → previews render
   * - Elements disappearing (navigation, lazy unload) → previews clear
   * Stops observing when all revealed items are resolved (no unresolved gaps).
   */
  const startObservingDOM = () => {
    stopObservingDOM();
    mutationObserver = new MutationObserver(() => {
      clearRevealedPreviews();
      showRevealedPreviews();
      // Stop observing once all revealed items have their elements
      if (allRevealedElementsResolved()) {
        stopObservingDOM();
      }
    });
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  };

  const stopObservingDOM = () => {
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
  };

  /**
   * Main sync function: render revealed previews, and if any elements are
   * missing (host app not ready), start observing DOM for when they appear.
   */
  const syncRevealedPreviews = () => {
    stopObservingDOM();
    clearRevealedPreviews();

    const hasRevealedItems = deps.commentItems().some((item) => item.revealed);
    if (!hasRevealedItems) return;

    showRevealedPreviews();

    // If some revealed items couldn't find their DOM elements,
    // observe mutations until they appear
    if (!allRevealedElementsResolved()) {
      startObservingDOM();
    }
  };

  // React to comment item changes (toggles, additions, removals)
  // NOTE: Must be called inside a reactive owner (e.g., the main createRoot
  // in core/index.tsx). The effect inherits ownership from the caller.
  createEffect(
    on(
      () => deps.commentItems(),
      () => syncRevealedPreviews(),
    ),
  );

  onCleanup(() => stopObservingDOM());

  const isItemRevealed = (commentItemId: string): boolean => {
    const item = deps.commentItems().find((i) => i.id === commentItemId);
    return item?.revealed ?? false;
  };

  const handleToggleItem = (commentItemId: string) => {
    const items = deps.commentItems();
    const updatedItems = items.map((item) =>
      item.id === commentItemId
        ? { ...item, revealed: !item.revealed }
        : item,
    );
    deps.setCommentItems(updatedItems);
    deps.persistCommentItems(updatedItems);
  };

  const handleToggleParent = () => {
    const newRevealed = !selectionsRevealed();

    // Override all children
    const items = deps.commentItems();
    const updatedItems = items.map((item) => ({
      ...item,
      revealed: newRevealed,
    }));
    deps.setCommentItems(updatedItems);
    deps.persistCommentItems(updatedItems);

    // Update toolbar state
    deps.updateToolbarState({ selectionsRevealed: newRevealed });
  };

  return {
    selectionsRevealed,
    isItemRevealed,
    handleToggleParent,
    handleToggleItem,
  };
}

export type { SelectionVisibilityAPI, SelectionVisibilityDeps, PreviewEntry } from "./types.js";
