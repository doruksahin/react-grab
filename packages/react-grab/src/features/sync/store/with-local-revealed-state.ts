import type { StorageAdapter } from "../types.js";
import {
  mergeRevealedIntoComments,
  mergeRevealedIntoGroups,
} from "./local-revealed-state.js";

/**
 * Keeps revealed state out of the storage port: loads take it from
 * localStorage, writes drop it. Used when `syncRevealedState` is false.
 */
export const withLocalRevealedState = (
  storage: StorageAdapter,
): StorageAdapter => ({
  ...storage,
  loadComments: async () =>
    mergeRevealedIntoComments(await storage.loadComments()),
  loadGroups: async () => mergeRevealedIntoGroups(await storage.loadGroups()),
  upsertComment: (item) => {
    const { revealed: _revealed, ...rest } = item;
    return storage.upsertComment(rest);
  },
  upsertGroup: (group) => {
    const { revealed: _revealed, ...rest } = group;
    return storage.upsertGroup(rest);
  },
});
