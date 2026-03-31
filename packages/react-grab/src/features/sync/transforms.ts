import type { CommentItem } from "../../types.js";
import type { SelectionGroup } from "../selection-groups/types.js";

const REVEALED_COMMENTS_KEY = "react-grab-revealed-comments";
const REVEALED_GROUPS_KEY = "react-grab-revealed-groups";

/**
 * Strip `revealed` from comments before sending to server.
 */
export const stripRevealedFromComments = (
  items: CommentItem[],
): Omit<CommentItem, "revealed">[] =>
  items.map(({ revealed, ...rest }) => rest);

/**
 * Strip `revealed` from groups before sending to server.
 */
export const stripRevealedFromGroups = (
  groups: SelectionGroup[],
): Omit<SelectionGroup, "revealed">[] =>
  groups.map(({ revealed, ...rest }) => rest);

/**
 * Save revealed states locally (localStorage) so they survive server round-trips.
 */
export const saveLocalRevealedStates = (
  items: CommentItem[],
  groups: SelectionGroup[],
): void => {
  try {
    const commentRevealed: Record<string, boolean> = {};
    for (const item of items) {
      if (item.revealed) commentRevealed[item.id] = true;
    }
    localStorage.setItem(REVEALED_COMMENTS_KEY, JSON.stringify(commentRevealed));

    const groupRevealed: Record<string, boolean> = {};
    for (const group of groups) {
      if (group.revealed) groupRevealed[group.id] = true;
    }
    localStorage.setItem(REVEALED_GROUPS_KEY, JSON.stringify(groupRevealed));
  } catch {
    // localStorage may be unavailable
  }
};

/**
 * Merge local revealed states onto server data.
 */
export const mergeRevealedIntoComments = (
  serverItems: Omit<CommentItem, "revealed">[],
): CommentItem[] => {
  let revealedMap: Record<string, boolean> = {};
  try {
    const stored = localStorage.getItem(REVEALED_COMMENTS_KEY);
    if (stored) revealedMap = JSON.parse(stored);
  } catch {
    // ignore
  }
  return serverItems.map((item) => ({
    ...item,
    revealed: revealedMap[item.id] ?? false,
  }));
};

/**
 * Merge local revealed states onto server groups.
 */
export const mergeRevealedIntoGroups = (
  serverGroups: Omit<SelectionGroup, "revealed">[],
): SelectionGroup[] => {
  let revealedMap: Record<string, boolean> = {};
  try {
    const stored = localStorage.getItem(REVEALED_GROUPS_KEY);
    if (stored) revealedMap = JSON.parse(stored);
  } catch {
    // ignore
  }
  return serverGroups.map((group) => ({
    ...group,
    revealed: revealedMap[group.id] ?? false,
  }));
};
