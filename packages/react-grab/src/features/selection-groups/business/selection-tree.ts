import type { CommentItem } from "../../../types.js";
import type { SelectionGroup } from "../types.js";
import { isPresentedAsLoose, presentedGroups } from "./membership.js";
import { groupComments } from "./group-operations.js";
import {
  activeSelections,
  isArchived,
  isSelectionArchived,
} from "./archive-policy.js";

export interface SelectionTreeSection<Group extends SelectionGroup> {
  group: Group;
  items: CommentItem[];
}

/** Selections as both surfaces show them: Ungrouped first, then each group. */
export interface SelectionTree<Group extends SelectionGroup> {
  ungrouped: CommentItem[];
  groups: SelectionTreeSection<Group>[];
}

/**
 * The one tree of selections (ADR-0028). Loose selections, in no group or
 * alone in a synthetic one, go to Ungrouped; every presented group follows
 * with its selections, empty groups included. The comments menu and the
 * sidebar both draw this. Archived groups and their selections are left
 * out (ADR-0030); `archivedSelectionTree` holds them.
 */
const buildTree = <Group extends SelectionGroup>(
  items: CommentItem[],
  groups: Group[],
): SelectionTree<Group> => ({
  ungrouped: items.filter((item) => isPresentedAsLoose(item, groups, items)),
  groups: groupComments(presentedGroups(groups, items), items),
});

export const selectionTree = <Group extends SelectionGroup>(
  items: CommentItem[],
  groups: Group[],
): SelectionTree<Group> =>
  buildTree(
    activeSelections(items, groups),
    groups.filter((group) => !isArchived(group)),
  );

/**
 * The archived part of the tree (ADR-0030), drawn the same way: a loose
 * selection whose own synthetic group was archived goes to its Ungrouped,
 * an archived real group follows with its selections.
 */
export const archivedSelectionTree = <Group extends SelectionGroup>(
  items: CommentItem[],
  groups: Group[],
): SelectionTree<Group> =>
  buildTree(
    items.filter((item) => isSelectionArchived(item, groups)),
    groups.filter((group) => isArchived(group)),
  );
