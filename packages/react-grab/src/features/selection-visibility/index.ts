import { createEffect, createMemo, on } from "solid-js";
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

  const showRevealedPreviews = () => {
    const disconnected = deps.disconnectedItemIds();
    for (const item of deps.commentItems()) {
      if (!item.revealed) continue;
      if (disconnected.has(item.id)) continue;
      const connectedElements = deps.getConnectedCommentElements(item);
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

  // Re-render reveal previews when:
  // - comment items change (toggles, additions, removals)
  // - disconnected set changes (DOM elements appear/disappear)
  // Both are reactive signals — no separate MutationObserver needed.
  // Uses the same disconnectedItemIds memo as the comments dropdown,
  // which is driven by a domMutationVersion signal in core.
  createEffect(
    on(
      () => [deps.commentItems(), deps.disconnectedItemIds()] as const,
      () => {
        clearRevealedPreviews();
        showRevealedPreviews();
      },
    ),
  );

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
