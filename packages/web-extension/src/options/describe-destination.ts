import type {
  JiraAccountSummary,
  WorkspaceSummary,
} from "react-grab/sync-http";
import { siteHost } from "./site-host.js";

/** "SCRUM on acme.atlassian.net, as Ada", or why there is none (ADR-0027). */
export const describeDestination = (
  workspace: WorkspaceSummary,
  accounts: ReadonlyArray<JiraAccountSummary>,
): string => {
  if (!workspace.jiraAccountId || !workspace.jiraProjectKey) {
    return "No Jira destination yet";
  }
  const account = accounts.find(
    (candidate) => candidate.id === workspace.jiraAccountId,
  );
  const site = workspace.siteUrl ? siteHost(workspace.siteUrl) : "Jira";
  return account
    ? `${workspace.jiraProjectKey} on ${site}, as ${account.displayName}`
    : `${workspace.jiraProjectKey} on ${site}`;
};
