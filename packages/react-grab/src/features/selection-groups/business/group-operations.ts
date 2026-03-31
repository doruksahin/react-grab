import type { CommentItem } from "../../../types.js";
import type { SelectionGroup } from "../types.js";
import { DEFAULT_GROUP_ID } from "../types.js";

export const getCommentsByGroup = (
  comments: CommentItem[],
  groupId: string,
): CommentItem[] => comments.filter((c) => c.groupId === groupId);

export const countByGroup = (
  comments: CommentItem[],
  groupId: string,
): number =>
  comments.reduce((n, c) => (c.groupId === groupId ? n + 1 : n), 0);

export const removeCommentsByGroup = (
  comments: CommentItem[],
  groupId: string,
): CommentItem[] => comments.filter((c) => c.groupId !== groupId);

export const groupComments = (
  groups: SelectionGroup[],
  comments: CommentItem[],
): Array<{ group: SelectionGroup; items: CommentItem[] }> =>
  groups.map((group) => ({
    group,
    items: comments.filter((c) => c.groupId === group.id),
  }));

export const isDefaultGroup = (groupId: string): boolean =>
  groupId === DEFAULT_GROUP_ID;

/**
 * Fuzzy match: checks if all characters in `query` appear in `text` in order.
 * Case-insensitive. Empty query matches everything.
 */
export const fuzzyMatchGroup = (text: string, query: string): boolean => {
  if (!query) return true;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let textIdx = 0;
  for (let i = 0; i < lowerQuery.length; i++) {
    const found = lowerText.indexOf(lowerQuery[i]!, textIdx);
    if (found === -1) return false;
    textIdx = found + 1;
  }
  return true;
};
