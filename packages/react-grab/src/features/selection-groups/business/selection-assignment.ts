import type { CommentItem } from "../../../types.js";

/**
 * The single writer module for `selection.groupId`. Every mutation that
 * changes a selection's group membership must go through here.
 */

export const assignSelection = (
  items: CommentItem[],
  itemId: string,
  groupId: string | null,
): CommentItem[] =>
  items.map((i) => (i.id === itemId ? { ...i, groupId } : i));

export const unassignSelectionsInGroup = (
  items: CommentItem[],
  groupId: string,
): CommentItem[] =>
  items.map((i) => (i.groupId === groupId ? { ...i, groupId: null } : i));
