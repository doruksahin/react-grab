import type { CommentItem } from "../../types.js";
import type { SelectionGroup } from "../selection-groups/types.js";
import type {
  UpsertCommentBody,
  UpsertGroupBody,
} from "../../generated/sync-api.js";

const REVEALED_COMMENTS_KEY = "react-grab-revealed-comments";
const REVEALED_GROUPS_KEY = "react-grab-revealed-groups";

/**
 * Wire-format translation for the optional-group-membership refactor.
 *
 * Client `CommentItem.groupId` is `string | null` (`null` = ungrouped).
 * Server schema (`features/sync/schemas.ts`) is `z.string()` — required,
 * non-null. Decision: client-side override + translate at this boundary.
 *   - On write: `null` becomes `""`.
 *   - On read:  `""` (and any falsy value) becomes `null`.
 * Real group IDs pass through unchanged.
 */
const groupIdToWire = (id: string | null): string => (id === null ? "" : id);
const groupIdFromWire = (id: string | null): string | null =>
  id === "" || id === null ? null : id;

/**
 * The comment as the server stores it: `groupId` in wire format, no UI-only
 * preview bounds, and `revealed` only when revealed state is synced.
 */
export const toCommentWire = (
  item: CommentItem,
  syncRevealed: boolean,
): UpsertCommentBody => {
  const { previewBounds: _previewBounds, revealed, ...rest } = item;
  return {
    ...rest,
    groupId: groupIdToWire(rest.groupId),
    ...(syncRevealed && revealed !== undefined ? { revealed } : {}),
  };
};

/**
 * The group fields a client may write. `status`, `jiraTicketId` and the Jira
 * display fields are deliberately absent: the server owns them (ADR-0019).
 */
export const toGroupWire = (
  group: SelectionGroup,
  syncRevealed: boolean,
): UpsertGroupBody => ({
  id: group.id,
  name: group.name,
  createdAt: group.createdAt,
  ...(group.synthetic !== undefined ? { synthetic: group.synthetic } : {}),
  ...(syncRevealed && group.revealed !== undefined
    ? { revealed: group.revealed }
    : {}),
});

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
    localStorage.setItem(
      REVEALED_COMMENTS_KEY,
      JSON.stringify(commentRevealed),
    );

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
    groupId: groupIdFromWire(item.groupId),
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
