import type { SelectionGroupWithJira } from "./jira-types.js";

/**
 * The Jira site's host name (e.g. "acme.atlassian.net"), taken from the
 * ticket links the sync server already returned for ticketed groups. Null
 * when no group has a ticket link yet.
 */
export const getJiraSiteHost = (
  groups: Pick<SelectionGroupWithJira, "jiraUrl">[],
): string | null => {
  for (const group of groups) {
    if (!group.jiraUrl) continue;
    try {
      return new URL(group.jiraUrl).host;
    } catch {
      continue;
    }
  }
  return null;
};
