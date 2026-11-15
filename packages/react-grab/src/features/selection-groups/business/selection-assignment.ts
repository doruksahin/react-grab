import type { CommentItem } from "../../../types.js";

/**
 * Low-level writers for `selection.groupId`. Only membership-policy.ts
 * calls them, after the policy accepted the change.
 */

export const assignSelection = (
  items: CommentItem[],
  itemId: string,
  groupId: string,
): CommentItem[] => items.map((i) => (i.id === itemId ? { ...i, groupId } : i));

export const bulkAssignSelections = (
  items: CommentItem[],
  itemIds: Set<string>,
  groupId: string,
): CommentItem[] =>
  items.map((i) => (itemIds.has(i.id) ? { ...i, groupId } : i));
