import type { ItemChanges } from "./item-changes.js";

/**
 * Applies this client's own changes (from `itemChanges`) to a list loaded
 * from the server: changed items replace the server's copy, new items come
 * first, deleted items are removed. Items only the server has are kept.
 */
export const applyItemChanges = <Item extends { id: string }>(
  serverItems: readonly Item[],
  changes: ItemChanges<Item>,
): Item[] => {
  const deletedIds = new Set(changes.deletedIds);
  const upsertsById = new Map(changes.upserts.map((item) => [item.id, item]));
  const serverIds = new Set(serverItems.map((item) => item.id));
  const added = changes.upserts.filter((item) => !serverIds.has(item.id));
  const kept = serverItems
    .filter((item) => !deletedIds.has(item.id))
    .map((item) => upsertsById.get(item.id) ?? item);
  return [...added, ...kept];
};
