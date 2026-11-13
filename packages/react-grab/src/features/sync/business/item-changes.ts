export interface ItemChanges<Item> {
  /** Items that are new, or whose server-visible fields changed. */
  upserts: Item[];
  /** Ids present before and absent now. */
  deletedIds: string[];
}

/**
 * Turns "the list before" and "the list after" a local change into the
 * per-item writes the sync server accepts (ADR-0019).
 *
 * Both lists are this client's own view, so the result is exactly what this
 * client changed — never an item another person added, which is what the old
 * whole-list write used to erase.
 *
 * `toWire` projects an item onto the fields the server stores, so a change to
 * a local-only field (preview bounds, a revealed flag that is not synced)
 * does not cause a write.
 */
export const itemChanges = <Item extends { id: string }>(
  previous: readonly Item[],
  next: readonly Item[],
  toWire: (item: Item) => unknown,
): ItemChanges<Item> => {
  const previousById = new Map(previous.map((item) => [item.id, item]));
  const nextIds = new Set(next.map((item) => item.id));

  const upserts = next.filter((item) => {
    const before = previousById.get(item.id);
    if (before === item) return false;
    if (!before) return true;
    return JSON.stringify(toWire(before)) !== JSON.stringify(toWire(item));
  });

  const deletedIds = previous
    .filter((item) => !nextIds.has(item.id))
    .map((item) => item.id);

  return { upserts, deletedIds };
};
