import type { CommentItem } from "../shared-types.js";
import type { SelectionGroup } from "../features/selection-groups/types.js";
import {
  persistedCommentFields,
  persistedGroupFields,
} from "../features/sync/business/persisted-fields.js";
import type {
  ListComments200Item,
  UpsertCommentBody,
  UpsertGroupBody,
} from "../generated/sync-api.js";

/*
 * Translation between the overlay's persisted fields and what the server
 * stores. Client `CommentItem.groupId` is `string | null` (`null` =
 * ungrouped); the server requires a string. On write `null` becomes `""`; on
 * read `""` becomes `null`. Real group ids pass through unchanged.
 */

export const toCommentWire = (item: CommentItem): UpsertCommentBody => {
  const persisted = persistedCommentFields(item);
  return { ...persisted, groupId: persisted.groupId ?? "" };
};

export const fromCommentWire = (item: ListComments200Item): CommentItem => ({
  ...item,
  groupId: item.groupId === "" ? null : item.groupId,
});

export const toGroupWire = (group: SelectionGroup): UpsertGroupBody =>
  persistedGroupFields(group);
