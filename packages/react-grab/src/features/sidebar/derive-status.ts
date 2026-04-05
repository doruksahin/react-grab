import type { SelectionGroup } from "../selection-groups/types";
import type { CommentItem } from "../../types";

export type GroupStatus = "open" | "ticketed" | "resolved";

export interface GroupedEntry {
  group: SelectionGroup;
  items: CommentItem[];
}

/**
 * Phase 1: derives status from jiraTicketId only.
 * Phase 3 will add a jiraStatusMap parameter for resolved detection.
 */
export function deriveStatus(entry: GroupedEntry): GroupStatus {
  if (!entry.group.jiraTicketId) return "open";
  // Phase 3: check jiraStatusMap.get(group.jiraTicketId) === 'done' → 'resolved'
  return "ticketed";
}
