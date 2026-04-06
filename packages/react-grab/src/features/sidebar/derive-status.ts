// packages/react-grab/src/features/sidebar/derive-status.ts
import type { SelectionGroup } from "../selection-groups/types.js";
import type { CommentItem, GroupStatus } from "../../types.js";
import type { SelectionGroupWithJira } from "./jira-types.js";

export type { GroupStatus };

export interface GroupedEntry {
  group: SelectionGroup;
  items: CommentItem[];
}

/**
 * Derives the display status of a group.
 * - "open": no JIRA ticket
 * - "ticketed": has a ticket, not yet done
 * - "resolved": ticket done (jiraResolved = true, set by polling)
 */
export function deriveStatus(group: SelectionGroupWithJira): GroupStatus {
  if (!group.jiraTicketId) return "open";
  if (group.jiraResolved) return "resolved";
  return "ticketed";
}

/**
 * Derives status from a GroupedEntry (used by filter tabs and stats bar).
 * Delegates to deriveStatus on the group.
 */
export function deriveEntryStatus(entry: GroupedEntry): GroupStatus {
  return deriveStatus(entry.group as SelectionGroupWithJira);
}
