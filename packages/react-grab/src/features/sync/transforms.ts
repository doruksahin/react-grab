import type { CommentItem } from "../../types.js";
import type { SelectionGroup } from "../selection-groups/types.js";
import { loadToolbarState } from "../../components/toolbar/state.js";

const REVEALED_COMMENTS_KEY = "react-grab-revealed-comments";
const REVEALED_GROUPS_KEY = "react-grab-revealed-groups";

/**
 * Check if the parent reveal toggle is ON in localStorage (ToolbarState).
 * Used as fallback when per-item revealed states are missing from localStorage.
 */
const isParentRevealedOn = (): boolean => {
  const toolbarState = loadToolbarState();
  return toolbarState?.selectionsRevealed ?? false;
};

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
  let revealedMap: Record<string, boolean> | null = null;
  try {
    const stored = localStorage.getItem(REVEALED_COMMENTS_KEY);
    if (stored) revealedMap = JSON.parse(stored);
  } catch {
    // ignore
  }
  // If we have per-item overrides, use them.
  // Otherwise fall back to the parent toggle state from localStorage.
  const fallback = revealedMap === null ? isParentRevealedOn() : false;
  return serverItems.map((item) => ({
    ...item,
    revealed: revealedMap?.[item.id] ?? fallback,
  }));
};

/**
 * Merge local revealed states onto server groups.
 */
export const mergeRevealedIntoGroups = (
  serverGroups: Omit<SelectionGroup, "revealed">[],
): SelectionGroup[] => {
  let revealedMap: Record<string, boolean> | null = null;
  try {
    const stored = localStorage.getItem(REVEALED_GROUPS_KEY);
    if (stored) revealedMap = JSON.parse(stored);
  } catch {
    // ignore
  }
  const fallback = revealedMap === null ? isParentRevealedOn() : false;
  return serverGroups.map((group) => ({
    ...group,
    revealed: revealedMap?.[group.id] ?? fallback,
  }));
};
