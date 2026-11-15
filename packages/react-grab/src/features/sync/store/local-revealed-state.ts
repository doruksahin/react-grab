import type { CommentItem } from "../../../types.js";
import type { SelectionGroup } from "../../selection-groups/types.js";

const REVEALED_COMMENTS_KEY = "react-grab-revealed-comments";
const REVEALED_GROUPS_KEY = "react-grab-revealed-groups";

/*
 * When revealed state is not synced (`SyncConfig.syncRevealedState: false`),
 * each browser keeps it in localStorage, keyed by item id.
 */

const collectRevealed = (
  items: ReadonlyArray<{ id: string; revealed?: boolean }>,
) => {
  const revealed: Record<string, boolean> = {};
  for (const item of items) {
    if (item.revealed) revealed[item.id] = true;
  }
  return revealed;
};

const isRevealedMap = (value: unknown): value is Record<string, boolean> =>
  typeof value === "object" &&
  value !== null &&
  Object.values(value).every((flag) => typeof flag === "boolean");

const readRevealed = (key: string): Record<string, boolean> => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return {};
    const parsed: unknown = JSON.parse(stored);
    return isRevealedMap(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

/** Saves both lists together, so writing one never wipes the other's flags. */
export const saveLocalRevealedStates = (
  items: CommentItem[],
  groups: SelectionGroup[],
): void => {
  try {
    localStorage.setItem(
      REVEALED_COMMENTS_KEY,
      JSON.stringify(collectRevealed(items)),
    );
    localStorage.setItem(
      REVEALED_GROUPS_KEY,
      JSON.stringify(collectRevealed(groups)),
    );
  } catch {
    // localStorage may be unavailable
  }
};

export const mergeRevealedIntoComments = (
  items: CommentItem[],
): CommentItem[] => {
  const revealed = readRevealed(REVEALED_COMMENTS_KEY);
  return items.map((item) => ({
    ...item,
    revealed: revealed[item.id] ?? false,
  }));
};

export const mergeRevealedIntoGroups = (
  groups: SelectionGroup[],
): SelectionGroup[] => {
  const revealed = readRevealed(REVEALED_GROUPS_KEY);
  return groups.map((group) => ({
    ...group,
    revealed: revealed[group.id] ?? false,
  }));
};
