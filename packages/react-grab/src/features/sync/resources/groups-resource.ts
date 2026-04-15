import { createResource } from "solid-js";
import type { StorageAdapter } from "../types.js";
import type { SyncStoreHandle } from "../store/sync-store.js";

export const createGroupsResource = (
  adapter: () => StorageAdapter | null,
  store: SyncStoreHandle,
) => {
  const [resource, { mutate, refetch }] = createResource(
    adapter,
    async (adptr) => {
      const groups = await adptr.loadGroups();
      store.reconcileGroups(groups);
      return groups;
    },
    { initialValue: [] },
  );

  return { resource, mutate, refetch };
};
