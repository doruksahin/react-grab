/**
 * Idempotent migration helper for legacy persisted selections whose
 * `groupId` was the synthetic `"default"` sentinel, `undefined`, or
 * missing entirely. Maps all three to `null`. Real group IDs pass through.
 */
export const migrateLegacyDefaultGroup = <T extends { groupId: string | null }>(
  items: T[],
): T[] =>
  items.map((i) => {
    const raw = (i as { groupId?: unknown }).groupId;
    if (raw === "default" || raw === undefined || raw === null) {
      return { ...i, groupId: null };
    }
    return i;
  });
