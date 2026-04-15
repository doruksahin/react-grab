import { createResource } from "solid-js";
import type { StorageAdapter } from "../types.js";
import type { SyncStoreHandle } from "../store/sync-store.js";

export const createCommentsResource = (
  adapter: () => StorageAdapter | null,
  store: SyncStoreHandle,
) => {
  const [resource, { mutate, refetch }] = createResource(
    adapter,
    async (adptr) => {
      const comments = await adptr.loadComments();
      store.reconcileComments(comments);
      return comments;
    },
    { initialValue: [] },
  );

  return { resource, mutate, refetch };
};
