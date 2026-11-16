import type { CommentItem } from "../../../types.js";
import type { SelectionGroup } from "../../selection-groups/types.js";
import {
  persistedCommentFields,
  persistedGroupFields,
} from "../business/persisted-fields.js";
import type { StorageAdapter } from "../types.js";
import {
  mergeRevealedIntoComments,
  mergeRevealedIntoGroups,
  rememberRevealed,
} from "./local-revealed-state.js";

const withoutRevealed = <Item extends { revealed?: boolean }>(
  item: Item,
): Omit<Item, "revealed"> => {
  const { revealed: _revealed, ...rest } = item;
  return rest;
};

/**
 * The whole policy for `syncRevealedState: false`: revealed state stays in
 * this browser's localStorage and never reaches the storage port. Loads take
 * it from localStorage, writes record it there and drop it. A write whose
 * remaining fields equal what the server last had is not sent, so toggling
 * visibility causes no request.
 */
export const withLocalRevealedState = (
  storage: StorageAdapter,
): StorageAdapter => {
  const serverFields = new Map<string, string>();
  const commentKey = (id: string) => `comment:${id}`;
  const groupKey = (id: string) => `group:${id}`;
  const recordComment = (item: CommentItem) =>
    serverFields.set(
      commentKey(item.id),
      JSON.stringify(persistedCommentFields(withoutRevealed(item))),
    );
  const recordGroup = (group: SelectionGroup) =>
    serverFields.set(
      groupKey(group.id),
      JSON.stringify(persistedGroupFields(withoutRevealed(group))),
    );

  return {
    uploadScreenshot: (selectionId, kind, blob) =>
      storage.uploadScreenshot(selectionId, kind, blob),
    loadScreenshot: (selectionId, kind) =>
      storage.loadScreenshot(selectionId, kind),
    uploadRecording: (commentId, gzipBlob) =>
      storage.uploadRecording(commentId, gzipBlob),
    loadComments: async () => {
      const items = await storage.loadComments();
      items.forEach(recordComment);
      return mergeRevealedIntoComments(items);
    },
    loadGroups: async () => {
      const groups = await storage.loadGroups();
      groups.forEach(recordGroup);
      return mergeRevealedIntoGroups(groups);
    },
    upsertComment: async (item) => {
      rememberRevealed("comments", item.id, Boolean(item.revealed));
      const persisted = withoutRevealed(item);
      const fields = JSON.stringify(persistedCommentFields(persisted));
      if (serverFields.get(commentKey(item.id)) === fields) return;
      await storage.upsertComment(persisted);
      serverFields.set(commentKey(item.id), fields);
    },
    upsertGroup: async (group) => {
      rememberRevealed("groups", group.id, Boolean(group.revealed));
      const persisted = withoutRevealed(group);
      const fields = JSON.stringify(persistedGroupFields(persisted));
      if (serverFields.get(groupKey(group.id)) === fields) return;
      await storage.upsertGroup(persisted);
      serverFields.set(groupKey(group.id), fields);
    },
    deleteComment: async (commentId) => {
      await storage.deleteComment(commentId);
      serverFields.delete(commentKey(commentId));
    },
    deleteGroup: async (groupId) => {
      await storage.deleteGroup(groupId);
      serverFields.delete(groupKey(groupId));
    },
    // The server owns the archive time; the local revealed state still applies.
    archiveGroup: async (groupId) => {
      const [group] = mergeRevealedIntoGroups([
        await storage.archiveGroup(groupId),
      ]);
      return group;
    },
    restoreGroup: async (groupId) => {
      const [group] = mergeRevealedIntoGroups([
        await storage.restoreGroup(groupId),
      ]);
      return group;
    },
  };
};
