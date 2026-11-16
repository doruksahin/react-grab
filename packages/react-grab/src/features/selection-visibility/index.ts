import { isSelectionArchived } from "../selection-groups/business/archive-policy.js";
import {
  type Accessor,
  createEffect,
  createMemo,
  onCleanup,
  untrack,
} from "solid-js";
import { keyArray } from "@solid-primitives/keyed";
import type { CommentItem } from "../../types.js";
import type {
  PreviewEntry,
  SelectionVisibilityAPI,
  SelectionVisibilityDeps,
} from "./types.js";
import { saveLocalRevealedStates } from "../sync/store/local-revealed-state.js";
import { isSamePreview, type PreviewSource } from "./business/same-preview.js";

const REVEAL_PREFIX = "reveal-pinned";

export function createSelectionVisibility(
  deps: SelectionVisibilityDeps,
): SelectionVisibilityAPI {
  const selectionsRevealed = createMemo(
    () => deps.currentToolbarState()?.selectionsRevealed ?? false,
  );

  // The selections to draw: revealed and with their elements on the page.
  // disconnectedItemIds follows DOM mutations (domMutationVersion in core).
  // An archived group's selections stay off the page (ADR-0030).
  const revealedItems = createMemo(() => {
    const disconnected = deps.disconnectedItemIds();
    const groups = deps.groups();
    return deps
      .commentItems()
      .filter(
        (item) =>
          item.revealed &&
          !disconnected.has(item.id) &&
          !isSelectionArchived(item, groups),
      );
  });

  // One reactive scope per revealed selection, keyed by id (keyArray from
  // @solid-primitives/keyed): items are rebuilt as new objects on every edit
  // or sync, and the scope receives the current one as an accessor. A
  // selection keeps its box and label while other selections change; its
  // scope ends — and its preview goes — when it is hidden, disconnected or
  // removed. External bridge: the overlay store.
  const drawPreview = (item: Accessor<CommentItem>) => {
    const source = createMemo<PreviewSource | undefined>(
      () => {
        void deps.disconnectedItemIds();
        return {
          item: item(),
          elements: deps.getConnectedCommentElements(item()),
        };
      },
      undefined,
      {
        equals: (previous, next) =>
          previous !== undefined &&
          next !== undefined &&
          isSamePreview(previous, next),
      },
    );

    createEffect(() => {
      const current = source();
      if (!current) return;
      const entries: PreviewEntry[] = [];
      untrack(() =>
        deps.addCommentItemPreview(
          current.item,
          current.elements.map((element) => deps.createElementBounds(element)),
          current.elements,
          REVEAL_PREFIX,
          entries,
        ),
      );
      onCleanup(() => {
        for (const { boxId, labelId } of entries) {
          deps.actions.removeGrabbedBox(boxId);
          if (labelId) deps.actions.removeLabelInstance(labelId);
        }
      });
    });
  };
  createMemo(keyArray(revealedItems, (item) => item.id, drawPreview));

  // Persistence, separate from drawing: revealed flags survive sync round-trips.
  createEffect(() => {
    saveLocalRevealedStates(deps.commentItems(), deps.groups());
  });

  const isItemRevealed = (commentItemId: string): boolean => {
    const item = deps.commentItems().find((i) => i.id === commentItemId);
    return item?.revealed ?? false;
  };

  const handleToggleItem = (commentItemId: string) => {
    const items = deps.commentItems();
    const updatedItems = items.map((item) =>
      item.id === commentItemId ? { ...item, revealed: !item.revealed } : item,
    );
    deps.setCommentItems(updatedItems);
    deps.persistCommentItems(updatedItems);
  };

  const handleToggleGroup = (groupId: string) => {
    const group = deps.groups().find((g) => g.id === groupId);
    if (!group) return;
    const newRevealed = !group.revealed;

    // Update the group's revealed state
    const updatedGroups = deps
      .groups()
      .map((g) => (g.id === groupId ? { ...g, revealed: newRevealed } : g));
    deps.persistGroups(updatedGroups);

    // Override all items in this group
    const items = deps.commentItems();
    const updatedItems = items.map((item) =>
      item.groupId === groupId ? { ...item, revealed: newRevealed } : item,
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

  // untrack: this function may be called from within a createEffect (e.g. the
  // sidebar's filter visibility effect). Without untrack, deps.groups() and
  // deps.commentItems() would register as dependencies of that outer effect,
  // and the subsequent persistGroups (which updates deps.groups()) would
  // re-trigger the caller — creating an infinite loop.
  const setGroupsRevealed = (
    visibleIds: Set<string>,
    allGroupIds: string[],
  ) => {
    const allIdSet = new Set(allGroupIds);
    const currentGroups = untrack(() => deps.groups());
    const updatedGroups = currentGroups.map((g) =>
      allIdSet.has(g.id) ? { ...g, revealed: visibleIds.has(g.id) } : g,
    );
    deps.persistGroups(updatedGroups);

    const items = untrack(() => deps.commentItems());
    const updatedItems = items.map((item) =>
      item.groupId && allIdSet.has(item.groupId)
        ? { ...item, revealed: visibleIds.has(item.groupId) }
        : item,
    );
    deps.setCommentItems(updatedItems);
    deps.persistCommentItems(updatedItems);
  };

  return {
    selectionsRevealed,
    isItemRevealed,
    handleToggleParent,
    handleToggleGroup,
    handleToggleItem,
    setGroupsRevealed,
  };
}

export type {
  SelectionVisibilityAPI,
  SelectionVisibilityDeps,
  PreviewEntry,
} from "./types.js";
