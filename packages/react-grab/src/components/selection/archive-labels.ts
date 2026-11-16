import type { SelectionGroup } from "../../features/selection-groups/types.js";

// A real group's comments share one ticket, so they are archived and
// restored together and the label says so; a loose comment's own ticket is
// just that comment (ADR-0030).
const scopeText = (group: SelectionGroup, selectionCount: number): string =>
  group.synthetic
    ? ""
    : ` group (${selectionCount} ${selectionCount === 1 ? "comment" : "comments"})`;

/** "Archive", or "Archive group (3 comments)" when the ticket is a group's. */
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
