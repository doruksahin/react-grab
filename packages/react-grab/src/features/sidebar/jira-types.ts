// packages/react-grab/src/features/sidebar/jira-types.ts
import type { SelectionGroup } from "../selection-groups/types.js";

/**
 * Extension of SelectionGroup with JIRA tracking fields.
 * jiraResolved is persisted (lives on SelectionGroup base type).
 * jiraStatus / jiraStatusCategory / jiraUrl are session-only — they
 * live in Sidebar's local signal and reset on page refresh.
 */
export type SelectionGroupWithJira = SelectionGroup & {
  /** Raw JIRA status name, e.g. "In Progress" */
  jiraStatus?: string;
  /** JIRA status category, e.g. "In Progress", "Done", "To Do" */
  jiraStatusCategory?: string;
  /** Full JIRA ticket URL, e.g. "https://company.atlassian.net/browse/ATT-123" */
  jiraUrl?: string;
  /** JIRA assignee display name, null if unassigned */
  jiraAssignee?: string | null;
  /** JIRA reporter display name, null if unknown */
  jiraReporter?: string | null;
  /** Avatar URL (48×48) for the Jira assignee, null if unassigned or unavailable */
  jiraAssigneeAvatar?: string | null;
  /** Avatar URL (48×48) for the Jira reporter, null if unavailable */
  jiraReporterAvatar?: string | null;
  /** JIRA labels array, e.g. ["UI Ticket Manager", "frontend"] */
  jiraLabels?: string[];
};
