import { createEffect, createMemo, on } from "solid-js";
import type {
  PreviewEntry,
  SelectionVisibilityAPI,
  SelectionVisibilityDeps,
} from "./types.js";
import { saveLocalRevealedStates } from "../sync/transforms.js";

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
      ([items, disconnected]) => {
        const revealedCount = items.filter((i) => i.revealed).length;
        const disconnectedCount = disconnected.size;
        console.log(`[reveal-debug] effect fired: items=${items.length} revealed=${revealedCount} disconnected=${disconnectedCount}`);
        clearRevealedPreviews();
        showRevealedPreviews();
        console.log(`[reveal-debug] after show: previews=${revealedPreviews.length}`);
        // Persist revealed states locally for sync round-trip survival
        saveLocalRevealedStates(deps.commentItems(), deps.groups());
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

  const handleToggleGroup = (groupId: string) => {
    const group = deps.groups().find((g) => g.id === groupId);
    if (!group) return;
    const newRevealed = !group.revealed;

    // Update the group's revealed state
    const updatedGroups = deps.groups().map((g) =>
      g.id === groupId ? { ...g, revealed: newRevealed } : g,
    );
    deps.persistGroups(updatedGroups);

    // Override all items in this group
    const items = deps.commentItems();
    const updatedItems = items.map((item) =>
      item.groupId === groupId
        ? { ...item, revealed: newRevealed }
        : item,
    );
    deps.setCommentItems(updatedItems);
    deps.persistCommentItems(updatedItems);
  };

  const handleToggleParent = () => {
    const newRevealed = !selectionsRevealed();

    // Override all groups
    const updatedGroups = deps.groups().map((group) => ({
      ...group,
      revealed: newRevealed,
    }));
    deps.persistGroups(updatedGroups);

    // Override all items
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
    handleToggleGroup,
    handleToggleItem,
  };
}

export type { SelectionVisibilityAPI, SelectionVisibilityDeps, PreviewEntry } from "./types.js";
