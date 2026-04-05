// packages/react-grab/src/features/sidebar/jira-types.ts
import type { SelectionGroup } from "../selection-groups/types.js";

/**
 * Client-only extension of SelectionGroup with JIRA tracking fields.
 * These fields are NOT persisted to the server — they live in Sidebar's
 * local signal and reset on page refresh.
 */
export type SelectionGroupWithJira = SelectionGroup & {
  /** Set to true when polling detects statusCategory === "done" */
  jiraResolved?: boolean;
  /** Raw JIRA status name, e.g. "In Progress" */
  jiraStatus?: string;
  /** JIRA status category, e.g. "In Progress", "Done", "To Do" */
  jiraStatusCategory?: string;
  /** Full JIRA ticket URL, e.g. "https://company.atlassian.net/browse/ATT-123" */
  jiraUrl?: string;
};
