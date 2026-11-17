/**
 * Membership policy: the one place that decides whether a selection may
 * change group, and the commands that apply such a change.
 *
 * Invariants (ADR-0008, SPEC-011):
 *   1. A locked selection (its group has a ticket) never leaves its group or
 *      the list, and a ticketed group cannot be deleted from under it.
 *   2. A selection can only move into a group that exists, has no ticket and
 *      is not synthetic.
 *   3. A selection always has a group. Leaving a real group (moving to
 *      "Ungrouped", or deleting the group) gives it a new synthetic group of
 *      its own.
 *   4. A synthetic group has exactly one member: new selections get their
 *      own, nothing moves into one, and an emptied one is garbage-collected
 *      by the caller (`gcEmptySyntheticGroups`).
 *
 * The query `assignableGroupsFor` and the commands share the same predicates,
 * so a surface that offers only assignable groups never offers a move the
 * command refuses. Pure functions: no signals, no persistence.
 */
import { isArchived, isSelectionArchived } from "./archive-policy.js";
import type { CommentItem } from "../../../types.js";
import type { SelectionGroup } from "../types.js";
import {
  assignSelection,
  bulkAssignSelections,
} from "./selection-assignment.js";
import { createSyntheticGroupForItem, isSynthetic } from "./synthetic-group.js";
import {
  canRemoveSelection,
  isSelectionLocked,
  isTicketed,
} from "./ticket-lock.js";

interface HasMembership {
  groupId: string | null;
}

export type TargetRefusal =
  | "target-not-found"
  | "target-ticketed"
  | "target-synthetic"
  | "target-archived";

export type SelectionRefusal =
  | "selection-not-found"
  | "selection-locked"
  | "selection-archived";

export type GroupDeletionRefusal = "group-not-found" | "group-ticketed";

export type ArchivedGroupDeletionRefusal =
  | GroupDeletionRefusal
  | "group-not-archived";

/** An accepted change carries the next items and groups; persist both. */
interface MembershipChange {
  items: CommentItem[];
  groups: SelectionGroup[];
}

export type MoveResult =
  | ({ status: "moved" } & MembershipChange)
  | { status: "refused"; reason: SelectionRefusal | TargetRefusal };

export interface RefusedSelection {
  itemId: string;
  reason: SelectionRefusal;
}

/**
 * A bulk move refuses as a whole when the target is refused, or when no
 * selection could move. Otherwise the movable selections move and each one
 * left behind is listed with its reason.
 */
export type BulkMoveResult =
  | ({
      status: "moved";
      movedIds: string[];
      refused: RefusedSelection[];
    } & MembershipChange)
  | { status: "refused"; reason: SelectionRefusal | TargetRefusal };

export type DeleteGroupResult =
  | ({ status: "deleted" } & MembershipChange)
  | { status: "refused"; reason: GroupDeletionRefusal };

export type DeleteArchivedGroupResult =
  | ({ status: "deleted" } & MembershipChange)
  | { status: "refused"; reason: ArchivedGroupDeletionRefusal };

export type RemoveResult =
  | { status: "removed"; items: CommentItem[] }
  | { status: "refused"; reason: SelectionRefusal };

/** What clearing left: the locked and archived selections, and how many were deleted. */
export interface ClearResult {
  items: CommentItem[];
  removed: number;
}

/** How many selections "Clear all" deletes, and how many stay locked. */
export interface ClearCounts {
  removed: number;
  kept: number;
}

/** Why a group cannot receive selections, or null when it can. */
const refusalForGroup = (group: SelectionGroup): TargetRefusal | null => {
  // An archived group is off the board (ADR-0030): nothing moves or lands in it.
  if (isArchived(group)) return "target-archived";
  if (isTicketed(group)) return "target-ticketed";
  if (isSynthetic(group)) return "target-synthetic";
  return null;
};

/** Why a selection cannot move into `groupId`; null (leave every group) is allowed. */
const refusalForTarget = (
  groupId: string | null,
  groups: SelectionGroup[],
): TargetRefusal | null => {
  if (groupId === null) return null;
  const group = groups.find((g) => g.id === groupId);
  return group ? refusalForGroup(group) : "target-not-found";
};

const refusalForSelection = (
  item: HasMembership | undefined,
  groups: SelectionGroup[],
): SelectionRefusal | null => {
  if (!item) return "selection-not-found";
  if (isSelectionLocked(item, groups)) return "selection-locked";
  // An archived group goes as a whole; one selection never leaves it (ADR-0030).
  return isSelectionArchived(item, groups) ? "selection-archived" : null;
};

/**
 * Why a selection cannot be removed: a ticket keeps it (ADR-0008), and one
 * in an archived real group goes only with its group (ADR-0030). An archived
 * loose selection may be removed: its synthetic group is just itself.
 */
const refusalForRemoval = (
  item: HasMembership | undefined,
  groups: SelectionGroup[],
): SelectionRefusal | null => {
  if (!item) return "selection-not-found";
  if (isSelectionLocked(item, groups)) return "selection-locked";
  const group = groups.find((candidate) => candidate.id === item.groupId);
  return group && isArchived(group) && !isSynthetic(group)
    ? "selection-archived"
    : null;
};

/** Whether a selection may be removed on its own. */
export const isRemovable = (
  item: HasMembership,
  groups: SelectionGroup[],
): boolean => refusalForRemoval(item, groups) === null;

/** Whether a selection may change group: not when it is locked or archived. */
export const canMoveSelection = (
  item: HasMembership,
  groups: SelectionGroup[],
): boolean => refusalForSelection(item, groups) === null;

/** The groups a selection may move into: none when it is locked or archived. */
export const assignableGroupsFor = (
  item: HasMembership,
  groups: SelectionGroup[],
): SelectionGroup[] => {
  if (refusalForSelection(item, groups)) return [];
  return groups.filter((group) => refusalForGroup(group) === null);
};

/** Each listed selection gets a new synthetic group of its own (invariant 3). */
const giveOwnSyntheticGroups = (
  items: CommentItem[],
  groups: SelectionGroup[],
  itemIds: ReadonlySet<string>,
): MembershipChange => {
  const created = new Map(
    items
      .filter((item) => itemIds.has(item.id))
      .map((item) => [item.id, createSyntheticGroupForItem(item)]),
  );
  return {
    items: items.map((item) => {
      const own = created.get(item.id);
      return own ? { ...item, groupId: own.id } : item;
    }),
    groups: [...groups, ...created.values()],
  };
};

const isLoose = (item: HasMembership, groups: SelectionGroup[]): boolean => {
  const group = groups.find((g) => g.id === item.groupId);
  return Boolean(group && isSynthetic(group));
};

/**
 * Moves a selection into a group, or out of every real group when the
 * target is null ("Ungrouped"): it then gets its own synthetic group, and a
 * selection that is already loose stays where it is.
 */
export const moveSelection = (
  items: CommentItem[],
  groups: SelectionGroup[],
  itemId: string,
  targetGroupId: string | null,
): MoveResult => {
  const item = items.find((entry) => entry.id === itemId);
  const reason =
    refusalForSelection(item, groups) ??
    refusalForTarget(targetGroupId, groups);
  if (reason || !item) {
    return { status: "refused", reason: reason ?? "selection-not-found" };
  }
  if (targetGroupId !== null) {
    return {
      status: "moved",
      items: assignSelection(items, itemId, targetGroupId),
      groups,
    };
  }
  if (isLoose(item, groups)) return { status: "moved", items, groups };
  return {
    status: "moved",
    ...giveOwnSyntheticGroups(items, groups, new Set([itemId])),
  };
};

export const moveSelections = (
  items: CommentItem[],
  groups: SelectionGroup[],
  itemIds: ReadonlySet<string>,
  targetGroupId: string,
): BulkMoveResult => {
  const targetRefusal = refusalForTarget(targetGroupId, groups);
  if (targetRefusal) return { status: "refused", reason: targetRefusal };

  const movedIds: string[] = [];
  const refused: RefusedSelection[] = [];
  for (const itemId of itemIds) {
    const reason = refusalForSelection(
      items.find((entry) => entry.id === itemId),
      groups,
    );
    if (reason) refused.push({ itemId, reason });
    else movedIds.push(itemId);
  }

  const [firstRefusal] = refused;
  if (movedIds.length === 0 && firstRefusal) {
    return { status: "refused", reason: firstRefusal.reason };
  }
  return {
    status: "moved",
    items: bulkAssignSelections(items, new Set(movedIds), targetGroupId),
    groups,
    movedIds,
    refused,
  };
};

const refusalForDeletion = (
  group: SelectionGroup | undefined,
): GroupDeletionRefusal | null => {
  if (!group) return "group-not-found";
  return isTicketed(group) ? "group-ticketed" : null;
};

/** Whether a group may be deleted: not while a ticket holds its selections. */
export const canDeleteGroup = (group: SelectionGroup): boolean =>
  refusalForDeletion(group) === null;

/** Deletes a group; each of its selections gets its own synthetic group. */
export const deleteGroup = (
  items: CommentItem[],
  groups: SelectionGroup[],
  groupId: string,
): DeleteGroupResult => {
  const reason = refusalForDeletion(groups.find((g) => g.id === groupId));
  if (reason) return { status: "refused", reason };
  const members = new Set(
    items.filter((item) => item.groupId === groupId).map((item) => item.id),
  );
  return {
    status: "deleted",
    ...giveOwnSyntheticGroups(
      items,
      groups.filter((g) => g.id !== groupId),
      members,
    ),
  };
};

/**
 * Deletes an archived group together with its selections (ADR-0030). Unlike
 * `deleteGroup`, its selections do not fall back to Ungrouped: they were off
 * the board and are deleted with it. A group with a ticket is never deleted.
 */
export const deleteArchivedGroup = (
  items: CommentItem[],
  groups: SelectionGroup[],
  groupId: string,
): DeleteArchivedGroupResult => {
  const group = groups.find((g) => g.id === groupId);
  const reason = refusalForDeletion(group);
  if (reason) return { status: "refused", reason };
  if (!isArchived(group))
    return { status: "refused", reason: "group-not-archived" };
  return {
    status: "deleted",
    items: items.filter((item) => item.groupId !== groupId),
    groups: groups.filter((group) => group.id !== groupId),
  };
};

/** Removes a selection; a locked one stays, removing it would orphan its ticket. */
export const removeSelection = (
  items: CommentItem[],
  groups: SelectionGroup[],
  itemId: string,
): RemoveResult => {
  const reason = refusalForRemoval(
    items.find((entry) => entry.id === itemId),
    groups,
  );
  if (reason) return { status: "refused", reason };
  return {
    status: "removed",
    items: items.filter((entry) => entry.id !== itemId),
  };
};

/**
 * Deletes every selection on the board that may be deleted and keeps the
 * locked ones: a selection with a ticket is never deleted (ADR-0008, amended
 * 2026-11-16). Archived selections are not on the board, so clearing it
 * never deletes them (ADR-0030). "Clear all" and the clear after "Copy all"
 * use this.
 */
export const clearSelections = (
  items: CommentItem[],
  groups: SelectionGroup[],
): ClearResult => {
  const kept = items.filter(
    (entry) =>
      isSelectionArchived(entry, groups) || !canRemoveSelection(entry, groups),
  );
  return { items: kept, removed: items.length - kept.length };
};

interface NewSelectionSeed {
  componentName?: string;
  elementName: string;
}

/**
 * The group a new selection goes into: the chosen group when it can take
 * selections, otherwise a new synthetic group of its own. Returns the
 * (possibly extended) groups; the caller persists them when they changed.
 */
export const groupForNewSelection = (
  seed: NewSelectionSeed,
  chosenGroupId: string | null,
  groups: SelectionGroup[],
): { groups: SelectionGroup[]; groupId: string } => {
  if (chosenGroupId && refusalForTarget(chosenGroupId, groups) === null) {
    return { groups, groupId: chosenGroupId };
  }
  const synthetic = createSyntheticGroupForItem(seed);
  return { groups: [...groups, synthetic], groupId: synthetic.id };
};
