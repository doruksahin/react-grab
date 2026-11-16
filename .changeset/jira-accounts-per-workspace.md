---
"react-grab": minor
---

Jira accounts per workspace (ADR-0027)

The sync server now decides where a workspace's tickets go: each workspace is bound to a Jira account and project, set up in the extension's settings. A host app names only the workspace.

- `SyncConfig.jiraProjectKey` is deprecated and optional. When set, it is sent only for a workspace without a Jira destination, until the cut-over, with a console warning. It will be removed in the next major version.
- `JiraPort.getSite` is replaced by `getDestination`, which returns `{ siteUrl, projectKey, signsInAs }`. `listIssueTypes`, `listLabels` and `searchUsers` take no project key, and `JiraTicketDraft` has no `projectKey`.
- The Jira routes are workspace-scoped (`/workspaces/{id}/jira/…`). A failed Jira request throws a `SyncHttpError` with a `code` (for example `jira-account-rejected`, `jira-destination-missing`), and the create-ticket dialog shows the reason and keeps Create disabled.
- The create-ticket dialog names the account: "Into SCRUM on acme.atlassian.net, as Ada".
- Release note: give every workspace a Jira destination before the browser extension with this change ships, because the extension no longer stores a project key. Host apps that still pass `jiraProjectKey` keep working until the cut-over.
- `react-grab/sync-http` exports `createHttpJiraAdminPort`, for the extension's service worker only; it needs the admin token.
