import type { CommentItem } from "../../../types.js";
import type { SelectionGroup } from "../types.js";
import { isPresentedAsLoose, presentedGroups } from "./membership.js";
import { groupComments } from "./group-operations.js";

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
 * sidebar both draw this.
 */
export const selectionTree = <Group extends SelectionGroup>(
  items: CommentItem[],
  groups: Group[],
): SelectionTree<Group> => ({
  ungrouped: items.filter((item) => isPresentedAsLoose(item, groups, items)),
  groups: groupComments(presentedGroups(groups, items), items),
});
