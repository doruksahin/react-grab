import type { SelectionGroup } from "../../features/selection-groups/types.js";

// A real group is archived and restored as a whole and the label says so; a
// loose selection's own synthetic group is just that selection (ADR-0030).
const commentCount = (count: number): string =>
  `${count} ${count === 1 ? "comment" : "comments"}`;

const scopeText = (group: SelectionGroup, selectionCount: number): string =>
  group.synthetic ? "" : ` group (${commentCount(selectionCount)})`;

/** "Archive", or "Archive group (3 comments)" for a real group. */
export const archiveLabel = (
  group: SelectionGroup,
  selectionCount: number,
): string => `Archive${scopeText(group, selectionCount)}`;

/** "Restore", or "Restore group (3 comments)". */
export const restoreLabel = (
  group: SelectionGroup,
  selectionCount: number,
): string => `Restore${scopeText(group, selectionCount)}`;

/** How a toast names a group: its ticket key, else its name. */
export const groupTitle = (group: SelectionGroup): string =>
  group.jiraTicketId ?? group.name;

/** "Delete group (3 comments)": an archived group goes with its comments. */
export const deleteGroupLabel = (selectionCount: number): string =>
  `Delete group (${commentCount(selectionCount)})`;
