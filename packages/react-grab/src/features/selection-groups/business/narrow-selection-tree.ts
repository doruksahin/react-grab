import type { CommentItem } from "../../../types.js";
import type { SelectionGroup } from "../types.js";
import type { SelectionTree } from "./selection-tree.js";

export interface SelectionTreeNarrowing {
  /** Picks selections (search, Flagged, the sidebar's status and Attention
   *  chips). A section with none of them hides. */
  itemFilter?: (item: CommentItem) => boolean;
  /** Picks groups (the filter menu's assignee, reporter, label and due date).
   *  A matching group shows even when it has no selections; a selection
   *  shows only in a matching group. */
  allowedGroupIds?: ReadonlySet<string> | null;
}

/** The selection tree as the sidebar's search and filters leave it (ADR-0028). */
export const narrowSelectionTree = <Group extends SelectionGroup>(
  tree: SelectionTree<Group>,
  { itemFilter, allowedGroupIds }: SelectionTreeNarrowing,
): SelectionTree<Group> => {
  if (!itemFilter && !allowedGroupIds) return tree;
  const inAllowedGroup = (item: CommentItem) =>
    !allowedGroupIds ||
    (item.groupId != null && allowedGroupIds.has(item.groupId));
  const shows = (item: CommentItem) =>
    inAllowedGroup(item) && (!itemFilter || itemFilter(item));
  return {
    ungrouped: tree.ungrouped.filter(shows),
    groups: tree.groups
      .filter(
        (section) => !allowedGroupIds || allowedGroupIds.has(section.group.id),
      )
      .map((section) => ({ ...section, items: section.items.filter(shows) }))
      .filter((section) => !itemFilter || section.items.length > 0),
  };
};
