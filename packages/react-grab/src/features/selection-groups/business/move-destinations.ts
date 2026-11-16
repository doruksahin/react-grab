import type { SelectionGroup } from "../types.js";
import { assignableGroupsFor } from "./membership-policy.js";

/** A place a selection can move to; `id: null` is Ungrouped. */
export interface MoveDestination {
  id: string | null;
  name: string;
}

/**
 * Where a selection can move: Ungrouped, then each group it may join,
 * leaving out where it already is. A locked selection has none (ADR-0008).
 */
export const moveDestinations = (
  item: { groupId: string | null },
  groups: SelectionGroup[],
): MoveDestination[] => {
  const targets = assignableGroupsFor(item, groups);
  if (targets.length === 0) return [];
  const currentGroupId = item.groupId;
  const ungrouped: MoveDestination[] =
    currentGroupId === null ? [] : [{ id: null, name: "Ungrouped" }];
  return [
    ...ungrouped,
    ...targets
      .filter((group) => group.id !== currentGroupId)
      .map((group) => ({ id: group.id, name: group.name })),
  ];
};
