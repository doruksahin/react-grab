/**
 * Archiving (ADR-0030): a group with a Jira ticket, real or synthetic, can
 * be taken off the board and restored. It keeps its selections and its
 * ticket; views leave it out, and the sidebar lists it under "Archived".
 * A group without a ticket is deleted instead.
 */
import type { SelectionGroup } from "../types.js";
import { isTicketed } from "./ticket-lock.js";

interface HasMembership {
  groupId: string | null;
}

type ArchiveFields = Pick<SelectionGroup, "archivedAt">;

export const isArchived = (group: ArchiveFields | undefined): boolean =>
  group?.archivedAt !== undefined && group.archivedAt !== null;

/** Only a ticketed group that is still on the board can be archived. */
export const canArchive = (group: SelectionGroup): boolean =>
  isTicketed(group) && !isArchived(group);

/**
 * The group that archiving a selection archives: its own group, when that
 * group has the ticket. A selection without a ticket has none.
 */
export const archiveTargetFor = <Group extends SelectionGroup>(
  item: HasMembership,
  groups: Group[],
): Group | undefined => {
  if (item.groupId === null) return undefined;
  const group = groups.find((candidate) => candidate.id === item.groupId);
  return group && isTicketed(group) ? group : undefined;
};

/** Whether a selection sits in an archived group. */
export const isSelectionArchived = (
  item: HasMembership,
  groups: SelectionGroup[],
): boolean =>
  item.groupId !== null &&
  isArchived(groups.find((group) => group.id === item.groupId));

/** The selections and groups still on the board. */
export const activeSelections = <Item extends HasMembership>(
  items: Item[],
  groups: SelectionGroup[],
): Item[] => items.filter((item) => !isSelectionArchived(item, groups));

/** What archiving a selection would archive: its ticketed group and how many selections go with it. */
export interface ArchiveScope<Group extends SelectionGroup> {
  group: Group;
  selectionCount: number;
}

export const archiveScopeFor = <Group extends SelectionGroup>(
  item: HasMembership,
  groups: Group[],
  items: HasMembership[],
): ArchiveScope<Group> | undefined => {
  const group = archiveTargetFor(item, groups);
  if (!group || !canArchive(group)) return undefined;
  return {
    group,
    selectionCount: items.filter((other) => other.groupId === group.id).length,
  };
};
