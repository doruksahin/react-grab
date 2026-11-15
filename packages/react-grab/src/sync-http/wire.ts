import type { CommentItem } from "../shared-types.js";
import type { SelectionGroup } from "../features/selection-groups/types.js";
import type {
  ListComments200Item,
  UpsertCommentBody,
  UpsertGroupBody,
} from "../generated/sync-api.js";

/*
 * Translation between the overlay's items and what the server stores.
 *
 * Client `CommentItem.groupId` is `string | null` (`null` = ungrouped); the
 * server requires a string. On write `null` becomes `""`; on read `""` becomes
 * `null`. Real group ids pass through unchanged.
 */

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
    groupId: rest.groupId ?? "",
    ...(syncRevealed && revealed !== undefined ? { revealed } : {}),
  };
};

export const fromCommentWire = (item: ListComments200Item): CommentItem => ({
  ...item,
  groupId: item.groupId === "" ? null : item.groupId,
});

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
