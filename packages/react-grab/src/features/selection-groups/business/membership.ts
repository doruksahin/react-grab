/**
 * Membership predicates for selections relative to groups.
 *
 * Every selection always belongs to a group (real or synthetic).
 * These predicates classify items for rendering and business rules.
 */
import type { CommentItem } from "../../../types.js";
import type { SelectionGroup } from "../types.js";
import { isSynthetic } from "./synthetic-group.js";

interface HasMembership {
  groupId: string | null;
}

export const belongsTo = (item: HasMembership, groupId: string): boolean =>
  item.groupId === groupId;

/**
 * Single source of truth for "should this item be rendered as a loose card?"
 *
 * An item is presented as loose when it lives in a synthetic group that
 * contains exactly one item. Synthetic groups are invisible to the user —
 * their single item renders as ungrouped in every surface.
 *
 * This predicate is the only place that knows about the synthetic-group
 * rendering rule. Every render path consults this function rather than
 * reimplementing the check.
 */
export const isPresentedAsLoose = (
  item: CommentItem,
  groups: SelectionGroup[],
  allItems: CommentItem[],
): boolean => {
  if (item.groupId === null) return true;
  const group = groups.find((g) => g.id === item.groupId);
  if (!group || !isSynthetic(group)) return false;
  const count = allItems.reduce(
    (n, i) => (i.groupId === group.id ? n + 1 : n),
    0,
  );
  return count === 1;
};
