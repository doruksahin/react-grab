import type { CommentItem } from "../../../types.js";
import type { SelectionGroup } from "../../selection-groups/types.js";

/** A comment as it is persisted: everything except the UI-only preview bounds. */
export type PersistedComment = Omit<CommentItem, "previewBounds">;

/**
 * The group fields a client may write. `status`, `jiraTicketId` and the Jira
 * display fields are deliberately absent: the server owns them (ADR-0019).
 */
export type PersistedGroup = Pick<
  SelectionGroup,
  "id" | "name" | "createdAt" | "synthetic" | "revealed"
>;

/*
 * The fields whose change counts as a change to persist. Change detection
 * compares these, and the HTTP wire format is built on them, so a change to
 * a local-only field never causes a write.
 */

export const persistedCommentFields = (item: CommentItem): PersistedComment => {
  const { previewBounds: _previewBounds, ...persisted } = item;
  return persisted;
};

export const persistedGroupFields = (
  group: SelectionGroup,
): PersistedGroup => ({
  id: group.id,
  name: group.name,
  createdAt: group.createdAt,
  ...(group.synthetic !== undefined ? { synthetic: group.synthetic } : {}),
  ...(group.revealed !== undefined ? { revealed: group.revealed } : {}),
});
