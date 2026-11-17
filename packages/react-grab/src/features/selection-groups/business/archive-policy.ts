/**
 * Archiving (ADR-0030): the step before delete. A selection always has a
 * group (ADR-0008), so archiving is always a group's: a real group as a
 * whole, a loose selection through its own synthetic group. Archived groups
 * keep everything; views leave them out, and the sidebar lists them under
 * "Archived". Delete keeps its own rule: nothing with a ticket.
 */
import type { SelectionGroup } from "../types.js";
import { isSynthetic } from "./synthetic-group.js";
import { isTicketed } from "./ticket-lock.js";

interface HasMembership {
  groupId: string | null;
}

type ArchiveFields = Pick<SelectionGroup, "archivedAt">;

export const isArchived = (group: ArchiveFields | undefined): boolean =>
  group?.archivedAt !== undefined && group.archivedAt !== null;

/** Any group still on the board can be archived. */
export const canArchive = (group: SelectionGroup): boolean =>
  !isArchived(group);

const groupOf = <Group extends SelectionGroup>(
  item: HasMembership,
  groups: Group[],
): Group | undefined =>
  item.groupId === null
    ? undefined
    : groups.find((candidate) => candidate.id === item.groupId);

const memberCount = (items: HasMembership[], groupId: string): number =>
  items.filter((item) => item.groupId === groupId).length;

/** Whether a selection sits in an archived group. */
export const isSelectionArchived = (
  item: HasMembership,
  groups: SelectionGroup[],
): boolean => isArchived(groupOf(item, groups));

/** The selections still on the board. */
export const activeSelections = <Item extends HasMembership>(
  items: Item[],
  groups: SelectionGroup[],
): Item[] => items.filter((item) => !isSelectionArchived(item, groups));

/** A group and how many selections go with it. */
export interface GroupScope<Group extends SelectionGroup> {
  group: Group;
  selectionCount: number;
}

/** What archiving a selection archives: its group, as a whole. */
export const archiveScopeFor = <Group extends SelectionGroup>(
  item: HasMembership,
  groups: Group[],
  items: HasMembership[],
): GroupScope<Group> | undefined => {
  const group = groupOf(item, groups);
  if (!group || !canArchive(group)) return undefined;
  return { group, selectionCount: memberCount(items, group.id) };
};

/** What restoring an archived selection restores: its group. */
export const restoreScopeFor = <Group extends SelectionGroup>(
  item: HasMembership,
  groups: Group[],
  items: HasMembership[],
): GroupScope<Group> | undefined => {
  const group = groupOf(item, groups);
  if (!group || !isArchived(group)) return undefined;
  return { group, selectionCount: memberCount(items, group.id) };
};

/**
 * What deleting an archived selection deletes, only without a ticket: a
 * loose one is removed on its own; one in a real group goes with the group.
 */
export type ArchivedDeletion<Group extends SelectionGroup> =
  | { kind: "selection" }
  | ({ kind: "group" } & GroupScope<Group>);

export const archivedDeletionFor = <Group extends SelectionGroup>(
  item: HasMembership,
  groups: Group[],
  items: HasMembership[],
): ArchivedDeletion<Group> | undefined => {
  const group = groupOf(item, groups);
  if (!group || !isArchived(group) || isTicketed(group)) return undefined;
  if (isSynthetic(group)) return { kind: "selection" };
  return { kind: "group", group, selectionCount: memberCount(items, group.id) };
};
