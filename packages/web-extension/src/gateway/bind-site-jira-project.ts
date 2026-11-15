import type { JiraPort } from "react-grab/sync-http";
import type { SiteSettings } from "../settings/types.js";

/**
 * Replaces every Jira project key the page sent with the site's own, so a
 * page can only list, search and create in the project its site is bound to.
 */
export const bindSiteJiraProject = (
  method: keyof JiraPort,
  args: ReadonlyArray<unknown>,
  site: SiteSettings,
): ReadonlyArray<unknown> => {
  const [firstArgument, secondArgument] = args;
  switch (method) {
    case "listIssueTypes":
    case "listLabels":
      return [site.jiraProjectKey];
    case "searchUsers":
      return [firstArgument, site.jiraProjectKey];
    case "createTicket":
      return typeof secondArgument === "object" && secondArgument !== null
        ? [
            firstArgument,
            { ...secondArgument, projectKey: site.jiraProjectKey },
          ]
        : args;
    default:
      return args;
  }
};
