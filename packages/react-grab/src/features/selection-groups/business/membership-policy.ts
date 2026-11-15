/**
 * Membership policy: the one place that decides whether a selection may
 * change group, and the commands that apply such a change.
 *
 * Invariants (ADR-0008, SPEC-011):
 *   1. A locked selection (its group has a ticket) never leaves its group,
 *      and a ticketed group cannot be deleted from under it.
 *   2. A selection can only move into a group that exists, has no ticket and
 *      is not synthetic.
 *   3. A synthetic group has exactly one member: new selections get their
 *      own, nothing moves into one, and an emptied one is garbage-collected
 *      by the caller (`gcEmptySyntheticGroups`).
 *
 * The query `assignableGroupsFor` and the commands share the same predicates,
 * so a surface that offers only assignable groups never offers a move the
 * command refuses. Pure functions: no signals, no persistence.
 */
import type { CommentItem } from "../../../types.js";
import type { SelectionGroup } from "../types.js";
import {
  assignSelection,
  bulkAssignSelections,
  unassignSelectionsInGroup,
} from "./selection-assignment.js";
import { createSyntheticGroupForItem, isSynthetic } from "./synthetic-group.js";
import { isSelectionLocked, isTicketed } from "./ticket-lock.js";

interface HasMembership {
  groupId: string | null;
}

export type TargetRefusal =
  | "target-not-found"
  | "target-ticketed"
  | "target-synthetic";

export type SelectionRefusal = "selection-not-found" | "selection-locked";

export type GroupDeletionRefusal = "group-not-found" | "group-ticketed";

export type MoveResult =
  | { status: "moved"; items: CommentItem[] }
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
  | {
      status: "moved";
      items: CommentItem[];
      movedIds: string[];
      refused: RefusedSelection[];
    }
  | { status: "refused"; reason: SelectionRefusal | TargetRefusal };

export type DeleteGroupResult =
  | { status: "deleted"; items: CommentItem[]; groups: SelectionGroup[] }
  | { status: "refused"; reason: GroupDeletionRefusal };

/** Why a group cannot receive selections, or null when it can. */
const refusalForGroup = (group: SelectionGroup): TargetRefusal | null => {
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
  return isSelectionLocked(item, groups) ? "selection-locked" : null;
};

/** The groups a selection may move into: none when it is locked. */
export const assignableGroupsFor = (
  item: HasMembership,
  groups: SelectionGroup[],
): SelectionGroup[] => {
  if (refusalForSelection(item, groups)) return [];
  return groups.filter((group) => refusalForGroup(group) === null);
};

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
  if (reason) return { status: "refused", reason };
  return {
    status: "moved",
    items: assignSelection(items, itemId, targetGroupId),
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

/** Deletes a group; its selections are left without a group. */
export const deleteGroup = (
  items: CommentItem[],
  groups: SelectionGroup[],
  groupId: string,
): DeleteGroupResult => {
  const reason = refusalForDeletion(groups.find((g) => g.id === groupId));
  if (reason) return { status: "refused", reason };
  return {
    status: "deleted",
    items: unassignSelectionsInGroup(items, groupId),
    groups: groups.filter((g) => g.id !== groupId),
  };
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
